import { afterEach, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import type { ClientGameState } from '@wizarden/shared';
import { createWizardenServer, type WizardenServer } from '../index.js';

// Mobile reconnection: empty-lobby grace period, per-room reaping, and
// rejoin failures that say WHY (server restarted / room closed / removed).

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('rejoin robustness (mobile)', () => {
  let server: WizardenServer;
  let url: string;
  const sockets: Socket[] = [];

  async function boot(lobbyGraceMs: number): Promise<void> {
    server = createWizardenServer({ roundSummaryMs: 10, lobbyGraceMs, trickHoldMs: 0 });
    url = `http://localhost:${await server.listen(0)}`;
  }
  afterEach(async () => {
    for (const s of sockets) s.close();
    sockets.length = 0;
    await server.close();
  });

  async function connect(): Promise<Socket> {
    const s = ioClient(url, { transports: ['websocket'], forceNew: true });
    sockets.push(s);
    await new Promise<void>((res) => s.on('connect', () => res()));
    return s;
  }
  function once<T>(s: Socket, ev: string): Promise<T> {
    return new Promise((res) => s.once(ev, (p: T) => res(p)));
  }
  async function createRoom(name = 'Host') {
    const s = await connect();
    const p = once<{ code: string; token: string }>(s, 'room:created');
    s.emit('room:create', { name });
    return { s, ...(await p) };
  }
  async function rejoin(token: string) {
    const s = await connect();
    const ok = once<{ state: ClientGameState }>(s, 'room:joined').then((p) => ({
      ok: true as const,
      state: p.state,
    }));
    const err = once<{ code: string }>(s, 'error').then((e) => ({
      ok: false as const,
      code: e.code,
    }));
    s.emit('room:rejoin', { token });
    return Promise.race([ok, err]);
  }

  it('host backgrounds the tab to share the link: the lobby survives and they rejoin', async () => {
    await boot(10_000);
    const host = await createRoom();
    host.s.close(); // the only player drops (tab backgrounded)
    await sleep(50);
    expect(server.roomManager.get(host.code)).toBeDefined();

    // a friend can still join by code meanwhile
    const friend = await connect();
    const joined = once<{ code: string }>(friend, 'room:joined');
    friend.emit('room:join', { name: 'Bob', code: host.code });
    expect((await joined).code).toBe(host.code);

    const back = await rejoin(host.token);
    expect(back.ok).toBe(true);
  });

  it('an empty lobby closes after the grace period; rejoin then says ROOM_CLOSED', async () => {
    await boot(100);
    const host = await createRoom();
    host.s.close();
    await sleep(250);
    expect(server.roomManager.get(host.code)).toBeUndefined();
    expect(await rejoin(host.token)).toEqual({ ok: false, code: 'ROOM_CLOSED' });
  });

  it('a lobby closes immediately once everyone has left on purpose', async () => {
    await boot(10_000);
    const host = await createRoom();
    host.s.emit('room:leave', {});
    await sleep(50);
    expect(server.roomManager.get(host.code)).toBeUndefined();
  });

  it('an unknown token (server restarted, memory wiped) says SERVER_RESTARTED', async () => {
    await boot(10_000);
    expect(await rejoin('00000000-0000-4000-8000-000000000000')).toEqual({
      ok: false,
      code: 'SERVER_RESTARTED',
    });
  });

  it('another lobby emptying never reaps a started game whose players are all offline', async () => {
    await boot(50);
    // a started game, everyone briefly offline
    const host = await createRoom('A');
    const others = [await connect(), await connect()];
    for (const [i, o] of others.entries()) {
      const j = once(o, 'room:joined');
      o.emit('room:join', { name: `P${i}`, code: host.code });
      await j;
    }
    host.s.emit('game:start', {});
    await sleep(50);
    expect(server.roomManager.get(host.code)?.started).toBe(true);
    host.s.close();
    for (const o of others) o.close();
    await sleep(50);

    // an unrelated lobby empties and is reaped
    const other = await createRoom('Z');
    other.s.close();
    await sleep(200);
    expect(server.roomManager.get(other.code)).toBeUndefined();
    expect(server.roomManager.get(host.code)).toBeDefined();
    expect((await rejoin(host.token)).ok).toBe(true);
  });
});
