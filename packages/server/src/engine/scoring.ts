// Scoring rules. PURE. See spec §7.4 / rulebook "Score experience points".

import {
  CORRECT_BID_BASE,
  CORRECT_BID_PER_TRICK,
  WRONG_BID_PENALTY_PER_OFF,
} from '@wizarden/shared';

/**
 * Points for a single player's round.
 * - Correct bid: 20 + 10 x bid  (bid 0 won 0 => 20).
 * - Wrong bid:   -10 x |tricksWon - bid|.
 * Tricks set aside by a Bomb count toward no bid (handled by the caller: such
 * tricks are simply never added to any player's tricksWon).
 */
export function scoreRound(bid: number, tricksWon: number): number {
  if (bid === tricksWon) {
    return CORRECT_BID_BASE + CORRECT_BID_PER_TRICK * bid;
  }
  return -WRONG_BID_PENALTY_PER_OFF * Math.abs(tricksWon - bid);
}
