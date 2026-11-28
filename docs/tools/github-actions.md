# GitHub Actions

## Setup

GitHub Actions automates testing, security scanning, press verification, and releases. The TS Launch Blueprint project includes pre-configured workflows in [`.github/workflows/`](https://github.com/smorinlabs/ts-launch-blueprint/tree/main/.github/workflows): `ci.yml`, `codeql.yml`, `dependency-review.yml`, `difftree-pr-comment.yml`, `manual-pr-security-scan.yml`, `press-verify.yml`, `release-please.yml`, and `publish.yml` (plus blueprint-only maintenance workflows that `press rebrand` removes in stamped child repositories).

For the trigger/job breakdown of each workflow, see [Using CI/CD](../tasks/using-ci-cd.md); for the release-tag → publish flow specifically, see [the release runbook](../maintainers-release.md). This page covers the workflows as a group: shape, pinning, and permissions conventions.

## Workflow Configuration

The main quality-gate workflow (`ci.yml`) runs on every push or pull request to `main`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions: {}

jobs:
  ci:
    name: continuous-integration
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    strategy:
      fail-fast: false
      matrix:
        node-version: ['24.x', '26.x']

    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@73e46992e05b19abd31f2f3c20e0e7370d762115 # v6.1.1
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'
      - uses: extractions/setup-just@53165ef7e734c5c07cb06b3c8e7b647c5aa16db3 # v4.0.0
      - run: pnpm install --frozen-lockfile
      - run: just format-check
      - run: just lint
      - run: just check-boundaries
      - run: just typecheck
      - if: matrix.node-version == '24.x'
        run: just coverage
      - if: matrix.node-version != '24.x'
        run: just test
      - if: matrix.node-version == '24.x'
        uses: codecov/codecov-action@303a32d7a59b442fa8d48b6a1cc6825c09c847a5 # v7.1.1
        with:
          use_oidc: true
          files: ./coverage/lcov.info
          flags: unittests
          fail_ci_if_error: false
      - run: just docs-check
      - run: just build
      - if: matrix.node-version == '24.x'
        run: just pack-check
      - run: pnpm exec lefthook run pre-commit --all-files
```

The other shipped workflows follow the same shape (deny-all baseline `permissions`, least-privilege per-job grants, `actions/checkout` with `persist-credentials: false`) scoped to a single concern each: static analysis (`codeql.yml`), dependency vulnerability review on PRs (`dependency-review.yml`), ASCII PR diff-tree comments (`difftree-pr-comment.yml`), a manual environment-gated deep security scan (`manual-pr-security-scan.yml`), hermetic `template-press` verification (`press-verify.yml`), the Conventional-Commits-driven release PR (`release-please.yml`), and npm publishing (`publish.yml`). See [Using CI/CD](../tasks/using-ci-cd.md) for what each one does.

## Action Pinning Policy

Every third-party action reference in this repository follows one of two rules:

- **Official `actions/*` and `github/*` actions** (`actions/checkout`, `actions/setup-node`, `github/codeql-action/*`, `actions/github-script`) — pinned to a **major-version tag** (e.g. `@v7`, `@v6`, `@v4`). These are maintained by GitHub itself and publish stable major tags.
- **Third-party / security-sensitive actions** — pinned to a **full commit SHA**, with the resolved version left in a trailing comment, e.g.:
  ```yaml
  - uses: extractions/setup-just@53165ef7e734c5c07cb06b3c8e7b647c5aa16db3 # v4.0.0
  ```
  This covers `pnpm/action-setup`, `extractions/setup-just`, `oven-sh/setup-bun`, `astral-sh/setup-uv`, `codecov/codecov-action`, `google/osv-scanner-action/osv-scanner-action`, `googleapis/release-please-action`, and `smorinlabs/difftree-action`. [Dependabot's `github-actions` ecosystem](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#package-ecosystem) keeps these SHAs fresh via automated PRs.

**SHA-pin exception within the "official action" bucket**: `actions/dependency-review-action` is an official `actions/*` action but is nonetheless pinned to a full SHA (`@a1d282b...` / `# v5.0.0`), because this action publishes **no floating major tag at all** (no `v5`, and no `v4` either — the Python source repo's `@v4` reference carried this exact latent resolution bug and would never have resolved). Only exact point-release tags exist upstream, so a SHA pin is the only reliable reference; Dependabot still keeps it current.

## Permissions Hygiene

Every workflow declares an explicit top-level `permissions:` block:

- **Deny-all baseline**: workflows that don't need to write anything declare `permissions: {}` at the workflow level, then re-grant only what each job needs (e.g. `contents: read` for a read-only checkout).
- **Token-bearing workflows** grant precisely the scopes their job performs — `contents: write` + `pull-requests: write` for Release Please and Update Contributors (they open/update PRs); `pull-requests: write` for Dependency Review (it posts a PR comment); `security-events: write` + `packages: read` + `actions: read` + `contents: read` for CodeQL (per GitHub's documented CodeQL requirements); `id-token: write` (OIDC only, no long-lived secret) for Codecov upload in `ci.yml` and the `publish` job in `publish.yml`.
- Every checkout step sets `persist-credentials: false` — no job here pushes using the checked-out token, so the persisted credential is dropped (closing the "artipacked" token-leak pattern that security scanners like `zizmor` flag).

## Best Practices

- **Keep It Simple**: start small and expand as needed — the commented-out `pnpm audit` scaffolding in `ci.yml` is left as uncomment-to-enable rather than wired in by default, while coverage thresholds (`just coverage`), tokenless Codecov OIDC upload (`24.x`), and `just pack-check` (`24.x`) are active.
- **Use Matrix Builds**: test across the Node.js Active-LTS floor and the next Current release (`['24.x', '26.x']`).
- **Cache Dependencies**: `pnpm/action-setup` (pinned before `actions/setup-node`) with `actions/setup-node`'s `cache: 'pnpm'`, keyed to the committed `pnpm-lock.yaml`, needs no separate `actions/cache` step.
- **Fail Fast, But Not Across the Matrix**: `fail-fast: false` so a failure on one Node version doesn't hide results from the other.
- **Monitor Regularly**: `just release-status` and `just pack-check` (see [the release runbook](../maintainers-release.md)) surface drift between `package.json`, the release-please manifest, and the latest tag.

[GitHub Actions documentation](https://docs.github.com/en/actions) for more details.
