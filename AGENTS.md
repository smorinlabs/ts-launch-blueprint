# AGENTS.md — Project Charter for ts-launch-blueprint

Canonical guidance for ALL coding agents (Claude Code, Cursor, Codex,
Windsurf, Aider, etc.) — this is the single file to edit.
[`CLAUDE.md`](CLAUDE.md) imports it verbatim (`@AGENTS.md`); Cursor,
Windsurf, and Codex read this file natively (vendor rule directories were
retired per Q10.A / Py ADR 0014). For human-contributor flow see
[`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md).

## Base Rules

- `Justfile` is the canonical task runner and holds all project automation.
- `Makefile` is strictly for Level 1 bootstrapping (`make bootstrap`,
  `make check`, `make hook-check`, `make install-node`, `make install-pnpm`,
  `make install-just`, plus optional `make install-docker` /
  `make install-flox`); add no new feature targets there.

### Justfile Editing Conventions

- Keep a blank line between recipes.
- Place every recipe in an existing `[group('...')]` declared in the `Justfile`
  header block.
- Put a one-line `#` doc comment directly above the recipe (and `@` / attributes
  between the comment and recipe name).

## Project Overview

`ts-launch-blueprint` is a production-ready TypeScript workspace shipping a
standalone core library (`ts-launch-blueprint-core`), an example CLI (`ts-projects`), an
HTTP API (`@ts-launch-blueprint/api`), a React/Vite web app
(`@ts-launch-blueprint/web`), and full quality-gate, packaging, and
repo-hygiene scaffolding.

- Package name: `ts-launch-blueprint` (CLI) / `ts-launch-blueprint-core` (standalone core library)
- Command name: `ts-projects`
- Env-var prefix: `TS_PROJECTS_*`

## Project Structure

- `packages/core`: publishable standalone core library `ts-launch-blueprint-core`
  (shared schemas, repositories, services, and `VERSION`); imported by apps only
  via its package entry (`src/index.ts` in workspace dev, `dist/index.js` +
  `dist/index.d.ts` via `publishConfig.exports` when packed); build output in
  `packages/core/dist` (gitignored, `zod` externalized, `sideEffects: false`).
- `apps/cli`: published npm package `ts-launch-blueprint` (`ts-projects` bin
  entry in `src/cli.ts`, public API in `src/lib.ts`, `src/version.ts`); build
  output in `apps/cli/dist` (gitignored; bundles core).
- `apps/api`: `@ts-launch-blueprint/api` — Hono + tRPC HTTP server (`src/server.ts`,
  `src/router.ts`), Pino logging, Prometheus metrics, OpenTelemetry tracing;
  build output in `apps/api/dist`.
- `apps/web`: `@ts-launch-blueprint/web` — React 19 + Vite + TanStack Query +
  tRPC browser app; imports only `import type { AppRouter } from '@ts-launch-blueprint/api/router'`;
  build output in `apps/web/dist`.
- Tests live in each package's `tests/` (`*.test.ts`) and repo-wide checks in
  `tests/`.
- Architecture boundaries (D-042): enforced by `.oxlintrc.json` and
  `.dependency-cruiser.cjs` (see `docs/reference/boundary-rules.md`). Run
  `just check-boundaries` after changing imports; never silence a boundary rule.
- Read `docs/about/architecture.md` before adding a feature.

## Development Environment

- **Node.js >= 24**: `.nvmrc`, `engines.node`, and `devEngines.runtime` must
  agree (enforced by a meta-test).
- **pnpm 10**: sole package manager (D-035; pinned via `packageManager` and
  enforced by `.npmrc`); `pnpm-lock.yaml` is committed.
- **tsdown**: bundles `apps/cli` (`dist/` ESM-only + `.d.ts` + sourcemaps) and
  workspace builds.
- **Fresh clone setup (two-level flow)**:
  1. **Level 1 (`Makefile`)**: run `make bootstrap` (ensures Node >=24, pnpm 10,
     and `just`), `make check`, and `make hook-check` (verifies external +
     workspace hook tools).
  2. **Level 2 (`just setup`)**: installs pinned analyzers (`shellcheck`
     0.11.0, `actionlint` 1.7.12, `editorconfig-checker` 4.0.2, `gitleaks`
     8.27.2), runs `pnpm install`, wires lefthook + `.gitmessage` (`just
setup-hooks`), restores `projects/.gitkeep`, and runs `just check-deps`.
     Put `~/.local/bin` on `PATH` for the installed analyzers.
- **Optional turnkey toolchains**: `mise install` (`mise.toml`), `flox activate`
  (`.flox/env/manifest.toml`), and VS Code Dev Containers
  (`.devcontainer/devcontainer.json`, `.devcontainer/post-create.sh`, which runs
  `make bootstrap && just setup`); then run `just setup` for `mise`/`flox`.
  Workspace JS tools stay in `pnpm-lock.yaml`, not `mise`/`flox`.

## Canonical Commands

