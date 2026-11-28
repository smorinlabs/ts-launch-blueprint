---
name: new-ts-project
description: 'Create and bootstrap a new TypeScript repository, CLI, Hono/tRPC API, React/Vite web app, or pnpm monorepo from smorinlabs/ts-launch-blueprint. Use when asked to "create a new TypeScript project", "bootstrap a TypeScript repo", or "start a project from ts-launch-blueprint"; ask whether the user wants the opinionated blueprint or a minimal setup when the template choice is unresolved. Not for modifying an existing TypeScript repo or routine pnpm, oxlint, or vitest tasks.'
---

# new-ts-project

Create a fresh TypeScript project from `smorinlabs/ts-launch-blueprint`,
validate its CLI, API, and web application, and deliver the initialization as a
pull request. The generated project starts at version `0.1.0` and requires
Node.js 24+ and pnpm 10.

This skill works either **installed globally** (user scope, invoked from any
directory without a local blueprint clone) or **project-scoped** inside a
`ts-launch-blueprint` checkout. Rebranding removes the generated target's copy
of `SKILL.md` and retires its companion documentation, so when running from a
local blueprint checkout keep reading the runbook from that checkout rather
than the generated target. The generated project's ongoing setup checklist is
`docs/PROJECT_SETUP.md` (with `docs/POST_INIT.md` as its post-init pointer), and
its release guide is `docs/RELEASE.md`.

## Scope and authorization

Use this skill for a new project derived from the blueprint. An existing
project with `press/press-receipt.toml`, the record of a completed rebrand, is
not a fresh bootstrap target.

If the user has already selected the blueprint or approved this bootstrap,
continue without asking them to choose it again. For a generic TypeScript
project request where that choice is unresolved, ask whether they want the
blueprint's full toolchain or a minimal setup. If they decline the template,
leave this skill and follow their chosen approach.

Resolve the GitHub owner, repository name, visibility, and target directory
before creating resources. Summarize the identity, local setup, and intended
initialization pull request. Ask for approval only if those actions are not
already authorized. An approved full bootstrap includes the preview, declared
cleanup, rebrand, local toolchain setup, validation, and initialization PR.
Publishing packages, merging the PR, and configuring external services require
their own requested scope.

## Runbook

Run commands from the stated directory and stop at a failed command. Replace
angle-bracket placeholders with the collected values. The shell examples use
Bash; keep the `bootstrap_*` variables available between steps. Record their
resolved values when the execution tool starts a separate shell for each call.

### 1. Check prerequisites and collect missing identity

Before creating the new repository, verify the command-line tools and GitHub
login:

```bash
command -v git
command -v gh
command -v node
command -v pnpm
command -v uv
command -v bash
command -v make
gh auth status
```

Resolve missing tools or interactive authentication before resource creation.
The complete bootstrap also runs the target's `make bootstrap` when needed (to
ensure Node >=24, pnpm 10, and `just` are installed) and `just setup` (which
installs pinned analyzers, runs `pnpm install`, wires git hooks, and verifies
`just check-deps`).

Reuse identity values the user already supplied. Collect only missing fields,
show derived defaults, and validate the answers before creating the repository.

| Field                               | Default                                                                                                                                                                                   | Validation                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| GitHub repo name (`repo_name`)      | Required                                                                                                                                                                                  | Lowercase kebab-case: `^[a-z][a-z0-9-]{0,99}$`                                            |
| GitHub owner (`owner`)              | `gh api user --jq .login`                                                                                                                                                                 | Existing account or organization the user can create repositories under                   |
| Visibility                          | `public`                                                                                                                                                                                  | `public` or `private`; resolve before creating the repository                             |
| Target directory                    | `<cwd>/<repo-name>` outside Git repositories, or a sibling of the enclosing Git repository root when invoked inside one (including `ts-launch-blueprint`); ask if no safe default applies | Absolute path; absent or empty; outside any existing Git repository or blueprint checkout |
| Package identifier (`package_name`) | Repo name with `-` changed to `_`                                                                                                                                                         | `^[a-z][a-z0-9_]*$`                                                                       |
| App short name (`app_name`)         | `package_name`                                                                                                                                                                            | `^[a-z][a-z0-9_]*$`                                                                       |
| CLI binary command (`cli_name`)     | `repo_name`                                                                                                                                                                               | Lowercase kebab-case: `^[a-z][a-z0-9-]{0,99}$`                                            |
| Author name (`author`)              | `git config user.name`                                                                                                                                                                    | Non-empty                                                                                 |
| Author email (`email`)              | `git config user.email`                                                                                                                                                                   | Valid email address                                                                       |
| Display name (`display_name`)       | Repo name with hyphens changed to spaces and words title-cased                                                                                                                            | Non-empty product name for README and documentation prose                                 |

How each identity key maps into the generated workspace:

