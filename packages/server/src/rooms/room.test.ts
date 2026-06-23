import { describe, expect, it } from 'vitest';
import type { GameState } from '../engine/internalState.js';
import { projectFor } from '../net/broadcast.js';
import { Room } from './room.js';

function seatPlayers(n: number) {
  return Array.from({ length: n }, (_, seat) => ({
    seat,
    name: `P${seat}`,
    isBot: false,
    isHost: seat === 0,
    connected: true,
    inPlay: true,
    hand: [],
    bid: null,
    tricksWon: 0,
    totalScore: 0,
  }));
}

/** A minimal in-progress game state waiting on a collective jugglerPass for seat 1. */
function jugglerWaitingGame(): GameState {
  return {
    roomCode: 'T',
    phase: 'trickResolving',
    players: seatPlayers(3),
    initialPlayerCount: 3,
    totalRounds: 20,
    gameMode: 'full',
    selectedSpecials: ['juggler'],
    round: {
      roundNumber: 2,
      cardsThisRound: 2,
      trumpCard: null,
      trumpSuit: 'red',
      pile: [],
      trickNumber: 0,
      leadSeat: 0,
      currentTrick: [],
      resolution: { wouldBeWinner: 0, voided: false, stageIndex: 2, jugglerPasses: {} },
    },
    currentTurnSeat: null,
    startMarkerSeat: 0,
    decisions: { 1: { kind: 'jugglerPass', seat: 1 } },
    rngState: 1,
    scoreboard: [],
    lastRoundResult: null,
    standings: null,
  };
}

describe('Room pause on an owed collective decision', () => {
  function buildStartedRoom(): Room {
    const room = new Room('T', {});
    for (let seat = 0; seat < 3; seat++) {
      const p = room.addPlayer(`P${seat}`, { socketId: `sock${seat}` });
      p.token = `tok${seat}`;
    }
    room.started = true;
    room.game = jugglerWaitingGame();
    return room;
  }

  it('pauses while the seat owing a jugglerPass is disconnected, resumes on return', () => {
    const room = buildStartedRoom();
    room.recomputePause();
    expect(room.game!.paused).toBe(false); // all connected

    room.markDisconnected(1);
    expect(room.game!.paused).toBe(true);
    expect(room.game!.pausedForName).toBe('P1');

    room.markReconnected(1, 'sock1b');
    expect(room.game!.paused).toBe(false);
  });

  it('re-exposes the owned decision to that seat (rejoin re-prompt source)', () => {
    const room = buildStartedRoom();
    const view = projectFor(room, 1);
    expect(view.pendingDecision).toEqual({ kind: 'jugglerPass', seat: 1 });
    // another seat never sees seat 1's decision
    expect(projectFor(room, 0).pendingDecision).toBeNull();
    expect(projectFor(room, 0).awaitingDecisionSeats).toEqual([1]);
  });

  it('off-turn disconnect does not pause', () => {
    const room = buildStartedRoom();
    room.markDisconnected(2); // seat 2 owes nothing
    expect(room.game!.paused).toBe(false);
  });
});
