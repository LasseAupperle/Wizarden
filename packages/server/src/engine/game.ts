// Game aggregate — the engine's public API. PURE: every transition takes a state
// + an action and returns the NEXT state (or a validation error). The caller
// (server room) owns timers/IO; the engine never schedules anything itself.
//
// Each public action clones the input state, validates against it, mutates the
// clone, and returns it — the input is never modified (no aliasing surprises).

import {
  BASE_DECK_SIZE,
  ErrorCodes,
  MAX_PLAYERS,
  MIN_PLAYERS,
  MIN_PLAYERS_DEBUG,
  SUITS,
  isSpecial,
  roundsForPlayerCount,
  type Card,
  type ErrorCode,
  type PlayDecision,
  type PlayerPublic,
  type SpecialType,
  type Suit,
} from '@wizarden/shared';
import { validateSpecials } from './deck.js';
import {
  activeCount,
  clone,
  nextActiveSeat,
  playerAt,
  type EnginePlayer,
  type GameState,
} from './internalState.js';
import {
  applyChosenTrump,
  beginBidding,
  dealAndStartRound,
  recordBidAndAdvance,
  recordPlayAndAdvance,
} from './round.js';
import { continueResolution, isLegalPlay, makeCtx } from './resolve.js';

export interface EngineError {
  code: ErrorCode;
  message: string;
}

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: EngineError };

const fail = (code: ErrorCode, message: string): ActionResult => ({
  ok: false,
  error: { code, message },
});

export interface NewGamePlayer {
  seat: number;
  name: string;
  isBot?: boolean;
  isHost?: boolean;
}

export interface CreateGameParams {
  roomCode: string;
  players: NewGamePlayer[];
  selectedSpecials?: SpecialType[];
  seed: number;
}

/** Rounds for a game's initial player count (60 / players; table-backed for 3-6). */
export function totalRoundsForCount(count: number): number {
  if (count >= 3) return roundsForPlayerCount(count);
  if (BASE_DECK_SIZE % count !== 0) {
    throw new Error(`player count ${count} does not divide ${BASE_DECK_SIZE}`);
  }
  return BASE_DECK_SIZE / count; // 2 players (debug) -> 30
}

/** Start a fresh game: fix seats, set round count, deal + resolve round 1. */
export function createGame(params: CreateGameParams): GameState {
  const players = [...params.players].sort((a, b) => a.seat - b.seat);
  const count = players.length;
  if (count < MIN_PLAYERS_DEBUG || count > MAX_PLAYERS) {
    throw new Error(`unsupported player count: ${count}`);
  }

  const enginePlayers: EnginePlayer[] = players.map((p) => ({
    seat: p.seat,
    name: p.name,
    isBot: p.isBot ?? false,
    isHost: p.isHost ?? false,
    connected: true,
    inPlay: true,
    hand: [],
    bid: null,
    tricksWon: 0,
    totalScore: 0,
  }));

  const state: GameState = {
    roomCode: params.roomCode,
    phase: 'dealing',
    players: enginePlayers,
    initialPlayerCount: count,
    totalRounds: totalRoundsForCount(count),
    selectedSpecials: validateSpecials(params.selectedSpecials ?? []),
    round: null,
    currentTurnSeat: null,
    startMarkerSeat: players[0]!.seat,
    decisions: {},
    rngState: params.seed >>> 0,
    scoreboard: [],
    lastRoundResult: null,
    standings: null,
  };

  dealAndStartRound(state, 1);
  return state;
}

/** Place a bid for the current bidder (0..cardsThisRound). */
export function applyBid(state: GameState, seat: number, bid: number): ActionResult {
  if (state.phase !== 'bidding') return fail(ErrorCodes.illegalMove, 'not in bidding phase');
  if (state.currentTurnSeat !== seat) return fail(ErrorCodes.notYourTurn, 'not your turn to bid');
  const round = state.round;
  if (!round) return fail(ErrorCodes.illegalMove, 'no active round');
  if (!Number.isInteger(bid) || bid < 0 || bid > round.cardsThisRound) {
    return fail(ErrorCodes.illegalMove, `bid out of range 0..${round.cardsThisRound}`);
  }

  const s = clone(state);
  recordBidAndAdvance(s, seat, bid);
  return { ok: true, state: s };
}

