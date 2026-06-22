import { describe, expect, it } from 'vitest';
import { scoreRound } from './scoring.js';

describe('scoreRound', () => {
  it('correct bid of 0 scores 20', () => {
    expect(scoreRound(0, 0)).toBe(20);
  });
  it('correct bid of n scores 20 + 10n', () => {
    expect(scoreRound(1, 1)).toBe(30);
    expect(scoreRound(3, 3)).toBe(50);
    expect(scoreRound(5, 5)).toBe(70);
  });
  it('wrong bid loses 10 per trick off', () => {
    expect(scoreRound(2, 0)).toBe(-20);
    expect(scoreRound(0, 3)).toBe(-30);
    expect(scoreRound(4, 2)).toBe(-20);
  });
});
