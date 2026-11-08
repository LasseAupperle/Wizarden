import { describe, expect, it } from 'vitest';
import { awaitingDecisionSeats } from '../engine/internalState.js';
import { decideBotMove } from '../bots/randomBot.js';
import { projectFor } from '../net/broadcast.js';
import { Room } from './room.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Make one legal move for whoever must act (bot logic as a legal-move oracle). */
function step(room: Room): void {
  const g = room.game!;
  const seat = awaitingDecisionSeats(g)[0] ?? g.currentTurnSeat;
  if (seat == null) throw new Error('nobody to act');
  const move = decideBotMove(g, seat)!;
  const r =
    move.kind === 'bid'
      ? room.bid(seat, move.bid)
      : move.kind === 'play'
        ? room.play(seat, move.cardId, move.decision)
        : room.resolve(seat, move.payload);
  if (!r.ok) throw new Error(`move failed: ${r.error.code}`);
}

describe('finished-trick hold (everyone sees the last card + winner)', () => {
  it('holds the trick, exposes it with the winner, blocks the next lead, then releases', async () => {
    const room = new Room('HOLD', { trickHoldMs: 80, roundSummaryMs: 0 });
    for (const n of ['A', 'B', 'C']) room.addPlayer(n);
    expect(room.start(0).ok).toBe(true);

    // Round 1 (1 trick) -> hold -> round 2; then play round 2's first trick.
    while (room.game!.round!.roundNumber < 2) {
      if (room.holdingTrick || room.game!.phase === 'roundEnd') await sleep(30);
      else step(room);
    }
    const startSeq = room.game!.trickSeq ?? 0;
    while ((room.game!.trickSeq ?? 0) === startSeq) step(room);

    // Mid-round: the finished trick is held on the table.
    expect(room.game!.phase).toBe('trick');
    expect(room.holdingTrick).toBe(true);
    const view = projectFor(room, 0);
    expect(view.currentTrick).toEqual([]);
    expect(view.lastTrick?.plays).toHaveLength(3);
    expect(view.lastTrick?.winnerSeat).toBe(room.game!.currentTurnSeat); // winner leads next

    // The next lead must wait.
    const lead = room.game!.currentTurnSeat!;
    const move = decideBotMove(room.game!, lead)!;
    expect(move.kind).toBe('play');
    if (move.kind === 'play') {
      const early = room.play(lead, move.cardId, move.decision);
      expect(early.ok).toBe(false);
    }

    await sleep(120);
    expect(room.holdingTrick).toBe(false);
    expect(projectFor(room, 0).lastTrick).toBeNull();
    step(room); // now allowed
    room.dispose();
  });

  it('trickHoldMs 0 disables the hold', () => {
    const room = new Room('NOHOLD', { trickHoldMs: 0, roundSummaryMs: 10_000 });
    for (const n of ['A', 'B', 'C']) room.addPlayer(n);
    room.start(0);
    while (room.game!.phase !== 'roundEnd') step(room);
    expect(room.holdingTrick).toBe(false);
    expect(projectFor(room, 0).lastTrick).toBeNull();
    room.dispose();
  });
});
