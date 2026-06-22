import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import type { ClientGameState } from '@wizarden/shared';
import { createWizardenServer, type WizardenServer } from '../index.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class TestClient {
  socket: Socket;
  state: ClientGameState | null = null;
  token = '';
  errors: { code: string; message: string }[] = [];

  constructor(url: string) {
    this.socket = ioClient(url, { transports: ['websocket'], forceNew: true });
    this.socket.on('state:update', (s: ClientGameState) => (this.state = s));
    const onRoom = (p: { token: string; state: ClientGameState }) => {
      this.token = p.token;
      this.state = p.state;
    };
    this.socket.on('room:created', onRoom);
    this.socket.on('room:joined', onRoom);
    this.socket.on('error', (e: { code: string; message: string }) => this.errors.push(e));
  }
  get seat(): number {
    return this.state!.yourSeat;
  }
  whenConnected(): Promise<void> {
    return new Promise((res) => this.socket.on('connect', () => res()));
  }
  nextError(): Promise<{ code: string; message: string }> {
    return new Promise((res) => this.socket.once('error', (e) => res(e)));
  }
  close(): void {
    this.socket.close();
  }
}

describe('Phase 5 — disconnect / reconnect / host migration / departures', () => {
  let server: WizardenServer;
  let url: string;
  const clients: TestClient[] = [];

  beforeEach(async () => {
    server = createWizardenServer({ roundSummaryMs: 10, enableDebug: false });
    const port = await server.listen(0);
    url = `http://localhost:${port}`;
  });
  afterEach(async () => {
    for (const c of clients) c.close();
    clients.length = 0;
    await server.close();
  });

  async function makeClient(): Promise<TestClient> {
    const c = new TestClient(url);
    clients.push(c);
    await c.whenConnected();
    return c;
  }

  async function lobbyOf(n: number): Promise<{ ordered: TestClient[]; code: string }> {
    const cs: TestClient[] = [];
    for (let i = 0; i < n; i++) cs.push(await makeClient());
    cs[0]!.socket.emit('room:create', { name: 'P0' });
    await sleep(25);
    const code = cs[0]!.state!.roomCode;
    for (let i = 1; i < n; i++) cs[i]!.socket.emit('room:join', { name: `P${i}`, code });
    await sleep(30);
    const ordered = [...cs].sort((a, b) => a.seat - b.seat);
    return { ordered, code };
  }

  async function startAndResolveTrump(ordered: TestClient[]): Promise<void> {
    ordered[0]!.socket.emit('game:start', {});
    await sleep(30);
    const host = ordered[0]!;
    if (host.state!.phase === 'trumpDecision') {
      const seat = host.state!.awaitingDecisionSeats[0]!;
      ordered[seat]!.socket.emit('game:resolve', { suit: 'red' });
      await sleep(20);
    }
  }

  it('pauses when the seat to act disconnects, resumes on reconnect', async () => {
    const { ordered, code } = await lobbyOf(3);
    await startAndResolveTrump(ordered);
    expect(ordered[0]!.state!.phase).toBe('bidding');

    const turnSeat = ordered[0]!.state!.currentTurnSeat!;
    const actor = ordered[turnSeat]!;
    const token = actor.token;
    actor.socket.disconnect();
    await sleep(40);

    // others see paused
    const other = ordered.find((c) => c.seat !== turnSeat)!;
    expect(other.state!.paused).toBe(true);
    expect(other.state!.pausedForName).toBe(`P${turnSeat}`);

    // reconnect via token
    const back = new TestClient(url);
    clients.push(back);
    await back.whenConnected();
    back.socket.emit('room:rejoin', { token });
    await sleep(40);
    expect(back.state!.roomCode).toBe(code);
    expect(other.state!.paused).toBe(false);

    // game continues: the restored seat can bid
    back.socket.emit('game:bid', { bid: 0 });
    await sleep(30);
    expect(other.state!.currentTurnSeat).not.toBe(turnSeat);
  }, 20000);

  it('off-turn disconnect does not pause', async () => {
    const { ordered } = await lobbyOf(3);
    await startAndResolveTrump(ordered);
    const turnSeat = ordered[0]!.state!.currentTurnSeat!;
    const offSeat = ordered.find((c) => c.seat !== turnSeat)!.seat;
    ordered[offSeat]!.socket.disconnect();
    await sleep(40);
    const stillHere = ordered.find((c) => c.seat === turnSeat)!;
    expect(stillHere.state!.paused).toBe(false);
  }, 20000);

  it('migrates host when the host disconnects', async () => {
    const { ordered } = await lobbyOf(3);
    ordered[0]!.socket.disconnect(); // host = seat 0
    await sleep(40);
    const survivor = ordered[1]!;
    const host = survivor.state!.players.find((p) => p.isHost)!;
    expect(host.seat).not.toBe(0);
    expect(host.connected).toBe(true);
  }, 20000);

  it('4->3 leave voids the round, re-deals the same round number, keeps total rounds', async () => {
    const { ordered } = await lobbyOf(4);
    await startAndResolveTrump(ordered);
    expect(ordered[0]!.state!.totalRounds).toBe(15);
    const targetSeat = 3;
    const targetToken = ordered[targetSeat]!.token;

    // host removes seat 3
    ordered[0]!.socket.emit('host:removePlayer', { seat: targetSeat });
    await sleep(40);

    const survivor = ordered[0]!.state!;
    expect(survivor.phase).not.toBe('gameOver');
    expect(survivor.roundNumber).toBe(1); // same round re-dealt
    expect(survivor.totalRounds).toBe(15); // preserved
    expect(survivor.players.filter((p) => p.inPlay)).toHaveLength(3);
    expect(survivor.players.find((p) => p.seat === targetSeat)!.inPlay).toBe(false);

    // departed token is rejected on rejoin
    const ghost = new TestClient(url);
    clients.push(ghost);
    await ghost.whenConnected();
    const errP = ghost.nextError();
    ghost.socket.emit('room:rejoin', { token: targetToken });
    expect((await errP).code).toBe('SESSION_GONE');
  }, 20000);

  it('dropping below 3 active ends the game with standings', async () => {
    const { ordered } = await lobbyOf(3);
    await startAndResolveTrump(ordered);
    ordered[2]!.socket.emit('room:leave', {});
    await sleep(40);
    const survivor = ordered[0]!.state!;
    expect(survivor.phase).toBe('gameOver');
    expect(survivor.gameOver!.standings).toHaveLength(3);
  }, 20000);
});
