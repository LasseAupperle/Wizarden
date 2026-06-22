// Dragon — highest card in the game (beats Wizards); led like a Wizard.
// Exception: Fairy beats Dragon when both are in the trick (handled by the
// resolver, which checks for both before ranking). Flipped => chooseTrump.

import type { CardBehavior } from './types.js';

export const dragon: CardBehavior = {
  special: 'dragon',
  onTrumpFlip: () => ({ type: 'chooseTrump' }),
  leadConstraint: () => ({ type: 'asWizard' }),
  identity: () => ({ kind: 'dragon' }),
};
