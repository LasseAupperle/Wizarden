import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import type { ClientGameState, SpecialType } from '@wizarden/shared';
import { createWizardenServer, type WizardenServer } from '../index.js';
import { Room } from '../rooms/room.js';
import { InMemoryLeaderboard } from '../rooms/leaderboard.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ALL_SPECIALS: SpecialType[] = [
  'dragon',
  'fairy',
  'bomb',
  'werewolf',
  'juggler',
  'cloud',
  'witch',
  'vampire',
  'shapeshifter',
];

describe('Phase 6 — bots (debug only)', () => {
  it('an all-bot game with every special runs to gameOver (no illegal moves)', async () => {
    const leaderboard = new InMemoryLeaderboard();
    const room = new Room('BOTS', {
      enableDebug: true,
      botDelayMs: 0,
      roundSummaryMs: 0,
      leaderboard,
    });
    room.selectedSpecials = ALL_SPECIALS;
    for (let i = 0; i < 4; i++) room.addPlayer(`Bot${i}`, { isBot: true });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('all-bot game did not finish')), 25000);
      // Reaching gameOver implies every bot move was legal: an illegal move would
      // stall the chain (no afterMutation -> no next bot scheduled).
      room.onChange = () => {
        if (room.game?.phase === 'gameOver') {
          clearTimeout(timer);
          resolve();
        }
      };
      const r = room.start(0);
      if (!r.ok) {
        clearTimeout(timer);
        reject(new Error(r.error.message));
      }
    });

    expect(room.game!.phase).toBe('gameOver');
    expect(room.game!.scoreboard).toHaveLength(room.game!.totalRounds);
    // bot games never count toward the leaderboard
    expect(leaderboard.all()).toHaveLength(0);
    room.dispose();
  }, 30000);

  describe('one human + bots over sockets', () => {
    let server: WizardenServer;
    let url: string;
    const clients: Socket[] = [];

    beforeEach(async () => {
      server = createWizardenServer({ enableDebug: true, botDelayMs: 1, roundSummaryMs: 8 });
      url = `http://localhost:${await server.listen(0)}`;
    });
    afterEach(async () => {
      for (const c of clients) c.close();
      clients.length = 0;
      await server.close();
    });

    it('completes a base game with a human and two bots', async () => {
      let state: ClientGameState | null = null;
      const human = ioClient(url, { transports: ['websocket'], forceNew: true });
      clients.push(human);
      human.on('state:update', (s: ClientGameState) => (state = s));
      human.on('room:created', (p: { state: ClientGameState }) => (state = p.state));
      await new Promise<void>((res) => human.on('connect', () => res()));

      human.emit('room:create', { name: 'Human' });
      await sleep(25);
      human.emit('lobby:addBot', {});
      human.emit('lobby:addBot', {});
      await sleep(25);
      expect(state!.players).toHaveLength(3);

      human.emit('lobby:configureSpecials', { specials: [] });
      await sleep(15);
      human.emit('game:start', {});
      await sleep(25);

      const mySeat = state!.yourSeat;
      const ledSuit = (
        trick: ClientGameState['currentTrick'],
      ): { suit: string | null; freed: boolean } => {
        for (const p of trick) {
          if (p.card.kind === 'wizard') return { suit: null, freed: true };
          if (p.card.kind === 'number') return { suit: p.card.suit, freed: false };
        }
        return { suit: null, freed: false };
      };
      const pickCard = (s: ClientGameState): string => {
        const { suit, freed } = ledSuit(s.currentTrick);
        if (suit === null || freed) return s.yourHand[0]!.id;
        return (s.yourHand.find((c) => c.kind === 'number' && c.suit === suit) ?? s.yourHand[0]!)
          .id;
      };

      let guard = 0;
      while (state!.phase !== 'gameOver') {
        if (++guard > 30000) throw new Error('human+bots game did not finish');
        const s = state!;
        const myTurn =
          (s.phase === 'bidding' || s.phase === 'trick') && s.currentTurnSeat === mySeat;
        if (s.phase === 'roundEnd') {
          await sleep(12);
        } else if (myTurn && s.phase === 'bidding') {
          human.emit('game:bid', { bid: 0 });
          await sleep(12);
        } else if (myTurn && s.phase === 'trick') {
          human.emit('game:play', { cardId: pickCard(s), decision: { type: 'none' } });
          await sleep(12);
        } else if (s.pendingDecision && s.pendingDecision.seat === mySeat) {
          human.emit('game:resolve', { suit: 'red' }); // base game: only chooseTrump
          await sleep(12);
        } else {
          await sleep(8); // a bot is acting
        }
      }

      expect(state!.phase).toBe('gameOver');
      expect(state!.scoreboard).toHaveLength(20);
    }, 30000);
  });
});
