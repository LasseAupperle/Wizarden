// Debug-only random-but-legal bot. Given the full server-side GameState and a
// seat, it returns one legal action: a legal bid, a legal play (with a valid
// PlayDecision), or a valid resolution for whatever decision the seat owes.
// Never produces an illegal move. Randomness is fine here (debug only).

import { SUITS, type Card, type PlayDecision, type Suit } from '@wizarden/shared';
import type { ResolvePayload } from '../engine/game.js';
import { playerAt, type GameState } from '../engine/internalState.js';
import { isLegalPlay, makeCtx } from '../engine/resolve.js';

export type BotMove =
  | { kind: 'bid'; bid: number }
  | { kind: 'play'; cardId: string; decision: PlayDecision }
  | { kind: 'resolve'; payload: ResolvePayload };

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const randInt = (maxInclusive: number): number => Math.floor(Math.random() * (maxInclusive + 1));
const randSuit = (): Suit => pick(SUITS);

function decisionForCard(card: Card): PlayDecision {
  if (card.kind !== 'special') return { type: 'none' };
  if (card.special === 'shapeshifter')
    return { type: 'shapeshifter', as: pick(['wizard', 'jester'] as const) };
  if (card.special === 'juggler' || card.special === 'cloud')
    return { type: 'announceSuit', suit: randSuit() };
  return { type: 'none' };
}

function resolvePayload(
  game: GameState,
  seat: number,
  kind: NonNullable<GameState['decisions'][number]>['kind'],
): ResolvePayload {
  const p = playerAt(game, seat)!;
  const decision = game.decisions[seat]!;
  switch (kind) {
    case 'chooseTrump':
      return { suit: randSuit() };
    case 'werewolfSwap':
      return { suit: Math.random() < 0.15 ? null : randSuit() };
    case 'cloudAdjust': {
      const bid = p.bid ?? 0;
      return { delta: bid === 0 ? 1 : pick([1, -1] as const) };
    }
    case 'witchSwap': {
      const trickCardIds = decision.kind === 'witchSwap' ? decision.trickCardIds : [];
      return { takeId: pick(trickCardIds), giveId: pick(p.hand).id };
    }
    case 'jugglerPass':
      return { cardId: pick(p.hand).id };
    default:
      return { suit: randSuit() };
  }
}

/** Decide one legal move for `seat`, or null if the seat is not the actor. */
export function decideBotMove(game: GameState, seat: number): BotMove | null {
  const p = playerAt(game, seat);
  if (!p) return null;

  const decision = game.decisions[seat];
  if (decision) return { kind: 'resolve', payload: resolvePayload(game, seat, decision.kind) };

  if (game.phase === 'bidding' && game.currentTurnSeat === seat) {
    return { kind: 'bid', bid: randInt(game.round?.cardsThisRound ?? 0) };
  }

  if (game.phase === 'trick' && game.currentTurnSeat === seat && game.round) {
    const ctx = makeCtx(game);
    const legal = p.hand.filter((c) => isLegalPlay(p.hand, c, game.round!.currentTrick, ctx));
    const card = pick(legal.length > 0 ? legal : p.hand);
    return { kind: 'play', cardId: card.id, decision: decisionForCard(card) };
  }

  return null;
}
