import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { selectScreen } from './store/gameStore.js';
import { Landing } from './screens/Landing.js';
import type { ClientGameState } from '@wizarden/shared';

function stateWith(phase: ClientGameState['phase']): ClientGameState {
  return {
    roomCode: 'ABCD',
    phase,
    players: [],
    yourSeat: 0,
    yourHand: [],
    roundNumber: 0,
    totalRounds: 0,
    gameMode: 'full',
    startMarkerSeat: 0,
    currentTurnSeat: null,
    awaitingDecisionSeats: [],
    trumpCard: null,
    trumpSuit: null,
    currentTrick: [],
    selectedSpecials: [],
    pendingDecision: null,
    paused: false,
    pausedForName: null,
    scoreboard: [],
    lastRoundResult: null,
    gameOver: null,
  };
}

describe('screen selection', () => {
  it('maps connection/phase to the right screen', () => {
    expect(selectScreen(null)).toBe('landing');
    expect(selectScreen(stateWith('lobby'))).toBe('lobby');
    expect(selectScreen(stateWith('bidding'))).toBe('game');
    expect(selectScreen(stateWith('gameOver'))).toBe('gameover');
  });
});

describe('Landing', () => {
  it('shows the wordmark and primary actions', () => {
    render(<Landing />);
    expect(screen.getByRole('heading', { name: 'Wizarden' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create room/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join room/i })).toBeInTheDocument();
  });
});
