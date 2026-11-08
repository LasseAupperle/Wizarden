import { afterEach, describe, expect, it, vi } from 'vitest';
import { startKeepAwake } from './keepAwake.js';
import { Room } from './rooms/room.js';

describe('keep-awake (spec §24.1)', () => {
  afterEach(() => vi.useRealTimers());

  it('pings <baseUrl>/health only while shouldStayAwake() is true, and stops', async () => {
    vi.useFakeTimers();
    const urls: string[] = [];
    let awake = true;
    const stop = startKeepAwake({
      baseUrl: 'https://example.onrender.com/',
      shouldStayAwake: () => awake,
      intervalMs: 1000,
      fetchFn: async (u) => void urls.push(u),
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(urls).toEqual([
      'https://example.onrender.com/health',
      'https://example.onrender.com/health',
    ]);
    awake = false; // nobody playing -> let the server sleep
    await vi.advanceTimersByTimeAsync(3000);
    expect(urls).toHaveLength(2);
    awake = true;
    stop();
    await vi.advanceTimersByTimeAsync(3000);
    expect(urls).toHaveLength(2);
  });

  it('a failed ping is swallowed (never throws / crashes)', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const stop = startKeepAwake({
      baseUrl: 'https://x',
      shouldStayAwake: () => true,
      intervalMs: 1000,
      fetchFn: async () => {
        calls++;
        throw new Error('network down');
      },
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls).toBe(2);
    stop();
  });
});

describe('Room.needsServer', () => {
  const GRACE = 30 * 60 * 1000;

  it('true while any human is connected (lobby included)', () => {
    const room = new Room('ABCD');
    room.addPlayer('Alice');
    expect(room.needsServer(Date.now(), GRACE)).toBe(true);
  });

  it('lobby with everyone disconnected does not keep the server awake', () => {
    const room = new Room('ABCD');
    const p = room.addPlayer('Alice');
    room.markDisconnected(p.seat);
    expect(room.needsServer(Date.now(), GRACE)).toBe(false);
  });

  it('unfinished game: stays awake within the grace window after everyone drops, then not', () => {
    const room = new Room('ABCD');
    const seats = ['A', 'B', 'C'].map((n) => room.addPlayer(n).seat);
    expect(room.start(seats[0]!).ok).toBe(true);
    for (const s of seats) room.markDisconnected(s);
    const t0 = room.lastHumanSeenAt;
    expect(room.needsServer(t0 + GRACE - 1, GRACE)).toBe(true);
    expect(room.needsServer(t0 + GRACE + 1, GRACE)).toBe(false);
  });

  it('bots alone never keep it awake', () => {
    const room = new Room('ABCD', { enableDebug: true });
    const human = room.addPlayer('A');
    expect(room.addBot().ok).toBe(true);
    room.markDisconnected(human.seat);
    expect(room.needsServer(Date.now() + 1, 0)).toBe(false);
  });
});
