// Cross-game leaderboard (§23.4). Keyed by lower-cased display name. Full-game
// wins score 1 point, half-game wins 0.5. Behind an interface so a persistent
// backend (Redis/Postgres/file) can replace the in-memory default additively.

import type { LeaderboardEntry } from '@wizarden/shared';

export interface LeaderboardStore {
  recordWin(names: readonly string[], points: number): void;
  top(n: number): LeaderboardEntry[];
  all(): LeaderboardEntry[];
}

export class InMemoryLeaderboard implements LeaderboardStore {
  private byKey = new Map<string, LeaderboardEntry>();

  recordWin(names: readonly string[], points: number): void {
    const now = Date.now();
    for (const raw of names) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const entry = this.byKey.get(key) ?? { name, points: 0, wins: 0, lastWonAt: 0 };
      entry.points += points;
      entry.wins += 1;
      entry.lastWonAt = now;
      entry.name = name; // keep the latest casing
      this.byKey.set(key, entry);
    }
  }

  all(): LeaderboardEntry[] {
    return [...this.byKey.values()].sort(
      (a, b) => b.points - a.points || b.lastWonAt - a.lastWonAt || a.name.localeCompare(b.name),
    );
  }

  top(n: number): LeaderboardEntry[] {
    return this.all().slice(0, n);
  }
}