- `repo_name`: GitHub repository name, published CLI package name
  (`apps/cli/package.json`), standalone core library package name
  (`<repo_name>-core` in `packages/core/package.json`), root
  `<repo_name>-workspace`, private app scopes (`@<repo_name>/api`,
  `@<repo_name>/web`), `Justfile` `ts_package_name`/`core_package_name`/`repo_name`,
  and API container image tag `<repo_name>-api`.
- `cli_name`: executable command in `apps/cli/package.json` `bin`, `Justfile`
  `command_name`, XDG directory `~/.config/<cli_name>/`, and config file
  `<cli_name>_config.toml`.
- `app_name`: snake_case short name whose uppercase form `<APP_NAME_UPPER>_*`
  prefixes runtime environment variables (`<APP_NAME_UPPER>_TOKEN`,
  `<APP_NAME_UPPER>_SOURCE`, `<APP_NAME_UPPER>_API_URL`).

### 2. Instantiate the GitHub template and create a working branch

Use a real GitHub template instantiation so `origin` identifies the new
repository. Create and clone separately to support the exact target directory;
`gh repo create` does not have a `--directory` option.

```bash
gh repo create "<owner>/<repo-name>" \
    --template smorinlabs/ts-launch-blueprint \
    --<visibility>
gh repo clone "<owner>/<repo-name>" "<target-dir>"
cd "<target-dir>"
git rev-parse --verify HEAD
git remote get-url origin
git status --short
bootstrap_base_branch="$(git branch --show-current)"
git switch -c chore/initialize-project
```

Require a populated, clean clone with `origin` pointing to the selected
repository and no existing receipt. If GitHub has not finished generating the
template, wait for its initial commit and complete the clone before continuing.
Do not recreate the remote or delete an existing directory to retry.

### 3. Keep operator input outside the target

From `<target-dir>`, allocate a separate directory for answers and validation
notes. This keeps operator input out of Git's clean-tree check.

```bash
bootstrap_operator_dir="$(mktemp -d "${TMPDIR:-/tmp}/blueprint-bootstrap.XXXXXX")"
bootstrap_answers="$bootstrap_operator_dir/press-answers.toml"
```

Write the following TOML to the exact path in `$bootstrap_answers`, using all
eight collected identity values and valid TOML string escaping:

```toml
[answers]
package_name = "<package_name>"
repo_name = "<repo_name>"
app_name = "<app_name>"
author = "<author>"
email = "<email>"
owner = "<owner>"
display_name = "<Display Name>"
cli_name = "<cli_name>"
```

Supply all eight keys: the blueprint declares all eight in
`press/press-source.toml`, so the new identity must supply all eight too. Keep
this file outside the target through the receipt check in step 6. It is
operator input, not a project artifact.

### 4. Verify the base toolchain and locked press engine

All remaining commands run from `<target-dir>`. Ensure the Level 1 base
toolchain (`node` >=24, `pnpm` 10, and `just`) is present before running
`template-press==5.0.0`, because lockfile regeneration runs `pnpm install
--lockfile-only`:

```bash
export PATH="$HOME/.local/bin:$PATH"
make check || make bootstrap
node --version
pnpm --version
just --version
uvx --from template-press==5.0.0 press --version
uvx --from template-press==5.0.0 press check-tools --target .
git status --short
```

Require Node 24+, pnpm 10, `just`, and `template-press==5.0.0`. The working
tree must still be clean. If `mise` blocks an untrusted configuration, inspect
the new target's `mise.toml` and resolve trust before running its tools.

### 5. Preview cleanup, clean, preview rebrand, then apply

Remove any ignored build, coverage, or copied package artifacts declared in
`[[clean]]` before rebranding:

```bash
uvx --from template-press==5.0.0 press clean --target . --show
```

Review and report the listed paths, then execute the declared cleanup and
dry-run preview:

```bash
uvx --from template-press==5.0.0 press clean --target .
uvx --from template-press==5.0.0 press rebrand --target . \
    --config "$bootstrap_answers" --dry-run
```

Inspect the dry-run plan. It should cover the new identity, initial `0.1.0`
version edits, reset documentation and history, removal of template-only
material, and regeneration of `pnpm-lock.yaml`. `--allow-dirty` is not needed
because the answers file is outside the target.

Show the plan summary and continue within the approved bootstrap scope. Pause
only for unexpected changes that need a new decision.

```bash
uvx --from template-press==5.0.0 press rebrand --target . --config "$bootstrap_answers"
test -f press/press-receipt.toml
```

