// Structured logging (§7/§21). JSON to stdout — Render captures stdout, so logs
// are visible live under the service's "Logs" tab (and via `render logs`).
// Set LOG_LEVEL=debug for more detail.

import { pino } from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'wizarden-server' },
});
