# GitHub Actions

## Setup

GitHub Actions automates testing, security scanning, and releases. The TS Launch Blueprint project includes seven pre-configured workflows in [`.github/workflows/`](https://github.com/smorinlabs/ts-launch-blueprint/tree/main/.github/workflows): `ci.yml`, `codeql.yml`, `dependency-review.yml`, `manual-pr-security-scan.yml`, `release-please.yml`, `publish.yml`, and `update-contributors.yml`.

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
    strategy:
      fail-fast: false
      matrix:
        node-version: ['24.x', '26.x']

    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v6
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - uses: extractions/setup-just@53165ef7e734c5c07cb06b3c8e7b647c5aa16db3 # v4.0.0
      - run: npm ci
      - run: just format-check
      - run: just lint
      - run: just typecheck
      - run: just test
      - run: just build
      - run: npx lefthook run pre-commit --all-files
```

The other six workflows follow the same shape (deny-all baseline `permissions`, least-privilege per-job grants, `actions/checkout` with `persist-credentials: false`) but are scoped to a single concern each: static analysis (`codeql.yml`), dependency vulnerability review on PRs (`dependency-review.yml`), a manual environment-gated deep security scan (`manual-pr-security-scan.yml`), the Conventional-Commits-driven release PR (`release-please.yml`), the tag-triggered npm publish (`publish.yml`), and the weekly contributors-list bot PR (`update-contributors.yml`). See [Using CI/CD](../tasks/using-ci-cd.md) for what each one does.

## Action Pinning Policy

Every third-party action reference in this repository follows one of two rules:

- **Official `actions/*` and `github/*` actions** (`actions/checkout`, `actions/setup-node`, `github/codeql-action/*`, `actions/github-script`) — pinned to a **major-version tag** (e.g. `@v7`, `@v6`, `@v4`). These are maintained by GitHub itself and publish stable major tags.
- **Third-party / security-sensitive actions** — pinned to a **full commit SHA**, with the resolved version left in a trailing comment, e.g.:
  ```yaml
  - uses: extractions/setup-just@53165ef7e734c5c07cb06b3c8e7b647c5aa16db3 # v4.0.0
  ```
  This covers `extractions/setup-just`, `google/osv-scanner-action/osv-scanner-action`, `googleapis/release-please-action`, and `smorinlabs/contributors-please-action`. [Dependabot's `github-actions` ecosystem](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#package-ecosystem) keeps these SHAs fresh via automated PRs.

**SHA-pin exception within the "official action" bucket**: `actions/dependency-review-action` is an official `actions/*` action but is nonetheless pinned to a full SHA (`@a1d282b...` / `# v5.0.0`), because this action publishes **no floating major tag at all** (no `v5`, and no `v4` either — the Python source repo's `@v4` reference carried this exact latent resolution bug and would never have resolved). Only exact point-release tags exist upstream, so a SHA pin is the only reliable reference; Dependabot still keeps it current.

## Permissions Hygiene

Every workflow declares an explicit top-level `permissions:` block:

- **Deny-all baseline**: workflows that don't need to write anything declare `permissions: {}` at the workflow level, then re-grant only what each job needs (e.g. `contents: read` for a read-only checkout).
- **Token-bearing workflows** grant precisely the scopes their job performs — `contents: write` + `pull-requests: write` for Release Please and Update Contributors (they open/update PRs); `pull-requests: write` for Dependency Review (it posts a PR comment); `security-events: write` + `packages: read` + `actions: read` + `contents: read` for CodeQL (per GitHub's documented CodeQL requirements); `id-token: write` (OIDC only, no long-lived secret) for the `publish` job in `publish.yml`.
- Every checkout step sets `persist-credentials: false` — no job here pushes using the checked-out token, so the persisted credential is dropped (closing the "artipacked" token-leak pattern that security scanners like `zizmor` flag).

## Best Practices

- **Keep It Simple**: start small and expand as needed — the commented-out scaffolding in `ci.yml` (Codecov upload, `npm audit`) is deliberately left as uncomment-to-enable rather than wired in by default.
- **Use Matrix Builds**: test across the Node.js Active-LTS floor and the next Current release (`['24.x', '26.x']`).
- **Cache Dependencies**: `actions/setup-node`'s built-in `cache: npm`, keyed to the committed `package-lock.json`, needs no separate `actions/cache` step.
- **Fail Fast, But Not Across the Matrix**: `fail-fast: false` so a failure on one Node version doesn't hide results from the other.
- **Monitor Regularly**: `just release-status` and `just pack-check` (see [the release runbook](../maintainers-release.md)) surface drift between `package.json`, the release-please manifest, and the latest tag.

[GitHub Actions documentation](https://docs.github.com/en/actions) for more details.
