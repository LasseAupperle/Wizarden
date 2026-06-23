// Persistent leaderboard backed by Upstash Redis (ioredis). Write-through over an
// in-memory mirror: reads are synchronous (from the mirror), writes update the
// mirror then persist the whole snapshot as one JSON blob (low write volume — a
// few games — so a single key is simplest and atomic enough). Hydrates the mirror
// from Redis on startup. Plugs in behind LeaderboardStore additively (§23.4).

import { Redis } from 'ioredis';
import type { LeaderboardEntry } from '@wizarden/shared';
import { InMemoryLeaderboard, type LeaderboardStore } from './leaderboard.js';

const KEY = 'wizarden:leaderboard:v1';

/** Upstash gives a `redis://...` URL; force TLS by normalising to `rediss://`. */
export function normalizeRedisUrl(url: string): string {
  if (url.startsWith('rediss://')) return url;
  if (url.startsWith('redis://') && url.includes('upstash.io')) {
    return 'rediss://' + url.slice('redis://'.length);
  }
  return url;
}

export class RedisLeaderboard implements LeaderboardStore {
  private readonly mirror = new InMemoryLeaderboard();
  private readonly redis: Redis;
  private ready: Promise<void>;

  constructor(url: string) {
    this.redis = new Redis(normalizeRedisUrl(url), {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: true,
    });
    this.redis.on('error', (e: Error) => console.error('[leaderboard] redis error:', e.message));
    this.ready = this.hydrate();
  }

  private async hydrate(): Promise<void> {
    try {
      const raw = await this.redis.get(KEY);
      if (raw) {
        const entries = JSON.parse(raw) as LeaderboardEntry[];
        if (Array.isArray(entries)) this.mirror.load(entries);
      }
    } catch (e) {
      console.error('[leaderboard] hydrate failed (starting empty):', (e as Error).message);
    }
  }

  recordWin(names: readonly string[], points: number): void {
    this.mirror.recordWin(names, points);
    void this.persist();
  }

  private async persist(): Promise<void> {
    try {
      await this.ready; // don't overwrite before the initial hydrate completes
      await this.redis.set(KEY, JSON.stringify(this.mirror.all()));
    } catch (e) {
      console.error('[leaderboard] persist failed:', (e as Error).message);
    }
  }

  top(n: number): LeaderboardEntry[] {
    return this.mirror.top(n);
  }

  all(): LeaderboardEntry[] {
    return this.mirror.all();
  }

  async close(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
