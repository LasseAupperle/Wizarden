// Round lifecycle: deal -> trump -> (pre-bid) -> bidding -> tricks -> scoring.
// PURE. Functions here MUTATE a state object the caller already cloned; they
// never clone or perform IO. game.ts owns validation + cloning + the public API.

import type { PlayDecision, RoundResult, Suit, TrickPlay } from '@wizarden/shared';
import { getBehavior } from './cards/registry.js';
import { buildDeck, dealRound } from './deck.js';
import {
  activeCount,
  activeSeats,
  biddingOrder,
  playerAt,
  type GameState,
} from './internalState.js';
import { createRng } from './rng.js';
import { makeCtx, resolveTrick } from './resolve.js';
import { scoreRound } from './scoring.js';

/** Deal `roundNumber` cards to each active player, flip trump, resolve trump. */
export function dealAndStartRound(state: GameState, roundNumber: number): void {
  const seats = activeSeats(state);
  const rng = createRng(state.rngState);
  const deck = buildDeck(state.selectedSpecials);
  const { hands, pile, trumpCard } = dealRound(deck, rng, seats.length, roundNumber);
  state.rngState = rng.getState();

  for (const p of state.players) {
    p.bid = null;
    p.tricksWon = 0;
    p.hand = [];
  }
  seats.forEach((seat, k) => {
    playerAt(state, seat)!.hand = hands[k]!;
  });

  state.round = {
    roundNumber,
    cardsThisRound: roundNumber,
    trumpCard,
    trumpSuit: null,
    pile,
    trickNumber: 0,
    leadSeat: -1,
    currentTrick: [],
  };
  state.decisions = {};
  state.lastRoundResult = null;
  state.phase = 'dealing';

  applyPreBidAndTrump(state);
}

/**
 * Run mandatory pre-bid steps (Werewolf swap, §7.1.3) then resolve trump-on-flip.
 * A raised pre-bid decision (Werewolf in hand) SUPERSEDES the start-marker's
 * trump choice. Extracted so tests can drive a hand-authored post-deal state.
 */
export function applyPreBidAndTrump(state: GameState): void {
  runPreBidSteps(state);
  if (Object.keys(state.decisions).length > 0) {
    state.phase = 'preBid';
    state.currentTurnSeat = null;
    return;
  }
  resolveTrumpOnFlip(state);
}

function runPreBidSteps(state: GameState): void {
  const ctx = makeCtx(state);
  for (const seat of activeSeats(state)) {
    for (const card of playerAt(state, seat)!.hand) {
      if (card.kind === 'special') getBehavior(card.special).preBid?.(ctx, seat);
    }
  }
}

/** Apply the trump-on-flip mapping (§7.3), registry-driven for specials. */
export function resolveTrumpOnFlip(state: GameState): void {
  const round = state.round!;
  const tc = round.trumpCard;

  if (tc === null || tc.kind === 'jester') {
    round.trumpSuit = null;
    beginBidding(state);
    return;
  }
  if (tc.kind === 'number') {
    round.trumpSuit = tc.suit;
    beginBidding(state);
    return;
  }
  if (tc.kind === 'wizard') {
    raiseChooseTrump(state);
    return;
  }
  // special card flipped -> ask its behavior
  const outcome = getBehavior(tc.special).onTrumpFlip();
  if (outcome.type === 'chooseTrump') {
    raiseChooseTrump(state);
  } else {
    round.trumpSuit = null;
    beginBidding(state);
  }
}

function raiseChooseTrump(state: GameState): void {
  state.phase = 'trumpDecision';
  state.currentTurnSeat = null;
  state.decisions[state.startMarkerSeat] = { kind: 'chooseTrump', seat: state.startMarkerSeat };
}

export function beginBidding(state: GameState): void {
  state.decisions = {};
  state.phase = 'bidding';
  const order = biddingOrder(state);
  state.currentTurnSeat = order[0] ?? null;
}

/** Record a (validated) bid and advance to the next bidder, or to trick play. */
export function recordBidAndAdvance(state: GameState, seat: number, bid: number): void {
  playerAt(state, seat)!.bid = bid;
  const order = biddingOrder(state);
  const idx = order.indexOf(seat);
  const nextBidder = order[idx + 1];
  if (nextBidder === undefined) {
    beginTrickPlay(state);
  } else {
    state.currentTurnSeat = nextBidder;
  }
}

export function beginTrickPlay(state: GameState): void {
  const round = state.round!;
  const order = biddingOrder(state);
  const lead = order[0]!;
  round.leadSeat = lead;
  round.trickNumber = 0;
  round.currentTrick = [];
  state.phase = 'trick';
  state.currentTurnSeat = lead;
}

/** Record a (validated, legal) card play and advance the trick. */
export function recordPlayAndAdvance(
  state: GameState,
  seat: number,
  cardId: string,
  decision: PlayDecision,
): void {
  const round = state.round!;
  const player = playerAt(state, seat)!;
  const cardIdx = player.hand.findIndex((c) => c.id === cardId);
  const card = player.hand[cardIdx]!;
  player.hand.splice(cardIdx, 1);
  const play: TrickPlay = { seat, card, decision };
  round.currentTrick.push(play);

  // Play-time identity resolution (Vampire flips a fresh trump vs. a Werewolf).
  if (card.kind === 'special') {
    getBehavior(card.special).onPlay?.(makeCtx(state), play);
  }

  // A play-time decision (Vampire's fresh-flip Wizard => choose trump) pauses the
  // trick; it resumes from this seat once the choice is resolved (see game.ts).
  if (Object.keys(state.decisions).length > 0) {
    state.phase = 'trumpDecision';
    state.currentTurnSeat = null;
    round.resumeTrickAfterTrump = true;
    return;
  }

  if (round.currentTrick.length === activeCount(state)) {
    resolveTrick(state);
  } else {
    state.currentTurnSeat = nextActiveAfter(state, seat);
  }
}

export function nextActiveAfter(state: GameState, fromSeat: number): number {
  const seats = activeSeats(state);
  for (const s of seats) if (s > fromSeat) return s;
  return seats[0]!;
}

/** Score every active player's round, update totals, enter roundEnd. */
export function scoreRoundAndEnd(state: GameState): void {
  const results: RoundResult[] = [];
  for (const seat of activeSeats(state)) {
    const p = playerAt(state, seat)!;
    const bid = p.bid ?? 0;
    const delta = scoreRound(bid, p.tricksWon);
    p.totalScore += delta;
    results.push({ seat, bid, tricksWon: p.tricksWon, delta, total: p.totalScore });
  }
  state.scoreboard.push(results);
  state.lastRoundResult = results;
  state.round!.currentTrick = [];
  state.phase = 'roundEnd';
  state.currentTurnSeat = null;
}

/** Resolve a chooseTrump decision into a concrete trump suit (or no-trump). */
export function applyChosenTrump(state: GameState, suit: Suit | null): void {
  state.round!.trumpSuit = suit;
  beginBidding(state);
}
