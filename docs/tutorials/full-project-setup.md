# Full Project Setup

This tutorial walks through the end-to-end setup of a new project from
this template. By the end, you'll have a working development
environment, a built CLI you can run locally, and a clear picture of
how releases happen.

## Prerequisites

This template only assumes you have `git` and a shell. Everything else
— Node.js, pnpm, and `just` — is checked (and, where possible, installed)
for you by the bootstrap `Makefile`, or provisioned via `mise`, `flox`, or a
VS Code Dev Container.

## Steps

### 1. Clone the Repository

```bash
git clone https://github.com/smorinlabs/ts-launch-blueprint.git
cd ts-launch-blueprint
```

### 2. Level 1: Bootstrap Foundational Tools

```bash
make bootstrap   # ensures node >=24, pnpm 10, and just are installed, then runs make check
```

`make` is the one tool this template assumes you already have (almost
everyone does). `make check` verifies that `just`, `node` (>=24), and `pnpm`
are installed (plus optional `docker`) and prints copy-pasteable install
commands for whichever is missing:

```bash
make install-just    # prints the just install command (or `make install-just-force`)
make install-node    # prints Node version-manager guidance (mise/nvm/fnm)
make install-pnpm    # prints pnpm install guidance (standalone/npm/Homebrew)
```

Node **24 or newer** is required (`.nvmrc` pins `24`; `package.json`
`engines.node` enforces `>=24`). You can also use `mise install` (`mise.toml`),
`flox activate` (`.flox/env/manifest.toml`), or `.devcontainer/` to provision
the full external toolchain. Everything else — formatting, linting, type
checking, testing, building — is a `just` recipe; the `Makefile` never wraps
development tasks itself.

### 3. Level 2: Run Unified Setup

```bash
just setup
```

`just setup` is idempotent and handles the entire workspace setup in one pass:

1. Runs `make check` to verify the Level 1 toolchain.
2. Installs pinned `shellcheck`, `actionlint`, `editorconfig-checker`, and
   `gitleaks` into `~/.local/bin`.
3. Runs `pnpm install` (which installs runtime and dev dependencies and
   generates/updates `pnpm-lock.yaml`).
4. Runs `just setup-hooks` to wire [lefthook](https://lefthook.dev) git hooks
   and `.gitmessage`.
5. Restores `projects/.gitkeep` when `PROJECTS.md` is present and runs
   `just check-deps`.

### 4. Git Hooks Summary

With `just setup-hooks` wired:

- **pre-commit** runs oxfmt (auto-fixing staged files), oxlint, boundary
  checks (`depcruise`), `shellcheck`, `actionlint`, `editorconfig-checker`,
  `cspell`, `pnpm-lock-check`, `check-large-files`, `gitleaks`, and a
  full-program `tsc --noEmit` — in parallel.
- **commit-msg** runs commitlint against your commit message
  ([Conventional Commits](https://www.conventionalcommits.org/), 100/200/200
  header/body/footer line-length limits).
- **pre-push** runs `gitleaks-range`, `press-verify`, and (if you opt in via
  `export TS_PROJECTS_PREPUSH_TESTS=1`) the test suite.

### 5. Run All Quality Gates

```bash
just all
```

This runs `format-check`, `lint`, `check-boundaries`, `check-shell`,
`check-workflows`, `check-editorconfig`, `check-spelling`, `typecheck`, and
`test`. Run `just` with no arguments (or `just select-shell` for interactive
selection) to see every available recipe grouped by purpose.

### 6. Build and Run the CLI

```bash
just build             # bundles apps/cli/src/cli.ts + apps/cli/src/lib.ts to dist/ via tsdown
just run --help        # node apps/cli/dist/cli.js --help
just version           # node apps/cli/dist/cli.js --version
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

### 7. Stamp a New Project with `template-press`

If you're starting a new project from this blueprint rather than working on it
directly, use [template-press](https://github.com/smorinlabs/template-press) to
rebrand all workspace packages, `Justfile` variables, CLI binary names, and
environment variable prefixes in one verified pass:

1. Copy `press/press-answers.example.toml` outside the repository and edit it
   with your destination identity.
2. Run `press rebrand --target . --config ../press-answers.toml --dry-run` to
   preview the plan, then run without `--dry-run` to apply it.
3. Run `just all` and `just press-verify` to confirm every gate is green.

See [Setting Up Development](../tasks/setting-up-development.md#customization-for-new-projects)
for the exact commands.

### 8. Keep Developing

Common recipes you'll reach for during day-to-day development:

```bash
just dev                    # format + lint + typecheck + test + build (alias: just cycle)
just format                 # oxfmt --write
just lint                   # oxlint
just lint-fix               # oxlint --fix
just typecheck              # tsc --noEmit
just test                   # vitest run
just coverage               # vitest run --coverage (95/95/90/95 thresholds)
just open-coverage-report   # open coverage/index.html in browser
just api                    # build and start API on :8080
just api-dev                # start API in tsx watch mode
```

## Project Commands Reference

| Task                 | Recipe                       | Underlying command                               |
| -------------------- | ---------------------------- | ------------------------------------------------ |
| Unified setup        | `just setup`                 | Level 2 setup (analyzers, `pnpm install`, hooks) |
| Install deps         | `just install`               | Pinned tools + `pnpm install`                    |
| Developer cycle      | `just dev` (`cycle`)         | format + lint + typecheck + test + build         |
| Setup git hooks      | `just setup-hooks`           | `pnpm exec lefthook install` + `.gitmessage`     |
| Run pre-commit       | `just hooks-run` (`hooks`)   | `pnpm exec lefthook run pre-commit --all-files`  |
| CI pre-commit        | `just pre-commit-run` (`pc`) | `pnpm exec lefthook run pre-commit --all-files`  |
| Verify commits       | `just verify-commits`        | `pnpm exec commitlint`                           |
| Format               | `just format`                | `pnpm exec oxfmt`                                |
| Format check         | `just format-check`          | `pnpm exec oxfmt --check`                        |
| Lint                 | `just lint`                  | `pnpm exec oxlint`                               |
| Type check           | `just typecheck`             | `pnpm run typecheck`                             |
| Test                 | `just test`                  | `pnpm exec vitest run`                           |
| Coverage             | `just coverage`              | `pnpm run test:coverage`                         |
| Coverage report      | `just open-coverage-report`  | Open `coverage/index.html` in browser            |
| All quality gates    | `just all`                   | All check, lint, typecheck, and test gates       |
| Build                | `just build`                 | `pnpm -r --filter './apps/*' build` (tsdown)     |
| Run built CLI        | `just run [args]`            | `node apps/cli/dist/cli.js [args]`               |
| Run API / dev API    | `just api` / `just api-dev`  | built `server.js` / `tsx watch src/server.ts`    |
| Select interactively | `just select-shell`          | `just --choose`                                  |
| Clean artifacts      | `just clean`                 | Remove `apps/*/dist`, `packages/*/dist`, caches  |
| Docs link check      | `just docs-check`            | `node scripts/check-links.mjs README.md docs`    |
| Full CI mirror       | `just ci`                    | install + all + docs-check + build + lefthook    |

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
