import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Resolve @wizarden/shared straight to its source so tests never depend on a
// prior `pnpm build` of the shared package.
const sharedSrc = fileURLToPath(new URL('../shared/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@wizarden/shared': sharedSrc,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