| Task                      | Command                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| List / choose recipes     | `just` / `just select-shell` (`just --choose`)                                                                                    |
| Unified setup (Level 2)   | `just setup` (after `make bootstrap`; or `just install` + `just setup-hooks`)                                                     |
| Full local quality gate   | `just all` (parallel: format-check, lint, boundaries, shell, workflows, editorconfig, spelling, typecheck, test)                  |
| Dev cycle (fast loop)     | `just dev` / `just cycle` (format, lint, typecheck, test, build)                                                                  |
| Format / check format     | `just format` / `just format-check` (`oxfmt`)                                                                                     |
| Lint / autofix            | `just lint` / `just lint-fix` (`oxlint`)                                                                                          |
| Architecture boundaries   | `just check-boundaries` (`depcruise`)                                                                                             |
| Removable-app proof       | `just check-removable cli`, `api web`, `web`, or `cli api web` (core-only standalone library)                                     |
| Type check                | `just typecheck` (`pnpm run typecheck`)                                                                                           |
| Run tests                 | `just test` (Vitest) or `pnpm exec vitest run <file> -t '<name>'`                                                                 |
| Advisory Bun tests        | `just test-bun` (Vitest under Bun, excludes `e2e.test.ts`; never `bun install` or bare `bun test`)                                |
| Coverage (95/95/90/95)    | `just coverage` (`just open-coverage-report` opens HTML)                                                                          |
| Build packages + apps     | `just build` (`packages/*/dist`, `apps/*/dist`)                                                                                   |
| Run API / Web dev         | `just api` (port 8080) / `just api-dev` (`tsx watch`) / `just web` (Vite proxies `/trpc` to `:8080`)                              |
| Docker API + smoke        | `just docker-build`, `just docker-run`, `just smoke`                                                                              |
| Run built CLI             | `just run <args>` / `just version`                                                                                                |
| Packaging verification    | `just pack-check` (`pack-check-core` + `pack-check-cli`: build, publint, attw, tarball + consumer smoke)                          |
| Docs link check / TypeDoc | `just docs-check` / `just docs-api` (optional)                                                                                    |
| Hook suite & commits      | `just hooks-run` (`just pre-commit-run`), `just verify-commits`, `just ci`                                                        |
| Security & hygiene checks | `just check-gitleaks`, `just audit`, `just check-shell`, `just check-workflows`, `just check-editorconfig`, `just check-spelling` |
| Press drift guard         | `just press-verify`                                                                                                               |
| Toolchain / release info  | `just check-deps`, `just debug-info`, `just release-status`, `just contributors`, `just clean`                                    |

## Verification Flow Before Commit/PR

1. **Setup (fresh clone / worktree)**: `make bootstrap` (if base tools are
   missing) and `just setup` (or `just install` + `just setup-hooks`; without
   `setup-hooks`, git hooks are silent no-ops; verify with `make hook-check`).
2. **Quality & packaging gates**: run `just all`, `just coverage`,
   `just pack-check`, and `just docs-check`.
3. **Press conformance** (enforced by `.github/workflows/press-verify.yml`): any
   added or renamed file carrying an identity token (`ts-launch-blueprint`,
   `ts_launch_blueprint`, `ts-projects`, `TS_PROJECTS`, author/owner names,
   `TS Launch Blueprint`) must press cleanly via default rewrites or
   `press/press-rules.toml`. Verify locally with `just press-verify`.
4. **Stage + commit** (lefthook hooks in `lefthook.yml`, or verify commits via
   `just verify-commits`):
   - `commit-msg`: `commitlint`.
   - `pre-commit`: `shellcheck`, `actionlint`, `editorconfig-checker`, `cspell`,
     `pnpm-lock-check`, `format` (`stage_fixed`), `check-large-files` (1 MB
     outside `docs/assets/`), `lint`, `boundaries`, `typecheck`, `gitleaks`
     (skipped when `CI=true`).
   - `pre-push`: `gitleaks-range`, `press-verify`, optional tests
     (`TS_PROJECTS_PREPUSH_TESTS=1`).
     Hooks mirror CI; CI is the authority.

## Pull Request Review Comments — MERGE GUARD (hard, enforced)

**This is a hard gate, not a guideline.** This repository enforces an active
ruleset with `required_review_thread_resolution: true` (verify with
`gh api "repos/<owner>/<repo>/rulesets"`). **A PR with ANY unresolved review
thread CANNOT be merged.** Bots (Copilot, CodeRabbit, Greptile, Cubic, Claude)
re-review on every push and open new threads, so a previously clean PR can
become blocked after a push.

For **every** review comment (human or bot), complete all three steps:

1. **Pre-validate** against the actual code/docs (confirm valid vs. invalid).
2. **Reply** recording the verdict and action (fix valid issues in the PR
   first, or give concrete rationale for invalid/intentional items).
3. **Resolve** the thread via the GraphQL `resolveReviewThread` mutation (there
   is no REST equivalent; account for GraphQL rate limits before merging).

## Code Quality & Commit Conventions

