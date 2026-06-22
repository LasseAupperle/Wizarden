import { describe, expect, it } from 'vitest';
import type { Card, TrickPlay } from '@wizarden/shared';
import { computeLedSuit, isLegalPlay, resolveBaseWinner } from './trick.js';

const num = (suit: Card extends { suit: infer S } ? S : never, value: number): Card =>
  ({ kind: 'number', id: `n-${suit}-${value}`, suit, value }) as Card;
const wiz = (i: number): Card => ({ kind: 'wizard', id: `wizard-${i}` });
const jes = (i: number): Card => ({ kind: 'jester', id: `jester-${i}` });
const play = (seat: number, card: Card): TrickPlay => ({ seat, card, decision: { type: 'none' } });

describe('computeLedSuit', () => {
  it('first number card locks the led suit', () => {
    expect(computeLedSuit([play(0, num('green', 5))])).toEqual({ ledSuit: 'green', freed: false });
  });
  it('a leading Wizard frees the trick (no led suit)', () => {
    expect(computeLedSuit([play(0, wiz(0)), play(1, num('red', 9))])).toEqual({
      ledSuit: null,
      freed: true,
    });
  });
  it('leading Jesters delay the lock until a number appears', () => {
    expect(computeLedSuit([play(0, jes(0)), play(1, jes(1))])).toEqual({
      ledSuit: null,
      freed: false,
    });
    expect(computeLedSuit([play(0, jes(0)), play(1, num('blue', 3))])).toEqual({
      ledSuit: 'blue',
      freed: false,
    });
  });
});

describe('isLegalPlay (follow-suit)', () => {
  const trick = [play(0, num('green', 5))]; // led green
  it('must follow the led suit when able', () => {
    const hand = [num('green', 2), num('red', 9)];
    expect(isLegalPlay(hand, num('red', 9), trick)).toBe(false);
    expect(isLegalPlay(hand, num('green', 2), trick)).toBe(true);
  });
  it('may play anything when void in the led suit', () => {
    const hand = [num('red', 9), num('blue', 4)];
    expect(isLegalPlay(hand, num('red', 9), trick)).toBe(true);
  });
  it('Wizards and Jesters are always legal', () => {
    const hand = [num('green', 2), wiz(0), jes(0)];
    expect(isLegalPlay(hand, wiz(0), trick)).toBe(true);
    expect(isLegalPlay(hand, jes(0), trick)).toBe(true);
  });
  it('leading anything is legal (empty trick)', () => {
    expect(isLegalPlay([num('red', 1)], num('red', 1), [])).toBe(true);
  });
  it('after a Wizard frees the trick, anything is legal even holding the would-be suit', () => {
    const freed = [play(0, wiz(0)), play(1, num('green', 9))];
    const hand = [num('green', 2), num('red', 9)];
    expect(isLegalPlay(hand, num('red', 9), freed)).toBe(true);
  });
});

describe('resolveBaseWinner', () => {
  it('first Wizard wins regardless of order', () => {
    const trick = [play(0, num('red', 13)), play(1, wiz(2)), play(2, wiz(3))];
    expect(resolveBaseWinner(trick, 'red', 'red')).toBe(1);
  });
  it('highest trump beats the led suit', () => {
    // led green; trump red. P2 plays red trump.
    const trick = [play(0, num('green', 13)), play(1, num('green', 2)), play(2, num('red', 4))];
    expect(resolveBaseWinner(trick, 'green', 'red')).toBe(2);
  });
  it('with no trump, highest led suit wins; off-suit cannot win', () => {
    const trick = [play(0, num('green', 7)), play(1, num('blue', 13)), play(2, num('green', 9))];
    expect(resolveBaseWinner(trick, 'green', null)).toBe(2);
  });
  it('only Jesters: first Jester played wins', () => {
    const trick = [play(0, jes(0)), play(1, jes(1)), play(2, jes(2))];
    expect(resolveBaseWinner(trick, null, 'red')).toBe(0);
  });
  it('Jester-led then numbers: highest of the locked suit wins', () => {
    const trick = [play(0, jes(0)), play(1, num('blue', 3)), play(2, num('blue', 10))];
    expect(resolveBaseWinner(trick, 'blue', null)).toBe(2);
  });
});
