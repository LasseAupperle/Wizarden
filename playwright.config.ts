import { defineConfig, devices } from '@playwright/test';

// Browser E2E (§5). Locally: `pnpm e2e:install` once (downloads Chromium), then
// `pnpm test:e2e`. Also runs in CI as the `e2e` job (.github/workflows/ci.yml).
//
// The webServers build + serve a production-like stack: the server on :3001 and
// the client preview on :4173 (built with VITE_SERVER_URL pointing at the server).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Optional: point at a pre-installed Chromium (e.g. a cloud sandbox whose
        // browser build differs from this Playwright version's). Unset = default.
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? { executablePath: process.env.PW_CHROMIUM_PATH }
          : {},
      },
    },
  ],
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
