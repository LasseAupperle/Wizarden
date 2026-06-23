import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpecialCardPicker } from './SpecialCardPicker.js';
import { HowToPlay } from './HowToPlay.js';

describe('SpecialCardPicker', () => {
  it('renders all 9 specials and reports toggles', () => {
    const onToggle = vi.fn();
    render(<SpecialCardPicker selected={[]} onToggle={onToggle} />);
    // 9 toggle buttons
    expect(screen.getAllByRole('button')).toHaveLength(9);
    fireEvent.click(screen.getByRole('button', { name: /bomb/i }));
    expect(onToggle).toHaveBeenCalledWith('bomb');
  });

  it('marks Dragon and Fairy as paired', () => {
    render(<SpecialCardPicker selected={[]} onToggle={() => {}} />);
    expect(screen.getAllByText(/paired/i)).toHaveLength(2);
  });
});

describe('HowToPlay reference', () => {
  it('lists all nine special cards', () => {
    render(<HowToPlay />);
    for (const name of ['Dragon', 'Fairy', 'Bomb', 'Werewolf', 'Juggler', 'Cloud', 'Witch', 'Vampire', 'Shapeshifter']) {
      expect(screen.getAllByText(new RegExp(name)).length).toBeGreaterThan(0);
    }
  });
});
