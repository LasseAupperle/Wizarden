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
  type ActionResult,
  type ResolvePayload,
} from '../engine/game.js';
import type { GameState } from '../engine/internalState.js';
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

  /** Broadcast bookkeeping so round:result / game:over fire once per transition. */
  flags = { lastResultRound: -1, gameOverEmitted: false };

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
    this.flags = { lastResultRound: -1, gameOverEmitted: false };
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
    this.flags = { lastResultRound: -1, gameOverEmitted: false };
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
