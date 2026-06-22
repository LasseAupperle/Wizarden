// Cloud — value 9¾ in its announced colour. Whoever wins the trick the Cloud is
// in must change their own bid by +1 or −1 immediately. No change if a Bomb is
// also in the trick. If Cloud + Juggler share a trick, the Juggler passes first
// (stage order), then the Cloud winner adjusts. Led => announced colour must be
// followed. Flipped => chooseTrump. (+1-only-at-0 is enforced on resolve.)

import { CLOUD_RANK, type Suit, type TrickPlay } from '@wizarden/shared';
import type { CardBehavior, EngineCtx, ResolveStage } from './types.js';

function announced(play: TrickPlay, ctx: EngineCtx): Suit {
  return play.decision.type === 'announceSuit' ? play.decision.suit : (ctx.round.trumpSuit ?? 'red');
}

export const cloud: CardBehavior = {
  special: 'cloud',
  onTrumpFlip: () => ({ type: 'chooseTrump' }),
  leadConstraint: (play, ctx) => ({ type: 'followAnnounced', suit: announced(play, ctx) }),
  identity: (play, ctx) => ({ kind: 'suited', suit: announced(play, ctx), value: CLOUD_RANK }),
  handlesStage: (stage: ResolveStage) => stage === 'cloud',
  onStage: (stage, ctx) => {
    // No adjustment when the trick was voided by a Bomb.
    if (stage !== 'cloud' || ctx.voided) return;
    ctx.raiseDecision({ kind: 'cloudAdjust', seat: ctx.wouldBeWinnerSeat });
  },
};
