// Vampire — on play, copies the round's flipped trump-determining card and all
// its effects. If that flipped card was the Werewolf, playing the Vampire flips
// a fresh trump card (applying from this trick to round end) and copies that.
// Never forced to follow suit. Led => follow rules of the copied card. Flipped
// => chooseTrump. (Copy/fresh-flip resolved in onPlay; identity reads the
// current trump card so the copy is stable for the rest of the trick.)

import { isSpecial } from '@wizarden/shared';
import type { CardBehavior, Effective } from './types.js';

function copiedIdentity(ctx: Parameters<CardBehavior['identity']>[1]): Effective {
  const tc = ctx.round.trumpCard;
  if (!tc) return { kind: 'jester' }; // nothing to copy -> behaves as a Jester
  return ctx.identityOfCard(tc);
}

export const vampire: CardBehavior = {
  special: 'vampire',
  onTrumpFlip: () => ({ type: 'chooseTrump' }),
  identity: (_play, ctx) => copiedIdentity(ctx),
  leadConstraint: (_play, ctx) => {
    const eff = copiedIdentity(ctx);
    if (eff.kind === 'wizard' || eff.kind === 'dragon') return { type: 'asWizard' };
    if (eff.kind === 'suited') return { type: 'followSuit', suit: eff.suit };
    return { type: 'asJester' };
  },
  onPlay: (ctx, _play) => {
    const tc = ctx.round.trumpCard;
    if (!tc || !isSpecial(tc, 'werewolf')) return;
    // Werewolf was the flipped card: flip a fresh trump card for the rest of the round.
    const fresh = ctx.round.pile.shift();
    if (!fresh) return;
    ctx.round.trumpCard = fresh;
    if (fresh.kind === 'number') ctx.round.trumpSuit = fresh.suit;
    else if (fresh.kind === 'jester') ctx.round.trumpSuit = null;
    // (A fresh Wizard/special would prompt a trump choice; out of scope for v1 —
    //  the existing trumpSuit carries over, which is safe.)
  },
};
