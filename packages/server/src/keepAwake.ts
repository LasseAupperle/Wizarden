// Keep the server awake ONLY while people are playing (spec §24.1).
//
// Render's free tier sleeps after ~15 min without inbound HTTP traffic, and a
// sleep/restart wipes every in-memory game. We don't keep the server warm on a
// schedule: it may sleep freely until someone opens the site. But while a room
// is in use we periodically request our own PUBLIC URL (which arrives through
// Render's edge as inbound traffic), so it can't sleep mid-game — even if
// everyone's phone is locked for a bit. Once nobody is playing, pinging stops
// and Render spins the service down normally.
//
// Not part of the engine: this is server infrastructure (timers + network IO).

import { logger } from './logger.js';

/** Ping comfortably inside Render's ~15 min idle window. */
export const KEEP_AWAKE_INTERVAL_MS = 10 * 60 * 1000;

export interface KeepAwakeOptions {
  /** Public base URL of this server, e.g. Render's RENDER_EXTERNAL_URL. */
  baseUrl: string;
  /** Polled each tick: true while any game/room still needs the server. */
  shouldStayAwake: () => boolean;
  intervalMs?: number;
  /** Injectable for tests. */
  fetchFn?: (url: string) => Promise<unknown>;
}

/** Start the keep-awake loop. Returns a stop function. */
export function startKeepAwake(opts: KeepAwakeOptions): () => void {
  const url = `${opts.baseUrl.replace(/\/+$/, '')}/health`;
  const doFetch =
    opts.fetchFn ?? ((u: string) => fetch(u, { signal: AbortSignal.timeout(15_000) }));

  const tick = async (): Promise<void> => {
    if (!opts.shouldStayAwake()) return;
    try {
      await doFetch(url);
      logger.debug({ url }, 'keep-awake ping');
    } catch (err) {
      logger.warn({ err, url }, 'keep-awake ping failed');
    }
  };

  const timer = setInterval(() => void tick(), opts.intervalMs ?? KEEP_AWAKE_INTERVAL_MS);
  timer.unref(); // never hold the process open on its own
  return () => clearInterval(timer);
}
