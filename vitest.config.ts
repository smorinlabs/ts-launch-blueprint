// Test config (D-019): Vitest 4, node environment, no globals; v8 coverage with
// the org-standard 95/95/90/95 thresholds enforced whenever coverage runs.
// One project per workspace package plus the repo-level checks (D-040);
// coverage stays at the root so the thresholds cover the whole workspace.
import { defineConfig } from 'vitest/config';

// Explicit annotation required by isolatedDeclarations (D-025).
const config: ReturnType<typeof defineConfig> = defineConfig({
  test: {
    projects: [
      { root: 'packages/core', test: { name: 'core', include: ['tests/**/*.test.ts'] } },
      { root: 'apps/cli', test: { name: 'cli', include: ['tests/**/*.test.ts'] } },
      { test: { name: 'repo', include: ['tests/**/*.test.ts'] } },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      // apps/cli/src/cli.ts is a thin process entry (argv/exit only) exercised
      // by the S3 subprocess tier, not unit-coverable (claim-npm
      // adapter-exclusion precedent, D-019(3)).
      // apps/cli/src/cli/adapters.ts holds the real prompt/clipboard/spinner
      // bridges to terminal devices (TTY prompt, OS clipboard, animated
      // stderr); in-process tests replace them with fakes via CliDeps and the
      // e2e subprocess tier drives the non-interactive paths (same D-019(3)
      // thin-I/O-adapter exclusion, each function a one-call bridge).
      exclude: ['apps/cli/src/cli.ts', 'apps/cli/src/cli/adapters.ts'],
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