A successful rebrand writes `press/press-receipt.toml` and refreshes
`press/press-source.toml` to the new identity. The generated target's copy of
`SKILL.md` has now been removed; continue following the globally installed
skill (or the original blueprint checkout's copy if running project-scoped).

### 6. Set up, normalize formatting, and validate the generated project

Install workspace dependencies, pinned analyzers, and Git hooks with
`just setup`, then format the **full tree** with `oxfmt` (since longer identity
values can wrap TypeScript, JSON, YAML, TOML, or Markdown lines):

```bash
just setup
pnpm exec oxfmt
```

Review `git status --short` and `git diff` against the preview. Stage the
reviewed generated changes so Git-backed checks (`oxfmt --check`, `cspell`,
`editorconfig-checker`, `lefthook`) see the new paths.

```bash
git add -A
git diff --cached --check
just all
just docs-check
just build
just pack-check
uvx --from template-press==5.0.0 press verify --target .
test -f apps/web/dist/index.html
node apps/cli/dist/cli.js --help
test "$(just version)" = "<cli_name> 0.1.0"
```

Require every command to pass. Check that the receipt matches the answers and
that root `package.json`, `packages/core/package.json`, `apps/cli/package.json`,
and `.release-please-manifest.json` all start at `0.1.0`:

```bash
node - "$bootstrap_answers" <<'NODE'
import { readFileSync } from 'node:fs';

const answers = {};
for (const line of readFileSync(process.argv[2], 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([a-z_]+)\s*=\s*"([^"]*)"$/);
  if (m) answers[m[1]] = m[2];
}
const rootPkg = JSON.parse(readFileSync('package.json', 'utf8'));
const corePkg = JSON.parse(readFileSync('packages/core/package.json', 'utf8'));
const cliPkg = JSON.parse(readFileSync('apps/cli/package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('.release-please-manifest.json', 'utf8'));
const receipt = readFileSync('press/press-receipt.toml', 'utf8');

if (
  rootPkg.version !== '0.1.0' ||
  corePkg.version !== '0.1.0' ||
  cliPkg.version !== '0.1.0' ||
  manifest['.'] !== '0.1.0'
) {
  throw new Error('Initial 0.1.0 version mismatch across manifests');
}
if (!receipt.includes('verified = true')) {
  throw new Error('Receipt missing verified = true');
}
for (const [key, val] of Object.entries(answers)) {
  if (!receipt.includes(`${key} = "${val}"`)) {
    throw new Error(`Receipt missing ${key} = "${val}"`);
  }
}
console.log('PASS: receipt identity and initial 0.1.0 versions agree');
NODE
```

Smoke-test the built API (`apps/api/dist/server.js`) using `scripts/smoke-api.sh`
on an ephemeral or unoccupied local port (use another port if `8080` is busy):

```bash
PORT=8080 LOG_LEVEL=silent node apps/api/dist/server.js &
api_pid=$!
trap 'kill -TERM "$api_pid" 2>/dev/null || true' EXIT
sh scripts/smoke-api.sh http://127.0.0.1:8080 20
kill -TERM "$api_pid"
wait "$api_pid"
trap - EXIT
```

### 7. Commit the validated initialization and open its PR

After the checks pass, inspect the final changes and stage any reviewed
formatting outputs. Keep the answers and logs outside the repository.

```bash
git add -A
git diff --cached --check
git commit -m "chore: initialize <repo-name> from ts-launch-blueprint"
git push -u origin chore/initialize-project
```

Write a PR body to `$bootstrap_operator_dir/initialization-pr.md` describing
the generated identity, initial `0.1.0` version, completed checks, and deferred
external-service setup. Use actual results, including any reported verification
exemptions. Then create the PR against the branch recorded before rebranding:

```bash
gh pr create --repo "<owner>/<repo-name>" \
    --base "$bootstrap_base_branch" --head chore/initialize-project \
    --title "chore: initialize <repo-name>" \
    --body-file "$bootstrap_operator_dir/initialization-pr.md"
```

Report the target path, PR URL, receipt path, and validation result. Distinguish
local checks from pending or completed GitHub checks. The delivered result is
an initialization PR; do not push the initialization directly to the default
branch or treat an open PR as merged.

Point to the generated `docs/PROJECT_SETUP.md` (and `docs/POST_INIT.md`) for
ongoing repository setup and `docs/RELEASE.md` for npm Trusted Publishing and
release configuration. Continue those tasks only when they are part of the user's
requested scope.

## Failure handling

- **Repository already exists:** determine whether the current run just
  created it. Resume that known bootstrap if appropriate; otherwise resolve
  the name conflict without adopting or resetting someone else's repository.
- **Dirty-tree or ignored-path refusal:** inspect the exact target paths in
  the diagnostic. Keep user work intact. Preview and run `press clean` only
  for the target's declared paths; resolve remaining collisions explicitly.
- **Apply failure:** record the exit code and engine diagnostics, then inspect
  the target and receipt state. A failed apply can leave rewritten files.
  Use target-scoped restoration for individually reviewed paths, or start a
  separate fresh clone while retaining the failed checkout for diagnosis.
  Do not run blanket `git clean` or silently retry with force flags.
- **Check, build, hook, or push failure:** fix confirmed bootstrap problems
  and rerun the affected checks before proceeding. Report missing access or
  service configuration precisely; do not disable gates to create a green PR.
- **User stops the bootstrap:** report which resources and changes exist and
  leave them intact. Stopping does not authorize repository deletion.
