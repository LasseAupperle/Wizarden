// Shapeshifter — declared as a Wizard or a Jester on play, then behaves exactly
// as that card. Flipped => chooseTrump. The declaration rides on the play's
// PlayDecision ({ type: 'shapeshifter', as }).

import type { CardBehavior, Effective, LeadConstraint } from './types.js';

function declaredAs(decision: { type: string; as?: 'wizard' | 'jester' }): 'wizard' | 'jester' {
  return decision.type === 'shapeshifter' && decision.as ? decision.as : 'jester';
}

export const shapeshifter: CardBehavior = {
  special: 'shapeshifter',
  onTrumpFlip: () => ({ type: 'chooseTrump' }),
  identity: (play): Effective =>
    declaredAs(play.decision) === 'wizard' ? { kind: 'wizard' } : { kind: 'jester' },
  leadConstraint: (play): LeadConstraint =>
    declaredAs(play.decision) === 'wizard' ? { type: 'asWizard' } : { type: 'asJester' },
};
