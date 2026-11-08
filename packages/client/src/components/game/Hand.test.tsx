import { describe, expect, it } from 'vitest';
import { layoutHand } from './Hand.js';

describe('layoutHand (fanned hand fits in 1–2 rows)', () => {
  it('lays a few cards side by side without overlap', () => {
    expect(layoutHand(4, 360, 69, 2)).toEqual({ rows: 1, perRow: 4, step: 75 });
  });

  it('fans (overlaps) cards that do not fit, keeping one row while readable', () => {
    const l = layoutHand(8, 360, 69, 2);
    expect(l.rows).toBe(1);
    expect(l.step).toBeLessThan(75);
    expect(l.step).toBeGreaterThanOrEqual(30);
    expect((l.perRow - 1) * l.step + 69).toBeLessThanOrEqual(360);
  });

  it('uses two rows for a 20-card hand on a phone, never more', () => {
    const l = layoutHand(20, 360, 69, 2);
    expect(l.rows).toBe(2);
    expect(l.perRow).toBe(10);
    expect((l.perRow - 1) * l.step + 69).toBeLessThanOrEqual(360.5);
  });

  it('fits 20 large cards in one row on a PC', () => {
    const l = layoutHand(20, 1000, 84, 2);
    expect(l.rows).toBe(1);
    expect(l.step).toBeGreaterThanOrEqual(30);
  });
});
