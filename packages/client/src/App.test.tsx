import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.js';

// Phase 0 gate: client renders + can import from @wizarden/shared.
describe('App', () => {
  it('renders the Wizarden title and shared deck size', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Wizarden' })).toBeInTheDocument();
    expect(screen.getByText(/base deck 60 cards/i)).toBeInTheDocument();
  });
});
