import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Lobby } from './Lobby.js';
import { intents } from '../net/socket.js';
import { makeState, player } from '../test/fixtures.js';

vi.mock('../net/socket.js', () => ({
  DEBUG_ENABLED: false,
  getSocket: vi.fn(),
  intents: {
    start: vi.fn(),
    configureSpecials: vi.fn(),
    configureMode: vi.fn(),
    addBot: vi.fn(),
    removeBot: vi.fn(),
    removePlayer: vi.fn(),
    leave: vi.fn(),
    bid: vi.fn(),
    play: vi.fn(),
    resolve: vi.fn(),
    playAgain: vi.fn(),
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
  },
}));

describe('Lobby screen', () => {
  it('disables Start below 3 players for the host', () => {
    const two = makeState({ phase: 'lobby', players: [player(0, { name: 'You' }), player(1)] });
    render(<Lobby game={two} />);
    expect(screen.getByText('Need 3–6 players to start').closest('button')).toBeDisabled();
  });

  it('enables Start at 3 players and starts on tap', () => {
    render(<Lobby game={makeState({ phase: 'lobby' })} />);
    const start = screen.getByRole('button', { name: 'Start game' });
    expect(start).toBeEnabled();
    fireEvent.click(start);
    expect(intents.start).toHaveBeenCalled();
  });

  it('shows the special-card picker', () => {
    render(<Lobby game={makeState({ phase: 'lobby' })} />);
    expect(screen.getByText('Special cards')).toBeInTheDocument();
    expect(screen.getByText('Dragon')).toBeInTheDocument();
  });
});
