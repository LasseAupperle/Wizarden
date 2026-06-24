import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameOver } from './GameOver.js';
import { intents } from '../net/socket.js';
import { makeState, player } from '../test/fixtures.js';

vi.mock('../net/socket.js', () => ({
  DEBUG_ENABLED: false,
  getSocket: vi.fn(),
  intents: {
    playAgain: vi.fn(),
    leave: vi.fn(),
    start: vi.fn(),
    bid: vi.fn(),
    play: vi.fn(),
    resolve: vi.fn(),
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    removePlayer: vi.fn(),
    addBot: vi.fn(),
    removeBot: vi.fn(),
    configureSpecials: vi.fn(),
    configureMode: vi.fn(),
  },
}));

const standings = [
  player(1, { name: 'Bob', totalScore: 120 }),
  player(0, { name: 'You', totalScore: 90 }),
  player(2, { name: 'Cara', totalScore: 40 }),
];

describe('GameOver screen', () => {
  it('announces the winner and lists standings', () => {
    render(<GameOver game={makeState({ phase: 'gameOver', gameOver: { standings } })} />);
    expect(screen.getByText(/winner/i)).toBeInTheDocument();
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0); // winner heading + standings
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('host can Play Again', () => {
    render(<GameOver game={makeState({ phase: 'gameOver', gameOver: { standings } })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(intents.playAgain).toHaveBeenCalled();
  });
});
