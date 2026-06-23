import { describe, expect, it } from 'vitest';
import { normalizeRedisUrl } from './redisLeaderboard.js';

describe('normalizeRedisUrl', () => {
  it('upgrades an Upstash redis:// URL to rediss:// (TLS)', () => {
    expect(normalizeRedisUrl('redis://default:pw@x.upstash.io:6379')).toBe(
      'rediss://default:pw@x.upstash.io:6379',
    );
  });
  it('leaves an explicit rediss:// URL unchanged', () => {
    expect(normalizeRedisUrl('rediss://default:pw@x.upstash.io:6379')).toBe(
      'rediss://default:pw@x.upstash.io:6379',
    );
  });
  it('leaves a non-Upstash redis:// URL unchanged (e.g. local)', () => {
    expect(normalizeRedisUrl('redis://localhost:6379')).toBe('redis://localhost:6379');
  });
});
