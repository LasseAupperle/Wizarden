// Round lifecycle: deal -> trump -> (pre-bid) -> bidding -> tricks -> scoring.
// PURE. Functions here MUTATE a state object the caller already cloned; they
// never clone or perform IO. game.ts owns validation + cloning + the public API.

import type { RoundResult, Suit } from '@wizarden/shared';
import { buildDeck, dealRound } from './deck.js';
import {
  activeCount,
  activeSeats,
  biddingOrder,
  playerAt,
  type GameState,
} from './internalState.js';
import { createRng } from './rng.js';
import { scoreRound } from './scoring.js';
import { computeLedSuit, resolveBaseWinner } from './trick.js';

/** Deal `roundNumber` cards to each active player, flip trump, resolve trump. */
export function dealAndStartRound(state: GameState, roundNumber: number): void {
  const seats = activeSeats(state);
  const rng = createRng(state.rngState);
  const deck = buildDeck(state.selectedSpecials);
  const { hands, pile, trumpCard } = dealRound(deck, rng, seats.length, roundNumber);
  state.rngState = rng.getState();

  // Reset per-round player fields; assign hands to active seats in order.
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

  resolveTrumpOnFlip(state);
}

/** Apply the trump-on-flip mapping for the BASE deck (number/Wizard/Jester). */
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
    // Start-marker holder chooses the trump colour.
    state.phase = 'trumpDecision';
    state.currentTurnSeat = null;
    state.decisions[state.startMarkerSeat] = { kind: 'chooseTrump', seat: state.startMarkerSeat };
    return;
  }
  // Special trump cards are introduced in Phase 3 (registry-driven).
  throw new Error(`trump-on-flip not implemented for ${tc.kind} in the base engine`);
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
  decision: { type: 'none' },
): void {
  const round = state.round!;
  const player = playerAt(state, seat)!;
  const cardIdx = player.hand.findIndex((c) => c.id === cardId);
  const card = player.hand[cardIdx]!;
  player.hand.splice(cardIdx, 1);
  round.currentTrick.push({ seat, card, decision });

  if (round.currentTrick.length === activeCount(state)) {
    finishTrick(state);
  } else {
    state.currentTurnSeat = nextActiveAfter(state, seat);
  }
}

function nextActiveAfter(state: GameState, fromSeat: number): number {
  const seats = activeSeats(state);
  for (const s of seats) if (s > fromSeat) return s;
  return seats[0]!;
}

/** Resolve a completed BASE trick: award it, then continue or score the round. */
export function finishTrick(state: GameState): void {
  const round = state.round!;
  const { ledSuit } = computeLedSuit(round.currentTrick);
  const winner = resolveBaseWinner(round.currentTrick, ledSuit, round.trumpSuit);
  playerAt(state, winner)!.tricksWon += 1;
  round.leadSeat = winner;

  const cardsRemain = activeSeats(state).some((s) => playerAt(state, s)!.hand.length > 0);
  if (cardsRemain) {
    round.trickNumber += 1;
    round.currentTrick = [];
    state.phase = 'trick';
    state.currentTurnSeat = winner;
  } else {
    scoreRoundAndEnd(state);
  }
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
