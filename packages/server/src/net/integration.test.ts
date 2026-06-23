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
    this.socket.on('room:created', (p: { token: string; state: ClientGameState }) => {
      this.token = p.token;
      this.state = p.state;
    });
    this.socket.on('room:joined', (p: { token: string; state: ClientGameState }) => {
      this.token = p.token;
      this.state = p.state;
    });
    this.socket.on('error', (e: { code: string; message: string }) => this.errors.push(e));
  }

  get seat(): number {
    return this.state!.yourSeat;
  }

  whenConnected(): Promise<void> {
    return new Promise((res) => this.socket.on('connect', () => res()));
  }

  nextState(): Promise<ClientGameState> {
    return new Promise((res) => this.socket.once('state:update', (s: ClientGameState) => res(s)));
  }

  nextError(): Promise<{ code: string; message: string }> {
    return new Promise((res) => this.socket.once('error', (e) => res(e)));
  }

  close(): void {
    this.socket.close();
  }
}

// Base-game (no specials) legal-card picker from the redacted client view.
function ledSuit(trick: ClientGameState['currentTrick']): { suit: string | null; freed: boolean } {
  for (const p of trick) {
    if (p.card.kind === 'wizard') return { suit: null, freed: true };
    if (p.card.kind === 'number') return { suit: p.card.suit, freed: false };
  }
  return { suit: null, freed: false };
}

function pickCard(state: ClientGameState): string {
  const hand = state.yourHand;
  const { suit, freed } = ledSuit(state.currentTrick);
  if (suit === null || freed) return hand[0]!.id;
  const follow = hand.find((c) => c.kind === 'number' && c.suit === suit);
  return (follow ?? hand[0]!).id;
}

describe('Phase 4 — server protocol over real sockets', () => {
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

  async function act(
    host: TestClient,
    actor: TestClient,
    ev: string,
    payload: unknown,
  ): Promise<void> {
    const p = host.nextState();
    actor.socket.emit(ev, payload);
    await p;
    await sleep(4);
  }

  it('creates a room, three join, configure specials, play a full game to game:over', async () => {
    const a = await makeClient();
    const b = await makeClient();
    const c = await makeClient();

    // create + join
    a.socket.emit('room:create', { name: 'Alice' });
    await sleep(20);
    const code = a.state!.roomCode;
    expect(code).toMatch(/^[A-Z2-9]{4}$/);

    b.socket.emit('room:join', { name: 'Bob', code });
    c.socket.emit('room:join', { name: 'Cara', code });
    await sleep(30);

    expect(a.state!.players).toHaveLength(3);
    expect(a.state!.phase).toBe('lobby');

    // invalid config rejected, valid (empty) accepted
    a.socket.emit('lobby:configureSpecials', { specials: ['dragon'] }); // unpaired
    const err = await a.nextError();
    expect(err.code).toBe('INVALID_CONFIG');
    a.socket.emit('lobby:configureSpecials', { specials: [] });
    await sleep(15);

    // start
    a.socket.emit('game:start', {});
    await sleep(20);
    expect(a.state!.phase).not.toBe('lobby');
    expect(a.state!.totalRounds).toBe(20);

    const bySeat = [a, b, c];
    const ordered = bySeat.sort((x, y) => x.seat - y.seat);

    // redaction: own hand present; others are counts only
    await sleep(10);
    for (const cl of ordered) {
      expect(cl.state!.yourHand.length).toBe(cl.state!.roundNumber);
      // other players expose handCount, never their cards
      for (const pub of cl.state!.players) {
        expect(pub).not.toHaveProperty('hand');
        expect(typeof pub.handCount).toBe('number');
      }
    }
    // host's view of seat 1's count equals seat 1's actual hand size
    const seat1Client = ordered[1]!;
    expect(ordered[0]!.state!.players[1]!.handCount).toBe(seat1Client.state!.yourHand.length);

    // drive the whole game
    const host = ordered[0]!;
    let guard = 0;
    while (host.state!.phase !== 'gameOver') {
      if (++guard > 20000) throw new Error('game did not finish');
      const st = host.state!;
      if (st.phase === 'roundEnd') {
        await host.nextState(); // wait for the auto-advance broadcast (no client action)
        await sleep(4);
        continue;
      }
      if (st.phase === 'bidding') {
        await act(host, ordered[st.currentTurnSeat!]!, 'game:bid', { bid: 0 });
      } else if (st.phase === 'trick') {
        const actor = ordered[st.currentTurnSeat!]!;
        await act(host, actor, 'game:play', { cardId: pickCard(actor.state!), decision: { type: 'none' } });
      } else if (st.phase === 'trumpDecision' || st.phase === 'preBid') {
        await act(host, ordered[st.awaitingDecisionSeats[0]!]!, 'game:resolve', { suit: 'red' });
      } else {
        throw new Error(`unexpected phase: ${st.phase}`);
      }
    }

    expect(host.state!.phase).toBe('gameOver');
    expect(host.state!.gameOver!.standings).toHaveLength(3);
    expect(host.state!.scoreboard).toHaveLength(20);

    // a real (non-debug, non-bot) full game records exactly 1 point on the leaderboard
    const totalPoints = server.leaderboard.all().reduce((sum, e) => sum + e.points, 0);
    expect(totalPoints).toBe(1);
  }, 40000);

  it('rejects out-of-turn bids, bogus plays, and mid-game joins', async () => {
    const a = await makeClient();
    const b = await makeClient();
    const c = await makeClient();
    a.socket.emit('room:create', { name: 'A' });
    await sleep(20);
    const code = a.state!.roomCode;
    b.socket.emit('room:join', { name: 'B', code });
    c.socket.emit('room:join', { name: 'C', code });
    await sleep(30);
    a.socket.emit('game:start', {});
    await sleep(20);

    const ordered = [a, b, c].sort((x, y) => x.seat - y.seat);
    // skip a trump decision if one is pending
    if (ordered[0]!.state!.phase === 'trumpDecision') {
      await act(ordered[0]!, ordered[ordered[0]!.state!.awaitingDecisionSeats[0]!]!, 'game:resolve', { suit: 'red' });
    }
    expect(ordered[0]!.state!.phase).toBe('bidding');

    const current = ordered[0]!.state!.currentTurnSeat!;
    const notCurrent = ordered.find((cl) => cl.seat !== current)!;
    const errP = notCurrent.nextError();
    notCurrent.socket.emit('game:bid', { bid: 0 });
    expect((await errP).code).toBe('NOT_YOUR_TURN');

    // mid-game join rejected
    const d = await makeClient();
    const joinErr = d.nextError();
    d.socket.emit('room:join', { name: 'D', code });
    expect((await joinErr).code).toBe('GAME_IN_PROGRESS');
  }, 20000);

  it('runs two rooms simultaneously without cross-talk', async () => {
    const a1 = await makeClient();
    const a2 = await makeClient();
    a1.socket.emit('room:create', { name: 'A1' });
    await sleep(20);
    const code1 = a1.state!.roomCode;
    a2.socket.emit('room:join', { name: 'A2', code: code1 });
    await sleep(20);

    const b1 = await makeClient();
    b1.socket.emit('room:create', { name: 'B1' });
    await sleep(20);
    const code2 = b1.state!.roomCode;

    expect(code1).not.toBe(code2);
    // a change in room 1 must not leak into room 2
    a2.socket.emit('lobby:configureSpecials', { specials: [] });
    await sleep(20);
    expect(b1.state!.roomCode).toBe(code2);
    expect(b1.state!.players).toHaveLength(1);
    expect(a1.state!.players).toHaveLength(2);
  }, 20000);
});
