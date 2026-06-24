import { defineConfig, devices } from '@playwright/test';

// Opt-in browser E2E (§5). Run once: `pnpm e2e:install` (downloads Chromium),
// then `pnpm test:e2e`. Not wired into CI by default to avoid the browser
// download there — the socket integration + component suites cover the rest.
//
// The webServers build + serve a production-like stack: the server on :3001 and
// the client preview on :4173 (built with VITE_SERVER_URL pointing at the server).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command:
        'pnpm --filter @wizarden/shared build && pnpm --filter @wizarden/server build && node packages/server/dist/index.js',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { PORT: '3001', ENABLE_DEBUG: 'true', CLIENT_ORIGIN: 'http://localhost:4173' },
    },
    {
      command:
        'pnpm --filter @wizarden/client build && pnpm --filter @wizarden/client preview --port 4173 --strictPort',
      port: 4173,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_SERVER_URL: 'http://localhost:3001', VITE_ENABLE_DEBUG: 'true' },
    },
  ],
});
