// Werewolf — when HELD, before bidding the holder must swap it for the flipped
// trump-determining card (taking that card into hand) and choose a new trump
// colour, or declare "no trump" (spec §7.1.3). Flipped (as the trump card) =>
// the start-marker holder chooses trump. The Werewolf is never played to a
// trick (it leaves the hand in the swap), so its in-trick identity is a no-op.

import type { CardBehavior } from './types.js';

export const werewolf: CardBehavior = {
  special: 'werewolf',
  onTrumpFlip: () => ({ type: 'chooseTrump' }),
  leadConstraint: () => ({ type: 'asJester' }),
  identity: () => ({ kind: 'jester' }),
  preBid: (ctx, seat) => {
    ctx.raiseDecision({ kind: 'werewolfSwap', seat });
  },
};
