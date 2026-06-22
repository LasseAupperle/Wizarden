import { describe, expect, it } from 'vitest';
import { BASE_DECK_SIZE, ROUNDS_BY_PLAYER_COUNT, roundsForPlayerCount } from './constants.js';
import { SUITS, SPECIAL_TYPES } from './cards.js';

describe('shared contracts', () => {
  it('base deck size is 60', () => {
    expect(BASE_DECK_SIZE).toBe(60);
  });

  it('every supported player count divides 60 evenly', () => {
    for (const [players, rounds] of Object.entries(ROUNDS_BY_PLAYER_COUNT)) {
      expect(Number(players) * rounds).toBe(60);
    }
  });

  it('roundsForPlayerCount matches the table and throws otherwise', () => {
    expect(roundsForPlayerCount(3)).toBe(20);
    expect(roundsForPlayerCount(6)).toBe(10);
    expect(() => roundsForPlayerCount(7)).toThrow();
  });

  it('exposes 4 suits and 9 special types', () => {
    expect(SUITS).toHaveLength(4);
    expect(SPECIAL_TYPES).toHaveLength(9);
  });
});
