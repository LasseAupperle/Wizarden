import { describe, expect, it } from 'vitest';
import type { Card, Suit } from '@wizarden/shared';
import {
  applyBid,
  applyChooseTrump,
  applyPlay,
  advanceRound,
  createGame,
  totalRoundsForCount,
  type ActionResult,
} from './game.js';
import { clone, playerAt, type EnginePlayer, type GameState } from './internalState.js';
import { beginBidding, dealAndStartRound } from './round.js';
import { isLegalPlay } from './trick.js';

// ---- test helpers ----

const num = (suit: Suit, value: number): Card => ({
  kind: 'number',
  id: `n-${suit}-${value}`,
  suit,
  value,
});
const wiz = (i: number): Card => ({ kind: 'wizard', id: `wizard-${i}` });

function ok(r: ActionResult): GameState {
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}: ${r.error.message}`);
  return r.state;
}

/** Build a state already in `bidding` with authored hands and a fixed trump. */
function biddingState(hands: Card[][], trumpSuit: Suit | null, startMarkerSeat = 0): GameState {
  const players: EnginePlayer[] = hands.map((hand, seat) => ({
    seat,
    name: `P${seat}`,
    isBot: false,
    isHost: seat === 0,
    connected: true,
    inPlay: true,
    hand: [...hand],
    bid: null,
    tricksWon: 0,
    totalScore: 0,
  }));
  const cards = hands[0]!.length;
  const state: GameState = {
    roomCode: 'TEST',
    phase: 'dealing',
    players,
    initialPlayerCount: players.length,
    totalRounds: totalRoundsForCount(players.length),
    gameMode: 'full',
    selectedSpecials: [],
    round: {
      roundNumber: cards,
      cardsThisRound: cards,
      trumpCard: null,
      trumpSuit,
      pile: [],
      trickNumber: 0,
      leadSeat: -1,
      currentTrick: [],
    },
    currentTurnSeat: null,
    startMarkerSeat,
    decisions: {},
    rngState: 1,
    scoreboard: [],
    lastRoundResult: null,
    standings: null,
  };
  beginBidding(state);
  return state;
}

/** Drive a game to gameOver by always bidding 0 and playing the first legal card. */
function autoplay(start: GameState): GameState {
  let s = start;
  let guard = 0;
  while (s.phase !== 'gameOver') {
    if (++guard > 200000) throw new Error('autoplay loop guard tripped');
    switch (s.phase) {
      case 'trumpDecision': {
        const seat = Number(Object.keys(s.decisions)[0]);
        s = ok(applyChooseTrump(s, seat, 'red'));
        break;
      }
      case 'bidding':
        s = ok(applyBid(s, s.currentTurnSeat!, 0));
        break;
      case 'trick': {
        const seat = s.currentTurnSeat!;
        const p = playerAt(s, seat)!;
        const card = p.hand.find((c) => isLegalPlay(p.hand, c, s.round!.currentTrick))!;
        s = ok(applyPlay(s, seat, card.id));
        break;
      }
      case 'roundEnd':
        s = ok(advanceRound(s));
        break;
      default:
        throw new Error(`unexpected phase: ${s.phase}`);
    }
  }
  return s;
}

// ---- scripted round: exact winners + exact scores ----

describe('scripted base round (3 players, trump red)', () => {
  it('produces the exact trick winners and scores', () => {
    let s = biddingState(
      [
        [num('red', 10), num('blue', 2)], // P0
        [num('green', 5), num('red', 3)], // P1
        [num('blue', 9), wiz(0)], // P2
      ],
      'red',
      0,
    );
    // bidding order clockwise of start marker(0): [1, 2, 0]
    expect(s.currentTurnSeat).toBe(1);
    s = ok(applyBid(s, 1, 1));
    s = ok(applyBid(s, 2, 0));
    s = ok(applyBid(s, 0, 0));
    expect(s.phase).toBe('trick');
    expect(s.currentTurnSeat).toBe(1); // first bidder leads

    // Trick 1: P1 green5, P2 wizard, P0 red10 -> Wizard wins (P2)
    s = ok(applyPlay(s, 1, 'n-green-5'));
    s = ok(applyPlay(s, 2, 'wizard-0'));
    s = ok(applyPlay(s, 0, 'n-red-10'));
    expect(playerAt(s, 2)!.tricksWon).toBe(1);
    expect(s.currentTurnSeat).toBe(2); // winner leads next

    // Trick 2: P2 blue9, P0 blue2 (must follow), P1 red3 (trump) -> trump wins (P1)
    s = ok(applyPlay(s, 2, 'n-blue-9'));
    s = ok(applyPlay(s, 0, 'n-blue-2'));
    s = ok(applyPlay(s, 1, 'n-red-3'));

    expect(s.phase).toBe('roundEnd');
    const bySeat = Object.fromEntries(s.lastRoundResult!.map((r) => [r.seat, r]));
    expect(bySeat[0]!.tricksWon).toBe(0);
    expect(bySeat[1]!.tricksWon).toBe(1);
    expect(bySeat[2]!.tricksWon).toBe(1);
    // P0 bid0 won0 -> +20 ; P1 bid1 won1 -> +30 ; P2 bid0 won1 -> -10
    expect(bySeat[0]!.delta).toBe(20);
    expect(bySeat[1]!.delta).toBe(30);
    expect(bySeat[2]!.delta).toBe(-10);
  });
});

// ---- illegal play rejection ----

describe('legal-move validation', () => {
  it('rejects not following the led suit when able', () => {
    let s = biddingState(
      [
        [num('green', 5), num('blue', 1)], // P0 leads
        [num('green', 7), num('red', 2)], // P1 holds green
        [num('green', 9), num('blue', 4)], // P2
      ],
      null,
      2, // start marker 2 -> bidding order [0,1,2], P0 leads
    );
    s = ok(applyBid(s, 0, 0));
    s = ok(applyBid(s, 1, 0));
    s = ok(applyBid(s, 2, 0));
    s = ok(applyPlay(s, 0, 'n-green-5')); // led green

    const bad = applyPlay(s, 1, 'n-red-2'); // P1 has green -> must follow
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('ILLEGAL_MOVE');

    const good = applyPlay(s, 1, 'n-green-7');
    expect(good.ok).toBe(true);
  });

  it('rejects bidding out of turn and out of range', () => {
    const s = biddingState([[num('red', 1)], [num('blue', 1)], [num('green', 1)]], null, 0);
    expect(applyBid(s, 0, 0).ok).toBe(false); // not P0's turn (order [1,2,0])
    expect(applyBid(s, 1, 5).ok).toBe(false); // > cardsThisRound (1)
    expect(applyBid(s, 1, 1).ok).toBe(true);
  });
});

// ---- full seeded game per player count ----

describe('full seeded game runs to gameOver', () => {
  for (const count of [3, 4, 5, 6]) {
    it(`${count} players -> ${totalRoundsForCount(count)} rounds, correct standings`, () => {
      const players = Array.from({ length: count }, (_, seat) => ({ seat, name: `P${seat}` }));
      const s = autoplay(createGame({ roomCode: 'GAME', players, seed: 12345 + count }));
      expect(s.phase).toBe('gameOver');
      expect(s.scoreboard).toHaveLength(totalRoundsForCount(count));
      expect(s.standings).toHaveLength(count);
      // standings sorted descending by score
      for (let i = 1; i < s.standings!.length; i++) {
        expect(s.standings![i - 1]!.totalScore).toBeGreaterThanOrEqual(s.standings![i]!.totalScore);
      }
      // every player's totalScore equals the sum of their per-round deltas
      for (const p of s.players) {
        const sum = s.scoreboard.reduce(
          (acc, round) => acc + (round.find((r) => r.seat === p.seat)?.delta ?? 0),
          0,
        );
        expect(p.totalScore).toBe(sum);
      }
    });
  }
});

// ---- final round has no trump in the base game ----

describe('base final round has no trump', () => {
  it('dealing the last round empties the deck (no trump card / suit)', () => {
    const base = createGame({
      roomCode: 'X',
      players: [
        { seat: 0, name: 'A' },
        { seat: 1, name: 'B' },
        { seat: 2, name: 'C' },
      ],
      seed: 5,
    });
    const draft = clone(base);
    dealAndStartRound(draft, draft.totalRounds); // round 20 for 3 players
    expect(draft.round!.trumpCard).toBeNull();
    expect(draft.round!.trumpSuit).toBeNull();
    expect(draft.phase).toBe('bidding');
  });
});

// ---- start-marker rotation skips an inactive seat ----

describe('start-marker rotation', () => {
  it('skips a departed (inactive) seat on advance', () => {
    const base = createGame({
      roomCode: 'Y',
      players: [
        { seat: 0, name: 'A' },
        { seat: 1, name: 'B' },
        { seat: 2, name: 'C' },
        { seat: 3, name: 'D' },
      ],
      seed: 9,
    });
    const s = clone(base);
    // pretend round 1 just ended; seat 1 has departed
    s.phase = 'roundEnd';
    s.currentTurnSeat = null;
    s.round!.roundNumber = 1;
    s.lastRoundResult = [];
    playerAt(s, 1)!.inPlay = false;
    s.startMarkerSeat = 0;

    const next = ok(advanceRound(s));
    expect(next.startMarkerSeat).toBe(2); // 0 -> skip 1 -> 2
  });
});
