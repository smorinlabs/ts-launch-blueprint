# Design Decisions

This is the thematic map of **every deliberate tool, library, and
configuration choice** in `ts-launch-blueprint` — what each choice is, why it
was made, and what value it brings to the project and to downstream
repositories stamped from the template.

## How to read this document

Engineering decisions in this repository are recorded in two retained places:

- **Architecture Decision Records** ([`docs/adr/`](../adr/README.md)) — one
  significant decision per file (context → choice → consequences), immutable
  once accepted.
- **Configuration & reference docs** ([`docs/reference/`](../reference/index.md))
  — executable configuration files, boundary rules, and runtime contracts.

**This page indexes those choices thematically** so a reader can understand the
whole system in one pass. Each entry uses the same compact shape:

> **What** — the concrete choice.
> **Why** — the rationale and the alternative it displaced.
> **Value** — what it buys the project and its users.
> **Refs** — the ADR or repository artifact that owns or implements it.

---

## 1. Language & runtime

### Node.js 24+ Active LTS floor

**What** — `engines.node = ">=24"` in `package.json`, pinned in `.nvmrc` (`24`)
and `devEngines.runtime`.
**Why** — Node 24 is Active LTS, bundles `npm >= 11.5.1` (required for npm OIDC
Trusted Publishing), and provides modern built-ins (`AbortSignal.timeout`, JSON
import attributes) without Corepack or EOL Node 20 baggage.
**Value** — every published CLI build and API container runs on a supported,
predictable runtime.
**Refs** — `.nvmrc`, `package.json`, [ADR 0001](../adr/0001-pnpm-monorepo-and-cli-only-publishing.md).

### 4-cell cross-OS & Node CI matrix

**What** — CI runs tests on `ubuntu`, `macos`, and `windows` at Node `24.x`,
plus `ubuntu` at Node `26.x` (Current).
**Why** — covers cross-platform path, symlink, and terminal quirks on the
minimum supported Node version while tracking the next major runtime without
multiplying every OS cell.
**Value** — cross-OS regressions are caught before merge.
**Refs** — `.github/workflows/ci.yml`, [ADR 0013](../adr/0013-testing-resilience-cross-os-ci-and-playwright.md).

### Optional advisory Bun lane

**What** — `just test-bun` and CI `bun-lane` run non-E2E Vitest suites under
Bun 1.3.x without maintaining a `bun.lock` (`never` `bun install`, `never` bare
`bun test`).
**Why** — tracks compatibility with fast alternative runtimes while keeping Node
24 and `pnpm-lock.yaml` authoritative (`apps/cli/tests/e2e.test.ts` stays
Node-only to verify real Node signal handling).
**Value** — early signal on runtime portability with zero consumer lock-in.
**Refs** — `Justfile` (`test-bun`), `.github/workflows/ci.yml`.

---

## 2. Code structure & architecture

### pnpm workspace monorepo (`packages/core` + `apps/*`)

**What** — `pnpm-workspace.yaml` separates `packages/core` (private, no build
step), `apps/cli` (published npm CLI + library), `apps/api` (private Hono +
tRPC server), and `apps/web` (private React + Vite UI), without Turborepo.
**Why** — Node server/CLI code and browser React code need different
`tsconfig.json` and bundler settings, and four small packages are orchestrated
faster by `Justfile` + `pnpm --filter` than a task-caching wrapper.
**Value** — deleting any app directory (`cli`, `api web`, `web`) leaves the rest
of the workspace clean, verified by `just check-removable`.
**Refs** — `pnpm-workspace.yaml`, [ADR 0001](../adr/0001-pnpm-monorepo-and-cli-only-publishing.md).

### Layered core (`schemas` / `repositories` / `services` + `createCore`)

**What** — `packages/core` separates Zod schemas and domain errors (`schemas/`),
data-access ports (`repositories/` with HTTP + in-memory implementations),
business logic (`services/`), and a single composition root (`createCore`).
**Why** — isolates domain rules from transport details (`commander`, `hono`,
`trpc`) so CLI and API share identical business semantics and tests run
in-memory with zero network calls.
**Value** — clean replacement of data backends and straightforward unit testing.
**Refs** — `packages/core/src/index.ts`, [Architecture](architecture.md), [ADR 0009](../adr/0009-layered-core-and-boundary-enforcement.md).

