import { describe, expect, it } from 'vitest';
import { InMemoryLeaderboard } from './leaderboard.js';

describe('InMemoryLeaderboard', () => {
  it('scores a full-game win as 1 point and a half-game win as 0.5', () => {
    const lb = new InMemoryLeaderboard();
    lb.recordWin(['Alice'], 1);
    lb.recordWin(['Bob'], 0.5);
    const byName = Object.fromEntries(lb.all().map((e) => [e.name, e]));
    expect(byName['Alice']!.points).toBe(1);
    expect(byName['Bob']!.points).toBe(0.5);
    expect(byName['Alice']!.wins).toBe(1);
  });

  it('accumulates across games and is case-insensitive on name', () => {
    const lb = new InMemoryLeaderboard();
    lb.recordWin(['Alice'], 1);
    lb.recordWin(['alice'], 0.5);
    expect(lb.all()).toHaveLength(1);
    expect(lb.all()[0]!.points).toBe(1.5);
    expect(lb.all()[0]!.wins).toBe(2);
  });

  it('records every co-winner of a tie', () => {
    const lb = new InMemoryLeaderboard();
    lb.recordWin(['A', 'B'], 1);
    expect(lb.all()).toHaveLength(2);
    expect(lb.all().every((e) => e.points === 1)).toBe(true);
  });

  it('top(n) returns the highest n, sorted by points desc', () => {
    const lb = new InMemoryLeaderboard();
    for (let i = 0; i < 7; i++) lb.recordWin([`P${i}`], i); // P0..P6 with 0..6 points
    const top5 = lb.top(5);
    expect(top5).toHaveLength(5);
    expect(top5.map((e) => e.name)).toEqual(['P6', 'P5', 'P4', 'P3', 'P2']);
  });

  it('ignores blank names', () => {
    const lb = new InMemoryLeaderboard();
    lb.recordWin(['', '  '], 1);
    expect(lb.all()).toHaveLength(0);
  });
});
