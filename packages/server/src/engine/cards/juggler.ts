// Juggler — value 7½ in its announced colour. When the trick ends (and it is
// NOT the last trick of the round), every player with cards passes one card of
// their own choosing clockwise (collective jugglerPass). A Bomb in the trick
// does NOT cancel the pass. Led => announced colour must be followed. Flipped
// => chooseTrump.

import { JUGGLER_RANK, type Suit, type TrickPlay } from '@wizarden/shared';
import type { CardBehavior, EngineCtx, ResolveStage } from './types.js';

function announced(play: TrickPlay, ctx: EngineCtx): Suit {
  return play.decision.type === 'announceSuit'
    ? play.decision.suit
    : (ctx.round.trumpSuit ?? 'red');
}

export const juggler: CardBehavior = {
  special: 'juggler',
  onTrumpFlip: () => ({ type: 'chooseTrump' }),
  leadConstraint: (play, ctx) => ({ type: 'followAnnounced', suit: announced(play, ctx) }),
  identity: (play, ctx) => ({ kind: 'suited', suit: announced(play, ctx), value: JUGGLER_RANK }),
  handlesStage: (stage: ResolveStage) => stage === 'juggler',
  onStage: (stage, ctx) => {
    if (stage !== 'juggler' || ctx.isLastTrickOfRound) return;
    for (const seat of ctx.activeSeatsWithCards()) {
      ctx.raiseDecision({ kind: 'jugglerPass', seat });
    }
  },
};
