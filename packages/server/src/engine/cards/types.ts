// CardBehavior plug-in contract (OCP). Each special card is one self-contained
// file implementing this interface and registered in registry.ts. The resolver
// and round code drive behaviors through these hook points and NEVER branch on
// card identity. Adding a card = add one file + one registry entry.
//
// EngineCtx, Effective, and the outcome/constraint types are engine-internal
// (defined here, not in @wizarden/shared).

import type { PendingDecision, SpecialType, Suit, TrickPlay } from '@wizarden/shared';
import type { GameState, RoundState } from '../internalState.js';

/** Normalised ranking identity of a played card (after shapeshifter/vampire). */
export type Effective =
  | { kind: 'wizard' }
  | { kind: 'dragon' }
  | { kind: 'jester' }
  | { kind: 'fairy' }
  | { kind: 'witch' }
  | { kind: 'bomb' }
  | { kind: 'suited'; suit: Suit; value: number }; // numbers + juggler(7.5) + cloud(9.75)

export type TrumpFlipOutcome = { type: 'chooseTrump' } | { type: 'noTrump' };

export type LeadConstraint =
  | { type: 'asWizard' } // led like a Wizard: others may play anything
  | { type: 'asJester' } // led like a Jester: free until a number/Wizard appears
  | { type: 'followSuit'; suit: Suit } // a plain suited lead must be followed
  | { type: 'followAnnounced'; suit: Suit }; // juggler/cloud announced suit must be followed

/** Ordered post-winner stages (spec §7.2 steps 2–5). */
export type ResolveStage = 'bomb' | 'juggler' | 'cloud' | 'witch';
export const RESOLVE_STAGES: readonly ResolveStage[] = ['bomb', 'juggler', 'cloud', 'witch'];

/**
 * Engine context handed to behaviors. Exposes read access to the current
 * trick/round/game plus a controlled way to enqueue decisions and mark trick
 * voiding. Behaviors must not reach outside these operations.
 */
export interface EngineCtx {
  readonly state: GameState;
  readonly round: RoundState;
  readonly trick: TrickPlay[];
  /** True if this trick empties every active hand (the round's last trick). */
  readonly isLastTrickOfRound: boolean;

  // ---- resolution scratch (valid during staged resolution) ----
  wouldBeWinnerSeat: number;
  voided: boolean;

  // ---- helpers ----
  identityOf(play: TrickPlay): Effective;
  identityOfCard(card: import('@wizarden/shared').Card): Effective;
  activeSeatsWithCards(): number[];
  raiseDecision(d: PendingDecision): void;
  markVoided(): void;
}

export interface CardBehavior {
  readonly special: SpecialType;

  /** Called when this special is the flipped trump-determining card (§7.3). */
  onTrumpFlip(): TrumpFlipOutcome;

  /** Called when this special is the FIRST card led in a trick. */
  leadConstraint(play: TrickPlay, ctx: EngineCtx): LeadConstraint;

  /** This special's ranking identity in the trick. */
  identity(play: TrickPlay, ctx: EngineCtx): Effective;

  /** Pre-bid mandatory step when HELD (Werewolf only). Most omit this. */
  preBid?(ctx: EngineCtx, seat: number): void;

  /** Play-time identity resolution (Vampire flips a fresh trump vs. a Werewolf). */
  onPlay?(ctx: EngineCtx, play: TrickPlay): void;

  /** Which ordered stages this special participates in (default: none). */
  handlesStage?(stage: ResolveStage): boolean;

  /** Ordered post-resolution hook; may raise pending decision(s). */
  onStage?(stage: ResolveStage, ctx: EngineCtx): void;
}
