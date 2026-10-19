// Test config (D-019): Vitest 4, node environment, no globals; v8 coverage with
// the org-standard 95/95/90/95 thresholds enforced whenever coverage runs.
// One project per workspace package (found by glob, so deleting an app
// doesn't break this file; each package's vitest.config.ts names it) plus the
// repo-level checks (D-040); coverage stays at the root so the thresholds
// cover the whole workspace.
import { defineConfig } from 'vitest/config';

// Explicit annotation required by isolatedDeclarations (D-025).
const config: ReturnType<typeof defineConfig> = defineConfig({
  test: {
    projects: [
      'packages/*/vitest.config.ts',
      'apps/*/vitest.config.ts',
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
      // apps/api/src/server.ts is the API's thin process entry (config ->
      // createCore -> serve), exercised by the API e2e test (same D-019(3)
      // thin-entry exclusion as the CLI's src/cli.ts).
      // **/__boundary-probe-*: temporary files written by tests/boundaries.test.ts,
      // in case a crashed run leaves one behind.
      exclude: [
        'apps/cli/src/cli.ts',
        'apps/cli/src/cli/adapters.ts',
        'apps/api/src/server.ts',
        '**/__boundary-probe-*',
        '**/__boundary-probe-*/**',
      ],
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
