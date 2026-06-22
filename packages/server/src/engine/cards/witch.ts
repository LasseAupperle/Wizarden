// Witch — lower than both a Jester and the Fairy. Resolves AFTER the winner is
// determined (last stage): the Witch's player puts one hand card into the trick
// and takes any non-Witch card from the trick into hand (may be a special). The
// placed card has no effect. Led like a Jester. Flipped => no trump.

import { isSpecial } from '@wizarden/shared';
import type { CardBehavior, ResolveStage } from './types.js';

export const witch: CardBehavior = {
  special: 'witch',
  onTrumpFlip: () => ({ type: 'noTrump' }),
  leadConstraint: () => ({ type: 'asJester' }),
  identity: () => ({ kind: 'witch' }),
  handlesStage: (stage: ResolveStage) => stage === 'witch',
  onStage: (stage, ctx) => {
    if (stage !== 'witch') return;
    const witchPlay = ctx.trick.find((p) => isSpecial(p.card, 'witch'));
    if (!witchPlay) return;
    // The swap needs a hand card to give back; on the round's last trick the
    // holder has none, so there is nothing to swap.
    const holder = ctx.state.players.find((p) => p.seat === witchPlay.seat);
    if (!holder || holder.hand.length === 0) return;
    const trickCardIds = ctx.trick.filter((p) => !isSpecial(p.card, 'witch')).map((p) => p.card.id);
    ctx.raiseDecision({ kind: 'witchSwap', seat: witchPlay.seat, trickCardIds });
  },
};
