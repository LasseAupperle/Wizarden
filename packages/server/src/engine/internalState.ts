// Engine-internal game state (richer than the client projection). PURE module:
// imports only @wizarden/shared. The server holds one GameState per room and
// replaces it with the result of each engine transition.

import type {
  Card,
  GameMode,
  PendingDecision,
  Phase,
  PlayerPublic,
  RoundResult,
  SpecialType,
  Suit,
  TrickPlay,
} from '@wizarden/shared';

export interface EnginePlayer {
  seat: number; // 0-based; equals index in players[]
  name: string;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
  inPlay: boolean; // false once departed mid-game
  hand: Card[]; // full hand (server-side only)
  bid: number | null; // this round
  tricksWon: number; // this round
  totalScore: number;
}

/** Resumable scratch state for the staged trick resolver (spec §7.2). */
export interface TrickResolution {
  wouldBeWinner: number; // rank winner ignoring a Bomb (also the post-Bomb leader)
  voided: boolean; // a Bomb voided the trick
  stageIndex: number; // next ResolveStage to process
  jugglerPasses: Record<number, string>; // seat -> chosen card id (collective)
}

export interface RoundState {
  roundNumber: number; // 1-based
  cardsThisRound: number; // == roundNumber
  trumpCard: Card | null; // flipped trump-determining card (retained for Vampire)
  trumpSuit: Suit | null; // resolved trump colour (null = no trump)
  pile: Card[]; // undealt remainder after the trump card
  trickNumber: number; // 0-based index of the current trick within the round
  leadSeat: number; // seat that leads the current trick
  currentTrick: TrickPlay[];
  resolution?: TrickResolution; // present only while a completed trick is resolving
}

export interface GameState {
  roomCode: string;
  phase: Phase;
  players: EnginePlayer[]; // seat-indexed, length = initial player count
  initialPlayerCount: number;
  totalRounds: number; // fixed at game start
  gameMode: GameMode; // full | half
  selectedSpecials: SpecialType[];
  round: RoundState | null;
  currentTurnSeat: number | null; // single seat to act (bidder / card to play)
  startMarkerSeat: number;
  decisions: Record<number, PendingDecision>; // seat -> outstanding decision
  rngState: number; // serializable RNG state
  scoreboard: RoundResult[][]; // [round][playerInActiveOrder]
  lastRoundResult: RoundResult[] | null;
  standings: PlayerPublic[] | null; // populated at gameOver
  paused?: boolean; // true while waiting on a disconnected seat (Phase 5)
  pausedForName?: string | null;
}

// ---- pure helpers over GameState ----

export function clone(state: GameState): GameState {
  return structuredClone(state);
}

export function playerAt(state: GameState, seat: number): EnginePlayer | undefined {
  return state.players.find((p) => p.seat === seat);
}

/** Active (inPlay) seats in ascending seat order. */
export function activeSeats(state: GameState): number[] {
  return state.players.filter((p) => p.inPlay).map((p) => p.seat);
}

export function activeCount(state: GameState): number {
  return state.players.reduce((n, p) => (p.inPlay ? n + 1 : n), 0);
}

/**
 * Next active seat clockwise (strictly after `fromSeat`, wrapping). Seats are
 * arranged in ascending index order; departed (inPlay:false) seats are skipped.
 */
export function nextActiveSeat(state: GameState, fromSeat: number): number {
  const seats = activeSeats(state);
  if (seats.length === 0) throw new Error('no active seats');
  // find first active seat with index > fromSeat, else wrap to the smallest.
  for (const s of seats) {
    if (s > fromSeat) return s;
  }
  return seats[0]!;
}

/** Active seats in turn order starting AT `startSeat` (which need not be active). */
export function seatsFrom(state: GameState, startSeat: number): number[] {
  const seats = activeSeats(state);
  if (seats.length === 0) return [];
  // rotate so the order begins at the first active seat >= startSeat (wrapping).
  const order: number[] = [];
  let cursor = startSeat;
  // include startSeat first if it is active
  if (seats.includes(startSeat)) {
    order.push(startSeat);
    cursor = startSeat;
    for (let i = 1; i < seats.length; i++) {
      cursor = nextActiveSeat(state, cursor);
      order.push(cursor);
    }
    return order;
  }
  // startSeat inactive: begin at the next active seat clockwise
  cursor = nextActiveSeat(state, startSeat);
  order.push(cursor);
  for (let i = 1; i < seats.length; i++) {
    cursor = nextActiveSeat(state, cursor);
    order.push(cursor);
  }
  return order;
}

/** The order in which players bid: clockwise of the start marker. */
export function biddingOrder(state: GameState): number[] {
  return seatsFrom(state, nextActiveSeat(state, state.startMarkerSeat));
}

export function awaitingDecisionSeats(state: GameState): number[] {
  return Object.keys(state.decisions)
    .map(Number)
    .sort((a, b) => a - b);
}
