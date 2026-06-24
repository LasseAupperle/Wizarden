// Optional client error tracking (§7). Inert unless VITE_SENTRY_DSN is set, and
// loaded via dynamic import so @sentry/react stays out of the main bundle when
// unused. Create a free Sentry project, then set VITE_SENTRY_DSN in Netlify.

export async function initSentry(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  const Sentry = await import('@sentry/react');
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
