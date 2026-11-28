# GitHub Actions

## Setup

GitHub Actions automates testing, security scanning, press verification, and releases. The TS Launch Blueprint project ships the following workflows in [`.github/workflows/`](https://github.com/smorinlabs/ts-launch-blueprint/tree/main/.github/workflows): `api-contract.yml`, `canary.yml`, `ci.yml`, `codeql.yml`, `commitlint.yml`, `dep-audit.yml`, `dependency-review.yml`, `difftree-pr-comment.yml`, `large-file-guard.yml`, `manual-pr-security-scan.yml`, `press-verify.yml`, `publish.yml`, `publish-container.yml`, `release-please.yml`, and `secret-scan.yml`, plus optional env/secret-gated org workflows shipped in child repos (`audit-triage.yml`, `claude.yml`, and `claude-code-review.yml`; inert unless configured per [Project Setup](../PROJECT_SETUP.md) and [ADR 0015](../adr/0015-security-scanning-and-optional-org-automation.md)) and blueprint-only maintenance workflows removed on `press rebrand` (`bootstrap-acceptance.yml`, `template-receipt-guard.yml`, and `update-contributors.yml`).

For the trigger/job breakdown of each workflow, see [Using CI/CD](../tasks/using-ci-cd.md); for the release-tag → publish flow specifically, see [the release runbook](../RELEASE.md). This page covers the workflows as a group: shape, pinning, and permissions conventions.

## Workflow Configuration

The main quality-gate workflow (`ci.yml`) runs on every `push` to `main`, `pull_request` targeting `main`, and `merge_group`, with PR-scoped `concurrency` cancellation and a single aggregate `ci-ok` gate:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  merge_group:

permissions: {}

concurrency:
  group: ci-${{ github.event.pull_request.number || github.sha }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  changes: # skips heavy code/web jobs on docs-only & verified release-please PRs
  lint: # always runs: shellcheck, actionlint, editorconfig, cspell, oxfmt, oxlint, docs-check, lefthook
  typecheck: # needs changes (code == true): check-boundaries + tsc --noEmit
  test: # needs changes (code == true): 4-cell matrix (ubuntu/macos/windows @ 24.x + ubuntu @ 26.x)
  pack-check: # needs changes (code == true || release == true): publint, attw, tarball smoke
  check-removable: # needs changes (code == true): cli, api+web, web deletion checks
  api-image: # needs changes (code == true): Docker build + smoke-api.sh + SIGTERM exit 0
  bun-lane: # advisory (continue-on-error: true): non-e2e tests under Bun
  web-e2e: # needs changes (web == true): Playwright Chromium E2E against built API
  ci-ok: # always runs after all jobs: fails if any needed job failed or was cancelled
```

The other shipped workflows follow the same shape (deny-all baseline `permissions`, least-privilege per-job grants, `actions/checkout` with `persist-credentials: false`) scoped to a single concern each: static analysis (`codeql.yml`), dependency vulnerability review on PRs (`dependency-review.yml`), weekly `pnpm audit` + OSV-Scanner (`dep-audit.yml`) and weekly latest-deps canary (`canary.yml`), manual environment-gated deep security scan (`manual-pr-security-scan.yml`), TruffleHog verified secret scanning (`secret-scan.yml`), Conventional Commits enforcement (`commitlint.yml`), >1 MiB file guard (`large-file-guard.yml`), tRPC API contract diffing (`api-contract.yml`), ASCII PR diff-tree comments (`difftree-pr-comment.yml`), hermetic `template-press` verification (`press-verify.yml`), the Conventional-Commits-driven release PR (`release-please.yml`), npm publishing (`publish.yml`), and GHCR container publishing (`publish-container.yml`). See [Using CI/CD](../tasks/using-ci-cd.md) for what each one does.

## Action Pinning Policy

Every third-party action reference in this repository follows one of two rules:

- **Official `actions/*` and `github/*` actions** (`actions/checkout`, `actions/setup-node`, `actions/cache`, `actions/upload-artifact`, `actions/create-github-app-token`, `github/codeql-action/*`, `actions/github-script`) — pinned to a **major-version tag** (e.g. `@v7`, `@v6`, `@v4`, `@v3`), or SHA-pinned where desired (such as `publish-container.yml`).
- **Third-party / security-sensitive actions** — pinned to a **full commit SHA**, with the resolved version left in a trailing comment, e.g.:
  ```yaml
  - uses: extractions/setup-just@53165ef7e734c5c07cb06b3c8e7b647c5aa16db3 # v4.0.0
  ```
  This covers `pnpm/action-setup`, `extractions/setup-just`, `oven-sh/setup-bun`, `astral-sh/setup-uv`, `codecov/codecov-action`, `google/osv-scanner-action/osv-scanner-action`, `googleapis/release-please-action`, `smorinlabs/difftree-action`, `smorinlabs/contributors-please-action`, `trufflesecurity/trufflehog`, `wagoid/commitlint-github-action`, `docker/setup-buildx-action`, and `anthropics/claude-code-action`. [Dependabot's `github-actions` ecosystem](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#package-ecosystem) keeps these SHAs fresh via automated PRs.

**SHA-pin exception within the "official action" bucket**: `actions/dependency-review-action` is an official `actions/*` action but is nonetheless pinned to a full SHA (`@bbc44d14a204704ccc493733616cd1e93a0321ec # v5.0.1`), because this action publishes **no floating major tag at all** (no `v5`, and no `v4` either — the Python source repo's `@v4` reference carried this exact latent resolution bug and would never have resolved). Only exact point-release tags exist upstream, so a SHA pin is the only reliable reference; Dependabot still keeps it current.

## Permissions Hygiene

Every workflow declares an explicit top-level `permissions:` block:

- **Deny-all baseline**: workflows that don't need to write anything declare `permissions: {}` at the workflow level, then re-grant only what each job needs (e.g. `contents: read` for a read-only checkout).
- **Token-bearing workflows** grant precisely the scopes their job performs — `contents: write` + `pull-requests: write` for Release Please (and `+ issues: write` for Update Contributors); `pull-requests: write` for Dependency Review and Difftree; `security-events: write` + `packages: read` + `actions: read` + `contents: read` for CodeQL; `packages: write` for `publish-container.yml`; `id-token: write` (OIDC only, no long-lived secret) for Codecov upload in `ci.yml` and the `publish` job in `publish.yml`.
- Every checkout step sets `persist-credentials: false` — no job here pushes using the checked-out token, so the persisted credential is dropped (closing the "artipacked" token-leak pattern that security scanners like `zizmor` flag).

## Best Practices

- **Keep Heavy Gates Scoped**: `changes` skips heavy code/web jobs on docs-only and verified `release-please` PRs while keeping `lint` (including `just docs-check`) always-on, and `dep-audit.yml` + `just audit` run `pnpm audit --audit-level=high` and OSV-Scanner without slowing every PR.
- **Use the 4-Cell Cross-OS Matrix**: test across `ubuntu`, `macos`, and `windows` on Node `24.x`, plus `ubuntu` on Node `26.x`.
- **Cache Dependencies**: `pnpm/action-setup` (pinned before `actions/setup-node`) with `actions/setup-node`'s `cache: 'pnpm'`, keyed to the committed `pnpm-lock.yaml`, needs no separate `actions/cache` step.
- **Fail Fast, But Not Across the Matrix**: `fail-fast: false` so a failure on one OS or Node version doesn't hide results from the others.
- **Monitor Regularly**: `just release-status` and `just pack-check` (see [the release runbook](../RELEASE.md)) surface drift between `package.json`, the release-please manifest, and the latest tag.

[GitHub Actions documentation](https://docs.github.com/en/actions) for more details.
