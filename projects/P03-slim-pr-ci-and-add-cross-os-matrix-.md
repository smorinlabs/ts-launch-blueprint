# P03 — Slim PR CI and add cross-OS matrix

Add merge_group, PR concurrency, change fast paths, ci-ok gate, and 3-OS matrix

### Open questions

- Should macOS and Windows matrix legs run on Node `24.x` on every code PR (matching Py's 4-cell matrix: 3 OS on floor + Linux on next) or run on main/nightly only to limit private-repo macOS/Windows runner minute multipliers?
- Should configurable runner variables (`vars.RUNNER_UBUNTU`, `vars.RUNNER_MACOS`, `vars.RUNNER_WINDOWS`) be ported verbatim from Py's `ci.yml`?
- Does `apps/cli/tests/e2e.test.ts` (POSIX `SIGINT`/`SIGTERM` exit 130/143) need Windows-aware guards before enabling the Windows matrix leg?

### Notes

Ports Py `P11` (parallel check gate), Py `P12` (slim PR CI job count), and Py's cross-OS CI matrix:

- **`merge_group` trigger:** Add `merge_group:` to `.github/workflows/ci.yml` (and other required PR workflows) so GitHub Merge Queues do not deadlock. Currently only `press-verify.yml` and `template-receipt-guard.yml` declare `merge_group`.
- **PR-only `concurrency`:** Add `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` to `ci.yml`, `codeql.yml`, `dependency-review.yml`, and `publish.yml` (`cancel-in-progress: false` on `publish.yml`).
- **`changes` detector + release-please fast path + `ci-ok` gate:** Port Py's `changes` job so docs-only PRs skip Docker/Node matrix/`check-removable` network reinstalls, verified version-only release-please PRs skip heavy test legs while keeping `pack-check`, and branch protection pins a single `ci-ok` aggregate gate.
- **Cross-OS test matrix:** Extend `ci.yml` beyond `ubuntu-latest` to cover macOS and Windows for the cross-platform CLI and workspace packages.
- **Parallel local gate (`just all`):** Add Just's `[parallel]` attribute to `@all` (mirroring Py `Justfile` `@check` from Py `P11`).

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P03` when ready. -->
