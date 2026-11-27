# P08 — Testing resilience and web browser E2E

Add Vitest shuffle, fast-check properties, CLI snapshots, and Playwright E2E

### Open questions

- Should Playwright browser E2E run in `ci.yml` on every web/API PR (with Chromium browser caching) or as a dedicated path-gated job?
- Should CLI `--help` snapshot tests wait until `P11` (CLI v4 modernization) or land now to lock down current `ts-projects` help output and make `P11` diffs explicit?

### Notes

Ports Py ADR 0019 testing practices and completes TS's own deferred web E2E ticket (`P4-3`, noted in `D-054(9)` and `docs/about/architecture.md:234`):

- **Vitest native resilience:** Enable `sequence: { shuffle: true }` (mirroring `pytest-randomly` with replayable seeds) and explicit `testTimeout`/`hookTimeout` in `vitest.config.ts`, verifying zero inter-test coupling across all 5 workspace projects.
- **Property-based testing (`fast-check`):** Add `fast-check` round-trip tests (`packages/core/tests/properties.test.ts`, CLI config/format properties) covering `Project`/`Workspace` schemas, CSV/JSON formatting, TOML config write -> read, and schema-driven fuzzing of `/trpc/projects.list` inputs (TS analog to Py's `hypothesis` + `schemathesis` fuzzing).
- **CLI `--help` golden snapshots:** Add Vitest snapshot tests across all CLI commands at fixed width (`syrupy` parity) so CLI UX changes surface explicitly in PR diffs.
- **Web browser E2E (`apps/web`, TS ticket P4-3):** Add Playwright E2E tests driving a real Chromium browser against the running `apps/api` (in-memory demo data) + built `apps/web` verifying projects table load, `?workspace=` URL filter/reload, 404 Clear filter, and keyboard navigation.

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P08` when ready. -->
