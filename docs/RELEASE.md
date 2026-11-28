# Release process

Automated release and distribution runbook for `ts-launch-blueprint` (see
[ADR 0001](adr/0001-pnpm-monorepo-and-cli-only-publishing.md) and
[Versioning and Release Management](reference/versioning.md)).

## Default flow (release-please)

1. Merge `feat:`, `fix:`, or `perf:` commits to `main` (using merge commits so
   individual Conventional Commits remain intact on `main`).
2. `.github/workflows/release-please.yml` runs stock
   `googleapis/release-please-action` against `release-please-config.json` and
   `.release-please-manifest.json`, opening or updating a standing Release PR
   (`chore(release): publish vX.Y.Z`) that bumps root `package.json`,
   `apps/cli/package.json` (via `extra-files`), `.release-please-manifest.json`,
   and `CHANGELOG.md` atomically.
3. Merge the Release PR. `release-please` pushes a `vX.Y.Z` tag and publishes
   a GitHub Release.
4. `.github/workflows/publish.yml` fires on the `v*` tag (publishing `apps/cli`
   only; `packages/core`, `apps/api`, and `apps/web` remain private):
   - `verify` (`verify-release`): confirms the tag descends from `main`,
     confirms `tag == apps/cli/package.json version == .release-please-manifest.json`,
     runs `just all`, and runs `just pack-check`.
   - `publish` (`publish-npm`): waits for human approval in the protected `npm`
     GitHub environment, verifies `npm publish --dry-run` triggers no `bin`
     auto-correction, and runs `npm publish` in `apps/cli` via OIDC Trusted
     Publishing (`id-token: write`, no `NPM_TOKEN`).
5. Independently, `.github/workflows/publish-container.yml` fires when a stable
   GitHub Release is published. It builds and smoke-tests the `apps/api` image,
   publishes the versioned image to GHCR, verifies anonymous pull access, and
   reconciles the `latest` tag.

---

## One-time setup (Environments + npm OIDC)

1. Provision the GitHub Environments (`npm` with `v*` tag policy and
   `security-review` with `main` / `release/*` branch policies):

   ```bash
   scripts/setup-github-environments.sh <owner>/<repo>
   ```

   Then open **Settings → Environments → `npm`** on GitHub and add required
   reviewers (1+ maintainer) so `publish` waits for explicit approval.

2. Print the exact Trusted Publisher inputs for `apps/cli/package.json` and
   validate `.github/workflows/publish.yml`:

   ```bash
   scripts/setup-npm-publishing.sh <owner>/<repo>
   ```

   Configure the printed **GitHub Actions** Trusted Publisher on `npmjs.com`
   (`Package Name` from `apps/cli/package.json`, `Owner`, `Repository name`,
   workflow `publish.yml`, environment `npm`).

---

## Public container publishing (GHCR)

The image is `ghcr.io/smorinlabs/ts-launch-blueprint` (`ghcr.io/<owner>/<repo>`
in generated projects). `apps/api/Dockerfile` packages the bundled `apps/api`
server on `node:24-slim`, runs as the non-root `node` user, and listens on port
`8080`. The supported platform is `linux/amd64`.

| Reference   | Meaning                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| `:X.Y.Z`    | Image for published stable release `vX.Y.Z`. Existing version tags are never overwritten.                      |
| `:latest`   | Highest numeric stable version published to the package, promoted after health and anonymous-pull checks pass. |
| `@sha256:…` | Exact manifest digest reported by the workflow. Prefer digest pinning for repeatable deployments.              |

Draft releases, prereleases, and standalone tag pushes do not publish
containers. Existing releases are not backfilled automatically. `publish.yml`
continues to run independently on `v*` tag pushes.

`scripts/publish-container.mjs` checks the release tag against the event
commit, checkout, `main` ancestry, `apps/cli/package.json` / root
`package.json`, and `.release-please-manifest.json`. A new version is built once
and smoke-tested with `scripts/smoke-api.sh` (verifying `/healthz` and `/readyz`
before clean `SIGTERM` shutdown), pushed to GHCR, and verified by configuration
digest.

The container publisher uses GitHub Actions' automatic `GITHUB_TOKEN` with
`contents: read` and `packages: write`. No stored GHCR credential is needed. The
`release-please` App or PAT remains responsible for creating release events that
trigger downstream workflows.

### First public publication

GHCR creates new packages as **Private**, even when linked to public
repositories. The first run can therefore upload `:X.Y.Z` and then fail its
anonymous pull verification step. The uploaded version is retained for retry.

1. After that first upload, open the repository on GitHub, select the container
   under **Packages**, and open **Package settings**.
2. Under **Danger Zone**, select **Change visibility**, choose **Public**, and
   confirm the package name. (GitHub does not allow a public package to return
   to private; organization policy must also allow public packages.)