### Mechanical boundary enforcement (`oxlint` + `dependency-cruiser`)

**What** — per-directory `oxlint` `no-restricted-imports` overrides plus
`dependency-cruiser` (`parser: 'swc'`) enforce `[core-no-framework-import]`,
`[app-core-entry-only]`, `[app-no-cross-app-import]`,
`[api-core-via-create-core]`, and `[web-types-only-from-api]`.
**Why** — prose architecture rules erode; Oxlint fails in milliseconds at edit
time and `dependency-cruiser` verifies the whole resolved import graph
(including `type-only` edges under TypeScript 7).
**Value** — architectural invariants are proven by tests (`tests/boundaries.test.ts`).
**Refs** — `.oxlintrc.json`, `.dependency-cruiser.cjs`, [Boundary Rules](../reference/boundary-rules.md), [ADR 0009](../adr/0009-layered-core-and-boundary-enforcement.md).

---

## 3. Dependency management & build

### `pnpm 10` + committed `pnpm-lock.yaml`

**What** — `packageManager` pins `pnpm@10.34.3` with a committed
`pnpm-lock.yaml` and `pnpm install --frozen-lockfile` in CI; `npm publish` is
used at release time (`apps/cli`).
**Why** — strict workspace hoisting prevents phantom imports, GitHub
dependency graph/Dependabot support `pnpm-lock.yaml` natively, and `npm publish`
avoids `pnpm publish` OIDC delegation bugs.
**Value** — reproducible installs and reliable npm Trusted Publishing.
**Refs** — `package.json`, `pnpm-lock.yaml`, [ADR 0001](../adr/0001-pnpm-monorepo-and-cli-only-publishing.md).

### `tsdown` ESM-only bundler + validated `exports`

**What** — `apps/cli` (`src/cli.ts`, `src/lib.ts`) and `apps/api`
(`src/server.ts`) bundle with `tsdown` (`"type": "module"`, ESM-only);
`apps/cli` uses a hand-authored `exports` map validated by `publint` and `attw`
(`just pack-check`).
**Why** — `tsup` is unmaintained; `tsdown` + Rolldown emits fast ESM bundles and
declarations (with `isolatedDeclarations: true`), and `publint` + `attw` +
tarball install tests catch broken `exports` or `bin` entries before release.
**Value** — zero-surprise npm package installation.
**Refs** — `apps/cli/tsdown.config.ts`, `apps/cli/package.json`, [ADR 0001](../adr/0001-pnpm-monorepo-and-cli-only-publishing.md).

### Static `package.json` version + MIT SPDX headers

**What** — `apps/cli/src/version.ts` imports `../package.json` via JSON import
attributes (`with { type: 'json' }`), bumped atomically by `release-please`;
root `LICENSE` is MIT with concise `SPDX-License-Identifier: MIT` headers.
**Why** — eliminates generated version files and multi-line license banners
while keeping runtime `--version` exact.
**Value** — single source of truth for versions and clean licensing provenance.
**Refs** — `apps/cli/src/version.ts`, `LICENSE`, [Versioning](../reference/versioning.md).

---

## 4. Linting & formatting

### Oxlint + Oxfmt unified pipeline

**What** — `oxlint` (correctness + suspicious at error severity, test-specific
overrides) and `oxfmt` (`printWidth: 100`, `singleQuote: true`, `semi: true`,
`trailingComma: 'es5'`, `sortImports`) format TS, JS, JSON, YAML, TOML, and
Markdown.
**Why** — replaces slow multi-tool stacks (`eslint`, `prettier`, `taplo`,
`yamlfmt`) with one fast Rust-based formatter/linter pair.
**Value** — sub-second local formatting and lint checks across every file type.
**Refs** — `.oxlintrc.json`, `.oxfmtrc.json`, [ADR 0010](../adr/0010-typescript-7-oxc-and-single-typecheck.md).