- **Commitlint (`commitlint.config.mjs`, `.gitmessage`)**: Conventional Commits
  with `100`-char header, `200`-char body lines, and `200`-char footer lines
  (Q9.A). Allowed types (exact 11): `feat`, `fix`, `docs`, `style`, `refactor`,
  `test`, `chore`, `ci`, `build`, `perf`, `revert`. `commitlint.dependabot.config.mjs`
  relaxes body/footer line length for `dependabot[bot]`. Every non-merge commit
  on a PR is linted in CI — reword non-conventional commits before merging.
- **Oxlint (`.oxlintrc.json`)**: `correctness` + `suspicious` at error
  severity, security-adjacent built-ins (`no-eval` family), `^_` unused-code
  convention, test relaxations in `**/tests/**`.
- **Oxfmt (`.oxfmtrc.json`)**: `100` cols, single quotes, semicolons, es5
  trailing commas, LF, `sortImports`; also formats JSON, YAML, and Markdown.
- **TypeScript 7 (`tsconfig.json`)**: strict `tsc --noEmit` including
  `isolatedDeclarations` at root (annotate exported symbols; disabled in
  `apps/api` and `apps/web` due to tRPC/React inference).
- **Vitest (`vitest.config.ts`)**: v8 coverage thresholds `95/95/90/95`
  (lines/functions/branches/statements).

## Dependencies

### Runtime Dependencies (per package)

- `packages/core`: `zod`
- `apps/cli`: `@inquirer/prompts`, `cli-table3`, `clipboardy`, `commander`,
  `picocolors`, `smol-toml`, `yocto-spinner`, `zod` (plus `ts-launch-blueprint-core`)
- `apps/api`: `@hono/node-server`, `@hono/trpc-server`, `@opentelemetry/api`,
  `@opentelemetry/context-async-hooks`, `@opentelemetry/core`,
  `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/resources`,
  `@opentelemetry/sdk-trace`, `@opentelemetry/semantic-conventions`,
  `@trpc/server`, `@prometheus-io/client`, `hono`, `pino`, `zod` (plus `ts-launch-blueprint-core`)
- `apps/web`: `@tanstack/react-query`, `@trpc/client`, `@trpc/server`,
  `@trpc/tanstack-react-query`, `react`, `react-dom` (with
  `@ts-launch-blueprint/api` and `ts-launch-blueprint-core` in devDependencies)

### Development Dependencies

- `typescript`, `tsdown`, `tsx`
- `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`,
  `@testing-library/dom`, `@testing-library/user-event`
- `oxlint`, `oxfmt`, `dependency-cruiser`, `cspell`
- `lefthook`, `@commitlint/cli`, `@commitlint/config-conventional`
- `publint`, `@arethetypeswrong/cli`, `yaml`, `pino-pretty`

## Releases

- `release-please` (`release-please-config.json`, `.github/workflows/release-please.yml`)
  bumps `package.json`, `packages/core/package.json`, `apps/cli/package.json`
  (`extra-files`), `.release-please-manifest.json`, and `CHANGELOG.md` atomically
  (`pnpm-lock.yaml` carries no root version).
- **Merge strategy**: use `--merge` (repository ruleset disallows squash merges).
  Because individual branch commits land on `main` and feed `release-please`,
  every commit must follow Conventional Commits.
- **Publishing (`publish.yml`)**: `verify` runs `just pack-check` (both core and
  CLI), then `publish` runs `npm publish` for `apps/cli` via OIDC
  Trusted Publishing (`id-token: write` in protected `npm` environment — never
  `NPM_TOKEN` and never `pnpm publish`), and `publish-core` publishes
  `packages/core` (`ts-launch-blueprint-core`, packed with `pnpm pack` ->
  `npm publish <tarball> --access public`) in parallel when repository variable
  `PUBLISH_CORE == 'true'` (ADR 0017; see `docs/RELEASE.md`).

## Documentation & Link Policy

- `just docs-check` runs `node scripts/check-links.mjs README.md docs` offline
  on every PR (`ci.yml`).
- Use relative `.md` paths inside `docs/` and `README.md` (no extensionless
  links), plain GitHub-Flavored Markdown (no Sphinx/MyST directives), no
  `#fragment` links to `github.com`, verify new external URLs return `200`, and
  update `docs/` in the same PR whenever a config or tool is retired.

### 8-Section Documentation Template (`docs/**/*.md`)

When writing tool or feature documentation under `docs/`, use `##` headings for
these eight required sections (include practical examples, standalone +
integrated testing steps, configuration options, disabling guidance, and
external references):

1. `## Introduction`
2. `## Purpose and Problem Solved by This Feature/Tool`
3. `## Getting Started`
4. `## Usage`
5. `## Configuration`
6. `## Testing`
7. `## Disabling the Feature`
8. `## References`

## project-harness — project workflow skills

Project state lives in `PROJECTS.md` (trunk) and `projects/P<NN>-*.md`. Route
state changes through `using-project-harness`, `project-next`, `project-add`,
`project-refine`, and `project-audit`. Trunk rows use
`- [<glyph>] **P<NN>** — [<title>](projects/P<NN>-<slug>.md)` and non-`[?]`
project files open with `- **Trunk:** [PROJECTS.md](../PROJECTS.md)` under
`**References**`.
