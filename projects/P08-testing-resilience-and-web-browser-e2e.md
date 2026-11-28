# P08 — Testing resilience and web browser E2E

**References**

- **Trunk:** [PROJECTS.md](../PROJECTS.md)
- **Design:** [TS_PORT_DECISIONS.md](../docs/port/TS_PORT_DECISIONS.md)
- **Design:** [architecture.md](../docs/about/architecture.md)
- **Design:** [web-app.md](../docs/reference/web-app.md)

Add Vitest shuffle, fast-check properties, CLI snapshots, and Playwright E2E

### Scope

- Enable `sequence: { shuffle: true }` and explicit finite `testTimeout` / `hookTimeout` in `vitest.config.ts`, verifying zero inter-test coupling across all 5 workspace projects (`core`, `cli`, `api`, `web`, `repo`).
- Install `fast-check` (devDependency) and add property-based round-trip tests in `packages/core/tests/properties.test.ts` (`WorkspaceSchema`/`convertWorkspace`, `ProjectSchema`/`convertProject`, `ListProjectsInputSchema`/`ListProjectsOutputSchema`) and `apps/cli/tests/properties.test.ts` (`formatOutput` JSON/CSV/text and `writeUserConfig`/`resolveConfig` TOML round-trip), plus schema-driven `/trpc/projects.list` fuzzing in `apps/api/tests/contract-fuzz.test.ts` asserting status `< 500`.
- Add deterministic 80-column CLI `--help` golden snapshot tests (`apps/cli/tests/help-snapshots.test.ts`) for root `ts-projects`, `projects`, and `config` commands to lock pre-`P11` help output (`Q3.A`), keeping `just press-verify` green (`press/press-rules.toml` updated if 80-col line wraps shift on rename).
- Complete deferred web browser E2E ticket `P4-3` (`D-054(9)`): install `@playwright/test` in `apps/web` (`devDependencies`, preserving `just check-removable web` and `just check-removable api web`), add `preview.proxy` (`/trpc -> http://localhost:8080`) in `apps/web/vite.config.ts`, update `apps/web/tsconfig.json` and `.gitignore`, add `apps/web/playwright.config.ts`, `apps/web/e2e/projects.spec.ts` (Chromium E2E covering initial `4 projects` load, `?workspace=` filter + `page.reload()`, 404 + `Clear filter`, and keyboard navigation against live `apps/api` + built `apps/web`), and `just test-web-e2e` in `Justfile`.
- Add `web` output to `.github/workflows/ci.yml`'s `changes` job (PRs touching `apps/web`, `apps/api`, `packages/core`, or manifests/lockfile + `main` pushes + `merge_group`) and wire a path-gated, cached, `apps/web`-existence-guarded Chromium `web-e2e` job on `ubuntu-latest` (`vars.RUNNER_UBUNTU || 'ubuntu-latest'`) into `ci-ok` (`Q6.A`), updating `tests/repo-hygiene.test.ts` and `tests/ci-change-detection.test.ts`.
- Complete mandatory `ci-fix --optimize` closeout on the measured green PR CI run (tuning Playwright browser caching and runtime).

### Out of scope

- Multi-browser E2E matrix (`firefox`, `webkit` — Chromium-only per `Q6.A`).
- CLI v4 noun-verb cutover (`P11`; `P08` locks pre-`P11` help snapshots per `Q3.A`).
- API container/security hardening, CORS for cross-origin deployments, or GHCR publishing (`P09`).

### Decisions

