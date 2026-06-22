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
  MIN_PLAYERS_DEBUG,
  SUITS,
  roundsForPlayerCount,
  type ErrorCode,
  type PlayerPublic,
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
  dealAndStartRound,
  recordBidAndAdvance,
  recordPlayAndAdvance,
} from './round.js';
import { isLegalPlay } from './trick.js';

export interface EngineError {
  code: ErrorCode;
  message: string;
}

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: EngineError };

const fail = (code: ErrorCode, message: string): ActionResult => ({ ok: false, error: { code, message } });

export interface NewGamePlayer {
  seat: number;
  name: string;
  isBot?: boolean;
  isHost?: boolean;
}

export interface CreateGameParams {
  roomCode: string;
  players: NewGamePlayer[];
  selectedSpecials?: import('@wizarden/shared').SpecialType[];
  seed: number;
}

/** Rounds for a game's initial player count (60 / players; table-backed for 3-6). */
export function totalRoundsForCount(count: number): number {
  if (count >= 3) return roundsForPlayerCount(count);
  // 2 players is debug-only: 60 / 2 = 30 still divides evenly.
  if (BASE_DECK_SIZE % count !== 0) {
    throw new Error(`player count ${count} does not divide ${BASE_DECK_SIZE}`);
  }
  return BASE_DECK_SIZE / count;
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

/** Resolve a chooseTrump decision (Wizard flipped in the base game). */
export function applyChooseTrump(state: GameState, seat: number, suit: Suit): ActionResult {
  if (state.phase !== 'trumpDecision') return fail(ErrorCodes.illegalMove, 'not awaiting trump');
  const decision = state.decisions[seat];
  if (!decision || decision.kind !== 'chooseTrump') {
    return fail(ErrorCodes.invalidDecision, 'no chooseTrump decision for this seat');
  }
  if (!SUITS.includes(suit)) return fail(ErrorCodes.invalidDecision, `invalid suit: ${suit}`);

  const s = clone(state);
  delete s.decisions[seat];
  applyChosenTrump(s, suit);
  return { ok: true, state: s };
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

/** Play a card for the current player (must be legal per follow-suit rules). */
export function applyPlay(
  state: GameState,
  seat: number,
  cardId: string,
): ActionResult {
  if (state.phase !== 'trick') return fail(ErrorCodes.illegalMove, 'not in trick phase');
  if (state.currentTurnSeat !== seat) return fail(ErrorCodes.notYourTurn, 'not your turn to play');
  const round = state.round;
  if (!round) return fail(ErrorCodes.illegalMove, 'no active round');

  const player = playerAt(state, seat);
  if (!player) return fail(ErrorCodes.illegalMove, 'unknown seat');
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) return fail(ErrorCodes.illegalMove, 'card not in hand');
  if (!isLegalPlay(player.hand, card, round.currentTrick)) {
    return fail(ErrorCodes.illegalMove, 'must follow the led suit');
  }

  const s = clone(state);
  recordPlayAndAdvance(s, seat, cardId, { type: 'none' });
  return { ok: true, state: s };
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
  return [...state.players]
    .map(toPlayerPublic)
    .sort((a, b) => b.totalScore - a.totalScore);
}

function finishGame(state: GameState): void {
  state.phase = 'gameOver';
  state.currentTurnSeat = null;
  state.decisions = {};
  state.standings = standings(state);
}
