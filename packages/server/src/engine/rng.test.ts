import { describe, expect, it } from 'vitest';
import { createRng, seedFromString } from './rng.js';

describe('createRng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces floats in [0, 1)', () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n) stays within [0, n)', () => {
    const r = createRng(2);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('shuffle does not mutate input and preserves the multiset', () => {
    const r = createRng(3);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = r.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); // unchanged
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it('state can be snapshotted and restored to continue the same stream', () => {
    const r = createRng(777);
    r.next();
    r.next();
    const snapshot = r.getState();
    const continued = [r.next(), r.next(), r.next()];
    const restored = createRng(snapshot);
    expect([restored.next(), restored.next(), restored.next()]).toEqual(continued);
  });

  it('seedFromString is stable and 32-bit', () => {
    const s = seedFromString('ABCD');
    expect(s).toBe(seedFromString('ABCD'));
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
    expect(seedFromString('ABCD')).not.toBe(seedFromString('ABCE'));
  });
});
