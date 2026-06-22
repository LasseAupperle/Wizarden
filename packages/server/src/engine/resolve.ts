// The full trick resolver (Phase 3). PURE. Drives CardBehavior plug-ins through
// the fixed ordered pipeline (§7.2) and is RESUMABLE across pending decisions
// (cloudAdjust / witchSwap / jugglerPass). Never branches on card identity —
// it iterates the registry for specials present in the trick.

import type { Card, Suit, TrickPlay } from '@wizarden/shared';
import { getBehavior } from './cards/registry.js';
import {
  RESOLVE_STAGES,
  type CardBehavior,
  type Effective,
  type EngineCtx,
  type LeadConstraint,
} from './cards/types.js';
import { activeSeats, playerAt, type GameState } from './internalState.js';
import { scoreRoundAndEnd } from './round.js';

// ---- engine context ----

export function makeCtx(state: GameState): EngineCtx {
  const round = state.round!;
  const isLast = activeSeats(state).every((s) => playerAt(state, s)!.hand.length === 0);

  const ctx: EngineCtx = {
    state,
    round,
    trick: round.currentTrick,
    isLastTrickOfRound: isLast,
    wouldBeWinnerSeat: 0,
    voided: false,
    identityOf: (play) => identityOfPlay(play, ctx),
    identityOfCard: (card) => identityOfCard(card, ctx),
    activeSeatsWithCards: () => activeSeats(state).filter((s) => playerAt(state, s)!.hand.length > 0),
    raiseDecision: (d) => {
      state.decisions[d.seat] = d;
    },
    markVoided: () => {
      ctx.voided = true;
    },
  };
  return ctx;
}

// ---- identity (ranking) ----

export function identityOfPlay(play: TrickPlay, ctx: EngineCtx): Effective {
  const c = play.card;
  if (c.kind === 'number') return { kind: 'suited', suit: c.suit, value: c.value };
  if (c.kind === 'wizard') return { kind: 'wizard' };
  if (c.kind === 'jester') return { kind: 'jester' };
  return getBehavior(c.special).identity(play, ctx);
}

export function identityOfCard(card: Card, ctx: EngineCtx): Effective {
  if (card.kind === 'number') return { kind: 'suited', suit: card.suit, value: card.value };
  if (card.kind === 'wizard') return { kind: 'wizard' };
  if (card.kind === 'jester') return { kind: 'jester' };
  if (card.special === 'vampire') return { kind: 'jester' }; // a Vampire can't copy itself
  return getBehavior(card.special).identity({ seat: -1, card, decision: { type: 'none' } }, ctx);
}

// ---- lead suit ----

function leadConstraintOfPlay(play: TrickPlay, ctx: EngineCtx): LeadConstraint {
  const c = play.card;
  if (c.kind === 'number') return { type: 'followSuit', suit: c.suit };
  if (c.kind === 'wizard') return { type: 'asWizard' };
  if (c.kind === 'jester') return { type: 'asJester' };
  return getBehavior(c.special).leadConstraint(play, ctx);
}

export interface LeadInfo {
  ledSuit: Suit | null;
  freed: boolean;
}

export function computeLeadInfo(trick: readonly TrickPlay[], ctx: EngineCtx): LeadInfo {
  for (const play of trick) {
    const lc = leadConstraintOfPlay(play, ctx);
    if (lc.type === 'asWizard') return { ledSuit: null, freed: true };
    if (lc.type === 'followSuit' || lc.type === 'followAnnounced') {
      return { ledSuit: lc.suit, freed: false };
    }
    // asJester: keep scanning.
  }
  return { ledSuit: null, freed: false };
}

// ---- winner ----

function highestSuited(
  plays: readonly { seat: number; eff: Effective }[],
  suit: Suit,
): { seat: number; value: number } | null {
  let best: { seat: number; value: number } | null = null;
  for (const p of plays) {
    if (p.eff.kind === 'suited' && p.eff.suit === suit) {
      if (!best || p.eff.value > best.value) best = { seat: p.seat, value: p.eff.value };
    }
  }
  return best;
}

