# Project setup — decisions and configuration

This checklist configures the application after its identity has been pressed.
Review each retained capability before enabling publishing or optional services.
The source template is recorded in `press/press-receipt.toml` under `[press.from]`.

Legend: **Default** = how the template ships. Each item is a checkbox so you can
track what you have decided.

---

## 1. Decisions — features to include or drop

Optional capabilities. For each, decide **keep** or **remove**; the file paths
show what to delete if you drop a feature. Anything you keep has matching setup
in [§2](#2-checks--configuration).

### CI / quality gates (recommended: keep all)

- [ ] **Core CI** (`lint`, `typecheck`, `check-boundaries`, 4-cell cross-OS
      `test` + coverage, `pack-check`, `check-removable`, `api-image`,
      `web-e2e`, advisory `bun-lane`, `ci-ok`) — _Default: on._ Files:
      `.github/workflows/ci.yml` (plus `.github/workflows/api-contract.yml` if
      keeping `apps/api`). Keeping this is the core value of the template.
- [ ] **Pre-commit / pre-push hooks** (lefthook: `oxfmt`, `oxlint`,
      `depcruise`, `shellcheck`, `actionlint`, `editorconfig-checker`, `cspell`,
      `pnpm-lock-check`, `check-large-files`, `gitleaks`, `tsc --noEmit`,
      `commitlint`, `press-verify`) — _Default: on._ File: `lefthook.yml`. Remove
      the file to disable local hooks.
- [ ] **Conventional Commits enforcement** (`commitlint`) — _Default: on._
      Files: `.github/workflows/commitlint.yml`, `commitlint.config.mjs`,
      `commitlint.dependabot.config.mjs`. Note: `release-please` depends on
      Conventional Commits; dropping this weakens automated release notes.
- [ ] **Large-file guard** (1 MB ceiling outside `docs/assets/`) — _Default: on._
      File: `.github/workflows/large-file-guard.yml`.
- [ ] **Difftree PR comments** — _Default: on._ File:
      `.github/workflows/difftree-pr-comment.yml` (retained verbatim via
      `keep_names` in `press/press-rules.toml`).
- [ ] **Press drift verification** — _Default: on._ File:
      `.github/workflows/press-verify.yml`.

### Security (recommended: keep)

- [ ] **CodeQL code scanning** (advanced setup, `javascript-typescript`,
      `build-mode: none`, `security-extended`) — _Default: on for public
      repositories; skipped for private repositories._ Files:
      `.github/workflows/codeql.yml`, `.github/codeql/codeql-config.yml`. Removing
      both disables CodeQL; you can instead switch to GitHub's _default setup_
      (see §2).
- [ ] **Secret scanning** (TruffleHog `--only-verified` in CI + `gitleaks` in
      hooks) — _Default: on._ Files: `.github/workflows/secret-scan.yml`,
      `.gitleaks.toml`, `.gitleaksignore`, `scripts/check-gitleaks.sh`. Keep.
- [ ] **Dependency review** (PR diff vulnerability/license check) — _Default: on
      (public repositories)._ File: `.github/workflows/dependency-review.yml`.
- [ ] **Weekly dependency audit & canary** (`pnpm audit` + `osv-scanner`
      rolling issue; weekly latest-deps `canary`) — _Default: on._ Files:
      `.github/workflows/dep-audit.yml`, `.github/workflows/canary.yml`.
- [ ] **Manual PR security review** (keyless `google/osv-scanner-action` gated
      behind the `security-review` environment) — _Default: present._ File:
      `.github/workflows/manual-pr-security-scan.yml`. Remove if unused.
- [ ] **CLA gate** (`license/cla` check via the external **cla-assistant.io**
      app) — _Default: connected on the upstream template repo; starts off on a
      fork._ There is **no in-repo workflow** — it is an external app. Connect
      it (and customize `docs/contributing/cla/`), or leave it off.

### Release & distribution (decide per project)

- [ ] **release-please** (PR-driven version bumps + changelog) — _Default: on,
      needs auth (`RELEASE_PLEASE_CLIENT_ID` + `RELEASE_PLEASE_PRIVATE_KEY` or
      `RELEASE_PLEASE_APP_TOKEN`)._ Files:
      `.github/workflows/release-please.yml`, `release-please-config.json`,
      `.release-please-manifest.json`. To disable: rename the workflow
      `.disabled` (see [RELEASE.md](RELEASE.md)).
- [ ] **Publish CLI package to npm** (`apps/cli` only, OIDC Trusted Publishing
      on `v*` tags) — _Default: on, needs npmjs.com Trusted Publisher + `npm`
      environment config._ File: `.github/workflows/publish.yml`. Remove if the
      project is not published to npm.
- [ ] **Publish the API container to public GHCR** (`apps/api/Dockerfile`,
      `ghcr.io/<owner>/<repo>`) — _Default: on for published stable GitHub
      Releases, needs one-time GHCR package visibility = Public._ Files:
      `.github/workflows/publish-container.yml`,
      `scripts/publish-container.mjs`, `scripts/publish-container.d.mts`,
      `scripts/smoke-api.sh`. Remove if dropping `apps/api` or not shipping a
      container image (see
      [GHCR setup and recovery](RELEASE.md#public-container-publishing-ghcr) and
      [removing the API](reference/boundary-rules.md#removing-the-api)).
- [ ] **Codecov coverage reporting** — _Default: on, tokenless OIDC on public
      repositories._ File: `.codecov.yml`; upload step in
      `.github/workflows/ci.yml` (`ubuntu` / Node `24.x` cell only). Remove the
      upload step and `.codecov.yml` to disable.
- _(Documentation uses plain CommonMark/GFM under `docs/` rendered natively on
  GitHub — there is no Read the Docs configuration to connect.)_

### Community / project automation (optional)

- [ ] **Contributors automation** (`contributors-please` app) — _Default: NOT
      shipped in pressed child repositories (`press rebrand` removes
      `update-contributors.yml`, `.contributors.yml`, `CONTRIBUTORS.md`, and
      `tests/contributors-automation.test.ts`)._ To opt in: run
      `just contributors` once, copy `update-contributors.yml` from the
      upstream blueprint if desired, and set `CONTRIBUTORS_PLEASE_*` secrets.
- [ ] **Claude Code PR review & `@claude` mentions** — _Default: present,
      auto-skips cleanly when `CLAUDE_CODE_OAUTH_TOKEN` is unset._ Files:
      `.github/workflows/claude-code-review.yml`, `.github/workflows/claude.yml`.
- [ ] **Funding / Sponsor button** — _Default: points at the template author._
      File: `.github/FUNDING.yml`. Update to your handle or delete it.
- [ ] **Issue/PR templates, Code of Conduct, Contributing, Security Policy** —
      _Default: on._ Files under `.github/`. Edit to taste.

### Retained machinery (no action needed)

- **Fork guard** — _Default: silenced by `press/press-receipt.toml`._ File:
  `scripts/guard.sh`, invoked eagerly by `Justfile` (`_blueprint_notice` and
  `_guard`). Do **not** delete it — `just` evaluates it at parse time, so
  removing the file breaks every recipe. It stays silent in a pressed project.
- **Press verify** — `.github/workflows/press-verify.yml` and
  `just press-verify` remain active in pressed repositories as their own
  rebrand drift guard.

---

## 2. Checks & Configuration

For each feature you kept, the concrete wiring: secrets, environments, external
services, repository settings, and local commands.

### 2.1 GitHub Actions secrets

Add under **Settings → Secrets and variables → Actions** (or org-level).

| Secret                                                              | Required by                             | Needed when                                                                                     | How to get it                                                                                                                                                |
| ------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RELEASE_PLEASE_CLIENT_ID` + `RELEASE_PLEASE_PRIVATE_KEY`           | `release-please.yml`                    | Using `release-please` (preferred auth; lets tag pushes fire `publish.yml`)                     | Create a GitHub App with **Contents + Pull requests: write**, install it on this repo, and use its Client ID (`Iv23li...`) + generated private key (`.pem`). |
| `RELEASE_PLEASE_APP_TOKEN`                                          | `release-please.yml`                    | `release-please` fallback (instead of the App)                                                  | Fine-grained PAT with **Contents + Pull requests: write** scoped to this repo.                                                                               |
| `CLAUDE_CODE_OAUTH_TOKEN`                                           | `claude-code-review.yml`, `claude.yml`  | Enabling automated Claude PR reviews and `@claude` mentions (auto-skips when absent)            | Claude Code OAuth token from Anthropic/Claude setup.                                                                                                         |
| `CONTRIBUTORS_PLEASE_CLIENT_ID` + `CONTRIBUTORS_PLEASE_PRIVATE_KEY` | `update-contributors.yml`               | Opting back into automated contributors PRs (removed on press by default)                       | From the `contributors-please` GitHub App install (falls back to `GITHUB_TOKEN` if unset).                                                                   |
| `CODECOV_TOKEN`                                                     | `ci.yml` (`Upload coverage to Codecov`) | **Private repos only** (public repos upload tokenless via OIDC `use_oidc: true`)                | From the repository settings page on `codecov.io`.                                                                                                           |
| `META_MUSE_CI_API_KEY`                                              | `audit-triage.yml`                      | Optional org-only Muse weekly-audit triage (also requires repo variable `MUSE_CI_ENABLED=true`) | Meta Muse CI API key (inert unless `vars.MUSE_CI_ENABLED == 'true'`).                                                                                        |

> `GITHUB_TOKEN` is provided automatically — no setup. **npm publishing**
> (`publish.yml`) uses **OIDC Trusted Publishing** (`id-token: write`,
> `environment: npm`) — **no `NPM_TOKEN` secret**. **GHCR publishing**
> (`publish-container.yml`) uses `GITHUB_TOKEN` with job-scoped
> `packages: write` — no registry password or PAT needed. **Manual PR security
> review** (`manual-pr-security-scan.yml`) uses keyless
> `google/osv-scanner-action` — no API key secret needed (`security-review`
> gates human approval).

### 2.2 GitHub Environments

Create under **Settings → Environments**. Environments can be provisioned
automatically:

```bash
# Creates `npm` (tag policy: v*) and `security-review` (branch policies: main, release/*)
scripts/setup-github-environments.sh <owner>/<repo>
# Requires: gh CLI authenticated with admin (repo scope / Administration: write)
```

| Environment       | Used by                       | Policy                       | Notes                                                                                                                                           |
| ----------------- | ----------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm`             | `publish.yml` (`publish` job) | Tag pattern `v*`             | Protected production npm publish. Add required reviewers (1+) in **Settings → Environments**, and pair with npmjs.com Trusted Publisher (§2.3). |
| `security-review` | `manual-pr-security-scan.yml` | Branches `main`, `release/*` | Gates manual OSV-Scanner PR security reviews behind environment protection rules / reviewers.                                                   |

### 2.3 External services to connect

| Service                     | Action                                                                                                                                                                                                                                                                        | Config in repo                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **CodeQL**                  | In **Settings → Code security**, ensure **default setup is OFF** (`not-configured`) — mutually exclusive with `codeql.yml` (see [SECURITY.md](../.github/SECURITY.md)).                                                                                                       | `.github/workflows/codeql.yml`, `.github/codeql/codeql-config.yml`                                   |
| **npm Trusted Publisher**   | On `npmjs.com` → package settings (`apps/cli/package.json` `name`) → _Trusted Publisher_ → **GitHub Actions**: owner, repo, workflow `publish.yml`, environment `npm`. Run `scripts/setup-npm-publishing.sh` to print exact inputs.                                           | `.github/workflows/publish.yml`                                                                      |
| **GHCR package**            | After the first release upload, open repository → **Packages** → **Package settings** → **Change visibility** → **Public**, ensure **Manage Actions access** grants repo write access, then rerun the failed `publish-container` workflow so the anonymous pull check passes. | `.github/workflows/publish-container.yml`; [GHCR guide](RELEASE.md#public-container-publishing-ghcr) |
| **Codecov**                 | Add the repo at `codecov.io`. Public repos use OIDC; `.codecov.yml` enforces project `auto` ±1% and patch 80%.                                                                                                                                                                | `.codecov.yml`                                                                                       |
| **Dependabot**              | Enable **Dependabot alerts** and **security updates** in Settings; `.github/dependabot.yml` configures `github-actions`, `npm` (reads `pnpm-lock.yaml`), and `docker` (`/apps/api`).                                                                                          | `.github/dependabot.yml`                                                                             |
| **release-please App**      | Install the GitHub App + set `RELEASE_PLEASE_CLIENT_ID` and `RELEASE_PLEASE_PRIVATE_KEY` (or `RELEASE_PLEASE_APP_TOKEN`) per §2.1.                                                                                                                                            | `.github/workflows/release-please.yml`                                                               |
| **contributors-please App** | _(Optional)_ Only if opting back into `update-contributors.yml`.                                                                                                                                                                                                              | —                                                                                                    |
| **CLA assistant**           | _(Optional)_ Connect at `cla-assistant.io` if keeping `license/cla`.                                                                                                                                                                                                          | —                                                                                                    |
| **Sponsor button**          | Set `github:` in `.github/FUNDING.yml` or delete it.                                                                                                                                                                                                                          | `.github/FUNDING.yml`                                                                                |

### 2.4 Repository settings (away from defaults)

Under **Settings**:

- [ ] **Branch protection** on `main`: require status checks anchored on the
      aggregate gates — `ci-ok` (all of `ci.yml`), `press-verify` (the rebrand
      drift guard), and `commitlint (humans)`. Avoid listing individual `ci.yml`
      jobs (`lint`, `typecheck`, `check-boundaries`, OS test matrix, `pack-check`,
      `web-e2e`): `ci-ok` subsumes them and its `needs:` list is versioned
      in-repo, so job renames never desync settings. Full command in
      [§3.6](#36-branch-protection).
- [ ] **Actions → General → Workflow permissions**: enable **"Allow GitHub
      Actions to create and approve pull requests"** (`release-please` and
      Dependabot open PRs).
- [ ] **Code security → Code scanning default setup: OFF** (CodeQL advanced).
- [ ] **Code security → Dependabot**: enable alerts + security updates.
- [ ] **Code security → Private vulnerability reporting**: enable (referenced by
      `SECURITY.md`).
- [ ] **General → Pull requests**: use merge commits (`allow_squash_merge=false`)
      so individual Conventional Commits are preserved for `release-please`.

### 2.5 Local development setup (per clone)

```bash
# Bare machines only: install base tools (node >=24, pnpm 10, just).
make bootstrap
# Every fresh clone: pinned analyzers, pnpm install, hooks, check-deps.
just setup
just all
```

### 2.6 Application / runtime config

For the bundled CLI example (not repository infrastructure):

- **API token** — provide via `--token` or the `TS_PROJECTS_TOKEN` environment
  variable (secrets are **never** read from or written to TOML config files per
  [ADR 0002](adr/0002-no-secrets-in-config-file.md)). Configure non-secret
  settings via `ts-projects config set <section>.<key> <value>` or
  `ts-projects config init`.
- **Manual publish fallback** — npm Trusted Publishing (OIDC) is strongly
  preferred (classic npm tokens were revoked in December 2025). Only if
  publishing from a self-hosted runner without GitHub OIDC, authenticate locally
  with a short-lived granular/session token from `apps/cli`.

---

## 3. Settings to verify & set — one by one

Go through these in order. Replace `<owner>/<repo>` throughout; `gh` must be
authenticated with repository admin rights.

### 3.1 Code scanning — if keeping CodeQL

- [ ] **CodeQL default setup must be OFF** · _repo setting_ — advanced
      `codeql.yml` is rejected at SARIF upload if default setup is also enabled.
  - Check: `gh api /repos/<owner>/<repo>/code-scanning/default-setup --jq .state` → want `not-configured`
  - Set (if `configured`): `gh api --method PATCH /repos/<owner>/<repo>/code-scanning/default-setup -f state=not-configured`

### 3.2 Actions permissions

- [ ] **Actions enabled** · _repo setting_
  - Check/Set: **Settings → Actions → General** → "Allow all actions and reusable workflows".
- [ ] **Allow Actions to create & approve PRs** · _repo setting_ — `release-please`
      and Dependabot open PRs.
  - Check: `gh api /repos/<owner>/<repo>/actions/permissions/workflow --jq '{perm: .default_workflow_permissions, approve: .can_approve_pull_request_reviews}'`
  - Set: `gh api --method PUT /repos/<owner>/<repo>/actions/permissions/workflow -F default_workflow_permissions=write -F can_approve_pull_request_reviews=true`

### 3.3 Secrets

List what is present with `gh secret list -R <owner>/<repo>`, then set each
secret you need (`gh secret set NAME -R <owner>/<repo>`):

- [ ] **`RELEASE_PLEASE_CLIENT_ID` + `RELEASE_PLEASE_PRIVATE_KEY`** (or
      `RELEASE_PLEASE_APP_TOKEN`) · _secret_ — if keeping `release-please`.
  - Set: `gh secret set RELEASE_PLEASE_CLIENT_ID -R <owner>/<repo>` and `gh secret set RELEASE_PLEASE_PRIVATE_KEY -R <owner>/<repo> < key.pem`
- [ ] **`CLAUDE_CODE_OAUTH_TOKEN`** · _secret_ — if enabling automated Claude
      reviews / `@claude` mentions.
- [ ] **`CODECOV_TOKEN`** · _secret_ — **private repositories only** (public
      repositories use tokenless OIDC).

### 3.4 Environments

- [ ] **`npm` and `security-review` exist** · _environment_
  - Check: `gh api /repos/<owner>/<repo>/environments --jq '.environments[].name'`
  - Set: `scripts/setup-github-environments.sh <owner>/<repo>`
  - Then add required reviewers on `npm` (and `security-review` if desired) in
    **Settings → Environments**.

### 3.5 Dependabot & vulnerability settings

- [ ] **Dependabot alerts** · _repo setting_
  - Set: `gh api --method PUT /repos/<owner>/<repo>/vulnerability-alerts`
- [ ] **Dependabot security updates** · _repo setting_
  - Set: `gh api --method PUT /repos/<owner>/<repo>/automated-security-fixes`
- [ ] **Dependabot version updates** · _file + setting_ — driven by
      `.github/dependabot.yml` (`github-actions`, `npm`, `docker`).
- [ ] **Private vulnerability reporting** · _repo setting_ — referenced by
      [SECURITY.md](../.github/SECURITY.md).
  - Set: `gh api --method PUT /repos/<owner>/<repo>/private-vulnerability-reporting`
- [ ] **Secret scanning + push protection** · _repo setting (optional)_ — GitHub
      native, complements TruffleHog/`gitleaks`. **Settings → Code security**.

### 3.6 Branch protection

- [ ] **Protect `main`** · _repo setting_ — require aggregate status checks
      (`ci-ok`, `press-verify`, `commitlint (humans)`):
  - Check: `gh api /repos/<owner>/<repo>/branches/main/protection --jq '.required_pull_request_reviews, .required_status_checks.contexts' 2>/dev/null || echo "unprotected"`
  - Set:

    ```bash
    gh api -X PUT /repos/<owner>/<repo>/branches/main/protection --input - <<'JSON'
    {
      "required_status_checks": {
        "strict": false,
        "contexts": [
          "ci-ok",
          "press-verify",
          "commitlint (humans)"
        ]
      },
      "enforce_admins": false,
      "required_pull_request_reviews": null,
      "restrictions": null,
      "allow_force_pushes": false,
      "allow_deletions": false
    }
    JSON
    ```

  - Also enable **Require conversation resolution before merging** when using
    review bots or team reviews. (`api-contract` and `bootstrap-acceptance` are
    path-filtered, so do not list them as unconditional required checks.)

### 3.7 External services (UI / no `gh` check)

- [ ] **npm Trusted Publisher** · _external_ — run
      `scripts/setup-npm-publishing.sh <owner>/<repo>` and configure the
      publisher on `npmjs.com` (`publish.yml`, environment `npm`).
- [ ] **Codecov** · _external_ — add the repository at `codecov.io`.
- [ ] **release-please GitHub App** · _external_ — install on the repo/org (or
      configure `RELEASE_PLEASE_APP_TOKEN`).
- [ ] **CLA assistant** · _external_ — connect at `cla-assistant.io` if keeping
      the `license/cla` gate.

### 3.8 Repo metadata & merge strategy

- [ ] **Funding handle** · _file_ — set `github:` in `.github/FUNDING.yml` or
      delete the file.
- [ ] **Merge strategy** · _repo setting_ — keep `allow_squash_merge=false` so
      merge commits preserve each Conventional Commit for `release-please`.
  - Set: `gh api --method PATCH /repos/<owner>/<repo> -F allow_squash_merge=false -F allow_merge_commit=true -F allow_rebase_merge=true -f merge_commit_title=MERGE_MESSAGE -F delete_branch_on_merge=true`

### 3.9 Local (per clone)

- [ ] Toolchain + hooks installed and workspace verified — see
      [§2.5](#25-local-development-setup-per-clone).

---

## Verify local setup

After bootstrap formatting has completed, verify the repository locally:

```bash
just setup
just all
just docs-check
just build
just pack-check
just press-verify
```

Use `pnpm install --frozen-lockfile` inside each additional Git worktree. Do not
share `node_modules` across worktrees via a symlink.

Optional Claude review runs when `CLAUDE_CODE_OAUTH_TOKEN` is configured. Without
that secret, the workflow check reports that Claude review is not configured
and skips cleanly.

The shipped CodeQL and `dependency-review` workflows skip private repositories.
Gitleaks, TruffleHog, `pnpm audit`, and `osv-scanner` remain active; verify the
retained security checks on your first PR.

Template generation removes the blueprint's `projects/` directory. `just setup`
recreates `projects/.gitkeep` whenever `PROJECTS.md` is present so the generated
repository has a clean directory for its own project records.
