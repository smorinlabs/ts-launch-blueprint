# 0013. Testing resilience, 4-cell cross-OS CI matrix, and Playwright E2E

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`Q5.A`, `Q6.A`, `D-019`, `D-027`, `D-036`)
- **Related:** `vitest.config.ts`, `.github/workflows/ci.yml`, `apps/web/playwright.config.ts`

## Context

Template code must stay reliable across Linux, macOS, and Windows (including
Active LTS and Current Node lines), surface hidden test-order dependencies, cover
real browser and subprocess behavior, and keep PR CI fast when only docs or a
single surface changes.

## Decision

We will enforce a **multi-tier testing and CI architecture**:

- **Vitest 4 resilience:** `sequence.shuffle: true`, explicit per-project
  timeouts, `95/95/90/95` line/function/branch/statement coverage thresholds,
  `fast-check` property tests, two-tier CLI tests (in-process `CliDeps` + built
  subprocess `e2e.test.ts` + 80-col `--help` snapshots), and Codecov OIDC upload.
- **Playwright web E2E (`Q6.A`):** Chromium-only browser suite wired into
  `ci.yml`'s `web-e2e` job (guarded for removable `apps/web`).
- **4-cell cross-OS matrix + `ci-ok` (`Q5.A`):** Test matrix runs `ubuntu` /
  `macos` / `windows` on Node `24.x` plus `ubuntu` on Node `26.x`, paired with
  a `changes` path detector, `RUNNER_*` self-hosted overrides, `merge_group`
  support, advisory `bun-lane`, and a single `ci-ok` aggregate required check.

## Consequences

- Cross-platform regressions (Windows paths, macOS symlinks, Node 26) are
  caught before merge while `changes` fast-paths keep docs-only PRs fast.
- Branch protection requires only `ci-ok` instead of tracking individual matrix
  jobs.

## Alternatives considered

- **Ubuntu-only CI matrix** — misses Windows path and POSIX-assumption bugs.
- **Per-job required branch-protection checks** — breaks whenever path filters
  skip unaffected jobs.
