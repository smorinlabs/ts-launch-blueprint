# P08 — Testing resilience and web browser E2E

Add Vitest shuffle, fast-check properties, CLI snapshots, and Playwright E2E

### Notes

**Decisions (2026-11-27):**

- **Q6.A:** Run Playwright Chromium E2E (`web-e2e` on `ubuntu-latest`, Chromium-only, cached, guarded on `apps/web` presence for `check-removable web`) on every PR touching `apps/web`, `apps/api`, `packages/core`, or manifests/lockfile plus `main` pushes, gated into `ci-ok`.
- **Q3.A:** Land CLI `--help` golden snapshots in `P08` to lock current help output so `P11`'s clean noun-verb cutover diffs explicitly in review.
- Finish with a `ci-fix --optimize` closeout pass (especially tuning Playwright browser caching and runtime).

Ports Py ADR 0019 testing practices and completes TS's own deferred web E2E ticket (`P4-3`, noted in `D-054(9)` and `docs/about/architecture.md:234`):

- **Vitest native resilience:** Enable `sequence: { shuffle: true }` (mirroring `pytest-randomly` with replayable seeds) and explicit `testTimeout`/`hookTimeout` in `vitest.config.ts`, verifying zero inter-test coupling across all 5 workspace projects.
- **Property-based testing (`fast-check`):** Add `fast-check` round-trip tests (`packages/core/tests/properties.test.ts`, CLI config/format properties) covering `Project`/`Workspace` schemas, CSV/JSON formatting, TOML config write -> read, and schema-driven fuzzing of `/trpc/projects.list` inputs (TS analog to Py's `hypothesis` + `schemathesis` fuzzing).
- **CLI `--help` golden snapshots:** Add Vitest snapshot tests across all CLI commands at fixed width (`syrupy` parity) so CLI UX changes surface explicitly in PR diffs.
- **Web browser E2E (`apps/web`, TS ticket P4-3):** Add Playwright E2E tests driving a real Chromium browser against the running `apps/api` (in-memory demo data) + built `apps/web` verifying projects table load, `?workspace=` URL filter/reload, 404 Clear filter, and keyboard navigation.

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P08` when ready. -->
