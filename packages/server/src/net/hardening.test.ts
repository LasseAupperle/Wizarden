import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import type { ClientGameState } from '@wizarden/shared';
import { createWizardenServer, type WizardenServer } from '../index.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Phase 4/5 hardening — validation, rate limit, names, multi-tab (§15–17)', () => {
  let server: WizardenServer;
  let url: string;
  const clients: Socket[] = [];

  beforeEach(async () => {
    server = createWizardenServer({ roundSummaryMs: 10 });
    url = `http://localhost:${await server.listen(0)}`;
  });
  afterEach(async () => {
    for (const c of clients) c.close();
    clients.length = 0;
    await server.close();
  });

  function connect(): Promise<Socket> {
    const s = ioClient(url, { transports: ['websocket'], forceNew: true });
    clients.push(s);
    return new Promise((res) => s.on('connect', () => res(s)));
  }
  const nextError = (s: Socket): Promise<{ code: string }> =>
    new Promise((res) => s.once('error', (e) => res(e)));

  it('rejects a malformed payload with MALFORMED_PAYLOAD', async () => {
    const s = await connect();
    const err = nextError(s);
    s.emit('room:create', 'not-an-object');
    expect((await err).code).toBe('MALFORMED_PAYLOAD');
  });

  it('rejects a blank name with NAME_INVALID', async () => {
    const s = await connect();
    const err = nextError(s);
    s.emit('room:create', { name: '   ' });
    expect((await err).code).toBe('NAME_INVALID');
  });

  it('rate-limits rapid room creation with RATE_LIMITED', async () => {
    const s = await connect();
    const errors: string[] = [];
    s.on('error', (e: { code: string }) => errors.push(e.code));
    for (let i = 0; i < 8; i++) s.emit('room:create', { name: `N${i}` });
    await sleep(60);
    expect(errors).toContain('RATE_LIMITED');
  });

  it('rejects an out-of-range bid payload as MALFORMED_PAYLOAD', async () => {
    const s = await connect();
    let state: ClientGameState | null = null;
    s.on('room:created', (p: { state: ClientGameState }) => (state = p.state));
    s.emit('room:create', { name: 'Host' });
    await sleep(20);
    expect(state).not.toBeNull();
    const err = nextError(s);
    s.emit('game:bid', { bid: 999 }); // > max
    expect((await err).code).toBe('MALFORMED_PAYLOAD');
  });

  it('multi-tab: rejoining from a new socket evicts the old one (SESSION_REPLACED)', async () => {
    const a = await connect();
    let token = '';
    a.on('room:created', (p: { token: string }) => (token = p.token));
    a.emit('room:create', { name: 'Solo' });
    await sleep(25);
    expect(token).not.toBe('');

    const aErr = nextError(a);
    const b = await connect();
    b.emit('room:rejoin', { token });
    expect((await aErr).code).toBe('SESSION_REPLACED');
  });
});
