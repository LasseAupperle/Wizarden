import { describe, expect, it } from 'vitest';
import {
  ROUNDS_BY_PLAYER_COUNT,
  SUITS,
  type Card,
  type SpecialType,
} from '@wizarden/shared';
import { buildBaseDeck, buildDeck, dealRound, validateSpecials } from './deck.js';
import { createRng } from './rng.js';

function countKind(deck: Card[], kind: Card['kind']): number {
  return deck.filter((c) => c.kind === kind).length;
}

describe('buildBaseDeck', () => {
  const deck = buildBaseDeck();

  it('is exactly 60 cards', () => {
    expect(deck).toHaveLength(60);
  });

  it('has correct composition: 52 number + 4 wizard + 4 jester', () => {
    expect(countKind(deck, 'number')).toBe(52);
    expect(countKind(deck, 'wizard')).toBe(4);
    expect(countKind(deck, 'jester')).toBe(4);
  });

  it('has 13 cards (values 1..13) in each of the 4 suits', () => {
    for (const suit of SUITS) {
      const inSuit = deck.filter((c) => c.kind === 'number' && c.suit === suit);
      expect(inSuit).toHaveLength(13);
      const values = inSuit.map((c) => (c.kind === 'number' ? c.value : 0)).sort((a, b) => a - b);
      expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    }
  });

  it('has unique ids', () => {
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(deck.length);
  });
});

describe('buildDeck with specials', () => {
  it('adds the selected specials (dragon+fairy+bomb => 63)', () => {
    const deck = buildDeck(['dragon', 'fairy', 'bomb']);
    expect(deck).toHaveLength(63);
    expect(countKind(deck, 'special')).toBe(3);
  });

  it('throws when only one of Dragon/Fairy is present', () => {
    expect(() => buildDeck(['dragon'])).toThrow();
    expect(() => buildDeck(['fairy'])).toThrow();
    expect(() => buildDeck(['dragon', 'bomb'])).toThrow();
  });

  it('accepts dragon+fairy together and all 9 specials (=> 69)', () => {
    expect(() => buildDeck(['dragon', 'fairy'])).not.toThrow();
    const all: SpecialType[] = [
      'dragon',
      'fairy',
      'bomb',
      'werewolf',
      'juggler',
      'cloud',
      'witch',
      'vampire',
      'shapeshifter',
    ];
    expect(buildDeck(all)).toHaveLength(69);
  });

  it('validateSpecials de-duplicates and throws on unknown', () => {
    expect(validateSpecials(['bomb', 'bomb'])).toEqual(['bomb']);
    // @ts-expect-error — testing runtime guard against an invalid type
    expect(() => validateSpecials(['nope'])).toThrow();
  });
});

describe('dealRound', () => {
  it('gives every player n cards and the pile holds the rest', () => {
    const deck = buildBaseDeck();
    const rng = createRng(123);
    const { hands, pile, trumpCard } = dealRound(deck, rng, 4, 5);
    expect(hands).toHaveLength(4);
    for (const h of hands) expect(h).toHaveLength(5);
    // 60 - (4*5) = 40 remaining; 1 becomes trump, 39 in pile.
    expect(trumpCard).not.toBeNull();
    expect(pile).toHaveLength(39);
    // No card appears twice across hands + trump + pile.
    const all = [...hands.flat(), ...(trumpCard ? [trumpCard] : []), ...pile];
    expect(new Set(all.map((c) => c.id)).size).toBe(60);
  });

  it('is deterministic: same seed reproduces identical hands + flipped card', () => {
    const deck = buildDeck(['dragon', 'fairy', 'bomb']);
    const a = dealRound(deck, createRng(999), 4, 7);
    const b = dealRound(deck, createRng(999), 4, 7);
    expect(a.hands.map((h) => h.map((c) => c.id))).toEqual(b.hands.map((h) => h.map((c) => c.id)));
    expect(a.trumpCard?.id).toBe(b.trumpCard?.id);
    expect(a.pile.map((c) => c.id)).toEqual(b.pile.map((c) => c.id));
  });

  it('different seeds produce different deals', () => {
    const deck = buildBaseDeck();
    const a = dealRound(deck, createRng(1), 3, 5);
    const b = dealRound(deck, createRng(2), 3, 5);
    expect(a.hands.map((h) => h.map((c) => c.id))).not.toEqual(
      b.hands.map((h) => h.map((c) => c.id)),
    );
  });

  it('throws if not enough cards', () => {
    const deck = buildBaseDeck();
    expect(() => dealRound(deck, createRng(1), 6, 11)).toThrow(); // 66 > 60
  });
});

describe('final round empties the base deck for every player count', () => {
  for (const [playersStr, rounds] of Object.entries(ROUNDS_BY_PLAYER_COUNT)) {
    const players = Number(playersStr);
    it(`${players} players: base final round (${rounds} cards each) -> no trump, empty pile`, () => {
      const base = buildBaseDeck();
      const { hands, pile, trumpCard } = dealRound(base, createRng(42), players, rounds);
      expect(players * rounds).toBe(60);
      for (const h of hands) expect(h).toHaveLength(rounds);
      expect(trumpCard).toBeNull();
      expect(pile).toHaveLength(0);
    });

    it(`${players} players: extended final round still flips a trump (specials remain)`, () => {
      const deck = buildDeck(['dragon', 'fairy', 'bomb']); // 63
      const { pile, trumpCard } = dealRound(deck, createRng(42), players, rounds);
      expect(trumpCard).not.toBeNull();
      // 63 - 60 = 3 leftover; 1 trump + 2 pile
      expect(pile).toHaveLength(2);
    });
  }
});

describe('re-deal same round number to fewer players (mid-game departure)', () => {
  it('4-player round 15 re-dealt to 3 players succeeds with a larger leftover pile', () => {
    const base = buildBaseDeck();
    const rng = createRng(7);
    // full 4-player final round: 60 cards dealt, pile empty
    const four = dealRound(base, rng, 4, 15);
    expect(four.pile).toHaveLength(0);
    expect(four.trumpCard).toBeNull();
    // same round number to 3 players: 45 dealt -> 15 leftover (1 trump + 14 pile)
    const three = dealRound(base, createRng(7), 3, 15);
    for (const h of three.hands) expect(h).toHaveLength(15);
    expect(three.trumpCard).not.toBeNull();
    expect(three.pile).toHaveLength(14);
  });
});
