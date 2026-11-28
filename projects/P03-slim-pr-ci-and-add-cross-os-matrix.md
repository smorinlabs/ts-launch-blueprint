# P03 — Slim PR CI and add cross-OS matrix

**References**

- **Trunk:** [PROJECTS.md](../PROJECTS.md)
- **Design:** [TS_PORT_DECISIONS.md](../docs/port/TS_PORT_DECISIONS.md)

Add merge_group, PR concurrency, change fast paths, ci-ok gate, and 3-OS matrix

### Scope

- Add `merge_group:` trigger across required PR workflows (`.github/workflows/ci.yml` and sibling required PR workflows) so GitHub Merge Queues do not deadlock.
- Add PR-only `concurrency` (`cancel-in-progress: ${{ github.event_name == 'pull_request' }}`) across `ci.yml`, `codeql.yml`, `dependency-review.yml`, and sibling PR workflows, plus `cancel-in-progress: false` on `publish.yml`.
- Port the `changes` path detector job to `ci.yml` (docs-only fast path skipping heavy jobs while keeping `README.md` as code, plus verified `release-please` version-only fast path keeping `pack-check`) and a single `ci-ok` aggregate gate (`if: always()`, `permissions: {}`).
- Expand `ci.yml` test matrix to the 4-cell OS matrix (`ubuntu`, `macos`, `windows` on Node `24.x`, plus `ubuntu` on Node `26.x`) with `vars.RUNNER_UBUNTU`/`RUNNER_MACOS`/`RUNNER_WINDOWS` overrides, keeping static, Docker, removable-app, coverage, and `pack-check` jobs Linux-only.
- Guard POSIX-only signal assertions (`SIGINT`/`SIGTERM`) in `apps/cli/tests/e2e.test.ts` on Windows.
- Add Just's `[parallel]` attribute to `@all` in `Justfile` and update `tests/repo-hygiene.test.ts` contracts for the new CI matrix shape and `docs-check` job placement.
- Complete mandatory `ci-fix --optimize` closeout on the measured green PR CI run.

### Out of scope

- Moving macOS or Windows off the PR matrix path.
- CodeQL path filtering (required ruleset expects CodeQL analysis on every PR).
- Modifying GitHub repository variables (`vars.RUNNER_*` remain as currently configured).

### Decisions

- **Q5.A (4-cell OS matrix & fast paths):** Run the 4-cell test matrix (`ubuntu`, `macos`, `windows` on Node `24.x`, plus `ubuntu` on Node `26.x`) on every code PR and `main` push, gated behind `changes` (skipping heavy tests on docs-only and verified `release-please` PRs while keeping `README.md` as code), with `vars.RUNNER_UBUNTU`/`RUNNER_MACOS`/`RUNNER_WINDOWS` overrides and static/Docker/removable jobs kept Linux-only.
- **Windows signal tests:** Guard POSIX-only `SIGINT`/`SIGTERM` assertions in `apps/cli/tests/e2e.test.ts` on Windows (`process.platform === 'win32'`).
- **Closeout:** Mandatory `ci-fix --optimize` pass on the measured green PR CI run before merge.

### Tests & Tasks

- [x] [P03-TS01] Update `tests/repo-hygiene.test.ts` (and add CI change-detection / matrix / concurrency / `ci-ok` contract tests) to assert `merge_group` triggers, PR-only `concurrency` (`cancel-in-progress: false` on `publish.yml`), `changes` fast paths (`README.md` treated as code), 4-cell OS matrix + `vars.RUNNER_*` overrides, `ci-ok` aggregate gate, and `docs-check` placement.
- [x] [P03-TS02] Guard POSIX-only signal assertions (`SIGINT`/`SIGTERM`) in `apps/cli/tests/e2e.test.ts` on Windows (`process.platform === 'win32'`).
- [x] [P03-T01] Add `merge_group`, PR-only `concurrency`, `changes` path detector, 4-cell OS matrix, Linux-only static/Docker/removable jobs, and `ci-ok` aggregate gate to `.github/workflows/ci.yml` (plus `merge_group`/PR-only `concurrency` on sibling workflows and `cancel-in-progress: false` on `publish.yml`).
- [x] [P03-T02] Add `[parallel]` attribute to `@all` in `Justfile`.
- [x] [P03-T03] Run `just all`, `just coverage`, `just pack-check`, `just docs-check`, and `project-audit P03`; open PR, run `ci-fix --optimize` closeout on green CI, resolve review threads, mark `P03` `[x]`, and merge via `--merge`.
