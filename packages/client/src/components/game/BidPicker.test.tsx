import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BidPicker } from './BidPicker.js';

describe('BidPicker', () => {
  it('shows a button per option in small rounds, plus the bids-so-far total', () => {
    const onBid = vi.fn();
    render(<BidPicker cards={3} bidsSoFar={2} value={0} onChange={vi.fn()} onBid={onBid} />);
    expect(screen.getByText('Bids: 2 of 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(onBid).toHaveBeenCalledWith(3);
  });

  it('uses a compact stepper for big rounds (no 21-button grid)', () => {
    const onChange = vi.fn();
    const onBid = vi.fn();
    render(<BidPicker cards={20} bidsSoFar={7} value={4} onChange={onChange} onBid={onBid} />);
    expect(screen.queryByRole('button', { name: '17' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+1' }));
    expect(onChange).toHaveBeenCalledWith(5);
    fireEvent.click(screen.getByRole('button', { name: 'Bid 4' }));
    expect(onBid).toHaveBeenCalledWith(4);
  });
});
