# Vitest Test Framework

Vitest is the test runner used across recent org TypeScript projects, replacing Pytest as this project's test framework. It provides fast, Vite-native test execution with a Jest-compatible API, built-in coverage via V8, and first-class TypeScript/ESM support with no separate transpile step.

## Installation

Vitest is a devDependency; it's installed along with everything else via [pnpm](pnpm.md):

```bash
pnpm install
```

## Basic Usage

1. **Test files live in `tests/`**:

   - Tests are placed in a top-level `tests/` directory (mirroring the source project's `testpaths = ["tests"]`), not colocated next to source files.
   - Test file names end in `.test.ts` (e.g. `tests/config.test.ts`).

2. **Write tests**:

   - Use `describe`/`it`/`expect` from `vitest`, imported explicitly (this project runs with `globals: false`, so there are no ambient `describe`/`it`).

   ```ts
   // tests/example.test.ts
   import { describe, expect, it } from 'vitest';

   function add(a: number, b: number): number {
     return a + b;
   }

   describe('add', () => {
     it('adds two numbers', () => {
       expect(add(2, 3)).toBe(5);
       expect(add(-1, 1)).toBe(0);
       expect(add(0, 0)).toBe(0);
     });
   });
   ```

3. **Run tests**:

   ```bash
   pnpm exec vitest run
   ```

   or via [`just`](justfiles.md):

   ```bash
   just test        # alias: just t
   just coverage     # runs with coverage thresholds enforced
   ```

## Key Features

- **Jest-compatible assertions**: `expect(...).toBe(...)`, `.toEqual(...)`, etc.
- **Test discovery**: Automatically finds `tests/**/*.test.ts`.
- **Dependency injection over mocking**: this project favors passing fakes through an explicit `deps` object (see [Mocking and test seams](#mocking-and-test-seams)) rather than `vi.mock`.
- **Built-in coverage**: V8-based coverage with no separate instrumentation step.
- **Native ESM/TypeScript**: no Babel/ts-node transpile step required.

## Configuration

Vitest is configured in [`vitest.config.ts`](../../vitest.config.ts):

```ts
import { defineConfig } from 'vitest/config';

const config: ReturnType<typeof defineConfig> = defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/cli.ts', 'src/lib/adapters.ts'],
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
```

- **`test.coverage.include`**: required as of Vitest 4 — `['src/**/*.ts']` is the set of files coverage is computed over.
- **`test.coverage.thresholds`**: the org-standard 95% lines / 95% functions / 90% branches / 95% statements gate, enforced whenever `--coverage` runs (`just coverage`, and in CI). The everyday `just test` loop stays coverage-free for a fast inner loop.
- **`test.coverage.exclude`**: only two files are excluded, both thin I/O adapters rather than logic:
  - `src/cli.ts` — a thin process entry point (parses `argv`, sets `process.exitCode`) exercised by the e2e subprocess tier instead of unit tests.
  - `src/lib/adapters.ts` — the real prompt/clipboard/spinner bridges to terminal devices (TTY prompt, OS clipboard, animated stderr); in-process tests replace them with fakes via the injected `CliDeps` object, and the e2e tier drives their non-interactive paths for real.

Unlike the source project's Pytest configuration, which declared `testpaths`/`python_files` but did not enforce a coverage minimum, this project enforces its thresholds in CI — a deliberate tightening, not a straight port.

## Test tiers

Tests are organized into tiers of increasing realism, mirroring (and, for the CLI, exceeding) the source project's `CliRunner`-based approach — Node has no direct `CliRunner` analogue, so the CLI gets two tiers instead of one:

1. **Unit tests** — `tests/config.test.ts`, `tests/api.test.ts`, `tests/version.test.ts`: exercise individual modules directly (config resolution/precedence, the API client, version reporting) with fakes for I/O.
2. **In-process CLI tests** — `tests/cli-core.test.ts`: call `runCli(argv, deps)` directly with an injected `CliDeps` object (fake `stdout`/`stderr` writers, fake env, fake fs), asserting exit codes and the separated stdout/stderr streams — no subprocess, no real `process.exit`.
3. **End-to-end subprocess tests** — `tests/e2e.test.ts`: spawn the _built_ CLI (`node dist/cli.js`) as a real child process against a local mock HTTP server, with a staleness-aware `buildIfStale()` helper that rebuilds `dist/` only when `src/`, `package.json`, or `tsdown.config.ts` are newer than the built artifact. This tier is the only one that can assert things the in-process tier can't reach: piped stdout is one clean JSON document with no regex-stripping needed, and `SIGINT`/`SIGTERM` map to exit codes 130/143.
4. **Repo-hygiene meta-tests** — `tests/repo-hygiene.test.ts`: assert that the project's own config files stay internally consistent (e.g. `.nvmrc`'s major version equals `package.json`'s `engines.node` floor, and the commitlint `type-enum` matches `.gitmessage`'s type list) — not application behavior, but the same "guard the guardrails" spirit as the source project's config-consistency checks.

```bash
just test              # unit + in-process + e2e + repo-hygiene tiers, no coverage
just coverage           # same, with coverage thresholds enforced
pnpm exec vitest run tests/e2e.test.ts   # run a single tier directly
```

## Mocking and test seams

This project prefers dependency injection over `vi.mock`:

```ts
import { afterEach, describe, expect, it } from 'vitest';

import { type CliDeps, runCli } from '../src/router.js';

function makeHarness(overrides: Partial<CliDeps> = {}): { deps: CliDeps; stdout: () => string } {
  const out: string[] = [];
  const deps: CliDeps = {
    stdout: (text) => {
      out.push(text);
    },
    stderr: () => {},
    ...overrides,
  };
  return { deps, stdout: () => out.join('') };
}

it('prints the version', async () => {
  const { deps, stdout } = makeHarness();
  const code = await runCli(['--version'], deps);
  expect(code).toBe(0);
  expect(stdout()).toContain('ts-projects');
});
```

- **Fakes/spies passed through `deps`** are the primary seam — the injected `fetchImpl` is the only HTTP transport, for example, so tests never hit the network.
- **`vi.stubEnv`** for environment variables, restored automatically between tests.
- **`fs.mkdtemp`** for temporary directories (config/XDG tests), cleaned up in `afterEach`.
- **`vi.mock`** is reserved as a last resort, when a module genuinely cannot be reached through the `deps` object.

This mirrors `unittest.mock`'s hermetic-boundary intent, but the DI shape catches a wrong-seam mistake at compile time (a fake that doesn't structurally match `CliDeps` is a type error) rather than at test-run time.

## Best Practices

- **Keep tests isolated**: each test should be independent and not rely on the state left behind by another test; use `afterEach` to clean up temp dirs/files.
- **Use descriptive names**: `it('...')` descriptions should read as a sentence describing the behavior under test.
- **Test edge cases**: boundary conditions, error paths, and the CLI's non-zero exit codes all need explicit coverage, not just the happy path.
- **Prefer DI over `vi.mock`**: pass fakes through `deps` wherever the code under test accepts them.
- **Follow Arrange-Act-Assert**:
  - **Arrange**: build the harness/fakes and inputs.
  - **Act**: call the function or `runCli(...)` under test.
  - **Assert**: check the return value and the captured stdout/stderr.

## Troubleshooting

- **Tests not being discovered**:
  - Confirm the file lives under `tests/` and ends in `.test.ts`.
  - Check `vitest.config.ts` hasn't scoped `include`/`exclude` away from it.
- **Coverage threshold failures**:
  - Run `just coverage` locally to see exactly which file/metric is under threshold before pushing.
  - Only `src/cli.ts` and `src/lib/adapters.ts` are pre-approved exclusions; adding a new exclusion needs the same "thin I/O adapter, exercised elsewhere" justification as those two.
- **e2e tier failures**:
  - Confirm `dist/cli.js` actually rebuilt — delete `dist/` and rerun if `buildIfStale()`'s mtime comparison seems stale.
  - The mock HTTP server binds an ephemeral `127.0.0.1` port per run, so port conflicts across parallel runs shouldn't occur; if they do, check for a leaked server from a previous failed run.

By following these guidelines, you can effectively use Vitest to write and run tests, ensuring the reliability and quality of this project's TypeScript code.

See also: [TypeScript (tsc)](typescript.md) for the type-checking gate tests run under, [Oxlint & Oxfmt](oxlint.md) for the per-test-glob lint relaxations, and [`just test` / `just coverage`](justfiles.md).
