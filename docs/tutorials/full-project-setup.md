# Full Project Setup

This tutorial walks through the end-to-end setup of a new project from
this template. By the end, you'll have a working development
environment, a built CLI you can run locally, and a clear picture of
how releases happen.

## Prerequisites

This template only assumes you have `git` and a shell. Everything else
— Node.js and `just` — is checked (and, where possible, installed) for
you by the bootstrap `Makefile`.

## Steps

### 1. Clone the Repository

```bash
git clone https://github.com/smorinlabs/ts-launch-blueprint.git
cd ts-launch-blueprint
```

### 2. Check Foundational Tools

```bash
make check
```

`make` is the one tool this template assumes you already have (almost
everyone does). `make check` verifies that `just` and `node` are
installed and prints copy-pasteable install commands for whichever is
missing:

```bash
make install-just    # prints the just install command (or `make install-just-force`)
make install-node    # prints Node version-manager guidance (mise/nvm/fnm)
```

Node **24 or newer** is required (`.nvmrc` pins `24`; `package.json`
`engines.node` enforces `>=24`). Everything else — formatting, linting,
type checking, testing, building — is a `just` recipe; the `Makefile`
never wraps development tasks itself.

### 3. Install Dependencies

```bash
pnpm install
```

This installs both runtime dependencies (`commander`, `@inquirer/prompts`,
`zod`, `smol-toml`, etc.) and dev dependencies (`typescript`, `tsdown`,
`oxlint`, `vitest`, `lefthook`, ...), and generates/updates
`pnpm-lock.yaml`. `pnpm install` also runs the `prepare` script
(`lefthook install`), which activates the git hooks — but see the next
step to fully wire the commit-message template too.

### 4. Set Up Git Hooks

```bash
just setup-hooks
```

This (re)installs the [lefthook](https://lefthook.dev) git hooks and
points `git commit` at `.gitmessage` as the commit-message template.
With hooks installed:

- **pre-commit** runs oxfmt (auto-fixing staged files), oxlint, a
  large-file check, and a full-program `tsc --noEmit` — in parallel.
- **commit-msg** runs commitlint against your commit message
  ([Conventional Commits](https://www.conventionalcommits.org/), 50/72
  line-length limits).
- **pre-push** runs the test suite only if you opt in:
  `export TS_PROJECTS_PREPUSH_TESTS=1`. By default, tests are left to
  CI so local pushes stay fast.

### 5. Run All Quality Gates

```bash
just all
```

This runs `format-check`, `lint`, `typecheck`, and `test` — the same
four gates enforced by the pre-commit hook suite and by CI. Run
`just` with no arguments to see every available recipe grouped by
purpose (setup, build, test, docs, releases, ...).

### 6. Build and Run the CLI

```bash
just build             # bundles src/cli.ts + src/lib.ts to dist/ via tsdown
just run --help        # node dist/cli.js --help
just version           # node dist/cli.js --version
```

`just run` forwards any arguments to the built CLI, so you can exercise
the real command:

```bash
export TS_PROJECTS_TOKEN=your_token_here
just run --format json
```

See [EXAMPLECLI.md](../../EXAMPLECLI.md) for the full UX spec —
configuration precedence, environment variables, output formats, and
the exit-code contract — and
[docs/reference/cli-reference.md](../reference/cli-reference.md) for
the command reference.

### 7. Configure the Project (If Using This as a Template)

If you're starting a new project from this blueprint rather than
working on it directly, update the rename seam:

- `package.json` — `name`, `description`, `repository`, `bin` entry
- `Justfile` — the `ts_package_name`, `repo_name`, and `command_name`
  variables at the top of the file (they drive `just pack-check` and
  `just run`)
- Environment variable prefix (`TS_PROJECTS_*`) and config file name,
  if you want a different namespace — see
  [docs/reference/configuration-files.md](../reference/configuration-files.md)

### 8. Keep Developing

Common recipes you'll reach for during day-to-day development:

```bash
just format       # oxfmt --write
just lint         # oxlint
just lint-fix     # oxlint --fix
just typecheck    # tsc --noEmit
just test         # vitest run
just coverage     # vitest run --coverage (95/95/90/95 thresholds)
```

## Project Commands Reference

| Task              | Recipe              | Underlying command                     |
| ----------------- | ------------------- | -------------------------------------- |
| Install deps      | `pnpm install`      | —                                      |
| Setup git hooks   | `just setup-hooks`  | `pnpm exec lefthook install`           |
| Format            | `just format`       | `pnpm exec oxfmt`                      |
| Format check      | `just format-check` | `pnpm exec oxfmt --check`              |
| Lint              | `just lint`         | `pnpm exec oxlint`                     |
| Type check        | `just typecheck`    | `pnpm run typecheck` (`tsc --noEmit`)  |
| Test              | `just test`         | `pnpm exec vitest run`                 |
| Coverage          | `just coverage`     | `pnpm run test:coverage`               |
| All quality gates | `just all`          | format-check + lint + typecheck + test |
| Build             | `just build`        | `pnpm run build` (tsdown)              |
| Run built CLI     | `just run [args]`   | `node dist/cli.js [args]`              |
| Docs link check   | `just docs-check`   | `node scripts/check-links.mjs`         |
| Full CI mirror    | `just ci`           | install + gates + build + hook suite   |

## Release Flow

Releases are not hand-rolled: [release-please](https://github.com/googleapis/release-please)
watches Conventional Commit history on `main` and maintains a Release
PR that bumps `package.json`, `.release-please-manifest.json`, and
`CHANGELOG.md`. Merging that PR tags the commit, which triggers the
publish workflow to build, verify, and (after a one-click environment
approval) publish to npm via Trusted Publishing (OIDC) — no long-lived
npm token is ever stored.

```bash
just release-status   # compare package.json / manifest / latest tag
just pack-check        # local-only: build, publint, attw, npm pack --dry-run,
                        # install the tarball, smoke-test the bin + ESM import
```

See [docs/maintainers-release.md](../maintainers-release.md) for the
full release runbook (one-time environment setup + routine release
steps).

## Additional Resources

- [docs/tasks/setting-up-development.md](../tasks/setting-up-development.md)
- [docs/tasks/managing-dependencies.md](../tasks/managing-dependencies.md)
- [docs/tasks/type-checking-code.md](../tasks/type-checking-code.md)
- [docs/tasks/using-ci-cd.md](../tasks/using-ci-cd.md)
- [docs/tools/justfiles.md](../tools/justfiles.md)
