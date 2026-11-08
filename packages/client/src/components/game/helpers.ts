// Pure view helpers for the game screen. Legality here only GATES the UI (dims
// unplayable cards); the server re-validates every play and stays authoritative.
import type { Card, ClientGameState, PlayerPublic, Suit } from '@wizarden/shared';

type Trick = ClientGameState['currentTrick'];

function ledSuitOf(trick: Trick): { suit: Suit | null; freed: boolean } {
  for (const p of trick) {
    if (p.card.kind === 'wizard') return { suit: null, freed: true };
    if (p.card.kind === 'number') return { suit: p.card.suit, freed: false };
  }
  return { suit: null, freed: false };
}

export function isPlayable(card: Card, hand: Card[], trick: Trick): boolean {
  if (card.kind !== 'number') return true;
  const { suit, freed } = ledSuitOf(trick);
  if (freed || suit === null || card.suit === suit) return true;
  return !hand.some((c) => c.kind === 'number' && c.suit === suit);
}

const KIND_ORDER: Record<Card['kind'], number> = { jester: 0, number: 1, special: 2, wizard: 3 };
const SUIT_ORDER: Record<Suit, number> = { red: 0, blue: 1, green: 2, yellow: 3 };

/** Stable, readable hand order: by kind, then suit, then value. */
export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (a.kind === 'number' && b.kind === 'number') {
      return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || a.value - b.value;
    }
    return a.id.localeCompare(b.id);
  });
}

/** All players in play order starting with you (you, next, next…). */
export function playOrderFromYou(game: ClientGameState): PlayerPublic[] {
  const n = game.players.length;
  const idx = game.players.findIndex((p) => p.seat === game.yourSeat);
  if (idx < 0) return game.players;
  return Array.from({ length: n }, (_, i) => game.players[(idx + i) % n]!);
}

export const nameOf = (game: ClientGameState, seat: number | null | undefined): string =>
  game.players.find((p) => p.seat === seat)?.name ?? '';

/** Sum of bids placed so far this round. */
export const bidsSoFar = (game: ClientGameState): number =>
  game.players.reduce((sum, p) => sum + (p.inPlay && p.bid != null ? p.bid : 0), 0);
