import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from './Game.js';
import { intents } from '../net/socket.js';
import { makeState, player } from '../test/fixtures.js';
import { useGameStore } from '../store/gameStore.js';

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

function setPointer(coarse: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: coarse && q.includes('coarse'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

describe('Game screen', () => {
  beforeEach(() => {
    setPointer(false);
    vi.mocked(intents.play).mockClear();
    useGameStore.setState((s) => ({ settings: { ...s.settings, language: 'en' } }));
  });

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

  it('holds a finished trick on the table and names the winner', () => {
    render(
      <Game
        game={makeState({
          phase: 'trick',
          currentTurnSeat: 1,
          lastTrick: {
            plays: [
              {
                seat: 0,
                card: { kind: 'number', id: 'n-red-3', suit: 'red', value: 3 },
                decision: { type: 'none' },
              },
              { seat: 1, card: { kind: 'wizard', id: 'wizard-0' }, decision: { type: 'none' } },
              {
                seat: 2,
                card: { kind: 'number', id: 'n-red-9', suit: 'red', value: 9 },
                decision: { type: 'none' },
              },
            ],
            winnerSeat: 1,
          },
        })}
      />,
    );
    expect(screen.getAllByText('Bob wins the trick').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Wizard')).toBeInTheDocument();
  });

  it('on touch, the first tap lifts a card and the second plays it', () => {
    setPointer(true);
    render(<Game game={makeState({ phase: 'trick', currentTurnSeat: 0 })} />);
    const card = screen.getByRole('button', { name: 'Red 5' });
    fireEvent.click(card);
    expect(intents.play).not.toHaveBeenCalled();
    expect(screen.getByText(/tap again to play/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Red 5' }));
    expect(intents.play).toHaveBeenCalledWith('n-red-5', { type: 'none' });
  });

  it('keeps your hand visible while you decide (inline panel, no overlay)', () => {
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
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Red 5')).toBeInTheDocument();
  });

  it('labels opponent stats and speaks Dutch when set', () => {
    useGameStore.setState((s) => ({ settings: { ...s.settings, language: 'nl' } }));
    render(
      <Game
        game={makeState({
          players: [player(0, { name: 'You' }), player(1, { name: 'Bob', bid: 2, totalScore: 70 })],
        })}
      />,
    );
    expect(screen.getByText('Ronde 1/20')).toBeInTheDocument();
    expect(screen.getAllByText(/bod/).length).toBeGreaterThan(0);
    expect(screen.getByText('70 ptn')).toBeInTheDocument();
  });
});
