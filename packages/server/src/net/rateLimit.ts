// Per-socket token-bucket rate limiting (§16): bound room creation and action
// spam without rejecting normal play. One SocketLimiter per connected socket.

export class TokenBucket {
  private tokens: number;
  private last = Date.now();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity;
  }

  /** Consume one token; false when the bucket is empty (caller -> RATE_LIMITED). */
  take(): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSec);
    this.last = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

export class SocketLimiter {
  /** Room creation: small burst, slow refill (prevents room flooding). */
  readonly create = new TokenBucket(3, 0.3);
  /** Gameplay actions (bid/play/resolve): only catches pathological floods —
   *  far above any human or fast scripted pace, so legit play never trips it. */
  readonly action = new TokenBucket(120, 100);
}
