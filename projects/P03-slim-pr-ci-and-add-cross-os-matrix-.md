# P03 — Slim PR CI and add cross-OS matrix

Add merge_group, PR concurrency, change fast paths, ci-ok gate, and 3-OS matrix

### Notes

**Decisions (2026-11-27):**

- **Q5.A:** Run the 4-cell test matrix (`ubuntu`, `macos`, `windows` on Node `24.x`, plus `ubuntu` on Node `26.x`) on every code PR and `main` push, gated behind `changes` (skipping tests on docs-only and release-please PRs), with `vars.RUNNER_UBUNTU`/`RUNNER_MACOS`/`RUNNER_WINDOWS` overrides and static/Docker/removable jobs kept Linux-only. Guard POSIX-only signal assertions in `apps/cli/tests/e2e.test.ts` on Windows.
- Finish with a `ci-fix --optimize` closeout pass.

Ports Py `P11` (parallel check gate), Py `P12` (slim PR CI job count), and Py's cross-OS CI matrix:

- **`merge_group` trigger:** Add `merge_group:` to `.github/workflows/ci.yml` (and other required PR workflows) so GitHub Merge Queues do not deadlock. Currently only `press-verify.yml` and `template-receipt-guard.yml` declare `merge_group`.
- **PR-only `concurrency`:** Add `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` to `ci.yml`, `codeql.yml`, `dependency-review.yml`, and `publish.yml` (`cancel-in-progress: false` on `publish.yml`).
- **`changes` detector + release-please fast path + `ci-ok` gate:** Port Py's `changes` job so docs-only PRs skip Docker/Node matrix/`check-removable` network reinstalls, verified version-only release-please PRs skip heavy test legs while keeping `pack-check`, and branch protection pins a single `ci-ok` aggregate gate.
- **Cross-OS test matrix:** Extend `ci.yml` beyond `ubuntu-latest` to cover macOS and Windows for the cross-platform CLI and workspace packages.
- **Parallel local gate (`just all`):** Add Just's `[parallel]` attribute to `@all` (mirroring Py `Justfile` `@check` from Py `P11`).

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P03` when ready. -->
