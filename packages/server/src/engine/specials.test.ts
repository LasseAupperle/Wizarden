import { describe, expect, it } from 'vitest';
import type { Card, PlayDecision, SpecialType, Suit } from '@wizarden/shared';
import {
  applyBid,
  applyPlay,
  applyResolve,
  advanceRound,
  createGame,
  totalRoundsForCount,
  type ActionResult,
} from './game.js';
import {
  awaitingDecisionSeats,
  clone,
  playerAt,
  type EnginePlayer,
  type GameState,
} from './internalState.js';
import { applyPreBidAndTrump, dealAndStartRound } from './round.js';
import { determineWinner, isLegalPlay, makeCtx } from './resolve.js';
import { RESOLVE_STAGES, type Effective } from './cards/types.js';

// ---- builders ----
const num = (suit: Suit, value: number): Card => ({ kind: 'number', id: `n-${suit}-${value}`, suit, value });
const wiz = (i: number): Card => ({ kind: 'wizard', id: `wizard-${i}` });
const jes = (i: number): Card => ({ kind: 'jester', id: `jester-${i}` });
const sp = (special: SpecialType): Card => ({ kind: 'special', id: `special-${special}`, special });

function ok(r: ActionResult): GameState {
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}: ${r.error.message}`);
  return r.state;
}

function makePlayers(hands: Card[][]): EnginePlayer[] {
  return hands.map((hand, seat) => ({
    seat,
    name: `P${seat}`,
    isBot: false,
    isHost: seat === 0,
    connected: true,
    inPlay: true,
    hand: [...hand],
    bid: 0,
    tricksWon: 0,
    totalScore: 0,
  }));
}

interface TrickOpts {
  hands: Card[][];
  trumpSuit?: Suit | null;
  trumpCard?: Card | null;
  leadSeat?: number;
  pile?: Card[];
  specials?: SpecialType[];
}

/** A state already in the `trick` phase with authored hands. */
function trickState(o: TrickOpts): GameState {
  const players = makePlayers(o.hands);
  const cards = o.hands[0]!.length;
  const lead = o.leadSeat ?? 0;
  return {
    roomCode: 'T',
    phase: 'trick',
    players,
    initialPlayerCount: players.length,
    totalRounds: totalRoundsForCount(players.length),
    gameMode: 'full',
    selectedSpecials: o.specials ?? [],
    round: {
      roundNumber: cards,
      cardsThisRound: cards,
      trumpCard: o.trumpCard ?? null,
      trumpSuit: o.trumpSuit ?? null,
      pile: o.pile ?? [],
      trickNumber: 0,
      leadSeat: lead,
      currentTrick: [],
    },
    currentTurnSeat: lead,
    startMarkerSeat: 0,
    decisions: {},
    rngState: 1,
    scoreboard: [],
    lastRoundResult: null,
    standings: null,
  };
}

/** A post-deal state (phase resolved by applyPreBidAndTrump) for trump-flip tests. */
function postDeal(o: { hands: Card[][]; trumpCard: Card | null; startMarkerSeat?: number }): GameState {
  const players = makePlayers(o.hands);
  const cards = o.hands[0]!.length;
  const state: GameState = {
    roomCode: 'T',
    phase: 'dealing',
    players,
    initialPlayerCount: players.length,
    totalRounds: totalRoundsForCount(players.length),
    gameMode: 'full',
    selectedSpecials: [],
    round: {
      roundNumber: cards,
      cardsThisRound: cards,
      trumpCard: o.trumpCard,
      trumpSuit: null,
      pile: [],
      trickNumber: 0,
      leadSeat: -1,
      currentTrick: [],
    },
    currentTurnSeat: null,
    startMarkerSeat: o.startMarkerSeat ?? 0,
    decisions: {},
    rngState: 1,
    scoreboard: [],
    lastRoundResult: null,
    standings: null,
  };
  applyPreBidAndTrump(state);
  return state;
}

/** Play one card for whoever is currently to move. */
function play(s: GameState, cardId: string, decision?: PlayDecision): GameState {
  return ok(applyPlay(s, s.currentTurnSeat!, cardId, decision));
}

// =====================================================================
// 1. Ranking: Dragon / Fairy / Wizard
// =====================================================================

const W: Effective = { kind: 'wizard' };
const D: Effective = { kind: 'dragon' };
const F: Effective = { kind: 'fairy' };
const S = (suit: Suit, value: number): Effective => ({ kind: 'suited', suit, value });

describe('ranking: dragon / fairy / wizard', () => {
  it('Dragon beats a Wizard', () => {
    expect(determineWinner([{ seat: 0, eff: W }, { seat: 1, eff: D }], 'red', 'red')).toBe(1);
  });
  it('Fairy beats Dragon when both present', () => {
    expect(determineWinner([{ seat: 0, eff: D }, { seat: 1, eff: F }], 'red', 'red')).toBe(1);
  });
  it('Fairy is otherwise the lowest (loses to a number)', () => {
    expect(determineWinner([{ seat: 0, eff: F }, { seat: 1, eff: S('red', 2) }], 'red', null)).toBe(1);
  });
  it('Juggler 7.5 and Cloud 9.75 rank between numbers in their suit', () => {
    // red trump: 8 > juggler(7.5) > 7 ; 10 > cloud(9.75) > 9
    expect(determineWinner([{ seat: 0, eff: S('red', 7.5) }, { seat: 1, eff: S('red', 8) }], 'red', 'red')).toBe(1);
    expect(determineWinner([{ seat: 0, eff: S('red', 7.5) }, { seat: 1, eff: S('red', 7) }], 'red', 'red')).toBe(0);
    expect(determineWinner([{ seat: 0, eff: S('red', 9.75) }, { seat: 1, eff: S('red', 10) }], 'red', 'red')).toBe(1);
  });
});

// =====================================================================
// 2. AMIGO five-card example
// =====================================================================

describe('AMIGO five-card example (Fairy+Dragon+Juggler+Bomb+Witch)', () => {
  it('Fairy is would-be winner, Bomb voids, Juggler passes, then Witch swaps', () => {
    let s = trickState({
      hands: [
        [sp('fairy'), num('red', 2)],
        [sp('dragon'), num('red', 3)],
        [sp('juggler'), num('red', 4)],
        [sp('bomb'), num('red', 5)],
        [sp('witch'), num('red', 6)],
      ],
      trumpSuit: 'red',
      leadSeat: 0,
      specials: ['fairy', 'dragon', 'juggler', 'bomb', 'witch'],
    });
    s = play(s, 'special-fairy');
    s = play(s, 'special-dragon');
    s = play(s, 'special-juggler', { type: 'announceSuit', suit: 'blue' });
    s = play(s, 'special-bomb');
    s = play(s, 'special-witch');

    // After all five: would-be winner = Fairy (seat 0), Bomb voided, Juggler pass raised.
    expect(s.phase).toBe('trickResolving');
    expect(s.round!.resolution!.wouldBeWinner).toBe(0);
    expect(s.round!.resolution!.voided).toBe(true);
    expect(awaitingDecisionSeats(s)).toEqual([0, 1, 2, 3, 4]);
    for (const seat of awaitingDecisionSeats(s)) {
      expect(s.decisions[seat]!.kind).toBe('jugglerPass');
    }

    // Everyone passes their number card clockwise.
    s = ok(applyResolve(s, 0, { cardId: 'n-red-2' }));
    s = ok(applyResolve(s, 1, { cardId: 'n-red-3' }));
    s = ok(applyResolve(s, 2, { cardId: 'n-red-4' }));
    s = ok(applyResolve(s, 3, { cardId: 'n-red-5' }));
    expect(s.phase).toBe('trickResolving'); // still waiting on seat 4
    s = ok(applyResolve(s, 4, { cardId: 'n-red-6' }));

    // Now the Witch swap is the outstanding decision.
    expect(awaitingDecisionSeats(s)).toEqual([4]);
    expect(s.decisions[4]!.kind).toBe('witchSwap');

    // Witch (seat 4) takes the Dragon, gives its held card.
    const giveId = playerAt(s, 4)!.hand[0]!.id;
    s = ok(applyResolve(s, 4, { takeId: 'special-dragon', giveId }));

    // Trick voided => no one scored it; would-be winner (seat 0) leads next.
    expect(s.phase).toBe('trick');
    expect(s.currentTurnSeat).toBe(0);
    for (const p of s.players) expect(p.tricksWon).toBe(0);
    expect(playerAt(s, 4)!.hand.some((c) => c.id === 'special-dragon')).toBe(true);
  });
});

// =====================================================================
// 3. Juggler collective pass
// =====================================================================

describe('Juggler collective pass', () => {
  it('raises a pass for every seat with cards and executes only after all submit', () => {
    let s = trickState({
      hands: [
        [sp('juggler'), num('red', 2)],
        [num('blue', 9), num('blue', 3)],
        [num('green', 9), num('green', 3)],
      ],
      trumpSuit: 'red',
      leadSeat: 0,
      specials: ['juggler'],
    });
    s = play(s, 'special-juggler', { type: 'announceSuit', suit: 'red' });
    s = play(s, 'n-blue-9');
    s = play(s, 'n-green-9');
    expect(awaitingDecisionSeats(s)).toEqual([0, 1, 2]);

    s = ok(applyResolve(s, 0, { cardId: 'n-red-2' }));
    s = ok(applyResolve(s, 1, { cardId: 'n-blue-3' }));
    expect(playerAt(s, 2)!.hand).toHaveLength(1); // not executed yet
    s = ok(applyResolve(s, 2, { cardId: 'n-green-3' }));

    // pass clockwise: 0->1, 1->2, 2->0
    expect(playerAt(s, 1)!.hand[0]!.id).toBe('n-red-2');
    expect(playerAt(s, 2)!.hand[0]!.id).toBe('n-blue-3');
    expect(playerAt(s, 0)!.hand[0]!.id).toBe('n-green-3');
  });

  it('does NOT pass on the last trick of a round', () => {
    let s = trickState({
      hands: [[sp('juggler')], [num('blue', 9)], [num('green', 9)]],
      trumpSuit: 'red',
      leadSeat: 0,
      specials: ['juggler'],
    });
    s = play(s, 'special-juggler', { type: 'announceSuit', suit: 'red' });
    s = play(s, 'n-blue-9');
    s = play(s, 'n-green-9');
    // last trick => no jugglerPass; round scores immediately
    expect(s.phase).toBe('roundEnd');
  });
});

// =====================================================================
// 4. Cloud
// =====================================================================

describe('Cloud', () => {
  it('Cloud + Bomb => no bid change', () => {
    let s = trickState({
      hands: [[sp('cloud')], [sp('bomb')]],
      trumpSuit: 'red',
      leadSeat: 0,
      specials: ['cloud', 'bomb'],
    });
    s = play(s, 'special-cloud', { type: 'announceSuit', suit: 'red' });
    s = play(s, 'special-bomb');
    expect(awaitingDecisionSeats(s)).toEqual([]); // no cloudAdjust
    expect(s.phase).toBe('roundEnd');
    expect(playerAt(s, 0)!.bid).toBe(0); // unchanged
  });

  it('Cloud + Juggler => Juggler passes first, then Cloud adjusts', () => {
    let s = trickState({
      hands: [
        [sp('juggler'), num('red', 2)],
        [sp('cloud'), num('blue', 2)],
      ],
      trumpSuit: 'red',
      leadSeat: 0,
      specials: ['juggler', 'cloud'],
    });
    s = play(s, 'special-juggler', { type: 'announceSuit', suit: 'red' });
    s = play(s, 'special-cloud', { type: 'announceSuit', suit: 'red' });
    // juggler stage first: passes outstanding, NOT yet cloudAdjust
    expect(s.decisions[0]!.kind).toBe('jugglerPass');
    expect(s.decisions[1]!.kind).toBe('jugglerPass');
    s = ok(applyResolve(s, 0, { cardId: 'n-red-2' }));
    s = ok(applyResolve(s, 1, { cardId: 'n-blue-2' }));
    // now cloud adjusts the winner (cloud 9.75 trump beats juggler 7.5) = seat 1
    expect(awaitingDecisionSeats(s)).toEqual([1]);
    expect(s.decisions[1]!.kind).toBe('cloudAdjust');
  });

  it('Cloud winner at bid 0 may only +1', () => {
    let s = trickState({
      hands: [[sp('cloud')], [num('red', 3)]],
      trumpSuit: 'red',
      leadSeat: 0,
      specials: ['cloud'],
    });
    s = play(s, 'special-cloud', { type: 'announceSuit', suit: 'red' });
    s = play(s, 'n-red-3');
    expect(s.decisions[0]!.kind).toBe('cloudAdjust');
    expect(applyResolve(s, 0, { delta: -1 }).ok).toBe(false);
    const after = ok(applyResolve(s, 0, { delta: 1 }));
    expect(playerAt(after, 0)!.bid).toBe(1);
  });
});

// =====================================================================
// 5. Werewolf
// =====================================================================

describe('Werewolf', () => {
  it('in hand => bidding blocked until the swap + trump choice resolves', () => {
    const s = postDeal({
      hands: [[num('red', 1), num('red', 2)], [sp('werewolf'), num('blue', 2)], [num('green', 1), num('green', 2)]],
      trumpCard: num('yellow', 9),
    });
    expect(s.phase).toBe('preBid');
    expect(s.decisions[1]!.kind).toBe('werewolfSwap');
    expect(applyBid(s, 1, 0).ok).toBe(false); // cannot bid yet

    const after = ok(applyResolve(s, 1, { suit: 'green' }));
    expect(after.phase).toBe('bidding');
    expect(after.round!.trumpSuit).toBe('green');
    // holder took the flipped card; the Werewolf is now the retained trump card
    expect(playerAt(after, 1)!.hand.some((c) => c.id === 'n-yellow-9')).toBe(true);
    expect(playerAt(after, 1)!.hand.some((c) => c.kind === 'special')).toBe(false);
    expect(after.round!.trumpCard!.id).toBe('special-werewolf');
  });

  it('flipped as the trump card => start-marker chooses trump', () => {
    const s = postDeal({ hands: [[num('red', 1)], [num('blue', 1)], [num('green', 1)]], trumpCard: sp('werewolf') });
    expect(s.phase).toBe('trumpDecision');
    expect(s.decisions[0]!.kind).toBe('chooseTrump');
  });

  it('Wizard flipped + Werewolf in hand => Werewolf swap supersedes the start-marker choice', () => {
    const s = postDeal({
      hands: [[num('red', 1)], [sp('werewolf')], [num('green', 1)]],
      trumpCard: wiz(0),
    });
    expect(s.phase).toBe('preBid');
    expect(s.decisions[1]!.kind).toBe('werewolfSwap');
    expect(s.decisions[0]).toBeUndefined(); // no chooseTrump for the start marker
  });
});

// =====================================================================
// 6. Vampire
// =====================================================================

describe('Vampire', () => {
  it('copies a flipped number trump (its suit + value)', () => {
    let s = trickState({
      hands: [[num('blue', 5)], [sp('vampire')]],
      trumpSuit: 'blue',
      trumpCard: num('blue', 7),
      leadSeat: 0,
      specials: ['vampire'],
    });
    s = play(s, 'n-blue-5');
    s = play(s, 'special-vampire');
    expect(s.phase).toBe('roundEnd');
    expect(playerAt(s, 1)!.tricksWon).toBe(1); // vampire = blue 7 trump beats blue 5
  });

  it("copies a flipped special's effects (Dragon) to beat a Wizard", () => {
    let s = trickState({
      hands: [[wiz(0)], [sp('vampire')]],
      trumpSuit: 'red',
      trumpCard: sp('dragon'),
      leadSeat: 0,
      specials: ['vampire', 'dragon', 'fairy'],
    });
    s = play(s, 'wizard-0');
    s = play(s, 'special-vampire');
    expect(playerAt(s, 1)!.tricksWon).toBe(1); // vampire copies Dragon -> beats the Wizard
  });

  it('when the flipped card was the Werewolf, flips a fresh trump for the rest of the round', () => {
    let s = trickState({
      hands: [[sp('vampire')], [num('red', 2)]],
      trumpSuit: null,
      trumpCard: sp('werewolf'),
      pile: [num('green', 9)],
      leadSeat: 0,
      specials: ['vampire', 'werewolf'],
    });
    s = play(s, 'special-vampire'); // not resolved yet (2 players, 1 card played)
    expect(s.round!.trumpSuit).toBe('green');
    expect(s.round!.trumpCard!.id).toBe('n-green-9');
  });
});

// =====================================================================
// 7. Trump-on-flip mapping (§7.3)
// =====================================================================

describe('trump-on-flip mapping', () => {
  const chooseTrumpSpecials: SpecialType[] = ['dragon', 'juggler', 'cloud', 'werewolf', 'vampire', 'shapeshifter'];
  const noTrumpSpecials: SpecialType[] = ['fairy', 'bomb', 'witch'];

  for (const special of chooseTrumpSpecials) {
    it(`${special} flipped => chooseTrump`, () => {
      const s = postDeal({ hands: [[num('red', 1)], [num('blue', 1)], [num('green', 1)]], trumpCard: sp(special) });
      expect(s.phase).toBe('trumpDecision');
      expect(s.decisions[0]!.kind).toBe('chooseTrump');
    });
  }
  for (const special of noTrumpSpecials) {
    it(`${special} flipped => no trump`, () => {
      const s = postDeal({ hands: [[num('red', 1)], [num('blue', 1)], [num('green', 1)]], trumpCard: sp(special) });
      expect(s.phase).toBe('bidding');
      expect(s.round!.trumpSuit).toBeNull();
    });
  }
  it('Jester flipped => no trump; number => its suit; Wizard => chooseTrump', () => {
    expect(postDeal({ hands: [[num('red', 1)], [num('blue', 1)], [num('green', 1)]], trumpCard: jes(0) }).round!.trumpSuit).toBeNull();
    expect(postDeal({ hands: [[num('red', 1)], [num('blue', 1)], [num('green', 1)]], trumpCard: num('red', 4) }).round!.trumpSuit).toBe('red');
    expect(postDeal({ hands: [[num('red', 1)], [num('blue', 1)], [num('green', 1)]], trumpCard: wiz(0) }).phase).toBe('trumpDecision');
  });
});

// =====================================================================
// 8. Full seeded game with ALL specials
// =====================================================================

const ALL_SPECIALS: SpecialType[] = [
  'dragon', 'fairy', 'bomb', 'werewolf', 'juggler', 'cloud', 'witch', 'vampire', 'shapeshifter',
];

function autoplaySpecials(start: GameState): GameState {
  let s = start;
  let guard = 0;
  while (s.phase !== 'gameOver') {
    if (++guard > 500000) throw new Error('autoplay loop guard');
    switch (s.phase) {
      case 'preBid':
      case 'trumpDecision': {
        const seat = awaitingDecisionSeats(s)[0]!;
        s = ok(applyResolve(s, seat, { suit: 'red' }));
        break;
      }
      case 'bidding':
        s = ok(applyBid(s, s.currentTurnSeat!, 0));
        break;
      case 'trick': {
        const seat = s.currentTurnSeat!;
        const p = playerAt(s, seat)!;
        const ctx = makeCtx(s);
        const card = p.hand.find((c) => isLegalPlay(p.hand, c, s.round!.currentTrick, ctx))!;
        let decision: PlayDecision = { type: 'none' };
        if (card.kind === 'special' && card.special === 'shapeshifter') decision = { type: 'shapeshifter', as: 'jester' };
        else if (card.kind === 'special' && (card.special === 'juggler' || card.special === 'cloud'))
          decision = { type: 'announceSuit', suit: 'red' };
        s = ok(applyPlay(s, seat, card.id, decision));
        break;
      }
      case 'trickResolving': {
        const seat = awaitingDecisionSeats(s)[0]!;
        const d = s.decisions[seat]!;
        if (d.kind === 'cloudAdjust') s = ok(applyResolve(s, seat, { delta: 1 }));
        else if (d.kind === 'jugglerPass') s = ok(applyResolve(s, seat, { cardId: playerAt(s, seat)!.hand[0]!.id }));
        else if (d.kind === 'witchSwap')
          s = ok(applyResolve(s, seat, { takeId: d.trickCardIds[0]!, giveId: playerAt(s, seat)!.hand[0]!.id }));
        else throw new Error(`unexpected decision in resolving: ${d.kind}`);
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

describe('full seeded game with all specials', () => {
  for (const seed of [101, 202, 303]) {
    it(`seed ${seed}: 3 players runs to gameOver`, () => {
      const players = [0, 1, 2].map((seat) => ({ seat, name: `P${seat}` }));
      const s = autoplaySpecials(createGame({ roomCode: 'ALL', players, selectedSpecials: ALL_SPECIALS, seed }));
      expect(s.phase).toBe('gameOver');
      expect(s.scoreboard).toHaveLength(totalRoundsForCount(3));
      expect(s.standings).toHaveLength(3);
    });
  }

  it('extended final round still flips a trump card', () => {
    const base = createGame({
      roomCode: 'X',
      players: [0, 1, 2].map((seat) => ({ seat, name: `P${seat}` })),
      selectedSpecials: ALL_SPECIALS,
      seed: 7,
    });
    const draft = clone(base);
    dealAndStartRound(draft, draft.totalRounds); // final round
    expect(draft.round!.trumpCard).not.toBeNull();
  });
});

// =====================================================================
// 9. Resolver order is pinned
// =====================================================================

describe('resolver order', () => {
  it('stages are bomb -> juggler -> cloud -> witch', () => {
    expect(RESOLVE_STAGES).toEqual(['bomb', 'juggler', 'cloud', 'witch']);
  });
});
