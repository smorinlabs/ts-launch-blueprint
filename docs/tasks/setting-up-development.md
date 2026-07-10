# Setting Up the Development Environment

## Setup & Dependency Check

Run the following command to check that the foundational tools — `just`
and `node` — are installed:

```bash
make check
```

`make check` only ever checks for and helps install `just` and `node`; it
never wraps development tasks itself (D-024(2)). If either tool is
missing, it prints the matching `make install-just` / `make install-node`
guidance.

## Setup Development Environment

The project requires Node.js >=24 (also pinned in
[`.nvmrc`](../../.nvmrc) and `engines` in
[`package.json`](../../package.json)). Unlike the Python source, there is
only one supported package manager: [pnpm](https://pnpm.io), which is
bootstrapped via `make install-pnpm` once — there is no choice to make
(D-035).

## Using pnpm

```bash
# Install dependencies (also generates/refreshes pnpm-lock.yaml,
# and installs the lefthook git hooks via the `prepare` script)
pnpm install

# Format the code
just format          # or: pnpm exec oxfmt

# Run linter
just lint            # or: pnpm exec oxlint

# Run type checker
just typecheck       # or: pnpm exec tsc --noEmit

# Run tests
just test            # or: pnpm exec vitest run

# Run tests with coverage
just coverage        # or: pnpm run test:coverage

# Run every quality gate together
just all

# Run the CLI from source (via tsx, no build step)
pnpm exec tsx src/cli.ts --help

# Build and run the packaged CLI
just build
node dist/cli.js --help
```

See [Managing Dependencies](managing-dependencies.md) for adding, updating,
and auditing packages, and [Type Checking Code](type-checking-code.md) for
the `tsc` gate in detail.

## Bun lane (optional)

[Bun](https://bun.sh) is supported as an **optional, advisory** dev/test
runtime only (D-036). It runs the non-e2e Vitest tiers under Bun as a
forward-compatibility signal — Bun tracks Node v23 parity, one major behind
this template's `>=24` floor — so it is never a required gate. The published
package and its `engines` are unchanged; consumers still run Node.

```bash
just test-bun   # bun run vitest run --exclude tests/e2e.test.ts
```

If `bun` is not installed the recipe prints install guidance and exits 0. In
CI the advisory `bun-lane` job (`continue-on-error: true`) runs the same
command against Bun 1.3.14.

Three hard rules keep the lane safe:

1. **Never `bun install`.** Installs stay pnpm-only; `bun install` would fork
   a `bun.lock` and drift from the committed `pnpm-lock.yaml`.
2. **Never bare `bun test`.** That invokes Bun's own test runner; Vitest must
   always be the driver, via `bun run vitest`.
3. **The e2e tier stays Node-only.** `tests/e2e.test.ts` spawns
   `process.execPath` to assert the published Node signal contract
   (SIGINT→130 / SIGTERM→143); under Bun it would exercise Bun's signal
   emulation instead, so it is excluded from this lane.

### Git Hooks (lefthook)

`pnpm install` already activates the [lefthook](https://lefthook.dev) git
hooks, because `package.json`'s `prepare` script runs `lefthook install`
automatically. To (re)install the hooks explicitly and also wire the
commit-message template (`.gitmessage`):

```bash
just setup-hooks
```

Pre-commit formats (oxfmt) and lints (oxlint) staged files and
type-checks the repository; commit messages are checked by commitlint
against Conventional Commits. Running the test suite on push is opt-in
(`export TS_PROJECTS_PREPUSH_TESTS=1`) rather than mandatory, mirroring
the source's "optional pre-commit" posture while making the default gate
faster.

To run the full hook suite against every file on demand (not just staged
changes):

```bash
just pre-commit-run
```

## Customization for New Projects

When using this repository as a template for a new project, update the
following template-rename seam (D-029) instead of hand-editing scattered
strings:

1. **Justfile name variables** — at the top of the
   [`Justfile`](../../Justfile):

   ```just
   ts_package_name := "ts-launch-blueprint"
   repo_name := "ts-launch-blueprint"
   command_name := "ts-projects"
   ```

   These drive the release/pack-check recipes (tarball name, installed
   `bin` name, smoke-test assertions) — change them once here rather than
   at each call site.

2. **`package.json`**: `name`, `description`, `repository.url`, and the
   `bin` map's key (currently `ts-projects`).

3. **Node.js version floor**: update `.nvmrc` and the `engines`
   field in `package.json` together if you need a different Node floor
   than `>=24`. (The `devEngines.packageManager` entry was removed in favor
   of the `packageManager` field + `.npmrc` enforcement, D-035.)