function normalizePlayDecision(
  card: Card,
  decision: PlayDecision,
): { ok: true; decision: PlayDecision } | { ok: false; error: EngineError } {
  if (isSpecial(card, 'shapeshifter')) {
    if (decision.type !== 'shapeshifter' || (decision.as !== 'wizard' && decision.as !== 'jester')) {
      return {
        ok: false,
        error: { code: ErrorCodes.invalidDecision, message: 'shapeshifter must declare wizard|jester' },
      };
    }
    return { ok: true, decision };
  }
  if (isSpecial(card, 'juggler') || isSpecial(card, 'cloud')) {
    if (decision.type !== 'announceSuit' || !SUITS.includes(decision.suit)) {
      return {
        ok: false,
        error: { code: ErrorCodes.invalidDecision, message: 'juggler/cloud must announce a suit' },
      };
    }
    return { ok: true, decision };
  }
  return { ok: true, decision: { type: 'none' } };
}

/** Play a card for the current player (must be legal; carries its PlayDecision). */
export function applyPlay(
  state: GameState,
  seat: number,
  cardId: string,
  decision: PlayDecision = { type: 'none' },
): ActionResult {
  if (state.phase !== 'trick') return fail(ErrorCodes.illegalMove, 'not in trick phase');
  if (state.currentTurnSeat !== seat) return fail(ErrorCodes.notYourTurn, 'not your turn to play');
  const round = state.round;
  if (!round) return fail(ErrorCodes.illegalMove, 'no active round');

  const player = playerAt(state, seat);
  if (!player) return fail(ErrorCodes.illegalMove, 'unknown seat');
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) return fail(ErrorCodes.illegalMove, 'card not in hand');

  const norm = normalizePlayDecision(card, decision);
  if (!norm.ok) return { ok: false, error: norm.error };

  const ctx = makeCtx(state);
  if (!isLegalPlay(player.hand, card, round.currentTrick, ctx)) {
    return fail(ErrorCodes.illegalMove, 'must follow the led suit');
  }

  const s = clone(state);
  recordPlayAndAdvance(s, seat, cardId, norm.decision);
  return { ok: true, state: s };
}

// ---- decision resolution (game:resolve) ----

export type ResolvePayload =
  | { suit: Suit | null }
  | { delta: 1 | -1 }
  | { takeId: string; giveId: string }
  | { cardId: string };

/** Resolve the outstanding decision owned by `seat`, dispatching on its kind. */
export function applyResolve(state: GameState, seat: number, payload: ResolvePayload): ActionResult {
  const decision = state.decisions[seat];
  if (!decision) return fail(ErrorCodes.invalidDecision, 'no outstanding decision for this seat');

  switch (decision.kind) {
    case 'chooseTrump':
      return resolveChooseTrump(state, seat, payload);
    case 'werewolfSwap':
      return resolveWerewolf(state, seat, payload);
    case 'cloudAdjust':
      return resolveCloud(state, seat, payload);
    case 'witchSwap':
      return resolveWitch(state, seat, payload);
    case 'jugglerPass':
      return resolveJuggler(state, seat, payload);
  }
}

/** Back-compat convenience used by the base-game flow. */
export function applyChooseTrump(state: GameState, seat: number, suit: Suit): ActionResult {
  if (state.phase !== 'trumpDecision') return fail(ErrorCodes.illegalMove, 'not awaiting trump');
  return resolveChooseTrump(state, seat, { suit });
}

function resolveChooseTrump(state: GameState, seat: number, payload: ResolvePayload): ActionResult {
  const suit = 'suit' in payload ? payload.suit : undefined;
  if (suit == null || !SUITS.includes(suit)) {
    return fail(ErrorCodes.invalidDecision, 'chooseTrump requires a valid suit');
  }
  const s = clone(state);
  delete s.decisions[seat];
  applyChosenTrump(s, suit);
  return { ok: true, state: s };
}

