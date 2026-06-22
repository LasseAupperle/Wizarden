// Seedable deterministic RNG (mulberry32). The engine receives randomness ONLY
// through this interface so tests reproduce exact deals. State is a single 32-bit
// integer, so the server can snapshot/restore it as part of GameState.

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Fisher-Yates shuffle returning a NEW array (input not mutated). */
  shuffle<T>(input: readonly T[]): T[];
  /** Current internal state (for snapshot/restore). */
  getState(): number;
}

/**
 * Create an RNG. Pass a numeric `seed` for a fresh stream, or restore a prior
 * stream by passing a previously captured `getState()` value as the seed.
 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;

  const step = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next: step,
    int(maxExclusive: number): number {
      if (maxExclusive <= 0) return 0;
      return Math.floor(step() * maxExclusive);
    },
    shuffle<T>(input: readonly T[]): T[] {
      const arr = input.slice();
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(step() * (i + 1));
        const tmp = arr[i] as T;
        arr[i] = arr[j] as T;
        arr[j] = tmp;
      }
      return arr;
    },
    getState(): number {
      return a >>> 0;
    },
  };
}

/** Convenience: a string seed hashed to a 32-bit integer (room codes, etc.). */
export function seedFromString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