export function determineWinner(
  plays: readonly { seat: number; eff: Effective }[],
  ledSuit: Suit | null,
  trumpSuit: Suit | null,
): number {
  if (plays.length === 0) throw new Error('cannot resolve an empty trick');

  const dragon = plays.find((p) => p.eff.kind === 'dragon');
  const fairy = plays.find((p) => p.eff.kind === 'fairy');
  if (dragon && fairy) return fairy.seat; // Fairy beats Dragon when both present
  if (dragon) return dragon.seat; // Dragon beats Wizards

  const wizard = plays.find((p) => p.eff.kind === 'wizard');
  if (wizard) return wizard.seat;

  if (trumpSuit) {
    const t = highestSuited(plays, trumpSuit);
    if (t) return t.seat;
  }
  if (ledSuit) {
    const l = highestSuited(plays, ledSuit);
    if (l) return l.seat;
  }

  // Fallback: nothing rankable (only Jester/Fairy/Witch/Bomb). Order: Jester > Fairy > Witch.
  const rank: Record<string, number> = { jester: 2, fairy: 1, witch: 0 };
  let best: { seat: number; r: number } | null = null;
  for (const p of plays) {
    const r = rank[p.eff.kind];
    if (r !== undefined && (!best || r > best.r)) best = { seat: p.seat, r };
  }
  return best ? best.seat : plays[0]!.seat;
}

// ---- legality (with specials) ----

export function isLegalPlay(
  hand: readonly Card[],
  card: Card,
  trick: readonly TrickPlay[],
  ctx: EngineCtx,
): boolean {
  if (card.kind !== 'number') return true; // Wizard/Jester/special always legal
  const { ledSuit, freed } = computeLeadInfo(trick, ctx);
  if (freed || ledSuit === null) return true;
  if (card.suit === ledSuit) return true;
  return !hand.some((c) => c.kind === 'number' && c.suit === ledSuit);
}

// ---- staged resolution (resumable) ----

function specialsInTrick(state: GameState): CardBehavior[] {
  const seen = new Set<string>();
  const out: CardBehavior[] = [];
  for (const p of state.round!.currentTrick) {
    if (p.card.kind === 'special' && !seen.has(p.card.special)) {
      seen.add(p.card.special);
      out.push(getBehavior(p.card.special));
    }
  }
  return out;
}

/** Begin resolving a completed trick: determine the would-be winner, then run stages. */
export function resolveTrick(state: GameState): void {
  const round = state.round!;
  const ctx = makeCtx(state);
  const { ledSuit } = computeLeadInfo(round.currentTrick, ctx);
  const plays = round.currentTrick.map((p) => ({ seat: p.seat, eff: ctx.identityOf(p) }));
  const wouldBe = determineWinner(plays, ledSuit, round.trumpSuit);

  round.resolution = { wouldBeWinner: wouldBe, voided: false, stageIndex: 0, jugglerPasses: {} };
  state.phase = 'trickResolving';
  state.currentTurnSeat = null;
  continueResolution(state);
}

/** Advance the staged pipeline; pauses (returns) while any decision is outstanding. */
export function continueResolution(state: GameState): void {
  const round = state.round!;
  const res = round.resolution!;

  while (res.stageIndex < RESOLVE_STAGES.length) {
    const stage = RESOLVE_STAGES[res.stageIndex]!;
    const ctx = makeCtx(state);
    ctx.wouldBeWinnerSeat = res.wouldBeWinner;
    ctx.voided = res.voided;

    for (const behavior of specialsInTrick(state)) {
      if (behavior.handlesStage?.(stage)) behavior.onStage?.(stage, ctx);
    }
    res.voided = ctx.voided;
    res.stageIndex++;

    if (Object.keys(state.decisions).length > 0) return; // pause for decision(s)
  }

  finalizeTrick(state);
}

/** Award the trick (unless voided), then start the next trick or score the round. */
export function finalizeTrick(state: GameState): void {
  const round = state.round!;
  const res = round.resolution!;

  if (!res.voided) playerAt(state, res.wouldBeWinner)!.tricksWon += 1;
  round.leadSeat = res.wouldBeWinner; // would-be winner leads next even after a Bomb
  round.resolution = undefined;
  round.currentTrick = [];

  const cardsRemain = activeSeats(state).some((s) => playerAt(state, s)!.hand.length > 0);
  if (cardsRemain) {
    round.trickNumber += 1;
    state.phase = 'trick';
    state.currentTurnSeat = res.wouldBeWinner;
  } else {
    scoreRoundAndEnd(state);
  }
}