function resolveWerewolf(state: GameState, seat: number, payload: ResolvePayload): ActionResult {
  if (!('suit' in payload)) return fail(ErrorCodes.invalidDecision, 'werewolfSwap requires suit|null');
  const suit = payload.suit;
  if (suit !== null && !SUITS.includes(suit)) {
    return fail(ErrorCodes.invalidDecision, 'invalid trump suit');
  }

  const s = clone(state);
  const holder = playerAt(s, seat)!;
  const wIdx = holder.hand.findIndex((c) => isSpecial(c, 'werewolf'));
  if (wIdx < 0) return fail(ErrorCodes.invalidDecision, 'werewolf not in hand');
  const werewolfCard = holder.hand[wIdx]!;
  holder.hand.splice(wIdx, 1);

  const flipped = s.round!.trumpCard;
  if (flipped) holder.hand.push(flipped); // holder takes the flipped card into hand
  s.round!.trumpCard = werewolfCard; // retained as the round's trump-determining card
  s.round!.trumpSuit = suit;

  delete s.decisions[seat];
  beginBidding(s);
  return { ok: true, state: s };
}

function resolveCloud(state: GameState, seat: number, payload: ResolvePayload): ActionResult {
  if (!('delta' in payload) || (payload.delta !== 1 && payload.delta !== -1)) {
    return fail(ErrorCodes.invalidDecision, 'cloudAdjust requires delta +1 or -1');
  }
  const current = playerAt(state, seat)!.bid ?? 0;
  if (current === 0 && payload.delta === -1) {
    return fail(ErrorCodes.invalidDecision, 'bid 0 may only be increased');
  }
  const s = clone(state);
  playerAt(s, seat)!.bid = current + payload.delta;
  delete s.decisions[seat];
  continueResolution(s);
  return { ok: true, state: s };
}

function resolveWitch(state: GameState, seat: number, payload: ResolvePayload): ActionResult {
  if (!('takeId' in payload) || !('giveId' in payload)) {
    return fail(ErrorCodes.invalidDecision, 'witchSwap requires takeId + giveId');
  }
  const decision = state.decisions[seat];
  if (!decision || decision.kind !== 'witchSwap') {
    return fail(ErrorCodes.invalidDecision, 'no witchSwap for this seat');
  }
  if (!decision.trickCardIds.includes(payload.takeId)) {
    return fail(ErrorCodes.invalidDecision, 'takeId is not a takeable trick card');
  }

  const s = clone(state);
  const round = s.round!;
  const holder = playerAt(s, seat)!;
  const takeIdx = round.currentTrick.findIndex((p) => p.card.id === payload.takeId);
  if (takeIdx < 0) return fail(ErrorCodes.invalidDecision, 'takeId not in trick');
  const giveIdx = holder.hand.findIndex((c) => c.id === payload.giveId);
  if (giveIdx < 0) return fail(ErrorCodes.invalidDecision, 'giveId not in hand');

  const taken = round.currentTrick[takeIdx]!.card;
  const give = holder.hand[giveIdx]!;
  holder.hand.splice(giveIdx, 1);
  holder.hand.push(taken);
  // the placed card has no effect; it just sits in the (already-won) trick
  round.currentTrick[takeIdx] = {
    seat: round.currentTrick[takeIdx]!.seat,
    card: give,
    decision: { type: 'none' },
  };

  delete s.decisions[seat];
  continueResolution(s);
  return { ok: true, state: s };
}

function resolveJuggler(state: GameState, seat: number, payload: ResolvePayload): ActionResult {
  if (!('cardId' in payload)) return fail(ErrorCodes.invalidDecision, 'jugglerPass requires cardId');
  const holder = playerAt(state, seat)!;
  if (!holder.hand.some((c) => c.id === payload.cardId)) {
    return fail(ErrorCodes.invalidDecision, 'card not in hand');
  }

  const s = clone(state);
  s.round!.resolution!.jugglerPasses[seat] = payload.cardId;
  delete s.decisions[seat];

  const stillWaiting = Object.values(s.decisions).some((d) => d.kind === 'jugglerPass');
  if (!stillWaiting) {
    executeJugglerPass(s);
    continueResolution(s);
  }
  return { ok: true, state: s };
}

