# P02 — Enforce CI coverage and pack-check smoke

Run coverage thresholds, Codecov OIDC, and pack-check smoke tests on every PR

### Notes

**Decisions (2026-11-27):**

- **Q2.A:** Target package for `pack-check` and npm publishing is `apps/cli` (`ts-launch-blueprint`) only; `packages/core` stays private and bundled.
- **Defaults:** Upload Codecov OIDC on Node `24.x` only (skipping cleanly without token on forks/private repos), configure `lcov`/`html`/`text` reporters in `vitest.config.ts` alongside `just open-coverage-report`, and finish with a `ci-fix --optimize` closeout pass.

Closes two silent CI wiring bugs vs `py-launch-blueprint` (`v4.2.0`) and `docs/port/TS_PORT_DECISIONS.md`:

- **Coverage gate not enforced in CI (breaks D-019(3)):** `vitest.config.ts` declares `95/95/90/95` thresholds (lines/functions/branches/statements), and `README.md` advertises them as CI-enforced, but `.github/workflows/ci.yml` runs `just test` (`vitest run` without `--coverage`). Wire `just coverage` into `ci.yml` (at least on Node `24.x`).
- **Codecov OIDC gate:** Py enforces `project: auto (±1%)` and `patch: 80%` via `.codecov.yml` and tokenless OIDC `codecov/codecov-action@v7`. TS only has stale commented `v5` scaffolding pointing at `coverage-final.json`.
- **PR `pack-check` smoke test (D-012(7)):** TS already has a 6-step `just pack-check` (`build`, `publint`, `attw`, `npm pack --dry-run` file-list assertion, scratch tarball install, bin `--version` + ESM import smoke), matching Py's `build-smoke` CI job, but `.github/workflows/ci.yml` only calls `just build`. Wire `just pack-check` into PR CI (and into `publish.yml`'s `verify` job).
- **Local HTML report opener:** Add `just open-coverage-report` mirroring Py's cross-platform opener.

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P02` when ready. -->
