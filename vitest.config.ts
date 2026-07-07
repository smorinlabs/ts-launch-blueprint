// Test config (D-019): Vitest 4, node environment, no globals; v8 coverage with
// the org-standard 95/95/90/95 thresholds enforced whenever coverage runs.
import { defineConfig } from 'vitest/config';

// Explicit annotation required by isolatedDeclarations (D-025).
const config: ReturnType<typeof defineConfig> = defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // src/cli.ts is a thin process entry (argv/exit only) exercised by the
      // S3 subprocess tier, not unit-coverable (claim-npm adapter-exclusion
      // precedent, D-019(3)).
      exclude: ['src/cli.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
    },
  },
});

export default config;
