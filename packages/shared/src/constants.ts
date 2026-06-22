// Tunable + structural constants. Single source for the rounds table, deck
// composition, and timings (so the engine stays free of magic numbers).

import type { Suit } from './cards.js';

// Base deck: 4 suits x 1..13 = 52 number cards + 4 wizards + 4 jesters = 60.
export const BASE_DECK_SIZE = 60;
export const SUIT_MIN = 1;
export const SUIT_MAX = 13;
export const WIZARD_COUNT = 4;
export const JESTER_COUNT = 4;

// Rounds are fixed at game start by the INITIAL player count: 60 / players.
// (Every supported player count divides 60 evenly.)
export const ROUNDS_BY_PLAYER_COUNT: Readonly<Record<number, number>> = {
  3: 20,
  4: 15,
  5: 12,
  6: 10,
} as const;

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
export const MIN_PLAYERS_DEBUG = 2; // 2 seats allowed only behind the debug flag

export function roundsForPlayerCount(players: number): number {
  const rounds = ROUNDS_BY_PLAYER_COUNT[players];
  if (rounds === undefined) {
    throw new Error(`Unsupported player count for rounds table: ${players}`);
  }
  return rounds;
}

// Juggler ranks at 7.5, Cloud at 9.75 (within their announced suit).
export const JUGGLER_RANK = 7.5;
export const CLOUD_RANK = 9.75;

// Scoring.
export const CORRECT_BID_BASE = 20;
export const CORRECT_BID_PER_TRICK = 10;
export const WRONG_BID_PENALTY_PER_OFF = 10;

// Round-end summary hold (ms) before the server auto-advances to the next round.
export const ROUND_SUMMARY_MS = 5000;

// Room codes: 4-6 uppercase alphanumerics, excluding ambiguous chars (O/0/I/1).
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 4;

// Trump-colour ordering helper (stable display order).
export const SUIT_ORDER: readonly Suit[] = ['red', 'blue', 'green', 'yellow'] as const;
