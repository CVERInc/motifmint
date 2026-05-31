import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // The lib/*.ts modules under test are pure string/data functions, so the
    // default node environment is enough. DOM-dependent paths (removePaths,
    // decode) are intentionally not unit-tested here — they run in CI's real
    // build and the maintainer's click-test.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
