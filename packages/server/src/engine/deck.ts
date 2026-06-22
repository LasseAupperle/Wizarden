// Deck construction, validation, and dealing. PURE: imports only @wizarden/shared
// and the engine RNG. The full deck is reshuffled at the START of every round.

import {
  BASE_DECK_SIZE,
  JESTER_COUNT,
  SPECIAL_TYPES,
  SUITS,
  SUIT_MAX,
  SUIT_MIN,
  WIZARD_COUNT,
  type Card,
  type SpecialType,
} from '@wizarden/shared';
import type { Rng } from './rng.js';

// ---- stable card ids ----
// Number: n-<suit>-<value> · Wizard: wizard-<i> · Jester: jester-<i> · Special: special-<type>

/** Build the 60-card base deck: 4 suits x 1..13 + 4 wizards + 4 jesters. */
export function buildBaseDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (let value = SUIT_MIN; value <= SUIT_MAX; value++) {
      cards.push({ kind: 'number', id: `n-${suit}-${value}`, suit, value });
    }
  }
  for (let i = 0; i < WIZARD_COUNT; i++) cards.push({ kind: 'wizard', id: `wizard-${i}` });
  for (let i = 0; i < JESTER_COUNT; i++) cards.push({ kind: 'jester', id: `jester-${i}` });
  return cards;
}

/**
 * Validate a selected-specials list. Throws on an unknown type or when exactly
 * one of Dragon/Fairy is present (they must both be in or both out). Returns the
 * de-duplicated set in canonical order.
 */
export function validateSpecials(specials: readonly SpecialType[]): SpecialType[] {
  const seen = new Set<SpecialType>();
  for (const s of specials) {
    if (!SPECIAL_TYPES.includes(s)) {
      throw new Error(`Unknown special card: ${String(s)}`);
    }
    seen.add(s);
  }
  const hasDragon = seen.has('dragon');
  const hasFairy = seen.has('fairy');
  if (hasDragon !== hasFairy) {
    throw new Error('Dragon and Fairy must both be selected or both omitted');
  }
  // canonical order = SPECIAL_TYPES order
  return SPECIAL_TYPES.filter((s) => seen.has(s));
}

/** Build the full deck for a game: base 60 + the (validated) selected specials. */
export function buildDeck(specials: readonly SpecialType[] = []): Card[] {
  const selected = validateSpecials(specials);
  const deck = buildBaseDeck();
  for (const special of selected) {
    deck.push({ kind: 'special', id: `special-${special}`, special });
  }
  return deck;
}

export interface DealResult {
  /** hands[seat] for seat 0..playerCount-1, each `cardsPerPlayer` long. */
  hands: Card[][];
  /** Undealt cards remaining AFTER the trump card is removed (face-down pile). */
  pile: Card[];
  /** The flipped trump-determining card (top of the undealt pile), or null if none remain. */
  trumpCard: Card | null;
}

/**
 * Reshuffle the full `deck` with the injected RNG and deal `cardsPerPlayer` to
 * each of `playerCount` players, then flip the top undealt card as trump.
 *
 * Used for both the normal deal and a mid-game re-deal to fewer players (the per-
 * round card counts are unchanged, so a shorter table just leaves a larger pile).
 */
export function dealRound(
  deck: readonly Card[],
  rng: Rng,
  playerCount: number,
  cardsPerPlayer: number,
): DealResult {
  if (playerCount <= 0) throw new Error(`playerCount must be > 0, got ${playerCount}`);
  if (cardsPerPlayer < 0) throw new Error(`cardsPerPlayer must be >= 0, got ${cardsPerPlayer}`);

  const needed = playerCount * cardsPerPlayer;
  if (needed > deck.length) {
    throw new Error(
      `Not enough cards: need ${needed} (${playerCount}x${cardsPerPlayer}) but deck has ${deck.length}`,
    );
  }

  const shuffled = rng.shuffle(deck);
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);

  // Round-robin deal (mirrors a physical deal; deterministic given the shuffle).
  let idx = 0;
  for (let c = 0; c < cardsPerPlayer; c++) {
    for (let seat = 0; seat < playerCount; seat++) {
      hands[seat]!.push(shuffled[idx]!);
      idx++;
    }
  }

  const remaining = shuffled.slice(idx);
  const trumpCard = remaining.length > 0 ? remaining[0]! : null;
  const pile = remaining.slice(1);

  return { hands, pile, trumpCard };
}

/** The base deck always has exactly 60 cards — exported for assertions/tests. */
export const BASE_SIZE = BASE_DECK_SIZE;
