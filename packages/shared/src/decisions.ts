// Pending-decision union. Several actions pause the flow to await a SPECIFIC
// player's input. Most are single-owner; jugglerPass is collective (one raised
// per participating seat, executed only once all have submitted). See spec §6.3.

export type PendingDecision =
  | { kind: 'chooseTrump'; seat: number } // a Wizard/Dragon/etc. was flipped
  | { kind: 'werewolfSwap'; seat: number } // holder must swap + choose trump pre-bid
  | { kind: 'cloudAdjust'; seat: number } // trick winner adjusts bid +/-1
  | { kind: 'witchSwap'; seat: number; trickCardIds: string[] } // choose card to take + give
  | { kind: 'jugglerPass'; seat: number }; // each player picks one hand card to pass

export type PendingDecisionKind = PendingDecision['kind'];
