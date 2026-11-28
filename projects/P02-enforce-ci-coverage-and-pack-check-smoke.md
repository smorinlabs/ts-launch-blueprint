# P02 — Enforce CI coverage and pack-check smoke

**References**

- **Trunk:** [PROJECTS.md](../PROJECTS.md)
- **Design:** [TS_PORT_DECISIONS.md](../docs/port/TS_PORT_DECISIONS.md)

Run coverage thresholds, Codecov OIDC, and pack-check smoke tests on every PR

### Scope

- Configure `vitest.config.ts` coverage reporters `['text', 'html', 'lcov']` alongside the existing `95/95/90/95` thresholds (lines/functions/branches/statements, `D-019(3)`).
- Add `just open-coverage-report` to `Justfile` mirroring the cross-platform HTML report opener.
- Add `.codecov.yml` (`project: auto` ±1%, `patch: 80%`, `require_ci_to_pass: true`) and wire `just coverage` + tokenless `codecov/codecov-action@v7` OIDC upload on Node `24.x` only (`id-token: write`, `fail_ci_if_error: false`, skipping cleanly on forks/private repos without a token) into `.github/workflows/ci.yml`.
- Wire `just pack-check` (targeting `apps/cli` / `ts-launch-blueprint` only, `D-012(7)`) into `.github/workflows/ci.yml` and `.github/workflows/publish.yml`'s `verify` job.
- Complete mandatory `ci-fix --optimize` closeout on the measured green PR CI run.

### Out of scope

- Publishing `packages/core`, `apps/api`, or `apps/web` to npm (`packages/core` stays private and bundled into `apps/cli`).
- Cross-OS CI matrix, `merge_group`, `changes` detector, and `ci-ok` aggregate gate (covered by `P03`).

### Decisions

- **Q2.A (Publish target):** Target package for `pack-check` and npm publishing is `apps/cli` (`ts-launch-blueprint`) only; `packages/core` stays private and bundled.
- **Codecov & reporters:** Upload Codecov via tokenless OIDC (`codecov/codecov-action@v7`) on Node `24.x` only (skipping cleanly without token on forks/private repos), configure `['text', 'html', 'lcov']` reporters in `vitest.config.ts`, and add `just open-coverage-report`.
- **Closeout:** Mandatory `ci-fix --optimize` pass on the measured green PR CI run before merge.

### Tests & Tasks

- [ ] [P02-TS01] Add/update `tests/repo-hygiene.test.ts` assertions for `vitest.config.ts` coverage reporters (`['text', 'html', 'lcov']`) and `95/95/90/95` thresholds, `.codecov.yml`, `ci.yml` `just coverage` + Node `24.x` Codecov v7 OIDC + `just pack-check`, and `publish.yml` `verify` job `just pack-check`.
- [ ] [P02-T01] Update `vitest.config.ts` reporters to `['text', 'html', 'lcov']` and add `open-coverage-report` recipe to `Justfile`.
- [ ] [P02-T02] Add `.codecov.yml` and wire `just coverage`, tokenless `codecov/codecov-action@v7` OIDC (Node `24.x` only, `id-token: write`), and `just pack-check` into `.github/workflows/ci.yml`.
- [ ] [P02-T03] Wire `just pack-check` into `.github/workflows/publish.yml`'s `verify` job and align any stale coverage/Codecov docs references if needed.
- [ ] [P02-T04] Run `just all`, `just coverage`, `just pack-check`, `just docs-check`, and `project-audit P02`; open PR, run `ci-fix --optimize` closeout on green CI, resolve review threads, mark `P02` `[x]`, and merge via `--merge`.
