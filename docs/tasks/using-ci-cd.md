# CI/CD with GitHub Actions

This guide explains how testing, linting, security scanning, and releases are automated for the TS Launch Blueprint project using GitHub Actions. [Learn more](../tools/github-actions.md).

## Workflow Overview

The repository ships the following workflows under `.github/workflows/`:

| Workflow                  | File                          | Trigger                                                       |
| ------------------------- | ----------------------------- | ------------------------------------------------------------- |
| CI                        | `ci.yml`                      | push to `main`, pull requests targeting `main`                |
| CodeQL Advanced           | `codeql.yml`                  | push/PR to `main`, weekly schedule                            |
| Dependency review         | `dependency-review.yml`       | pull requests targeting `main`                                |
| Difftree PR Comment       | `difftree-pr-comment.yml`     | pull requests (`opened`, `reopened`, `synchronize`, `edited`) |
| Manual PR Security Review | `manual-pr-security-scan.yml` | `workflow_dispatch` (manual)                                  |
| Press Verify              | `press-verify.yml`            | pull requests, `merge_group`, push to `main`                  |
| Release Please            | `release-please.yml`          | push to `main`, `workflow_dispatch`                           |
| Publish                   | `publish.yml`                 | `v*` tag push, `workflow_dispatch` (from a `v*` tag)          |

### CI (`ci.yml`)

The main quality gate. Runs on:

- Pushes to `main`
- Pull requests targeting `main`

**Job**: `ci` (`continuous-integration`), on `ubuntu-latest`, matrix over `node-version: ['24.x', '26.x']` — the Active LTS floor and the next Current line, mirroring the source project's "test the floor and the next version" compatibility signal.

Steps:

1. Checkout (`actions/checkout@v7`, `persist-credentials: false`)
2. `pnpm/action-setup@v6` with version `10.34.3` (SHA-pinned)
3. `actions/setup-node@v6` with `cache: 'pnpm'` keyed to `pnpm-lock.yaml`
4. Install `just` (`extractions/setup-just`, SHA-pinned)
5. `pnpm install --frozen-lockfile`
6. `just format-check`
7. `just lint`
8. `just check-boundaries`
9. `just typecheck`
10. `just coverage` on Node `24.x` (enforces 95/95/90/95 thresholds and writes `coverage/lcov.info`), or `just test` on `26.x`
11. `codecov/codecov-action` on Node `24.x` (tokenless OIDC upload via `id-token: write`, `fail_ci_if_error: false`)
12. `just docs-check`
13. `just build`
14. `just pack-check` on Node `24.x` (validates `apps/cli` build, `publint`, `attw`, packed file list, and tarball install + CLI/ESM smoke test)
15. `pnpm exec lefthook run pre-commit --all-files` — dual enforcement: the same gates that ran as named steps above are re-run through the committed hook suite, so the pre-commit discipline itself is exercised in CI, not just the individual recipes.

Commented-but-documented scaffolding (uncomment to enable): an always-on `pnpm audit --audit-level high` SCA step gated to same-repo pull requests (never runs against a fork, where secrets/attack surface differ).

### CodeQL Advanced (`codeql.yml`)

Static analysis via GitHub's CodeQL, ported near-verbatim from the source with the language matrix swapped from `python` to `javascript-typescript` (CodeQL's JS extractor covers TypeScript natively) and `github/codeql-action` bumped `v3` → `v4`. Runs on push/PR to `main` plus a weekly schedule (`44 21 * * 4`). Single matrix entry: `{ language: javascript-typescript, build-mode: none }`.

### Dependency review (`dependency-review.yml`)

Runs on every pull request targeting `main`; scans `pnpm-lock.yaml` for known-vulnerable dependency versions introduced by the PR and posts a summary comment (`comment-summary-in-pr: always`). Uses `actions/dependency-review-action`, pinned to a full commit SHA (see [pinning policy](../tools/github-actions.md#action-pinning-policy) — this action publishes no floating major tag, so a `@v5` ref would not resolve).

### Manual PR Security Review (`manual-pr-security-scan.yml`)

A manually-triggered (`workflow_dispatch`), environment-gated deep scan, taking `pr_number` and `reviewer` inputs. Replaces the source's `pyupio/safety-action` (which needed an API key) with [`google/osv-scanner-action`](https://google.github.io/osv-scanner/github-action/) (no secret required). Runs behind the `security-review` GitHub environment (protection rules such as required reviewers gate it) and posts the scan report as an attributed PR comment. The scanner step has an explicit `id: scan` and its output reaches the comment step via `env:` rather than being interpolated into the `github-script` body — closing a script-injection gap the source workflow was exposed to.

### Release Please (`release-please.yml`)

Runs on every push to `main` (plus manual re-trigger). Watches Conventional Commits and maintains a "Release PR" that bumps `package.json` + `.release-please-manifest.json` and regenerates `CHANGELOG.md`. Merging that PR tags `vX.Y.Z`, which triggers `publish.yml`. See [the release runbook](../RELEASE.md) for the one-time environment setup and the routine release flow.

### Publish (`publish.yml`)

Triggered by a `v*` tag push (or manual `workflow_dispatch` from a `v*` tag; `Q2.A` resolving `D-045`). Two jobs, both packing and publishing from `apps/cli` (the sole published npm package):

- `verify` — cheap, unprivileged: asserts the tag descends from `main`, asserts `tag == package.json version == manifest version`, runs `just all`, and runs `just pack-check` (builds `apps/cli`, checks `publint` and `attw`, asserts the packed file list is `dist/**` plus the root whitelist, and smoke-tests installing the tarball).
- `publish` — runs only inside the protected `npm` GitHub environment (human-approved), mints an OIDC token, and runs `npm publish` via [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) — no long-lived `NPM_TOKEN` anywhere.

### Difftree PR Comment (`difftree-pr-comment.yml`)

Posts an ASCII diff-tree summary of each pull request's changes as a single,
self-updating PR comment using `smorinlabs/difftree-action` (SHA-pinned per
D-022(9)). This workflow is retained intact when stamping child repositories
via `[rules] keep_names = ["smorinlabs/difftree-action"]` in
`press/press-rules.toml`.

### Press Verify (`press-verify.yml`)

Runs `template-press`'s hermetic `press verify` check on pull requests,
`merge_group`, and pushes to `main`, ensuring the repository presses cleanly
with no surviving source-identity leaks. This workflow ships to stamped child
repositories as their own drift guard. (The template repository additionally
runs `template-receipt-guard.yml` and `update-contributors.yml`, which
`press rebrand` removes in stamped child repositories.)

## Running the Gates Locally

The named CI steps map 1:1 to `just` recipes, so you can reproduce the whole CI job locally:

```bash
just install         # pnpm install
just format-check     # oxfmt --check
just lint             # oxlint
just typecheck        # tsc --noEmit
just test             # vitest run
just docs-check        # node scripts/check-links.mjs
just build             # tsdown build
pnpm exec lefthook run pre-commit --all-files
```

Or run the equivalent composite recipe:

```bash
just ci
```

## Customization

- **Add more Node.js versions**:
  ```yaml
  strategy:
    matrix:
      node-version: ['22.x', '24.x', '26.x']
  ```
- **Enable the commented security scan** (same-repo PRs only):
  ```yaml
  - name: Audit dependencies (SCA)
    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
    run: pnpm audit --audit-level high
  ```
- **Cache is already handled** by `actions/setup-node`'s built-in `cache: 'pnpm'`, keyed to `pnpm-lock.yaml` — no manual `actions/cache` step is needed.
