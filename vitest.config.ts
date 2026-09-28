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
    // decode, SVG stroke sampling) are intentionally not unit-tested here, and
    // CI does not execute them either (`astro build` only bundles them) — they
    // are covered only by the maintainer's manual click-test.
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
