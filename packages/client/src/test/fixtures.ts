import type { ClientGameState, PlayerPublic } from '@wizarden/shared';

export function player(seat: number, over: Partial<PlayerPublic> = {}): PlayerPublic {
  return {
    seat,
    name: `P${seat}`,
    connected: true,
    inPlay: true,
    isHost: seat === 0,
    isBot: false,
    bid: null,
    tricksWon: 0,
    handCount: 1,
    totalScore: 0,
    ...over,
  };
}

/** A minimal ClientGameState for component tests; override what each test needs. */
export function makeState(over: Partial<ClientGameState> = {}): ClientGameState {
  return {
    roomCode: 'TEST',
    phase: 'bidding',
    gameMode: 'full',
    players: [player(0, { name: 'You' }), player(1, { name: 'Bob' }), player(2, { name: 'Cara' })],
    yourSeat: 0,
    yourHand: [{ kind: 'number', id: 'n-red-5', suit: 'red', value: 5 }],
    roundNumber: 1,
    totalRounds: 20,
    startMarkerSeat: 0,
    currentTurnSeat: 0,
    awaitingDecisionSeats: [],
    trumpCard: null,
    trumpSuit: 'red',
    currentTrick: [],
    selectedSpecials: [],
    pendingDecision: null,
    paused: false,
    pausedForName: null,
    scoreboard: [],
    lastRoundResult: null,
    gameOver: null,
    ...over,
  };
}
