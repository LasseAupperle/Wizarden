// Typed env config (spec §21). Read + validate at startup, fail fast with a
// clear message on a malformed required value.

export interface ServerConfig {
  port: number;
  clientOrigin: string;
  enableDebug: boolean;
  redisUrl?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`[wizarden] FATAL: invalid PORT "${env.PORT}" — must be 1..65535`);
    process.exit(1);
  }

  const clientOrigin = env.CLIENT_ORIGIN ?? 'http://localhost:5173';
  if (!env.CLIENT_ORIGIN) {
    console.warn(
      '[wizarden] CLIENT_ORIGIN not set — defaulting to http://localhost:5173. ' +
        'Set it to the deployed client origin (e.g. https://wizarden.netlify.app) for CORS.',
    );
  } else if (!/^https?:\/\//.test(clientOrigin)) {
    console.error(
      `[wizarden] FATAL: CLIENT_ORIGIN must start with http:// or https:// (got "${clientOrigin}")`,
    );
    process.exit(1);
  }

  const redisUrl = env.REDIS_URL?.trim() || undefined;
  if (redisUrl && !/^rediss?:\/\//.test(redisUrl)) {
    console.error(
      `[wizarden] FATAL: REDIS_URL must start with redis:// or rediss:// (got "${redisUrl}")`,
    );
    process.exit(1);
  }

  return { port, clientOrigin, enableDebug: env.ENABLE_DEBUG === 'true', redisUrl };
}
