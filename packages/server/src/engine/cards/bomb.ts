// Bomb — voids the trick: nobody wins it, it counts toward no one's bid. The
// player who WOULD have won leads the next trick. Led like a Jester. Flipped =>
// no trump. The Bomb does not cancel a Juggler pass (handled by stage order).

import type { CardBehavior, ResolveStage } from './types.js';

export const bomb: CardBehavior = {
  special: 'bomb',
  onTrumpFlip: () => ({ type: 'noTrump' }),
  leadConstraint: () => ({ type: 'asJester' }),
  identity: () => ({ kind: 'bomb' }),
  handlesStage: (stage: ResolveStage) => stage === 'bomb',
  onStage: (stage, ctx) => {
    if (stage === 'bomb') ctx.markVoided();
  },
};