- **Q6.A (CI Playwright Chromium E2E):** Run `web-e2e` on `ubuntu-latest` (`vars.RUNNER_UBUNTU || 'ubuntu-latest'`) with Chromium-only install and browser caching, gated on PRs touching `apps/web`, `apps/api`, `packages/core`, or manifests/lockfile plus `main` pushes and `merge_group`, guarded on `apps/web/package.json` existence for `check-removable web`, and wired into `ci-ok`.
- **Q3.A (CLI `--help` golden snapshots):** Land fixed-width `--help` golden snapshots in `P08` so `P11`'s noun-verb CLI cutover diffs explicitly in review.
- **Playwright isolation & `vite preview` proxy:** Keep `@playwright/test`, `playwright.config.ts`, and `e2e/*.spec.ts` scoped inside `apps/web/` (excluded from Vitest globs and deleted cleanly by `just check-removable web`), and add `preview.proxy` for `/trpc` in `apps/web/vite.config.ts` so built `apps/web` talks to `apps/api` on the same origin.
- **Closeout:** Mandatory `ci-fix --optimize` pass on the measured green PR CI run (especially Playwright browser caching and runtime) before merge.

### Tests & Tasks

- [x] [P08-TS01] Add meta-test assertions in `tests/repo-hygiene.test.ts` for `vitest.config.ts` (`sequence: { shuffle: true }` and finite `testTimeout`/`hookTimeout`), and update `tests/repo-hygiene.test.ts` + `tests/ci-change-detection.test.ts` for `changes.outputs.web` and the Chromium-only, `apps/web`-guarded `web-e2e` job wired into `ci-ok`.
- [x] [P08-TS02] Add `fast-check` property-based round-trip tests in `packages/core/tests/properties.test.ts` (`WorkspaceSchema`/`convertWorkspace`, `ProjectSchema`/`convertProject`, `ListProjectsInputSchema`/`ListProjectsOutputSchema`) and `apps/cli/tests/properties.test.ts` (`formatOutput` JSON/CSV/text and `writeUserConfig`/`resolveConfig` TOML round-trip).
- [x] [P08-TS03] Add schema-driven `/trpc/projects.list` property fuzzing tests in `apps/api/tests/contract-fuzz.test.ts` driving `createApp` via `app.request(...)` across `fast-check` valid and malformed inputs and asserting status `< 500`.
- [x] [P08-TS04] Add deterministic 80-column CLI `--help` golden snapshot tests in `apps/cli/tests/help-snapshots.test.ts` for root `ts-projects`, `projects`, and `config` commands.
- [x] [P08-TS05] Add Playwright Chromium E2E tests in `apps/web/e2e/projects.spec.ts` verifying initial `4 projects` load, `?workspace=` URL filter + `page.reload()`, 404 + `Clear filter`, and keyboard navigation against live `apps/api` + built `apps/web`.
- [x] [P08-T01] Enable `sequence: { shuffle: true }` and explicit `testTimeout`/`hookTimeout` in `vitest.config.ts` and verify repeated `just test` runs pass cleanly across all 5 workspace projects.
- [x] [P08-T02] Install `fast-check` as a devDependency and verify `packages/core`, `apps/cli`, and `apps/api` property/fuzz suites pass (`just test`, `just coverage`, `just typecheck`, `just lint`).
- [x] [P08-T03] Generate CLI `--help` golden `.snap` files via `apps/cli/tests/help-snapshots.test.ts` and verify `just press-verify` passes cleanly (updating `press/press-rules.toml` if 80-col line wraps require exclusion/`[[regenerate]]`).
- [x] [P08-T04] Install `@playwright/test` in `apps/web`, configure `preview.proxy` in `apps/web/vite.config.ts`, update `apps/web/tsconfig.json` and `.gitignore`, add `apps/web/playwright.config.ts` + `test:e2e` script + `Justfile` `test-web-e2e` recipe, and verify `just check-removable web` and `just check-removable api web` pass.
- [x] [P08-T05] Wire `changes.outputs.web` and the cached, `apps/web`-guarded Chromium `web-e2e` job into `.github/workflows/ci.yml` (`ci-ok`), run `just all`, `just coverage`, `just pack-check`, `just docs-check`, `just press-verify`, `just test-web-e2e`, and `project-audit P08`; open PR, run `ci-fix --optimize` closeout on green CI (tuning Playwright caching), resolve review threads via `pr-merge-flow`, mark `P08` `[x]`, and merge via `--merge`.
