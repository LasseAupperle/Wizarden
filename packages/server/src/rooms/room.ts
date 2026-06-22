// A single room: lobby players + sessions, wrapping a Game once started. Owns
// the ROUND_SUMMARY_MS auto-advance timer (the engine has no timer). Knows
// nothing about sockets — the net layer subscribes via onChange and projects.

import {
  ErrorCodes,
  MAX_PLAYERS,
  MIN_PLAYERS,
  MIN_PLAYERS_DEBUG,
  ROUND_SUMMARY_MS,
  type ErrorCode,
  type PlayDecision,
  type SpecialType,
} from '@wizarden/shared';
import {
  advanceRound,
  applyBid,
  applyPlay,
  applyResolve,
  createGame,
  removePlayer,
  type ActionResult,
  type ResolvePayload,
} from '../engine/game.js';
import { awaitingDecisionSeats, playerAt as enginePlayerAt, type GameState } from '../engine/internalState.js';
import { validateSpecials } from '../engine/deck.js';

export interface RoomPlayer {
  seat: number;
  name: string;
  token: string | null;
  socketId: string | null;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
}

export interface RoomOptions {
  roundSummaryMs?: number;
  enableDebug?: boolean;
}

export type RoomResult = ActionResult | { ok: false; error: { code: ErrorCode; message: string } };

const fail = (code: ErrorCode, message: string): { ok: false; error: { code: ErrorCode; message: string } } => ({
  ok: false,
  error: { code, message },
});

function randomSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}

export class Room {
  readonly code: string;
  players: RoomPlayer[] = [];
  selectedSpecials: SpecialType[] = [];
  started = false;
  game: GameState | null = null;

  /** Invoked after any state change (incl. the timer-driven auto-advance). */
  onChange: () => void = () => {};

  /** Broadcast bookkeeping so round:result / game:over / pause fire once per transition. */
  flags = { lastResultRound: -1, gameOverEmitted: false, paused: false };

  private readonly roundSummaryMs: number;
  private readonly enableDebug: boolean;
  private advanceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(code: string, opts: RoomOptions = {}) {
    this.code = code;
    this.roundSummaryMs = opts.roundSummaryMs ?? ROUND_SUMMARY_MS;
    this.enableDebug = opts.enableDebug ?? false;
  }

  // ---- lobby ----

  private nextSeat(): number {
    const used = new Set(this.players.map((p) => p.seat));
    let seat = 0;
    while (used.has(seat)) seat++;
    return seat;
  }

  addPlayer(name: string, opts: { socketId?: string | null; isBot?: boolean } = {}): RoomPlayer {
    const player: RoomPlayer = {
      seat: this.nextSeat(),
      name,
      token: null,
      socketId: opts.socketId ?? null,
      isHost: this.players.length === 0,
      isBot: opts.isBot ?? false,
      connected: true,
    };
    this.players.push(player);
    this.players.sort((a, b) => a.seat - b.seat);
    return player;
  }

  playerBySeat(seat: number): RoomPlayer | undefined {
    return this.players.find((p) => p.seat === seat);
  }

  playerByToken(token: string): RoomPlayer | undefined {
    return this.players.find((p) => p.token === token);
  }

  hostSeat(): number | null {
    return this.players.find((p) => p.isHost)?.seat ?? null;
  }

  isEmpty(): boolean {
    return this.players.every((p) => !p.connected && !p.isBot);
  }

  configureSpecials(seat: number, specials: SpecialType[]): RoomResult {
    if (this.started) return fail(ErrorCodes.gameInProgress, 'game already started');
    if (this.playerBySeat(seat)?.isHost !== true) return fail(ErrorCodes.notHost, 'host only');
    try {
      this.selectedSpecials = validateSpecials(specials);
    } catch (e) {
      return fail(ErrorCodes.invalidConfig, (e as Error).message);
    }
    return { ok: true, state: this.game ?? ({} as GameState) };
  }

  addBot(name = `Bot ${this.players.length}`): RoomResult {
    if (!this.enableDebug) return fail(ErrorCodes.debugDisabled, 'debug only');
    if (this.started) return fail(ErrorCodes.gameInProgress, 'game already started');
    if (this.players.length >= MAX_PLAYERS) return fail(ErrorCodes.roomFull, 'room full');
    this.addPlayer(name, { isBot: true });
    return { ok: true, state: {} as GameState };
  }

  removeBot(seat: number): RoomResult {
    if (!this.enableDebug) return fail(ErrorCodes.debugDisabled, 'debug only');
    if (this.started) return fail(ErrorCodes.gameInProgress, 'game already started');
    const p = this.playerBySeat(seat);
    if (!p || !p.isBot) return fail(ErrorCodes.badRequest, 'not a bot seat');
    this.players = this.players.filter((x) => x.seat !== seat);
    return { ok: true, state: {} as GameState };
  }

  // ---- start + actions ----

