// Trick mechanics for the BASE game (number / Wizard / Jester). PURE.
//
// Phase 3 extends this file into the full ordered resolver that drives the
// CardBehavior plug-ins (bomb/juggler/cloud/witch + special ranking). The base
// winner logic here is the foundation those behaviors compose onto.

import { type Card, type Suit, type TrickPlay } from '@wizarden/shared';

export interface LedSuitInfo {
  /** The suit that must be followed this trick, or null if none is established. */
  ledSuit: Suit | null;
  /** True once a Wizard (played before any number) freed everyone from following. */
  freed: boolean;
}

/**
 * Determine the suit-to-follow from the cards played so far, in play order.
 * - A Wizard played before any number frees the trick (no follow constraint).
 * - The first number card locks the led suit for the remainder of the trick.
 * - Jesters have no effect on the led suit.
 */
export function computeLedSuit(trick: readonly TrickPlay[]): LedSuitInfo {
  for (const play of trick) {
    const c = play.card;
    if (c.kind === 'wizard') return { ledSuit: null, freed: true };
    if (c.kind === 'number') return { ledSuit: c.suit, freed: false };
    // jester: keep scanning. (specials handled in Phase 3)
  }
  return { ledSuit: null, freed: false };
}

/** Does the hand hold any card of the given suit (a number card of that suit)? */
function hasSuit(hand: readonly Card[], suit: Suit): boolean {
  return hand.some((c) => c.kind === 'number' && c.suit === suit);
}

/**
 * Is playing `card` from `hand` legal given the cards already in the trick?
 * Wizards/Jesters are always legal. Otherwise you must follow the led suit when
 * you hold it; if the suit is free/unestablished, anything goes.
 */
export function isLegalPlay(
  hand: readonly Card[],
  card: Card,
  trick: readonly TrickPlay[],
): boolean {
  if (card.kind === 'wizard' || card.kind === 'jester') return true;
  const { ledSuit, freed } = computeLedSuit(trick);
  if (freed || ledSuit === null) return true;
  if (card.kind === 'number' && card.suit === ledSuit) return true;
  // off-suit (or trump): legal only if you cannot follow the led suit.
  return !hasSuit(hand, ledSuit);
}

function highestNumberOfSuit(trick: readonly TrickPlay[], suit: Suit): TrickPlay | null {
  let best: TrickPlay | null = null;
  let bestValue = -1;
  for (const play of trick) {
    if (play.card.kind === 'number' && play.card.suit === suit && play.card.value > bestValue) {
      best = play;
      bestValue = play.card.value;
    }
  }
  return best;
}

/**
 * Determine the winning seat of a completed BASE-game trick.
 * Order: first Wizard > highest trump > highest led-suit > first card played
 * (the all-Jesters case, where the first Jester wins).
 */
export function resolveBaseWinner(
  trick: readonly TrickPlay[],
  ledSuit: Suit | null,
  trumpSuit: Suit | null,
): number {
  if (trick.length === 0) throw new Error('cannot resolve an empty trick');

  // 1. First Wizard played.
  const wizard = trick.find((p) => p.card.kind === 'wizard');
  if (wizard) return wizard.seat;

  // 2. Highest trump (number card of the trump suit).
  if (trumpSuit) {
    const topTrump = highestNumberOfSuit(trick, trumpSuit);
    if (topTrump) return topTrump.seat;
  }

  // 3. Highest card of the led suit.
  if (ledSuit) {
    const topLed = highestNumberOfSuit(trick, ledSuit);
    if (topLed) return topLed.seat;
  }

  // 4. Only Jesters (or nothing rankable): the first card played wins.
  return trick[0]!.seat;
}
