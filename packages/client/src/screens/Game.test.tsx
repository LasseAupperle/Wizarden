import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Game } from './Game.js';
import { intents } from '../net/socket.js';
import { makeState } from '../test/fixtures.js';

vi.mock('../net/socket.js', () => ({
  DEBUG_ENABLED: false,
  getSocket: vi.fn(),
  intents: {
    bid: vi.fn(),
    play: vi.fn(),
    resolve: vi.fn(),
    start: vi.fn(),
    leave: vi.fn(),
    playAgain: vi.fn(),
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    removePlayer: vi.fn(),
    addBot: vi.fn(),
    removeBot: vi.fn(),
    configureSpecials: vi.fn(),
    configureMode: vi.fn(),
  },
}));

describe('Game screen', () => {
  it('shows the bid sheet on your bidding turn and bids on tap', () => {
    render(<Game game={makeState({ phase: 'bidding', currentTurnSeat: 0 })} />);
    expect(screen.getByText('Your bid')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    expect(intents.bid).toHaveBeenCalledWith(1);
  });

  it('shows a "your turn" cue and your hand on your trick turn', () => {
    render(<Game game={makeState({ phase: 'trick', currentTurnSeat: 0 })} />);
    // the visible pill + the sr-only announcement both mention "your turn"
    expect(screen.getAllByText(/your turn/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Red 5')).toBeInTheDocument();
  });

  it('renders the chooseTrump decision prompt with suit options', () => {
    render(
      <Game
        game={makeState({
          phase: 'trumpDecision',
          currentTurnSeat: null,
          pendingDecision: { kind: 'chooseTrump', seat: 0 },
          awaitingDecisionSeats: [0],
        })}
      />,
    );
    expect(screen.getByText(/choose the trump/i)).toBeInTheDocument();
    // a suit not present in the hand, so it's unambiguously the suit-pick button
    const blue = screen.getByRole('button', { name: /Blue/ });
    fireEvent.click(blue);
    expect(intents.resolve).toHaveBeenCalledWith({ suit: 'blue' });
  });

  it('shows the round-end summary with an auto-advance countdown', () => {
    render(
      <Game
        game={makeState({
          phase: 'roundEnd',
          currentTurnSeat: null,
          lastRoundResult: [{ seat: 0, bid: 0, tricksWon: 0, delta: 20, total: 20 }],
        })}
      />,
    );
    expect(screen.getByText(/next round in/i)).toBeInTheDocument();
    expect(screen.getByText('+20')).toBeInTheDocument();
  });
});