  start(seat: number): RoomResult {
    if (this.started) return fail(ErrorCodes.gameInProgress, 'already started');
    if (this.playerBySeat(seat)?.isHost !== true) return fail(ErrorCodes.notHost, 'host only');
    const min = this.enableDebug ? MIN_PLAYERS_DEBUG : MIN_PLAYERS;
    if (this.players.length < min || this.players.length > MAX_PLAYERS) {
      return fail(ErrorCodes.invalidConfig, `need ${min}-${MAX_PLAYERS} players`);
    }
    this.game = createGame({
      roomCode: this.code,
      players: this.players.map((p) => ({ seat: p.seat, name: p.name, isBot: p.isBot, isHost: p.isHost })),
      selectedSpecials: this.selectedSpecials,
      seed: randomSeed(),
    });
    this.started = true;
    this.flags = { lastResultRound: -1, gameOverEmitted: false, paused: false };
    this.afterMutation();
    return { ok: true, state: this.game };
  }

  bid(seat: number, value: number): RoomResult {
    return this.commit(() => applyBid(this.requireGame(), seat, value));
  }

  play(seat: number, cardId: string, decision: PlayDecision): RoomResult {
    return this.commit(() => applyPlay(this.requireGame(), seat, cardId, decision));
  }

  resolve(seat: number, payload: ResolvePayload): RoomResult {
    return this.commit(() => applyResolve(this.requireGame(), seat, payload));
  }

  playAgain(seat: number): RoomResult {
    if (this.playerBySeat(seat)?.isHost !== true) return fail(ErrorCodes.notHost, 'host only');
    this.clearTimer();
    this.started = false;
    this.game = null;
    this.flags = { lastResultRound: -1, gameOverEmitted: false, paused: false };
    return { ok: true, state: {} as GameState };
  }

  private requireGame(): GameState {
    if (!this.game) throw new Error('no active game');
    return this.game;
  }

  private commit(action: () => ActionResult): RoomResult {
    if (!this.started || !this.game) return fail(ErrorCodes.illegalMove, 'game not started');
    const result = action();
    if (result.ok) {
      this.game = result.state;
      this.afterMutation();
    }
    return result;
  }

  private afterMutation(): void {
    if (this.game?.phase === 'roundEnd') this.scheduleAdvance();
    this.recomputePause();
  }

  // ---- disconnect / reconnect / departures (Phase 5) ----

  /** Is the seat still an active participant (in the lobby everyone is active)? */
  private isActiveSeat(seat: number): boolean {
    if (!this.started || !this.game) return true;
    return enginePlayerAt(this.game, seat)?.inPlay ?? false;
  }

  /** Mark a seat disconnected (seat retained). Returns whether the game now pauses. */
  markDisconnected(seat: number): void {
    const p = this.playerBySeat(seat);
    if (!p) return;
    p.connected = false;
    p.socketId = null;
    this.migrateHost();
    this.recomputePause();
  }

  markReconnected(seat: number, socketId: string): void {
    const p = this.playerBySeat(seat);
    if (!p) return;
    p.connected = true;
    p.socketId = socketId;
    this.recomputePause();
  }

  /** Voluntary leave / host removal. Lobby frees the seat; mid-game departs (§7.6). */
  leave(seat: number): RoomResult {
    if (!this.started || !this.game) {
      this.players = this.players.filter((p) => p.seat !== seat);
      this.migrateHost();
      return { ok: true, state: {} as GameState };
    }
    this.clearTimer();
    const result = removePlayer(this.game, seat);
    if (!result.ok) return result;
    this.game = result.state;
    const rp = this.playerBySeat(seat);
    if (rp) {
      rp.connected = false;
      rp.token = null; // invalidate; a rejoin must fail
      rp.socketId = null;
    }
    this.migrateHost();
    this.afterMutation();
    return { ok: true, state: this.game };
  }

  removeByHost(hostSeat: number, targetSeat: number): RoomResult {
    if (this.playerBySeat(hostSeat)?.isHost !== true) return fail(ErrorCodes.notHost, 'host only');
    if (!this.playerBySeat(targetSeat)) return fail(ErrorCodes.badRequest, 'unknown seat');
    return this.leave(targetSeat);
  }

  /** Move host to the next connected active seat when the current host is gone. */
  private migrateHost(): void {
    const hostOk = this.players.some((p) => p.isHost && p.connected && this.isActiveSeat(p.seat));
    if (hostOk) return;
    for (const p of this.players) p.isHost = false;
    const candidate = this.players
      .filter((p) => p.connected && this.isActiveSeat(p.seat) && !p.isBot)
      .sort((a, b) => a.seat - b.seat)[0];
    if (candidate) candidate.isHost = true;
  }

  /** Pause only while the game is waiting on a DISCONNECTED seat (its turn or a decision it owes). */
  recomputePause(): void {
    const g = this.game;
    if (!g) return;
    const awaited = new Set<number>();
    if (g.currentTurnSeat != null) awaited.add(g.currentTurnSeat);
    for (const s of awaitingDecisionSeats(g)) awaited.add(s);
    let paused = false;
    let name: string | null = null;
    for (const seat of awaited) {
      const rp = this.playerBySeat(seat);
      if (rp && !rp.connected && !rp.isBot) {
        paused = true;
        name = rp.name;
        break;
      }
    }
    g.paused = paused;
    g.pausedForName = name;
  }

  private scheduleAdvance(): void {
    this.clearTimer();
    this.advanceTimer = setTimeout(() => {
      this.advanceTimer = null;
      if (!this.game) return;
      const result = advanceRound(this.game);
      if (result.ok) this.game = result.state;
      this.afterMutation();
      this.onChange();
    }, this.roundSummaryMs);
  }

  private clearTimer(): void {
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
  }

  dispose(): void {
    this.clearTimer();
  }
}