3. Rerun the failed `publish-container` workflow from the release's Actions run.
   The retry verifies anonymous pull by digest and runs `promote-latest`.

If the package pre-existed this workflow, verify **Manage Actions access**
grants this repository write access.

### Retries and concurrent releases

An existing version is pulled by digest, its labels and health are re-verified,
and it is never rebuilt or overwritten. Registry authentication or transport
errors fail closed; only an explicit missing-manifest response permits a new
build.

`publish-version` serializes by `container-version-<tag>`, while
`promote-latest` serializes on `container-latest` (`cancel-in-progress: false`)
and reconciles the highest published stable version, refusing backward version
moves or conflicting digests.

Pull requests and `merge_group` runs execute `container-check` without registry
credentials. A rerun executes from the original release tag; ship a new stable
release to pick up workflow fixes on `main`.

References:
[GitHub container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry),
[package visibility](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility),
[workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

---

## Disabling release-please (downstream projects)

If a generated project prefers manual version tags instead of PR-driven
`release-please`:

```bash
# Disable release-please:
mv .github/workflows/release-please.yml .github/workflows/release-please.yml.disabled

# Bump versions consistently before tagging:
$EDITOR package.json
$EDITOR apps/cli/package.json
$EDITOR .release-please-manifest.json
git add package.json apps/cli/package.json .release-please-manifest.json
git commit -m "chore(release): prepare v1.2.3"
git tag -a v1.2.3 -m "v1.2.3"
git push origin main v1.2.3
```

`publish.yml` still fires on the `v*` tag and publishes `apps/cli` to npm. To
publish the API container image as well, publish a stable GitHub Release for
that tag. Keep root `package.json`, `apps/cli/package.json`, and
`.release-please-manifest.json` equal before committing and tagging.

---

## Token setup

`release-please` must authenticate with a token that can **both** open PRs and
trigger downstream workflows (so merging the Release PR fires `publish.yml` and
`publish-container.yml`). `GITHUB_TOKEN` cannot trigger downstream workflows and
may be blocked by org policy from opening PRs, so configure one of:

1. **GitHub App (preferred).** Create a GitHub App with **Contents: write** and
   **Pull requests: write**, install it on the repository, and add two secrets:
   - `RELEASE_PLEASE_CLIENT_ID` — the App's Client ID (e.g. `Iv23li...`)
   - `RELEASE_PLEASE_PRIVATE_KEY` — the App's private key (`.pem` contents)
2. **Fallback PAT.** Create a fine-grained Personal Access Token scoped to this
   repository with **Contents: write** and **Pull requests: write**, stored as
   `RELEASE_PLEASE_APP_TOKEN`.

When neither is configured, `release-please.yml` fails fast rather than
creating tags that silently fail to trigger publishing.

---

## First-release cutover (one-time)

`template-press rebrand` resets root `package.json`, `apps/cli/package.json`
(via `scripts/reset-version.mjs`), and `.release-please-manifest.json` to
`0.1.0`, and resets `CHANGELOG.md` to `# Changelog\n`.

Configure the release credentials above and `npm` environment / Trusted
Publisher before merging a Release PR. For an existing repository adopting
`release-please`, seed `.release-please-manifest.json` with the current version
and set `bootstrap-sha` in `release-please-config.json` only if older commits
should be excluded. See the
[release-please bootstrap reference](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#bootstrapping).

---

## Monitoring and troubleshooting

```bash
# Compare root package.json, .release-please-manifest.json, and latest v* tag
just release-status

# Local packaging verification (build, publint, attw, tarball smoke test)
just pack-check
```

Common failure modes:

- **Merging a Release PR did not trigger `publish.yml`**: verify
  `RELEASE_PLEASE_CLIENT_ID` + `RELEASE_PLEASE_PRIVATE_KEY` (or
  `RELEASE_PLEASE_APP_TOKEN`) are configured rather than `GITHUB_TOKEN`. As a
  fallback, run `publish.yml` via `workflow_dispatch` targeting the `v*` tag.
- **`publish` job never starts**: it is waiting for required reviewer approval in
  the protected `npm` GitHub Environment.
- **`publish` rejected by environment protection rules**: ensure the `npm`
  environment allows **`v*` tags** (`type=tag`), not branch-only policies. Run
  `scripts/setup-github-environments.sh <owner>/<repo>`.
- **`npm publish` fails auth**: verify the Trusted Publisher on `npmjs.com`
  matches owner, repository, `publish.yml`, and environment `npm` (`node >= 24`
  with bundled `npm >= 11.5.1`).
- **`bin` strip-guard fails**: fix `apps/cli/package.json` `"bin"` path/key
  rather than relying on npm auto-correction.
- **`verify` version or ancestry mismatch**: ensure the tag descends from
  `origin/main` and matches `apps/cli/package.json` and
  `.release-please-manifest.json`.