function executeJugglerPass(state: GameState): void {
  const res = state.round!.resolution!;
  const passes = res.jugglerPasses;
  const removed: Record<number, Card> = {};
  for (const seatStr of Object.keys(passes)) {
    const ps = Number(seatStr);
    const p = playerAt(state, ps)!;
    const idx = p.hand.findIndex((c) => c.id === passes[ps]);
    if (idx >= 0) {
      removed[ps] = p.hand[idx]!;
      p.hand.splice(idx, 1);
    }
  }
  // simultaneous: everyone passes to the next active seat clockwise
  for (const seatStr of Object.keys(removed)) {
    const ps = Number(seatStr);
    playerAt(state, nextActiveSeat(state, ps))!.hand.push(removed[ps]!);
  }
  res.jugglerPasses = {};
}

/**
 * Advance from roundEnd to the next round, or to gameOver after the last round.
 * The SERVER calls this after the ROUND_SUMMARY_MS delay; the engine itself has
 * no timer. Rotates the start marker one ACTIVE seat clockwise.
 */
export function advanceRound(state: GameState): ActionResult {
  if (state.phase !== 'roundEnd') return fail(ErrorCodes.illegalMove, 'not at round end');
  const round = state.round;
  if (!round) return fail(ErrorCodes.illegalMove, 'no active round');

  const s = clone(state);
  s.startMarkerSeat = nextActiveSeat(s, s.startMarkerSeat);

  if (round.roundNumber < s.totalRounds && activeCount(s) >= 1) {
    dealAndStartRound(s, round.roundNumber + 1);
  } else {
    finishGame(s);
  }
  return { ok: true, state: s };
}

/**
 * Remove a player mid-game (leave or host-removal), §7.6. With 3+ active seats
 * remaining the game continues short-handed: an in-progress round is VOIDED and
 * the SAME round number re-dealt to the remaining players (no scores recorded);
 * the original total round count is preserved and the start marker skips the
 * departed seat. Dropping below 3 active ends the game with standings.
 */
export function removePlayer(state: GameState, seat: number): ActionResult {
  const s = clone(state);
  const p = playerAt(s, seat);
  if (!p) return fail(ErrorCodes.badRequest, 'unknown seat');
  if (!p.inPlay) return { ok: true, state: s }; // already departed

  p.inPlay = false;
  p.hand = [];
  delete s.decisions[seat];

  if (activeCount(s) < MIN_PLAYERS) {
    finishGame(s);
    return { ok: true, state: s };
  }

  // Keep the start marker on an active seat.
  if (!playerAt(s, s.startMarkerSeat)?.inPlay) {
    s.startMarkerSeat = nextActiveSeat(s, s.startMarkerSeat);
  }

  // Void an in-progress round and re-deal the SAME round number to the remainder.
  const inProgress = s.phase !== 'roundEnd' && s.phase !== 'gameOver';
  if (inProgress) {
    const roundNumber = s.round?.roundNumber ?? 1;
    s.decisions = {};
    dealAndStartRound(s, roundNumber);
  }
  // (At roundEnd the round is already scored; the scheduled auto-advance deals
  //  the next round to the remaining players.)
  return { ok: true, state: s };
}

export function toPlayerPublic(p: EnginePlayer): PlayerPublic {
  return {
    seat: p.seat,
    name: p.name,
    connected: p.connected,
    inPlay: p.inPlay,
    isHost: p.isHost,
    isBot: p.isBot,
    bid: p.bid,
    tricksWon: p.tricksWon,
    handCount: p.hand.length,
    totalScore: p.totalScore,
  };
}

/** Final standings: all players (including departed) sorted by score desc. */
export function standings(state: GameState): PlayerPublic[] {
  return [...state.players].map(toPlayerPublic).sort((a, b) => b.totalScore - a.totalScore);
}

function finishGame(state: GameState): void {
  state.phase = 'gameOver';
  state.currentTurnSeat = null;
  state.decisions = {};
  state.standings = standings(state);
}
