# CI/CD with GitHub Actions

This guide explains how testing, linting, security scanning, and releases are automated for the TS Launch Blueprint project using GitHub Actions. [Learn more](../tools/github-actions.md).

## Workflow Overview

The repository ships the following workflows under `.github/workflows/`:

| Workflow                  | File                          | Trigger                                                                |
| ------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| API Contract              | `api-contract.yml`            | PRs touching `docs/api/contract.snapshot.json`                         |
| Canary                    | `canary.yml`                  | weekly schedule (`0 6 * * 2`), `workflow_dispatch`                     |
| CI                        | `ci.yml`                      | push to `main`, PRs targeting `main`, `merge_group`                    |
| CodeQL Advanced           | `codeql.yml`                  | push/PR to `main`, `merge_group`, weekly schedule, `public`            |
| Commitlint                | `commitlint.yml`              | push to `main`, PRs, `merge_group`                                     |
| Dependency Audit          | `dep-audit.yml`               | weekly schedule (`0 5 * * 1`), `workflow_dispatch`                     |
| Dependency review         | `dependency-review.yml`       | pull requests targeting `main`                                         |
| Difftree PR Comment       | `difftree-pr-comment.yml`     | pull requests (`opened`, `reopened`, `synchronize`, `edited`)          |
| Large File Guard          | `large-file-guard.yml`        | push to `main`, pull requests, `merge_group`                           |
| Manual PR Security Review | `manual-pr-security-scan.yml` | `workflow_dispatch` (manual)                                           |
| Press Verify              | `press-verify.yml`            | pull requests, `merge_group`, push to `main`                           |
| Publish                   | `publish.yml`                 | `v*` tag push, `workflow_dispatch` (from a `v*` tag)                   |
| Publish Container         | `publish-container.yml`       | PRs to `main` touching API/core, `merge_group`, `release: [published]` |
| Release Please            | `release-please.yml`          | push to `main`, `workflow_dispatch`                                    |
| Secret Scan               | `secret-scan.yml`             | push to `main`, pull requests                                          |

Blueprint-only maintenance workflows (removed on `press rebrand`): `audit-triage.yml`, `bootstrap-acceptance.yml`, `claude.yml`, `claude-code-review.yml`, `template-receipt-guard.yml`, and `update-contributors.yml`.

### CI (`ci.yml`)

The main quality gate. Runs on pushes to `main`, pull requests targeting `main`, and `merge_group`, with PR `concurrency` cancellation.

**Jobs**:

- `changes` — detects whether a PR modifies code (`code`), web/API surfaces (`web`), or is a verified `release-please` version bump (`release`), so docs-only PRs skip heavy builds/tests while keeping `lint` required.
- `lint` — always runs (`actions/checkout@v7`, `pnpm/action-setup` `10.34.3`, `actions/setup-node@v7`, `extractions/setup-just`): runs `just check-shell check-workflows`, `just check-editorconfig`, `just check-spelling`, `just format-check`, `just lint`, `just docs-check`, and `pnpm exec lefthook run pre-commit --all-files`.
- `typecheck` — runs `just check-boundaries` and `just typecheck` when `changes.outputs.code == 'true'`.
- `test` — 4-cell OS × Node matrix (`ubuntu`, `macos`, `windows` on `24.x`, plus `ubuntu` on `26.x`). Runs `just build`, `just coverage` + tokenless Codecov OIDC upload on `ubuntu / 24.x` (enforcing `95/95/90/95` thresholds), and `just test` on the remaining cells.
- `pack-check` — validates `apps/cli` packaging (`just build` + `just pack-check`: `publint`, `attw`, packed file whitelist, and tarball install smoke test) when `code == 'true'` or `release == 'true'`.
- `check-removable` — verifies `just check-removable cli`, `api web`, and `web` when `code == 'true'`.
- `api-image` — builds `apps/api/Dockerfile`, runs `scripts/smoke-api.sh`, and verifies graceful `SIGTERM` exit `0`.
- `bun-lane` — advisory (`continue-on-error: true`) non-E2E test lane under Bun (`bun run vitest run --exclude tests/e2e.test.ts`).
- `web-e2e` — runs Playwright Chromium E2E (`just test-web-e2e`) when `web == 'true'` and `apps/web/package.json` exists.
- `ci-ok` — single required aggregate gate: passes when every needed job succeeds or is skipped, and fails if any needed job fails or is cancelled.

### CodeQL Advanced (`codeql.yml`)

