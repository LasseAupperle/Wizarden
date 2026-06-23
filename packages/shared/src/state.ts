// Game state contracts. ClientGameState is the redacted per-player projection
// the server broadcasts; the server's internal GameState is richer (full hands,
// undealt pile, RNG state, outstanding-decision map) and is NOT defined here.

import type { Card, PlayDecision, SpecialType, Suit } from './cards.js';
import type { PendingDecision } from './decisions.js';
import type { GameMode } from './constants.js';

export type Phase =
  | 'lobby'
  | 'dealing'
  | 'trumpDecision'
  | 'preBid'
  | 'bidding'
  | 'trick'
  | 'trickResolving'
  | 'scoring'
  | 'roundEnd'
  | 'gameOver';

export interface PlayerPublic {
  seat: number; // 0-based; fluid in lobby, FIXED at game start
  name: string;
  connected: boolean; // socket connection status
  inPlay: boolean; // false once a player has left/been removed mid-game; kept for scoreboard history
  isHost: boolean;
  isBot: boolean;
  bid: number | null; // null until they have bid this round
  tricksWon: number; // this round
  handCount: number; // number of cards (public); contents are private
  totalScore: number;
}

export interface TrickPlay {
  seat: number;
  card: Card;
  decision: PlayDecision;
}

export interface RoundResult {
  // per round, per player
  seat: number;
  bid: number;
  tricksWon: number;
  delta: number;
  total: number;
}

// What a given client receives (their own hand is included; others' hands are counts):
export interface ClientGameState {
  roomCode: string;
  phase: Phase;
  players: PlayerPublic[];
  yourSeat: number;
  yourHand: Card[]; // empty in lobby
  roundNumber: number; // 1-based
  totalRounds: number; // fixed at game start; unchanged if players later leave
  gameMode: GameMode; // full | half (§23.3)
  startMarkerSeat: number;
  currentTurnSeat: number | null; // the single seat to act (bidder / card to play); null otherwise
  awaitingDecisionSeats: number[]; // seats that still owe a pending decision (single or collective)
  trumpCard: Card | null; // the flipped card (null if none / last base round)
  trumpSuit: Suit | null; // resolved trump colour (null = no trump)
  currentTrick: TrickPlay[];
  selectedSpecials: SpecialType[]; // which specials are in play this game
  pendingDecision: PendingDecision | null; // THIS player's own outstanding decision, else null
  paused: boolean; // true while waiting on a disconnected player
  pausedForName: string | null;
  scoreboard: RoundResult[][]; // [round][player]; for the popup
  lastRoundResult: RoundResult[] | null; // for the round-end summary
  gameOver: { standings: PlayerPublic[] } | null;
}
