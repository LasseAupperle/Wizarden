import { beforeEach, describe, expect, it, vi } from 'vitest';

// A controllable fake Socket.IO client: no network, just records calls.
const fake = vi.hoisted(() => {
  type Handler = (...a: unknown[]) => void;
  const handlers = new Map<string, Handler[]>();
  const managerHandlers = new Map<string, Handler[]>();
  const sock = {
    connected: false,
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: (ev: string, h: Handler) => void handlers.set(ev, [...(handlers.get(ev) ?? []), h]),
    io: {
      on: (ev: string, h: Handler) =>
        void managerHandlers.set(ev, [...(managerHandlers.get(ev) ?? []), h]),
    },
    fire: (ev: string, ...a: unknown[]) => handlers.get(ev)?.forEach((h) => h(...a)),
  };
  return { sock };
});
vi.mock('socket.io-client', () => ({ io: () => fake.sock }));

import { ClientEvents } from '@wizarden/shared';
import { STALE_CONNECTION_MS, getSocket, intents } from './socket.js';
import { useGameStore } from '../store/gameStore.js';

describe('socket: mobile reconnection behaviour', () => {
  beforeEach(() => {
    getSocket(); // registers listeners once (singleton)
    fake.sock.emit.mockClear();
    fake.sock.connect.mockClear();
    fake.sock.disconnect.mockClear();
    useGameStore.setState({ toasts: [] });
  });

  it('drops in-room actions while offline and tells the player (no replay before rejoin)', () => {
    fake.sock.connected = false;
    intents.bid(2);
    intents.play('c1', { type: 'none' });
    expect(fake.sock.emit).not.toHaveBeenCalled();
    expect(useGameStore.getState().toasts.at(-1)?.text).toMatch(/offline/i);
  });

  it('still lets Create/Join queue while connecting (e.g. server waking up)', () => {
    fake.sock.connected = false;
    intents.createRoom('Alice');
    expect(fake.sock.emit).toHaveBeenCalledWith(ClientEvents.roomCreate, { name: 'Alice' });
  });

  it('sends normally when connected', () => {
    fake.sock.connected = true;
    intents.bid(1);
    expect(fake.sock.emit).toHaveBeenCalledWith(ClientEvents.gameBid, { bid: 1 });
  });

  it('on returning to the foreground with a stale (zombie) connection, reconnects fresh', () => {
    vi.useFakeTimers();
    try {
      fake.sock.connected = true;
      fake.sock.fire('connect'); // last ping = now
      vi.advanceTimersByTime(STALE_CONNECTION_MS + 1000);
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(fake.sock.disconnect).toHaveBeenCalledTimes(1);
      expect(fake.sock.connect).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not reconnect a healthy connection on foreground', () => {
    fake.sock.connected = true;
    fake.sock.fire('connect');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fake.sock.disconnect).not.toHaveBeenCalled();
  });

  it('when the network changes (online event), starts a fresh connection', () => {
    fake.sock.connected = true;
    window.dispatchEvent(new Event('online'));
    expect(fake.sock.disconnect).toHaveBeenCalledTimes(1);
    expect(fake.sock.connect).toHaveBeenCalledTimes(1);
  });
});
