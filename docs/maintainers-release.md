# Release Runbook

**Stub** — expanded in the docs slice.

## One-Time Setup

Configure the release pipeline before the first release:

- [ ] On GitHub (this repository, Settings > Environments), create a new protected environment named `npm` with required reviewers (1+).
- [ ] On [npmjs.com](https://www.npmjs.com), in the package settings for `ts-launch-blueprint`, configure the Trusted Publisher:
  - Repository owner: `smorinlabs`
  - Repository name: `ts-launch-blueprint`
  - Workflow file path: `.github/workflows/publish.yml`
  - Environment name: `npm`
- [ ] _(Optional)_ To make release-please PRs auto-trigger the publish workflow (instead of requiring a manual tag push), mint a GitHub App token: see the commented "GitHub App token upgrade" block in `.github/workflows/release-please.yml` for instructions.

## Routine Release Flow

Each release is cut by merging the Release PR:

1. A Release PR (titled `chore(release): publish v*`) is posted to main by
   release-please, bumping `package.json`, `.release-please-manifest.json`,
   and `CHANGELOG.md` in one generated commit. `pnpm-lock.yaml` does not
   duplicate the root project version, so no follow-up lockfile commit is
   needed; the PR is internally consistent from its first revision.
2. Review and merge the Release PR.
3. release-please tags the commit as `vX.Y.Z`, which triggers `publish.yml`.
4. The `verify` job runs (format-check, lint, typecheck, test, build, file-list check); if it passes, `publish` waits in the `npm` environment.
5. Approve the deployment in the GitHub Actions UI (required by the environment's reviewers).
6. The `publish` job exchanges the OIDC token for a short-lived npm credential and publishes to the registry.
7. Verify the release: `just release-status` shows tag, package.json, and manifest aligned; `just pack-check` confirms the tarball is distributable.

## Monitoring

- `just release-status` — display package.json, manifest, latest tag, and report any drift.
- `just pack-check` — smoke-test the published distribution (build, publint, attw, npm pack, install, bin smoke test, ESM import).