Static analysis via GitHub's CodeQL (`javascript-typescript`, `security-extended` queries in `.github/codeql/codeql-config.yml`). Runs on push/PR to `main`, `merge_group`, `public`, plus a weekly schedule (`44 21 * * 4`).

### Dependency review & Audits (`dependency-review.yml`, `dep-audit.yml`, `canary.yml`)

- `dependency-review.yml` runs on every pull request targeting `main`, scanning `pnpm-lock.yaml` with `actions/dependency-review-action` (SHA-pinned, see [pinning policy](../tools/github-actions.md#action-pinning-policy)).
- `dep-audit.yml` runs weekly (`0 5 * * 1`, plus `workflow_dispatch`) to execute `pnpm audit --audit-level=high` and `google/osv-scanner-action` across the workspace, filing/updating a tracking issue on scheduled failure.
- `canary.yml` runs weekly (`0 6 * * 2`) across Node `24.x` and `26.x` with `pnpm update --recursive` to catch upstream breaking dependency changes early.

### Manual PR Security Review (`manual-pr-security-scan.yml`)

A manually-triggered (`workflow_dispatch`), environment-gated deep scan, taking `pr_number` and `reviewer` inputs. Uses [`google/osv-scanner-action`](https://google.github.io/osv-scanner/github-action/) behind the `security-review` GitHub environment and posts the scan report as an attributed PR comment via `env:`-passed outputs.

### Release Please (`release-please.yml`)

Runs on every push to `main` (plus manual re-trigger). Watches Conventional Commits and maintains a "Release PR" that bumps `package.json`, `apps/cli/package.json`, and `.release-please-manifest.json` and regenerates `CHANGELOG.md`. Merging that PR tags `vX.Y.Z`, which triggers `publish.yml`. See [the release runbook](../RELEASE.md) for the one-time environment setup and the routine release flow.

### Publish (`publish.yml`) & Container Publish (`publish-container.yml`)

- `publish.yml` is triggered by a `v*` tag push (or manual `workflow_dispatch` from a `v*` tag; `Q2.A` resolving `D-045`) for `apps/cli` only: `verify` asserts tag ancestry on `main`, version parity, `just all`, and `just pack-check`; `publish` runs inside the protected `npm` environment using npm Trusted Publishing (OIDC).
- `publish-container.yml` checks building/smoking `apps/api/Dockerfile` on PRs/`merge_group` and publishes versioned GHCR images on `release: [published]`.

### Difftree PR Comment (`difftree-pr-comment.yml`)

Posts an ASCII diff-tree summary of each pull request's changes as a single self-updating PR comment using `smorinlabs/difftree-action` (SHA-pinned). Retained intact in stamped child repositories via `[rules] keep_names = ["smorinlabs/difftree-action"]` in `press/press-rules.toml`.

### Press Verify (`press-verify.yml`)

Runs `template-press`'s hermetic `press verify` check on pull requests, `merge_group`, and pushes to `main`. In the blueprint repository, `bootstrap-acceptance.yml`, `template-receipt-guard.yml`, and `update-contributors.yml` run additional template-only acceptance and governance checks (removed on `press rebrand`).

## Running the Gates Locally

The CI checks map directly to `just` recipes so you can reproduce them locally:

```bash
just setup             # tools + pnpm install + lefthook hooks
just all               # format-check, lint, check-boundaries, check-shell, check-workflows, check-editorconfig, check-spelling, typecheck, test
just coverage          # vitest run --coverage (95/95/90/95 thresholds)
just docs-check        # node scripts/check-links.mjs README.md docs
just build             # tsdown build
just pack-check        # apps/cli publint, attw, tarball install + smoke test
just audit             # pnpm audit --audit-level=high
just press-verify      # template-press verification
pnpm exec lefthook run pre-commit --all-files
```

Or run the composite CI mirror:

```bash
just ci
```

## Customization

- **Add more Node.js versions** in `.github/workflows/ci.yml`:
  ```yaml
  strategy:
    matrix:
      os: [ubuntu, macos, windows]
      node-version: ['24.x']
      include:
        - os: ubuntu
          node-version: '26.x'
  ```
- **Tighten PR security checks**: adjust `fail-on-severity` in `.github/workflows/dependency-review.yml` or run `just audit` locally before opening a PR.
- **Cache is already handled** by `actions/setup-node@v7`'s built-in `cache: 'pnpm'`, keyed to `pnpm-lock.yaml` — no manual `actions/cache` step is needed.
