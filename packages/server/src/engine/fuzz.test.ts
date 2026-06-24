// Property/fuzz harness (spec §20). Plays many complete all-specials games with
// random player counts and a random-but-legal policy for every action/decision,
// asserting invariants after every step. A failure prints the seed so the exact
// game replays deterministically (the engine RNG is seeded).
//
// CI runs a small batch; set WIZARDEN_FUZZ_GAMES for a larger on-demand run.

import { describe, expect, it } from 'vitest';
import { SUITS, type PlayDecision, type SpecialType } from '@wizarden/shared';
import {
  applyBid,
  applyPlay,
  applyResolve,
  advanceRound,
  createGame,
  type ActionResult,
} from './game.js';
import { awaitingDecisionSeats, playerAt, type GameState } from './internalState.js';
import { isLegalPlay, makeCtx } from './resolve.js';

const ALL_SPECIALS: SpecialType[] = [
  'dragon',
  'fairy',
  'bomb',
  'werewolf',
  'juggler',
  'cloud',
  'witch',
  'vampire',
  'shapeshifter',
];

const GAMES = Number(process.env.WIZARDEN_FUZZ_GAMES ?? 120);

// A tiny seeded RNG for the fuzz POLICY itself (independent of the engine RNG).
function policyRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 16), 0x45d9f3b);
    t = Math.imul(t ^ (t >>> 16), 0x45d9f3b);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
}

function unwrap(r: ActionResult, seed: number): GameState {
  if (!r.ok) throw new Error(`[seed ${seed}] illegal action: ${r.error.code} ${r.error.message}`);
  return r.state;
}

/** Visible card ids: hands + pile + current trick + the flipped trump card. */
function visibleIds(s: GameState): string[] {
  const ids: string[] = [];
  for (const p of s.players) for (const c of p.hand) ids.push(c.id);
  if (s.round) {
    for (const c of s.round.pile) ids.push(c.id);
    for (const t of s.round.currentTrick) ids.push(t.card.id);
    if (s.round.trumpCard) ids.push(s.round.trumpCard.id);
  }
  return ids;
}

function checkInvariants(s: GameState, seed: number): void {
  // no card id is ever in two visible places at once
  const ids = visibleIds(s);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error(`[seed ${seed}] duplicate card id in play (phase ${s.phase})`);
  }
  // bids / tricksWon stay within range
  const n = s.round?.cardsThisRound ?? 0;
  for (const p of s.players) {
    // bid is normally 0..n, but a Cloud may push the winner's bid to n+1.
    if (p.bid !== null && (p.bid < 0 || p.bid > n + 1)) {
      throw new Error(`[seed ${seed}] bid ${p.bid} out of range for seat ${p.seat}`);
    }
    if (p.tricksWon < 0 || p.tricksWon > n) {
      throw new Error(`[seed ${seed}] tricksWon ${p.tricksWon} out of range for seat ${p.seat}`);
    }
  }
}

/** Perform exactly one legal action for the current state. */
function step(s: GameState, rnd: () => number, seed: number): GameState {
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;

  switch (s.phase) {
    case 'preBid':
    case 'trumpDecision': {
      const seat = awaitingDecisionSeats(s)[0]!;
      const suit = rnd() < 0.1 && s.decisions[seat]!.kind === 'werewolfSwap' ? null : pick(SUITS);
      return unwrap(applyResolve(s, seat, { suit }), seed);
    }
    case 'bidding': {
      const seat = s.currentTurnSeat!;
      const max = s.round!.cardsThisRound;
      return unwrap(applyBid(s, seat, Math.floor(rnd() * (max + 1))), seed);
    }
    case 'trick': {
      const seat = s.currentTurnSeat!;
      const p = playerAt(s, seat)!;
      const ctx = makeCtx(s);
      const legal = p.hand.filter((c) => isLegalPlay(p.hand, c, s.round!.currentTrick, ctx));
      const card = pick(legal.length > 0 ? legal : p.hand);
      let decision: PlayDecision = { type: 'none' };
      if (card.kind === 'special' && card.special === 'shapeshifter')
        decision = { type: 'shapeshifter', as: rnd() < 0.5 ? 'wizard' : 'jester' };
      else if (card.kind === 'special' && (card.special === 'juggler' || card.special === 'cloud'))
        decision = { type: 'announceSuit', suit: pick(SUITS) };
      return unwrap(applyPlay(s, seat, card.id, decision), seed);
    }
    case 'trickResolving': {
      const seat = awaitingDecisionSeats(s)[0]!;
      const d = s.decisions[seat]!;
      if (d.kind === 'cloudAdjust') {
        const bid = playerAt(s, seat)!.bid ?? 0;
        return unwrap(applyResolve(s, seat, { delta: bid === 0 ? 1 : rnd() < 0.5 ? 1 : -1 }), seed);
      }
      if (d.kind === 'jugglerPass') {
        return unwrap(applyResolve(s, seat, { cardId: pick(playerAt(s, seat)!.hand).id }), seed);
      }
      // witchSwap
      return unwrap(
        applyResolve(s, seat, {
          takeId: pick(d.trickCardIds),
          giveId: pick(playerAt(s, seat)!.hand).id,
        }),
        seed,
      );
    }
    case 'roundEnd':
      return unwrap(advanceRound(s), seed);
    default:
      throw new Error(`[seed ${seed}] unexpected phase: ${s.phase}`);
  }
}

describe('engine fuzz (§20)', () => {
  it(`plays ${GAMES} random all-specials games to gameOver with invariants intact`, () => {
    for (let g = 0; g < GAMES; g++) {
      const seed = 1000 + g;
      const rnd = policyRng(seed * 2654435761);
      const count = 3 + Math.floor(rnd() * 4); // 3..6
      const players = Array.from({ length: count }, (_, seat) => ({ seat, name: `P${seat}` }));

      let s = createGame({ roomCode: 'FUZZ', players, selectedSpecials: ALL_SPECIALS, seed });
      checkInvariants(s, seed);

      let guard = 0;
      while (s.phase !== 'gameOver') {
        if (++guard > 1_000_000) throw new Error(`[seed ${seed}] resolver deadlock`);
        s = step(s, rnd, seed);
        checkInvariants(s, seed);
      }

      expect(s.scoreboard).toHaveLength(s.totalRounds);
      expect(s.standings).toHaveLength(count);
    }
  }, 60000);

  it('an invariant catches a deliberately corrupted state', () => {
    const s = createGame({
      roomCode: 'X',
      players: [0, 1, 2].map((seat) => ({ seat, name: `P${seat}` })),
      seed: 1,
    });
    // duplicate a card id into another hand
    const dup = s.players[0]!.hand[0]!;
    s.players[1]!.hand.push({ ...dup });
    expect(() => checkInvariants(s, 1)).toThrow(/duplicate card id/);
  });
});