### `cspell` + `.editorconfig` + `editorconfig-checker`

**What** — Node-native `cspell` (`cspell.json`) checks spelling across code and
docs, and `editorconfig-checker` validates `.editorconfig` compliance.
**Why** — drops the Python `codespell` dependency so spelling checks run in the
existing Node toolchain without extra runtimes.
**Value** — catches typos in identifiers, comments, and documentation offline.
**Refs** — `cspell.json`, `.editorconfig`, [ADR 0014](../adr/0014-hook-ci-parity-cspell-and-commitlint.md).

---

## 5. Type checking

### TypeScript 7 (`^7.0.2`) single-engine `tsc --noEmit`

**What** — `tsconfig.base.json` enforces `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `NodeNext`, and
`isolatedDeclarations: true` (for `packages/core` and `apps/cli`);
`scripts/typecheck.sh` runs the root workspace plus per-app `tsconfig.json`
files (`apps/api`, `apps/web`), and `.vscode/settings.json` pins
`typescript.tsdk`.
**Why** — CI and the editor share one compiler and configuration (`tsc`), while
isolated declarations enable fast `.d.ts` generation without sacrificing full
type checking on tRPC/React apps.
**Value** — zero editor-vs-CI type skew.
**Refs** — `tsconfig.base.json`, `scripts/typecheck.sh`, `.vscode/settings.json`, [ADR 0010](../adr/0010-typescript-7-oxc-and-single-typecheck.md).

---

## 6. Testing

### Vitest 4, shuffled order, `95/95/90/95` coverage & `fast-check`

**What** — Vitest 4 runs workspace projects (`core`, `cli`, `api`, `web`,
`repo`) with `sequence.shuffle: true`, explicit timeouts, `fast-check` property
tests, 80-col CLI `--help` snapshots, subprocess `e2e.test.ts`, and
`@vitest/coverage-v8` thresholds (`95` lines, `95` functions, `90` branches,
`95` statements) uploaded tokenlessly to Codecov on public repos.
**Why** — randomized execution catches shared-state test coupling early; strict
thresholds keep core and controller behavior covered without bloating thin
process entrypoints.
**Value** — deterministic, high-confidence regressions across unit, property,
and subprocess tiers.
**Refs** — `vitest.config.ts`, `.codecov.yml`, [ADR 0013](../adr/0013-testing-resilience-cross-os-ci-and-playwright.md).

### Playwright Chromium E2E & repo-hygiene meta-tests

**What** — `apps/web` runs Playwright Chromium browser E2E (`just test-web-e2e`,
CI `web-e2e` job); root `tests/` asserts workflow/config invariants, boundary
probes (`tests/boundaries.test.ts`), setup scripts (`tests/setup-scripts.test.ts`),
and press rules (`tests/press-config.test.ts`).
**Why** — tests the real built API + React bundle in a browser and prevents
configuration drift between hooks, workflows, and docs.
**Value** — catches integration and governance drift automatically.
**Refs** — `.github/workflows/ci.yml`, `tests/repo-hygiene.test.ts`, [ADR 0013](../adr/0013-testing-resilience-cross-os-ci-and-playwright.md).

---

## 7. Pre-commit / git hooks

### `lefthook 2.x` three-stage parity

**What** — `package.json` `"prepare"` installs `lefthook` across `commit-msg`
(`commitlint`), `pre-commit` (`oxfmt`, `oxlint`, `depcruise`, `shellcheck`,
`actionlint`, `editorconfig-checker`, `cspell`, `pnpm-lock-check`,
`check-large-files`, `gitleaks`, `tsc --noEmit`), and `pre-push`
(`gitleaks-range`, `press-verify`, optional `TS_PROJECTS_PREPUSH_TESTS=1`).
**Why** — runs fast checks locally with CI parity (`just hooks-run`) while
keeping slow full-test runs opt-in before push.
**Value** — prevents broken commits from reaching CI.
**Refs** — `lefthook.yml`, [Lefthook](../tools/lefthook.md), [ADR 0014](../adr/0014-hook-ci-parity-cspell-and-commitlint.md).

---

## 8. Security

### Two-layer secret scanning + keyless SAST/SCA

**What** — `gitleaks` scans staged changes and push ranges locally while
TruffleHog (`--only-verified`) scans commits in CI (`secret-scan.yml`). CodeQL
(`javascript-typescript`, `security-extended`), `dependency-review.yml`, weekly
`dep-audit.yml` (`pnpm audit` + `osv-scanner`), `large-file-guard.yml`, and
manual `manual-pr-security-scan.yml` (`security-review` env, keyless
`osv-scanner`) ship with `permissions: {}` least-privilege baselines.
**Why** — layered scanning catches leaked credentials and vulnerable
dependencies without requiring commercial API keys in downstream repos.
**Value** — strong security posture out of the box for both public and private
forks.
**Refs** — `.github/SECURITY.md`, `.gitleaks.toml`, [ADR 0015](../adr/0015-security-scanning-and-optional-org-automation.md).

### Optional org security triage (`audit-triage.yml` + `.oss-scanner/`)

**What** — `audit-triage.yml` is inert unless `vars.MUSE_CI_ENABLED == 'true'`
and `META_MUSE_CI_API_KEY` are configured; `.oss-scanner/` ships as
blueprint-only security context (`[[remove]]`d on `press rebrand`).
**Why** — supports optional automated org triage without breaking or leaking
into downstream stamped repositories.
**Value** — clean opt-in governance for org-managed repos.
**Refs** — `.github/workflows/audit-triage.yml`, [ADR 0015](../adr/0015-security-scanning-and-optional-org-automation.md).

---

## 9. CI/CD

### Path-aware `ci.yml`, `ci-ok` gate & `merge_group`

**What** — `.github/workflows/ci.yml` uses a `changes` path detector and
`release-please--*` fast path, feeds all required jobs (`lint`, `typecheck`,
`check-boundaries`, 4-cell `test`, `pack-check`, `check-removable`, `api-image`,
`web-e2e`) into a single `ci-ok` gate, and supports `merge_group` queues.
**Why** — docs-only PRs skip heavy builds safely while `ci-ok` keeps branch
protection immune to internal job renames.
**Value** — fast PR feedback with one stable required check.
**Refs** — `.github/workflows/ci.yml`, [Using CI/CD](../tasks/using-ci-cd.md), [ADR 0013](../adr/0013-testing-resilience-cross-os-ci-and-playwright.md).

### Hybrid action pinning + `actionlint` / `shellcheck`

**What** — official `actions/*` and `github/*` actions pin major tags (except
`actions/dependency-review-action`, which pins a full SHA because it publishes
no floating major tag); third-party actions pin 40-char commit SHAs with
trailing version comments refreshed by Dependabot. All checkouts set
`persist-credentials: false`, and `actionlint` + `shellcheck` validate every
workflow and shell script.
**Why** — minimizes supply-chain and token-leak risk (`artipacked`).
**Value** — automated Dependabot updates with auditable action pins.
**Refs** — `.github/workflows/`, [GitHub Actions](../tools/github-actions.md), `scripts/check-shell.sh`.

---

## 10. Commit conventions & dependency updates

### `commitlint` (`100/200/200`) + Dependabot override + grouped updates

**What** — `commitlint.config.mjs` enforces Conventional Commits (`100` header,
`200` body/footer) matching `.gitmessage` (wired by `just setup-hooks`), while
`commitlint.dependabot.config.mjs` relaxes body/footer limits for automated
Dependabot PRs. `.github/dependabot.yml` groups weekly `github-actions`,
`npm`, and `docker` updates with a 5-day cooldown.
**Why** — `release-please` derives versions and changelogs from commit types on
`main` (merge commits enabled, squash merges disabled).
**Value** — clean commit history without breaking automated dependency bumps.
**Refs** — `commitlint.config.mjs`, `.github/dependabot.yml`, [ADR 0014](../adr/0014-hook-ci-parity-cspell-and-commitlint.md).

---

## 11. Release management

### Stock `release-please` + npm OIDC Trusted Publishing + GHCR

**What** — stock `googleapis/release-please-action` maintains Release PRs
updating `package.json`, `apps/cli/package.json`,
`.release-please-manifest.json`, and `CHANGELOG.md`. Merging cuts a `v*` tag,
triggering `publish.yml` (`verify` → protected `npm` environment → `npm publish`
via OIDC with `bin` strip-guard) and `publish-container.yml` (immutable
`:X.Y.Z` + serialized `:latest` GHCR images).
**Why** — zero long-lived `NPM_TOKEN` or registry passwords, automatic npm
provenance, and atomic version consistency.
**Value** — auditable, human-approved releases with one-click environment gates.
**Refs** — [Release Process](../RELEASE.md), `.github/workflows/publish.yml`, [ADR 0001](../adr/0001-pnpm-monorepo-and-cli-only-publishing.md).

---

## 12. Bootstrapping & toolchain provisioning

### Two-level `make bootstrap` → `just setup` + turnkey environments

**What** — `Makefile` checks/installs Level 1 tools (`node >=24`, `pnpm 10`,
`just`); `just setup` installs pinned analyzers (`shellcheck`, `actionlint`,
`editorconfig-checker`, `gitleaks`), runs `pnpm install`, wires hooks, and runs
`just check-deps`; `mise.toml`, `.flox/env/manifest.toml`, and `.devcontainer/`
offer turnkey provisioning.
**Why** — separates machine-level prerequisites from idempotent per-clone repo
setup.
**Value** — predictable onboarding across bare machines, local shells, and CI.
**Refs** — `Makefile`, `Justfile`, [ADR 0005](../adr/0005-turnkey-toolchains-mise-flox-devcontainer.md).

---

## 13. Documentation

### Plain CommonMark/GFM `docs/` + offline `just docs-check`

**What** — Diátaxis documentation under `docs/` (`tutorials`, `tasks`,
`reference`, `about`, `tools`, `contributing`, `adr`) in plain CommonMark/GFM,
validated offline by `scripts/check-links.mjs` (`just docs-check`), with
optional `just docs-api` (TypeDoc).
**Why** — GitHub renders Markdown natively; dropping Sphinx/MyST/RTD removes a
Python doc build toolchain while keeping relative link integrity strictly gated.
**Value** — zero-dependency documentation checks in every PR.
**Refs** — [Documentation Guide](../docs.md), `scripts/check-links.mjs`, [ADR 0016](../adr/0016-canonical-agents-md-and-plain-markdown-docs.md).

---

## 14. API service (Hono + tRPC)

### Hono + tRPC v11 with RFC 9457, cursor pagination, idempotency & observability

**What** — `apps/api` mounts tRPC procedures alongside plain HTTP `/healthz`,
`/readyz`, and `/metrics` routes; maps domain errors with `isDev: false` and
emits RFC 9457 `application/problem+json` on non-tRPC errors; supports cursor
pagination (`MAX_API_LIMIT = 100`), TTL+LRU `Idempotency-Key` middleware, RFC
8594 deprecation headers, `hono/secure-headers`, Pino Cloud Logging JSON, an
isolated `@prometheus-io/client` registry, manual OpenTelemetry 3.x spans, and a
serialized `docs/api/contract.snapshot.json` guarded by `api-contract.yml`.
**Why** — demonstrates production API hardening (security, observability,
non-breaking pagination, safe retries) while bundling cleanly into a minimal
`node:24-slim` container (`apps/api/Dockerfile`).
**Value** — clone-and-run API out of the box (`TS_PROJECTS_SOURCE=memory`) and
production-ready patterns on deploy.
**Refs** — [API Reference](../reference/api-reference.md), [ADR 0011](../adr/0011-hono-trpc-api-hardening-and-contract-snapshots.md).

---

## 15. Web app (React 19 + Vite)

### Types-only `AppRouter`, TanStack Query & accessible plain CSS

**What** — `apps/web` uses React 19 + Vite + TanStack Query (`createQueryClient`
disables 4xx retries), imports only `type AppRouter` from
`@ts-launch-blueprint/api/router`, keeps filter state in `?workspace=`, and
uses plain semantic CSS (`<output>`, `role="alert"`).
**Why** — gives end-to-end typed RPC in the browser without pulling server
dependencies into the client bundle or forcing a UI component library.
**Value** — lightweight (~87 kB gzipped) starter UI easy to customize.
**Refs** — [Web App Reference](../reference/web-app.md), [ADR 0012](../adr/0012-react-vite-web-types-only-router.md).

---

## 16. CLI conventions (`ts-projects`)

### Noun-verb v4 hierarchy, env/flag tokens, 3-layer TOML & cross-OS paths

**What** — Commander v15 noun-verb commands (`projects list|get`,
`config init|path|get|set`, `doctor [--bundle]`, `completion {bash,zsh,fish}`),
global `-o/--output {text,json,csv,markdown}`, `--json`, and `--output-file`,
env/flag-only tokens (`--token` > `TS_PROJECTS_TOKEN`, never in TOML),
3-layer TOML discovery (`system` → `user` → `project`) with warning degradation
and atomic `temp + fsync + rename` writes, `XDG_*` + Windows native defaults,
interactive pager, first-run hint, `TS000`–`TS006` error codes + crash log, and
R6.1 exit codes (`0/1/2/3/4/5/130/143`).
**Why** — ensures scripts, pipes, and interactive terminals across POSIX and
Windows follow consistent, predictable CLI contracts.
**Value** — battle-tested CLI ergonomics and full in-process + subprocess test
coverage.
**Refs** — `EXAMPLECLI.md`, [CLI Reference](../reference/cli-reference.md), [ADRs 0002–0004](../adr/0002-no-secrets-in-config-file.md), [ADRs 0006–0008](../adr/0006-stable-error-codes-hints-crash-log.md).

---

## 17. Contributors & governance

### Templates, Contributing guide, Security Policy, CLA & optional roster

**What** — `.github/CONTRIBUTING.md`, Code of Conduct, `.github/SECURITY.md`,
structured YAML issue/PR templates, optional CLA Assistant (`docs/contributing/cla/`),
and template-level `contributors-please` automation (`[[remove]]`d on stamp).
**Why** — standardizes bug reports, security disclosures, and contributor
onboarding from day one.
**Value** — ready-to-accept community contributions.
**Refs** — `.github/CONTRIBUTING.md`, `.github/SECURITY.md`, [GitHub Templates](../github-templates.md).

---

## 18. Template / rebrand system

### External `template-press==5.0.0` + `press-verify` + fork guard

**What** — `press/press-source.toml`, `press/press-rules.toml`, and
`press/stubs/` drive `template-press==5.0.0` rebranding; `press-verify.yml`
guards against identity leaks, and `scripts/guard.sh` prevents accidental builds
from un-pressed forks while silencing itself once `press/press-receipt.toml` is
present.
**Why** — keeps template identity changes automated, repeatable, and verified in
CI (`tests/press-acceptance.test.ts`).
**Value** — single-command project stamping with cryptographic receipt tracking.
**Refs** — `press/press-rules.toml`, `scripts/guard.sh`, [ADR 0016](../adr/0016-canonical-agents-md-and-plain-markdown-docs.md).

---

## 19. AI agent tooling

### Canonical `AGENTS.md` + `CLAUDE.md` + `llms.txt` + review configs

**What** — `AGENTS.md` is the sole canonical agent instruction file, imported by
`CLAUDE.md` (`@AGENTS.md`); `llms.txt` indexes packages and docs; `.coderabbit.yaml`,
`.greptile/`, `claude-code-review.yml`, `claude.yml`, and `.github/CODEOWNERS`
provide review integration; `.claude/skills/new-ts-project/` + `docs/PROJECT_SETUP.md`

- `docs/POST_INIT.md` guide project instantiation and post-init setup.
  **Why** — one source of truth prevents contradictory instructions across AI
  tools.
  **Value** — fast, accurate onboarding for both human contributors and AI
  agents.
  **Refs** — `AGENTS.md`, `CLAUDE.md`, `llms.txt`, [ADR 0016](../adr/0016-canonical-agents-md-and-plain-markdown-docs.md).

---

## 20. IDE integration & Decision records index

### VS Code workspace defaults + DevContainer + ADR Index

**What** — `.vscode/{extensions,launch,settings}.json` wires workspace TypeScript
(`typescript.tsdk`) and `tsx`/`dist` debugging without imposing opinionated
editor preferences; `.devcontainer/` provides a ready container environment.

All architectural decisions in this repository are indexed in
[`docs/adr/README.md`](../adr/README.md):

| ADR                                                                   | Decision                                                     | Focus                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| [0001](../adr/0001-pnpm-monorepo-and-cli-only-publishing.md)          | pnpm monorepo & CLI-only npm publishing                      | `Q2.A`, `D-035`, `D-040`, `D-041`, `D-045`           |
| [0002](../adr/0002-no-secrets-in-config-file.md)                      | Env/flag-only CLI tokens (no secrets in TOML)                | `Q4.A`                                               |
| [0003](../adr/0003-noun-verb-cli-and-global-output-formats.md)        | Noun-verb CLI surface & global output formats                | `Q3.A`, `Q4.A`, `D-016`, `D-018`, `D-033`            |
| [0004](../adr/0004-config-errors-degrade-to-warnings.md)              | Discovered config degradation & atomic writes                | `Q4.A`, `D-017`                                      |
| [0005](../adr/0005-turnkey-toolchains-mise-flox-devcontainer.md)      | Turnkey toolchains + `Makefile` / `Justfile`                 | `D-024`, `D-056`                                     |
| [0006](../adr/0006-stable-error-codes-hints-crash-log.md)             | Unified `ConfigError`, error codes, hints & crash log        | `D-016`                                              |
| [0007](../adr/0007-cli-ergonomics-pager-onboarding-doctor.md)         | Interactive pager, `config init`, marker & `doctor --bundle` | `Q3.A`                                               |
| [0008](../adr/0008-windows-native-paths-xdg-overrides.md)             | Windows-native paths + `XDG_*` overrides everywhere          | `Q4.A`                                               |
| [0009](../adr/0009-layered-core-and-boundary-enforcement.md)          | Layered core & `oxlint` + `depcruise` boundaries             | `D-039`, `D-042`, `D-047`                            |
| [0010](../adr/0010-typescript-7-oxc-and-single-typecheck.md)          | TypeScript 7, Oxlint/Oxfmt & single `tsc` gate               | `D-013`, `D-014`, `D-015`, `D-025`, `D-032`, `D-046` |
| [0011](../adr/0011-hono-trpc-api-hardening-and-contract-snapshots.md) | Hardened Hono/tRPC API & contract snapshots                  | `Q7.A`, `Q8.A`, `D-043`, `D-048`–`D-053`             |
| [0012](../adr/0012-react-vite-web-types-only-router.md)               | React + Vite web app over types-only `AppRouter`             | `D-054`, `D-055`                                     |
| [0013](../adr/0013-testing-resilience-cross-os-ci-and-playwright.md)  | Testing resilience, 4-OS matrix & Playwright E2E             | `Q5.A`, `Q6.A`, `D-019`, `D-027`, `D-036`            |
| [0014](../adr/0014-hook-ci-parity-cspell-and-commitlint.md)           | Hook-CI parity, `cspell` & `commitlint`                      | `Q9.A`, `D-020`                                      |
| [0015](../adr/0015-security-scanning-and-optional-org-automation.md)  | Secret scanning, CodeQL, OSV-Scanner & org triage            | `Q11.C`, `D-022`                                     |
| [0016](../adr/0016-canonical-agents-md-and-plain-markdown-docs.md)    | Canonical `AGENTS.md`, CommonMark docs & press               | `Q10.A`, `D-023`, `D-024`                            |
