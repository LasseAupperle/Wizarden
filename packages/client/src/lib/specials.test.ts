import { describe, expect, it } from 'vitest';
import { ALL_SPECIALS, SPECIAL_META, toggleSpecial } from './specials.js';

describe('toggleSpecial', () => {
  it('adds and removes a normal special', () => {
    expect(toggleSpecial([], 'bomb')).toEqual(['bomb']);
    expect(toggleSpecial(['bomb'], 'bomb')).toEqual([]);
  });

  it('keeps Dragon and Fairy paired (adding one adds both)', () => {
    const on = toggleSpecial([], 'dragon');
    expect(on).toContain('dragon');
    expect(on).toContain('fairy');
  });

  it('removing one of the pair removes both', () => {
    const off = toggleSpecial(['dragon', 'fairy'], 'fairy');
    expect(off).not.toContain('dragon');
    expect(off).not.toContain('fairy');
  });

  it('has metadata + an emblem for all 9 specials', () => {
    expect(ALL_SPECIALS).toHaveLength(9);
    for (const s of ALL_SPECIALS) {
      expect(SPECIAL_META[s].name.length).toBeGreaterThan(0);
      expect(SPECIAL_META[s].emblem.length).toBeGreaterThan(0);
    }
  });
});
