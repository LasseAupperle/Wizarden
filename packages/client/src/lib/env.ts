// Typed client env (spec §21). VITE_* vars are inlined at build time.

export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';
export const DEBUG_ENABLED: boolean = import.meta.env.VITE_ENABLE_DEBUG === 'true';

if (import.meta.env.PROD && !import.meta.env.VITE_SERVER_URL) {
  // Built without a backend URL — Socket.IO will try localhost and fail.
  console.warn('[wizarden] VITE_SERVER_URL was not set at build time; defaulting to http://localhost:3001');
}
