import { describe, expect, it } from 'vitest';
import { BASE_DECK_SIZE, type ClientGameState, type Card } from '@wizarden/shared';

// Phase 0 gate: shared contracts are importable + usable from the server.
describe('server <- shared', () => {
  it('imports a shared constant', () => {
    expect(BASE_DECK_SIZE).toBe(60);
  });

  it('imports shared types', () => {
    const phase: ClientGameState['phase'] = 'lobby';
    const card: Card = { kind: 'wizard', id: 'w0' };
    expect(phase).toBe('lobby');
    expect(card.kind).toBe('wizard');
  });
});
