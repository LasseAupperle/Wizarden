// Fairy — normally lower than a Jester (loses), BUT beats the Dragon when both
// are in the trick (the resolver checks Dragon+Fairy first). Led like a Jester.
// Flipped => no trump.

import type { CardBehavior } from './types.js';

export const fairy: CardBehavior = {
  special: 'fairy',
  onTrumpFlip: () => ({ type: 'noTrump' }),
  leadConstraint: () => ({ type: 'asJester' }),
  identity: () => ({ kind: 'fairy' }),
};
