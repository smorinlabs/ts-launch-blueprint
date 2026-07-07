# TS Port Index

Structured understanding of everything in the source project
`smorinlabs/py-launch-blueprint` and how each element must be preserved,
replaced, modified, or intentionally omitted in the TypeScript port. Produced in
Phases 1–2 of `goal.md` (domain spec: `typescript_port_process_prompt.md`).

- **Source**: `~/c/py-launch-blueprint` at pinned SHA
  `4828f8596b2332d74fbcff932ebab6f0030febd5` (93 tracked files; scope = `git
  ls-files` at that SHA, per goal.md §2.2).
- **Coverage**: every one of the 93 files has an entry below with all 11 domain-spec
  fields. Entries are grouped into 11 logical file groups (D-007).
- **Statuses** here are `Indexed` or `Needs research`; later phases advance them
  (Researched → Planned → Implemented → Tested → Verified) via the plan and log.

## Deliberate scope exclusions (D-005)

The following files exist in the source working tree but are **untracked at the
pinned SHA** and are excluded from the port by user decision (goal.md §2.3).
Validators must not flag them:

- `TEMPLATE_USAGE.md`
- `scripts/cleanup_template.py`
- `scripts/init_from_template.py`
- `scripts/rename_template.py`
- `typescript_port_process_prompt.md`

## Port categories used

Copy as-is · Copy then modify · Translate to TypeScript equivalent · Replace
with TypeScript/Node ecosystem equivalent · Split into multiple files · Merge
into another file · Omit with reason · Needs research

Tool selections marked "Needs research" are deliberately deferred to
`TS_PORT_RESEARCH.md` (Phase 4) after the existing-repo review (Phase 3); this
index records candidates, not decisions.

---

# Part 1 — File-by-file index (93 files)

## Group: github-community

# Index fragment: github-community

Source repo: /Users/stevemorin/c/py-launch-blueprint @ 4828f8596b2332d74fbcff932ebab6f0030febd5

### `.github/CODE_OF_CONDUCT.md`
- **Target path**: `.github/CODE_OF_CONDUCT.md`
- **Port category**: Copy as-is
- **Purpose**: Community code of conduct — a condensed adaptation of the Contributor Covenant v2.0 defining expected/unacceptable behavior, enforcement, and reporting.
- **Features/capabilities**: Pledge of inclusive, harassment-free community; expected behavior list (empathy, constructive feedback, taking responsibility); unacceptable behavior list (harassment, doxxing, unprofessional conduct); enforcement escalation (warnings → temporary bans → permanent removal); reporting channel placeholder `[INSERT CONTACT]`; attribution link to Contributor Covenant v2.0.
- **Best-practice intent**: Every open-source template ships a code of conduct so downstream projects start with community governance in place; GitHub also surfaces it in the repo's community-health checklist.
- **Python-specific assumptions**: none
- **TS/Node equivalent**: Identical file — codes of conduct are language-agnostic. Keep the `[INSERT CONTACT]` placeholder since this is a template repo.
- **Open questions**: none
- **Validation strategy**: Confirm GitHub's Community Standards page (repo Insights → Community) detects the code of conduct; visual review that no py-launch-blueprint references remain.
- **Status**: Indexed

### `.github/CONTRIBUTING.md`
- **Target path**: `.github/CONTRIBUTING.md`
- **Port category**: Copy then modify
- **Purpose**: Contributor guide covering the CLA process, how to report bugs / suggest enhancements / submit PRs, code of conduct pointer, and Conventional Commits requirement.
- **Features/capabilities**: CLA section with links to Individual CLA (`./docs/cla/individual_cla.md`) and Corporate CLA (`./docs/cla/corporate_cla.md`) plus CLA Assistant bot doc (`docs/source/tools/cla-assistant.md`); bug-reporting flow that instructs contributors to run `just debug-info` (collects OS, tool versions, installed packages to clipboard) with manual fallback listing OS, Python version, `uv`, `ruff`, `git`, `just` versions and `uv pip list`; enhancement-suggestion guidelines; 6-step fork/branch/PR workflow; PR guidelines (coding style, tests included, tests pass, docs updated); Conventional Commits section (note: the "Commit Message Format" subsection is left empty in the source — appears truncated); "Getting Help" section.
- **Best-practice intent**: Lowers contribution friction with an explicit end-to-end contribution workflow; encodes CLA legal hygiene, reproducible bug reports via a one-command diagnostics dump, and machine-parsable commit history (Conventional Commits) for changelog/version automation.
- **Python-specific assumptions**: References to Python version, `uv`, `ruff`, `uv pip list`; Sphinx-flavored docs path `docs/source/tools/cla-assistant.md`; project name "Py Launch Blueprint"; issue-tracker URL points at `smorin/py-launch-blueprint`.
- **TS/Node equivalent**: Same file with tool list swapped to the TS toolchain (Node/package-manager/linter/typechecker versions, e.g. `node`, `pnpm`/`npm`, chosen linter, `tsc`); keep `just debug-info` if the justfile is ported; update project name, repo URLs, and docs paths to the ts-launch-blueprint equivalents; fix or fill the empty Conventional Commits format section.
- **Open questions**: Whether the CLA workflow (docs/cla files + CLA Assistant) is being carried into ts-launch-blueprint at all — links must not dangle; what the ported `debug-info` recipe will report (depends on final TS tool selection); whether to fill in the truncated Conventional Commits format block (recommended — appears to be an upstream omission).
- **Validation strategy**: Link check (all relative links resolve in the new repo); run the ported `just debug-info` and confirm the described behavior matches; GitHub Community Standards page detects CONTRIBUTING.
- **Status**: Indexed

### `.github/FUNDING.yml`
- **Target path**: `.github/FUNDING.yml`
- **Port category**: Copy as-is
- **Purpose**: Enables GitHub's "Sponsor" button on the repository.
- **Features/capabilities**: Single funding platform entry `github: smorin`; 18-line MIT-style license header comment at the top.
- **Best-practice intent**: Sustainable open source — makes sponsorship discoverable with zero maintenance cost; license header shows the template's habit of stamping provenance even on config files.
- **Python-specific assumptions**: none
- **TS/Node equivalent**: Identical file; same owner (`smorin`) unless the new repo has a different sponsor target.
- **Open questions**: none
- **Validation strategy**: Confirm the Sponsor button renders on the ts-launch-blueprint repo page.
- **Status**: Indexed

### `.github/ISSUE_TEMPLATE/01-feature-request.yml`
- **Target path**: `.github/ISSUE_TEMPLATE/01-feature-request.yml`
- **Port category**: Copy then modify
- **Purpose**: GitHub issue form for feature requests with structured triage metadata and built-in acceptance criteria.
- **Features/capabilities**: Auto title prefix `[FEATURE]: `; auto labels `enhancement`, `feature-request`; required dropdowns for feature type (new/enhancement/perf/UI-UX), priority (Critical→Low), requires-proposal (yes/no), research-needed (yes/no); required textareas for problem statement and proposed solution (with "TBD" convention for research items); optional research-details textarea; markdown block listing acceptance criteria — testing added to pre-commit hook, testing added to CI/CD in GitHub Actions, docs added/updated **in Sphinx**, unit-test coverage, command added if necessary, cross-platform accessibility, graceful error handling; required yes/no confirmation dropdowns for acceptance criteria and a pre-submission checklist (self-review, **CLA signed**, docs planned, feasibility considered, duplicates checked, stakeholders identified); MIT license header comment.
- **Best-practice intent**: Forces requesters to think through problem vs. solution, triage priority, and definition-of-done before an issue lands; uses confirmation dropdowns (required) rather than optional checkboxes so submitters must actively acknowledge the quality bar.
- **Python-specific assumptions**: Acceptance criterion "Documentation is added and updated into the documentation in Sphinx"; CLA checklist item ties to the repo's CLA setup.
- **TS/Node equivalent**: Same issue-form YAML (GitHub-native, language-agnostic) with "Sphinx" replaced by the TS docs tool chosen for the port; keep pre-commit/CI criteria wording aligned with the ported hook/CI stack; keep or drop the CLA line to match the CONTRIBUTING.md decision.
- **Open questions**: Name of the docs tool replacing Sphinx (deferred to the research phase — TypeDoc/Docusaurus/Starlight are candidates but selection is out of scope here).
- **Validation strategy**: YAML lint; open a draft issue on GitHub and confirm the form renders with all fields, labels, and required validations.
- **Status**: Indexed

### `.github/ISSUE_TEMPLATE/02-documentation-request.yml`
- **Target path**: `.github/ISSUE_TEMPLATE/02-documentation-request.yml`
- **Port category**: Copy as-is
- **Purpose**: GitHub issue form for requesting new documentation or improvements to existing docs.
- **Features/capabilities**: Auto title prefix `[DOCS]: `; auto label `documentation`; required dropdown for doc-request type (new / update existing / fix errors-typos / reorganize structure); optional input for current doc location; required textareas for description of need and suggested content/outline; required contribution-willingness dropdown with optional contact-info input; pre-submission checklist markdown (searched duplicates, checked docs don't exist, provided clear details, understands volunteer-maintained) with required yes/no confirmation dropdown; MIT license header comment.
- **Best-practice intent**: Treats documentation as a first-class contribution surface with its own structured intake, and recruits contributors by asking about willingness to help write the docs.
- **Python-specific assumptions**: none (no toolchain or language references in the form body)
- **TS/Node equivalent**: Identical file; GitHub issue forms are ecosystem-agnostic.
- **Open questions**: none
- **Validation strategy**: YAML lint; open a draft issue on GitHub and confirm rendering and required-field validation.
- **Status**: Indexed

### `.github/ISSUE_TEMPLATE/03-bug-report.yml`
- **Target path**: `.github/ISSUE_TEMPLATE/03-bug-report.yml`
- **Port category**: Copy then modify
- **Purpose**: GitHub issue form for structured, reproducible bug reports.
- **Features/capabilities**: Auto title prefix `[BUG]: `; auto labels `bug`, `needs-triage`; required dropdowns for severity (breaking vs. quality issue) and priority (Critical→Low); required textareas for steps-to-reproduce (placeholder shows `pip install ...`), expected behavior, actual behavior; system-info section instructing `just debug-info` (placeholder shows sample output: OS/kernel/arch plus versions of `python`, `uv`, `ruff`, `git`, `just`); optional screenshots, logs (rendered as `shell`), and possible-solution textareas; required contribution-willingness dropdown (would you PR a fix); pre-submission checklist (duplicates checked, repro info included, exact versions, tested on latest) with required confirmation dropdown; MIT license header comment.
- **Best-practice intent**: Maximizes bug-report signal for volunteer maintainers — severity/priority triage at intake, mandatory repro steps, and one-command environment capture so "works on my machine" gaps are diagnosable.
- **Python-specific assumptions**: `pip install` in the repro placeholder; instruction to provide "Python version" as manual fallback; sample debug output lists `python`, `uv`, `ruff` versions.
- **TS/Node equivalent**: Same issue-form YAML with placeholders rewritten for the TS stack (`npm install`/`pnpm add`, Node version, versions of the chosen package manager/linter/`tsc`/`just`); depends on the ported `just debug-info` recipe emitting the equivalent report.
- **Open questions**: Final tool names in the sample debug-info output block (depends on toolchain selection in the research phase).
- **Validation strategy**: YAML lint; render the form on GitHub; cross-check that placeholder sample output matches what the ported `just debug-info` actually prints.
- **Status**: Indexed

### `.github/ISSUE_TEMPLATE/config.yml`
- **Target path**: `.github/ISSUE_TEMPLATE/config.yml`
- **Port category**: Copy then modify
- **Purpose**: Issue-template chooser configuration — disables blank issues and routes support questions to community channels.
- **Features/capabilities**: `blank_issues_enabled: false` (forces use of the structured templates); two `contact_links`: "GitHub Community Support" → `https://github.com/smorin/py-launch-blueprint/discussions` and "Open Source Discord Community" → `https://discord.gg/3zh8JyV6fU`; MIT license header comment.
- **Best-practice intent**: Keeps the issue tracker high-signal by blocking free-form issues and redirecting Q&A to Discussions/Discord.
- **Python-specific assumptions**: none in mechanism, but the Discussions URL is hardcoded to the `py-launch-blueprint` repo.
- **TS/Node equivalent**: Identical file with the Discussions URL updated to `smorin/ts-launch-blueprint` (requires enabling Discussions on the new repo); Discord invite likely reused as-is.
- **Open questions**: Will GitHub Discussions be enabled on ts-launch-blueprint, and does the same Discord invite serve both templates?
- **Validation strategy**: Open the "New issue" chooser on GitHub — blank-issue option absent, both contact links present and resolving (no 404s).
- **Status**: Indexed

### `.github/SECURITY.md`
- **Target path**: `.github/SECURITY.md`
- **Port category**: Copy then modify
- **Purpose**: Security policy — supported versions, security controls in place, vulnerability reporting process, and best practices for contributors and users.
- **Features/capabilities**: Supported-versions table (1.0.x supported, <1.0 not); controls list: GitHub CodeQL scanning, Dependabot alerts/updates, protected main branch, required code reviews, dependency audits, SAST+SCA scanning; reporting flow via GitHub private vulnerability reporting with 48-hour initial-response SLA and a 5-step process (acknowledge → investigate → fix → advisory → disclosure); contributor practices (secure dependency versions, input validation, OWASP, no hardcoded secrets, validated file ops); user practices (update deps, env vars, file permissions, least privilege, 2FA); security measures for authentication (token-based auth, secure token storage, env vars) and data protection (no sensitive data in logs, input sanitization); compliance claims: OWASP Top 10, CWE, NIST.
- **Best-practice intent**: Gives researchers a private, SLA-backed disclosure channel and documents the layered security posture (scanning + branch protection + review) the template expects downstream repos to keep.
- **Python-specific assumptions**: none in the text itself; the controls it references (CodeQL config, Dependabot config) live in sibling files that ARE toolchain-specific and must be ported consistently.
- **TS/Node equivalent**: Same file nearly verbatim — CodeQL supports JS/TS and Dependabot supports npm; adjust the supported-versions table to the TS template's actual versioning, and ensure the referenced controls exist in the ported repo (CodeQL workflow with `javascript-typescript` language, `dependabot.yml` with `npm` ecosystem).
- **Open questions**: Initial supported-version range for ts-launch-blueprint (it starts pre-1.0, so the "1.0.x supported" table is aspirational as-is).
- **Validation strategy**: GitHub Security tab shows the policy; verify private vulnerability reporting is enabled on the repo; cross-check every claimed control against an actually-ported artifact (CodeQL workflow, dependabot.yml, branch protection).
- **Status**: Indexed

### `.github/pull_request_template.md`
- **Target path**: `.github/pull_request_template.md`
- **Port category**: Copy then modify
- **Purpose**: Feature-oriented PR template enforcing branch naming, issue linkage, implementation/testing/docs disclosure, and a definition-of-done checklist.
- **Features/capabilities**: Branch naming convention (`feature/short-description` or `feature/issue-number-description`) with a fill-in for current branch; "Closes #" issue autolink; sections with rich HTML-comment examples for feature description, implementation details (architecture/patterns), changes made, testing performed; pre-commit and test instructions via `just pre-commit-setup`, `just pre-commit-run`, `just test` (note: stray orphaned `-->` on line 73); documentation-updates section referencing Sphinx docs/README/docstrings; breaking-changes section; 10-item checklist: branch naming, testing in pre-commit hook, testing in GitHub Actions CI, docs in **Sphinx**, coverage via **`pytest --cov`**, CLI commands added if applicable, style via **`flake8` or equivalent**, all tests pass locally+CI, self-review done, no debug prints/commented-out code; reviewer-notes section.
- **Best-practice intent**: Makes every PR self-documenting and reviewable — reproducible verification commands, explicit breaking-change disclosure, and a checklist that mirrors the repo's automated quality gates so nothing merges below the bar.
- **Python-specific assumptions**: `pytest --cov` for coverage, `flake8` for style, Sphinx and docstrings for documentation; assumes the `just pre-commit-*` / `just test` recipes exist.
- **TS/Node equivalent**: Same markdown template with the checklist commands swapped for the TS stack (e.g. `vitest --coverage`/`node --test` for coverage, oxlint/chosen linter for style, the chosen TS docs tool instead of Sphinx, TSDoc instead of docstrings); keep the `just`-recipe indirection so the template survives tool swaps; fix the orphaned `-->` while porting. Note `flake8` here is inconsistent with the source repo's own ruff usage — port to the actually-chosen linter, not a literal translation.
- **Open questions**: Final names of the TS test-coverage, lint, and docs commands (pending toolchain research); whether ts-launch-blueprint wants separate PR templates per PR type (this one is explicitly "Feature Pull Request").
- **Validation strategy**: Open a draft PR on GitHub and confirm the template auto-populates; run each command quoted in the checklist against the ported justfile to confirm they exist.
- **Status**: Indexed

## Group: github-workflows

# Index fragment: github-workflows

Source repo: /Users/stevemorin/c/py-launch-blueprint @ 4828f8596b2332d74fbcff932ebab6f0030febd5

### `.github/workflows/changelog.yml`
- **Target path**: .github/workflows/changelog.yml
- **Port category**: Needs research
- **Purpose**: Intended to generate a changelog automatically on pushes/PRs to main; currently a stub.
- **Features/capabilities**: MIT license header comment; triggers on `push` to main, `pull_request` to main, and `workflow_dispatch`; explicit `permissions: contents: write` (commented "for better security"); single job `generate-changelog` on ubuntu-latest whose only step is `actions/checkout@v4` with `fetch-depth: 0` (full history, needed for changelog generation). No actual changelog-generation step exists — the workflow is incomplete in the source repo.
- **Best-practice intent**: Automated, history-derived changelog maintenance with least-privilege explicit permissions and full-history checkout.
- **Python-specific assumptions**: none (the workflow body is language-agnostic; no Python tooling appears).
- **TS/Node equivalent**: Same GitHub Actions workflow shape; the generation tool is unchosen. Candidates: Changesets (`@changesets/action`), `git-cliff`, `conventional-changelog`/`release-please`. Choice interacts with release.yml versioning strategy.
- **Open questions**: The source workflow has no generation step — was a tool ever wired in, or should the TS port design changelog generation from scratch? Should changelog generation be merged into the release workflow (e.g., Changesets handles both)?
- **Validation strategy**: Trigger via `workflow_dispatch` on a test branch/repo and confirm a CHANGELOG is produced/updated; `actionlint` for workflow syntax.
- **Status**: Needs research

### `.github/workflows/ci.yaml`
- **Target path**: .github/workflows/ci.yaml
- **Port category**: Translate to TypeScript equivalent
- **Purpose**: Main CI pipeline: type checking, linting, TOML format checking, and pre-commit hook verification on pushes/PRs to main.
- **Features/capabilities**: Triggers on push/PR to main. Job `test` (named `continuous-integration`) on ubuntu-latest with a Python version matrix ["3.10", "3.11"]. Steps: `actions/checkout@v4`; `astral-sh/setup-uv@v5`; `actions/setup-python@v5` (matrix version); `extractions/setup-just@v2` (installs `just`); `uv venv .venv` + `uv sync --all-extras --dev` and appends `.venv/bin` to `GITHUB_PATH`; `just install-taplo`; `uvx mypy py_launch_blueprint/` (type check); `uvx ruff check py_launch_blueprint/` (lint); `taplo check '**/*.toml'` (TOML format check); `just pre-commit-setup` + `just pre-commit-run` (runs the full pre-commit suite in CI). Commented-out blocks: codecov upload, a Safety CLI security job (disabled pending pyup.io support, gated to same-repo PRs), and a PyPI publish job using twine (reference only). Notably no explicit test-runner step (pytest is presumably covered via pre-commit or intentionally absent).
- **Best-practice intent**: Every PR must pass type check, lint, config-format check, and the same pre-commit hooks developers run locally (CI/local parity via `just` recipes); multi-runtime-version matrix testing.
- **Python-specific assumptions**: Python version matrix, uv/uvx, setup-python, mypy, ruff, pre-commit (Python tool), package dir `py_launch_blueprint/`, commented pyupio/safety and PyPI/twine references.
- **TS/Node equivalent**: Same workflow shape with `actions/setup-node` and a Node version matrix (e.g., 20.x/22.x); package-manager install with lockfile caching; typecheck via `tsc --noEmit`; lint via the chosen linter (goal.md indicates oxc/Oxlint direction); keep `just` recipes as the CI/local parity layer and keep taplo if TOML configs survive the port; git-hook parity step via the chosen hook manager (husky/lefthook/pre-commit — TBD in tool-selection phase).
- **Open questions**: Package manager (npm/pnpm/bun) and Node matrix versions; final linter/typechecker/test-runner picks; whether a test-execution step should be added (the Python CI oddly lacks one); whether taplo remains relevant in a TS repo.
- **Validation strategy**: `actionlint` on the workflow; open a test PR in the TS repo and confirm all jobs run and fail correctly when a lint/type error is introduced; confirm CI steps invoke the same `just` recipes available locally.
- **Status**: Indexed

### `.github/workflows/codeql.yml`
- **Target path**: .github/workflows/codeql.yml
- **Port category**: Copy then modify
- **Purpose**: GitHub CodeQL static-analysis security scanning of the codebase.
- **Features/capabilities**: Triggers on push/PR to main plus weekly cron (`44 21 * * 4`). Job `analyze` with per-language matrix — currently one entry: `language: python`, `build-mode: none`. Runner selection expression falls back to macos-latest only for swift. Least-privilege permissions: `security-events: write`, `packages: read`, `actions: read`, `contents: read`. `fail-fast: false`. Steps: checkout@v4, `github/codeql-action/init@v3` (with commented custom-queries hooks), a manual-build fallback step gated on `build-mode == 'manual'` (exits 1 with instructions), `github/codeql-action/analyze@v3` with `category: /language:${{matrix.language}}`. Extensive stock comments about supported languages and runner sizing.
- **Best-practice intent**: Continuous + scheduled security scanning with results in the GitHub Security tab; explicit minimal permissions; extensible language matrix.
- **Python-specific assumptions**: Only the matrix entry `language: python` (file comments explicitly list `javascript-typescript` as the alternative).
- **TS/Node equivalent**: Identical file with the matrix entry changed to `language: javascript-typescript`, `build-mode: none`. No tool substitution needed — CodeQL natively supports TS.
- **Open questions**: none
- **Validation strategy**: Push to the TS repo and confirm the CodeQL run completes and results appear under Security > Code scanning; `actionlint` for syntax.
- **Status**: Indexed

### `.github/workflows/dependency-review.yml`
- **Target path**: .github/workflows/dependency-review.yml
- **Port category**: Copy as-is
- **Purpose**: Blocks/flags PRs that introduce known-vulnerable dependencies by scanning manifest changes.
- **Features/capabilities**: Triggers on `pull_request` to main. Permissions: `contents: read`, `pull-requests: write` (the latter needed for `comment-summary-in-pr`). Single job runs checkout@v4 then `actions/dependency-review-action@v4` with `comment-summary-in-pr: always`; commented-out options for `fail-on-severity: moderate`, `deny-licenses`, and `retry-on-snapshot-warnings`. Header comments note it can block merges if marked as a required check.
- **Best-practice intent**: Supply-chain security gate on every PR with visible-in-PR results; least-privilege permissions.
- **Python-specific assumptions**: none — the action reads GitHub's dependency graph and supports npm/yarn/pnpm lockfiles natively.
- **TS/Node equivalent**: The exact same file; it works unchanged once the TS repo has a lockfile the dependency graph understands. Optionally enable `fail-on-severity` in the port.
- **Open questions**: none
- **Validation strategy**: Open a test PR adding a package with a known advisory and confirm the action comments/flags it; confirm the summary comment appears on a benign dependency PR.
- **Status**: Indexed

### `.github/workflows/manual-pr-security-scan.yml`
- **Target path**: .github/workflows/manual-pr-security-scan.yml
- **Port category**: Needs research
- **Purpose**: On-demand, human-initiated security scan of a specific PR, with results posted back as a PR comment attributed to a named reviewer.
- **Features/capabilities**: `workflow_dispatch` with required inputs `pr_number` and `reviewer`. Job uses a GitHub `environment: security-review` (enables environment protection rules/required approvers and scoped secrets). Checks out `refs/pull/<pr_number>/head`. Runs `pyupio/safety-action@v1` with `api-key: ${{ secrets.SAFETY_API_KEY }}` and `--detailed-output`. Then `actions/github-script@v7` builds a "Security Review Results" markdown checklist (reviewer mention, PASS/FAIL from exit code, fenced CLI output) and posts it via `github.rest.issues.createComment`. Latent bug in source: the Safety step has no `id: safety`, so `steps.safety.outputs.cli-output`/`exit-code` resolve empty — the comment logic never receives real scan output.
- **Best-practice intent**: Auditable, manually-gated security review workflow: protected environment, named reviewer accountability, scan results recorded on the PR itself.
- **Python-specific assumptions**: `pyupio/safety-action` scans Python dependencies and requires a Safety (pyup.io) API key.
- **TS/Node equivalent**: Keep the dispatch-inputs + environment + comment-back skeleton; replace the scanner. Candidates: `npm audit` (built-in, no key), `osv-scanner`, Snyk, Socket.dev — selection deferred to the research phase. Fix the missing step `id` so outputs actually flow into the comment.
- **Open questions**: Which Node vulnerability scanner (and whether an API key/secret is acceptable for a template repo); whether this workflow is still needed given dependency-review.yml + CodeQL cover overlapping ground; carry forward or drop the `security-review` environment requirement (needs repo settings, not just the file).
- **Validation strategy**: Dispatch the workflow against a test PR containing a known-vulnerable dependency; verify the scan runs, the PASS/FAIL status is correct, and the comment contains real scanner output (regression test for the missing-`id` bug).
- **Status**: Needs research

### `.github/workflows/release.yml`
- **Target path**: .github/workflows/release.yml
- **Port category**: Translate to TypeScript equivalent
- **Purpose**: Tag-driven release pipeline: build the package and verify the git tag version matches the package's declared version.
- **Features/capabilities**: Triggers on push of tags matching `v*`. Job `publish` on ubuntu-latest: checkout@v4 with `fetch-depth: 0`; `astral-sh/setup-uv@v5`; setup-python 3.10; `uv venv`; `uv pip install hatch build`; `uv run hatch build`; then a guard script that strips `refs/tags/v` to get TAG_VERSION, reads `py_launch_blueprint.__version__` via `uv run python -c ...`, and exits 1 on mismatch ("Version mismatch: Tag X vs Package Y"). Despite the job name `publish`, there is NO publish/upload step — it only builds and verifies (actual PyPI publish is the commented-out block in ci.yaml).
- **Best-practice intent**: Releases are immutable tag-driven events; the tag must agree with the source-of-truth version so artifacts can never carry a mismatched version.
- **Python-specific assumptions**: uv, hatch, setup-python, importing `py_launch_blueprint.__version__` as the version source of truth.
- **TS/Node equivalent**: Same tag-triggered workflow with setup-node; build via the chosen bundler/`npm pack`; version guard becomes comparing the tag against `node -p "require('./package.json').version"`. If Changesets/release-please is adopted (see changelog.yml), this workflow may merge into that flow. Publishing (npm registry, provenance/OIDC) remains opt-in, mirroring the Python repo's choice not to publish.
- **Open questions**: Whether the TS template should actually publish to npm (with `--provenance`) or keep build+verify only; interaction with the changelog/release tooling decision.
- **Validation strategy**: Push a `v*` tag matching package.json and confirm success; push a deliberately mismatched tag and confirm the job fails with the mismatch message.
- **Status**: Indexed

### `.github/workflows/update-contributors.yml`
- **Target path**: .github/workflows/update-contributors.yml
- **Port category**: Translate to TypeScript equivalent
- **Purpose**: Keeps CONTRIBUTORS.md current by regenerating it from git history and opening an automated PR with the changes.
- **Features/capabilities**: Triggers on push/PR to main and `workflow_dispatch`. Permissions: `contents: write`, `pull-requests: write`. Steps: `actions/checkout@v3` with `fetch-depth: 0` and `ref: main`; `actions/setup-python@v4` (3.10); runs `python scripts/update_contributors.py`; a shell step that fetches and checks out/creates an `update-contributors` branch (creating it remotely if absent, with explanatory comments); commits CONTRIBUTORS.md as `github-actions[bot]` only if `git status --porcelain` shows changes; `peter-evans/create-pull-request@v5` opens/updates a PR (`chore: update contributors list`, branch `update-contributors`, base main, `delete-branch: true`). Uses older action majors (checkout@v3, setup-python@v4, create-pull-request@v5) than sibling workflows.
- **Best-practice intent**: Contributor attribution is automated and auditable — changes land via a bot PR rather than direct pushes to main.
- **Python-specific assumptions**: Python runtime setup and `scripts/update_contributors.py` (Python is only the scripting language here; the logic is git-log driven).
- **TS/Node equivalent**: Same workflow with setup-node running the ported script (e.g., `node scripts/update-contributors.mjs` or a tsx-run TS script — path must match wherever the script lands in the scripts-group port); `peter-evans/create-pull-request` is language-agnostic and stays. Bump action versions to current majors while porting.
- **Open questions**: Ported script's final path/runner (couples to the scripts group's indexing); whether running on `pull_request` (not just push/dispatch) is intended — on PRs it would attempt branch pushes with the PR's ref semantics and fails on forks; the manual branch checkout/push step partially duplicates what create-pull-request handles itself and may be simplifiable.
- **Validation strategy**: `workflow_dispatch` in the TS repo after a commit from a new author; confirm CONTRIBUTORS.md regenerates and a bot PR appears on branch `update-contributors`; confirm no PR is opened when there are no changes.
- **Status**: Indexed

## Group: root-configs

# Index fragment: root-configs

Source repo: /Users/stevemorin/c/py-launch-blueprint @ 4828f8596b2332d74fbcff932ebab6f0030febd5

### `.gitignore`
- **Target path**: `.gitignore`
- **Port category**: Copy then modify
- **Purpose**: Excludes generated artifacts, caches, virtual environments, and secrets from version control.
- **Features/capabilities**: Ignores Python bytecode (`__pycache__/`, `*.py[oc]`), build outputs (`build/`, `dist/`, `wheels/`, `*.egg-info`), `uv.lock` (listed twice, with a comment "remove if you want to pin versions"), `.coverage`, `docs/build/`, `.DS_Store`, tool caches (`.mypy_cache`, `.pytest_cache`, `.ruff_cache`), `.venv`, and `.env` under a `#secrets` header.
- **Best-practice intent**: Clean working tree — never commit generated files, tool caches, environments, or secrets; the lockfile-ignoring stance is an explicit, documented template decision.
- **Python-specific assumptions**: Nearly all entries are Python-toolchain-specific (bytecode, egg-info, uv.lock, .venv, mypy/pytest/ruff caches).
- **TS/Node equivalent**: A `.gitignore` with Node equivalents: `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`, tool caches (e.g. `.eslintcache`/`.oxlint` cache dirs as applicable), `.env`, `.DS_Store`; decide the analogous lockfile policy (`package-lock.json`/`pnpm-lock.yaml`) and document it the same way.
- **Open questions**: Whether the TS template keeps the "ignore the lockfile" stance (Node convention is usually to commit lockfiles); exact cache entries depend on final tool choices.
- **Validation strategy**: `git status` after a full install + build + test + docs run shows a clean tree; `git check-ignore` spot-checks for `node_modules`, build output, and `.env`.
- **Status**: Indexed

### `.gitlint`
- **Target path**: n/a (replaced; likely `commitlint.config.*` or equivalent)
- **Port category**: Replace with TypeScript/Node ecosystem equivalent
- **Purpose**: Configures gitlint to enforce commit-message hygiene and Conventional Commits.
- **Features/capabilities**: Enables the `contrib-title-conventional-commits` rule; title max length 50; body max line length 72; allowed types restricted to `feat,fix,docs,style,refactor,test,chore,ci,build,perf`.
- **Best-practice intent**: Machine-enforced Conventional Commits with the classic 50/72 formatting discipline, feeding automated changelog generation (see `cog.toml`).
- **Python-specific assumptions**: gitlint itself is a Python package (installed via pip/uv).
- **TS/Node equivalent**: commitlint with `@commitlint/config-conventional` (config file + hook integration via the chosen git-hook manager); must replicate the same allowed-type list and 50/72 length rules.
- **Open questions**: Whether commit-lint enforcement runs via husky/lefthook/pre-commit and/or CI — depends on the hook-manager decision (see `.pre-commit-config.yaml`).
- **Validation strategy**: Feed known-good and known-bad commit messages (wrong type, >50-char title, >72-char body line) to the linter and assert pass/fail matches the Python repo's behavior.
- **Status**: Indexed

### `.gitmessage`
- **Target path**: `.gitmessage`
- **Port category**: Copy as-is
- **Purpose**: Git commit-message template (used via `git config commit.template`) guiding contributors toward the expected format.
- **Features/capabilities**: `<type>: <description>` skeleton with a 50-character ruler comment; lists types `feat, fix, docs, style, refactor, test, chore`; examples (`feat: add user authentication`, `fix(auth): resolve login timeout issue`); rules: blank line between subject and body, 50-char subject, capitalize, no trailing period, imperative mood, wrap body at 72.
- **Best-practice intent**: Human-facing guidance mirroring the machine-enforced rules, so contributors see the convention at commit time.
- **Python-specific assumptions**: none
- **TS/Node equivalent**: Same file, unchanged; optionally reconcile its type list with the fuller list in `.gitlint`/commitlint (this file omits `ci`, `build`, `perf`).
- **Open questions**: Whether to sync the type list with the enforcement config while porting (a pre-existing inconsistency in the source repo).
- **Validation strategy**: `git config commit.template .gitmessage` then `git commit` shows the template; manual inspection.
- **Status**: Indexed

### `.pre-commit-config.yaml`
- **Target path**: Needs research (candidates: keep `.pre-commit-config.yaml`, or `lefthook.yml`, or husky + lint-staged config)
- **Port category**: Needs research
- **Purpose**: Defines the pre-commit hook pipeline that gates every commit on type checks, hygiene checks, lint/format, and the test suite. Carries an MIT license header and extensive inline documentation of exclusion patterns.
- **Features/capabilities**: Hooks: mypy (v1.15.0, with `types-requests`, `types-PyYAML`, `types-python-dateutil`, `click`, `types-click` as additional deps); pre-commit-hooks v5.0.0 (`check-yaml`, `end-of-file-fixer` excluding the generated `_version.py`, `trailing-whitespace`, `check-toml`, `check-added-large-files`); ruff v0.11.11 (`ruff check --fix --force-exclude --no-cache` and `ruff format`); google/yamlfmt v0.13.0 (`-conf .yamlfmt`); local taplo hook (`taplo format --config .taplo.toml` on `*.toml`); local pytest hook running the full test suite on pre-commit (`pass_filenames: false`, `stages: [pre-commit]`). Long comment block documenting global vs hook-level vs directory exclusion patterns.
- **Best-practice intent**: Nothing lands in history that fails type check, lint, format, file-hygiene, or tests — the full quality gate runs locally before commit, with generated files explicitly excluded.
- **Python-specific assumptions**: The pre-commit framework itself is Python; hook contents are mypy/ruff/pytest; exclusions reference `py_launch_blueprint/_version.py`; `types_or: [cython, pyi, python]`.
- **TS/Node equivalent**: Hook contents map cleanly (mypy→`tsc --noEmit`; ruff check/format→oxlint/Biome/ESLint+Prettier per later tool research; pytest→vitest/node test runner; check-yaml/toml/eof/whitespace/large-files have prettier- or pre-commit-hooks-based equivalents). The hook *manager* is the open choice: pre-commit works fine in Node repos, but husky+lint-staged and lefthook are the native idioms.
- **Open questions**: Which hook manager (pre-commit vs husky+lint-staged vs lefthook); whether running the full test suite on every commit is kept (cost/benefit in Node); which lint/format tools the research phase selects; equivalent of the generated-version-file exclusion.
- **Validation strategy**: Install hooks in a fresh clone, attempt commits with a type error, a lint violation, an unformatted file, and a failing test — each must be blocked; a clean commit must pass.
- **Status**: Needs research

### `.python-version`
- **Target path**: `.nvmrc` or `.node-version` (plus `engines` in `package.json`)
- **Port category**: Replace with TypeScript/Node ecosystem equivalent
- **Purpose**: Pins the project's Python interpreter version for pyenv/uv.
- **Features/capabilities**: Single line: `3.10` (matches `requires-python >=3.10`, mypy `python_version`, pyright `pythonVersion`, and ruff `target-version = "py310"` — the version is asserted consistently in five places).
- **Best-practice intent**: One authoritative runtime-version pin so every developer and CI job uses the same interpreter floor.
- **Python-specific assumptions**: Entirely — the file format is read by pyenv/uv.
- **TS/Node equivalent**: `.nvmrc` / `.node-version` for version managers, `"engines": { "node": ">=X" }` in `package.json`, and matching `target`/`lib` in `tsconfig.json` — preserving the source repo's discipline of keeping all version declarations consistent.
- **Open questions**: Which Node version to pin and which pin-file convention (nvm vs fnm vs volta) — a later research/decision item, though the pattern itself is settled.
- **Validation strategy**: Version manager auto-selects the pinned Node in a fresh shell; `npm install` fails (or warns per config) on an out-of-range Node via `engines`; CI uses the same version.
- **Status**: Indexed

### `.readthedocs.yaml`
- **Target path**: Needs research (may be n/a if docs move off Read the Docs)
- **Port category**: Needs research
- **Purpose**: Read the Docs build configuration for hosted documentation. Carries an MIT license header.
- **Features/capabilities**: Config `version: 2`; build on `ubuntu-22.04` with Python 3.10; `post_create_environment` job installs uv and prints its version; Sphinx build from `docs/source/conf.py`; installs the package with the `docs` extra via pip; output formats `pdf`, `epub`, `htmlzip`.
- **Best-practice intent**: Reproducible, hosted, versioned documentation builds with multiple downloadable formats, built from the same repo on every push.
- **Python-specific assumptions**: Sphinx toolchain, pip/uv install, Python `docs` extra, `conf.py` — the entire docs stack is Python.
- **TS/Node equivalent**: Unresolved: Read the Docs does support Node-based builds via `build.commands`, but the idiomatic TS choices are TypeDoc, Docusaurus, VitePress, or Starlight, typically deployed to GitHub Pages/Netlify/Vercel. The docs-platform decision drives whether any `.readthedocs.yaml` exists at all.
- **Open questions**: Docs generator and hosting platform for the TS template; whether pdf/epub outputs are a requirement worth preserving; fate of the whole `docs/` toolchain (owned by another index group).
- **Validation strategy**: Once the platform is chosen: a clean docs build from a fresh clone succeeds locally and on the hosting service; published site renders the ported content.
- **Status**: Needs research

### `.taplo.toml`
- **Target path**: Needs research (`.taplo.toml` if TOML files survive the port; otherwise omitted)
- **Port category**: Needs research
- **Purpose**: Taplo TOML-formatter configuration so all TOML files have one canonical style. Carries an MIT license header.
- **Features/capabilities**: `[formatting]`: `respect-ignores = true`, `line-width = 80`, `indent-width = 4`, `align-entries = true`, `align-comments = true`, `array-auto-expand = true`, `array-auto-collapse = false`, `compact-arrays = false`, `compact-inline-tables = false`, `newline-style = "LF"`. Wired into pre-commit as a local `taplo format` hook.
- **Best-practice intent**: Every config-file format in the repo is machine-formatted — no bikeshedding, no drift, LF-only line endings.
- **Python-specific assumptions**: None in the tool (taplo is a Rust binary), but its raison d'être here is `pyproject.toml`, which will not exist in the TS repo.
- **TS/Node equivalent**: Keep `.taplo.toml` only if the TS repo retains TOML files (e.g. `cog.toml` if cocogitto is carried over, `lefthook`-adjacent configs, Rust-tool configs like `oxlint`'s if TOML-based); otherwise the intent transfers to formatting whatever config formats remain (JSON via Prettier/Biome, YAML via yamlfmt/Prettier).
- **Open questions**: Whether any TOML files exist in the final TS repo — fully dependent on the release-tooling and linter decisions made in the research phase.
- **Validation strategy**: If kept: `taplo format --check --config .taplo.toml` passes in CI/hooks on all tracked TOML files. If omitted: confirm no `*.toml` files are tracked.
- **Status**: Needs research

### `.yamlfmt`
- **Target path**: `.yamlfmt`
- **Port category**: Copy then modify
- **Purpose**: Configuration for google/yamlfmt, the YAML formatter used by the pre-commit hook.
- **Features/capabilities**: Basic formatter, 2-space indent, no `---` document start, LF line endings, `retain_line_breaks_single: true`, `indentless_arrays: true`, trim trailing whitespace, `pad_line_comments: 2`, `max_width: 160` (comment says to match yamllint config); path includes `**/*.yml|yaml`; excludes `.venv/**`, `node_modules/**`, `.git/**`, `__pycache__/**`, `*.egg-info/**`, `dist/**`, `build/**` (note: already excludes `node_modules`).
- **Best-practice intent**: Deterministic formatting for YAML (CI workflows, tool configs) with a documented width limit shared with linting.
- **Python-specific assumptions**: Only the exclude globs (`.venv`, `__pycache__`, `*.egg-info`); yamlfmt itself is a Go binary, language-agnostic.
- **TS/Node equivalent**: Same file with Python-specific excludes dropped and Node ones kept/added (`node_modules/**`, `coverage/**`, `dist/**`). Alternative: consolidate YAML formatting under Prettier if the research phase picks it for other formats — one open trade-off, not a blocker for a direct port.
- **Open questions**: Whether the TS template consolidates YAML formatting into its main formatter (Prettier) instead of a dedicated yamlfmt binary; whether a yamllint counterpart is carried over (referenced by comment but not present in this group).
- **Validation strategy**: `yamlfmt -conf .yamlfmt -lint` (dry-run) passes on all tracked YAML in CI/hooks; formatting a deliberately mangled workflow file produces the expected canonical output.
- **Status**: Indexed

### `cog.toml`
- **Target path**: `cog.toml`
- **Port category**: Copy then modify
- **Purpose**: Cocogitto (cog) configuration for Conventional-Commits-driven changelog generation and contributor listing. Carries an MIT license header.
- **Features/capabilities**: `[changelog]`: repository `https://github.com/smorin/py-launch-blueprint`, `template = "conventional"`, `remote = "origin"`, output `CHANGELOG.md`; `[changelog.sections]` mapping types to sections (features/fixes/performance/documentation/testing/maintenance); `[changelog.git]`: `conventional_commits = true`, `filter_unconventional = true`, commit parsers grouping `feat|fix|docs|perf|refactor|test|chore` and skipping `chore(release): prepare for` commits; `[contributors]`: markdown format, sort by commits, show stats, exclude `noreply.github.com` domain.
- **Best-practice intent**: Fully automated, convention-driven CHANGELOG and release notes — commits are the single source of truth for release history.
- **Python-specific assumptions**: None in the tool (cocogitto is a Rust binary); only the repository URL and its coupling to the repo's git-tag-based versioning scheme (hatch-vcs in `pyproject.toml`).
- **TS/Node equivalent**: Keep cocogitto with the repository URL updated to ts-launch-blueprint (minimal change), or switch to a Node-native release stack (changesets, release-please, semantic-release) — the versioning/release-tooling decision in the research phase should confirm which; the section mapping and skip rules must be preserved either way.
- **Open questions**: Whether release automation stays on cocogitto or moves to a Node-native tool — coupled to how the TS repo derives versions (source repo derives from git tags via hatch-vcs).
- **Validation strategy**: Generate a changelog against a small synthetic commit history containing each type plus an unconventional commit and a `chore(release)` commit; assert grouping, filtering, and skip behavior match the source config.
- **Status**: Indexed

### `pyproject.toml`
- **Target path**: Split across `package.json`, `tsconfig.json`, linter config (tool TBD), test-runner config, and build config
- **Port category**: Split into multiple files
- **Purpose**: The central Python project manifest: metadata, dependencies, entry point, build system, dynamic versioning, and embedded config for ruff, pytest, mypy, and hatch. Carries an MIT license header.
- **Features/capabilities**: `[project]`: name `py_launch_blueprint`, dynamic version, description ("CLI tools... project search"), README, `requires-python >=3.10`, MIT license, author; runtime deps: `click`, `questionary`, `python-dotenv`, `thefuzz` + `python-Levenshtein`, `pyperclip`, `requests`, `rich`. Optional-dependency groups: `dev` (pytest, pytest-cov, mypy, ruff, pre-commit, type stubs, cogapp) and `docs` (sphinx, furo, myst-parser, sphinx-autodoc-typehints, sphinx-copybutton, sphinx-autobuild, sphinxext-opengraph, cogapp). Console script `py-projects = py_launch_blueprint.projects:main`. Build: hatchling + hatch-vcs (+setuptools-scm), version written to `py_launch_blueprint/_version.py`, fallback `0.0.1`, `no-local-version` scheme; wheel/sdist target contents. `[tool.ruff]`: target py310, line length 88, rule sets E,F,I,B,C4,UP,N,RUF,W,YTT,S (incl. bandit security rules), autofix on, excludes for generated/vendored paths, per-file ignores (`F401` in `__init__.py`; `S101/S105/S106` in tests, with explanatory comments). `[tool.pytest.ini_options]`: testpaths `tests`, `test_*.py`. `[tool.mypy]`: strict mode plus every disallow-*/warn-* flag enabled, pretty errors with codes and columns, override relaxing `disallow_untyped_defs` for `tests.*`.
- **Best-practice intent**: Single-source project definition; strict typing everywhere (relaxed only for tests); security-aware linting; git-tag-derived versions (never hand-edited); explicit separation of runtime vs dev vs docs dependencies; a packaged CLI entry point.
- **Python-specific assumptions**: Everything — PEP 621 metadata, Python dep ecosystem, hatch/setuptools-scm build backend, ruff/mypy/pytest config.
- **TS/Node equivalent**: `package.json` (name, description, license, author, `bin` for the CLI entry point, deps/devDeps mirroring the dev/docs split, `engines`); `tsconfig.json` (`strict: true` plus extras like `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`, `exactOptionalPropertyTypes` to match the mypy/pyright bar); linter config for the ruff rule intent incl. security rules (tool TBD in research phase — repo notes mention oxc/Oxlint); test-runner config (vitest/node:test, TBD); build/bundler config (tsup/tsc, TBD); versioning-from-git story (TBD, coupled to `cog.toml`). Runtime dep intents map to: click→commander/clipanion/yargs, questionary→prompts/@inquirer, python-dotenv→dotenv, thefuzz→fuse.js/fuzzysort, pyperclip→clipboardy, requests→built-in fetch/undici, rich→chalk/picocolors/ink — candidates only; selection is research-phase work.
- **Open questions**: Package manager (npm/pnpm/bun); linter/formatter/test/build tool selection; how to replicate git-tag-driven dynamic versioning in Node; whether a docs dependency group has a meaningful analog; exact per-path lint-relaxation mechanism for tests.
- **Validation strategy**: Fresh-clone `install → typecheck → lint → test → build → run CLI --help` all succeed; the CLI is invocable via the `bin` name; strictness verified by confirming a deliberately untyped/unsafe snippet fails typecheck and lint the same way it does in the Python repo.
- **Status**: Indexed

### `pyrightconfig.json`
- **Target path**: n/a (merged into `tsconfig.json`)
- **Port category**: Merge into another file
- **Purpose**: Pyright (VS Code/Pylance) type-checker configuration — a second, editor-facing strict type checker alongside mypy.
- **Features/capabilities**: Includes `py_launch_blueprint` and `tests`; excludes `node_modules` and `__pycache__`; `defineConstant DEBUG=true`; `typeCheckingMode: "strict"`; `pythonVersion 3.10`; `useLibraryCodeForTypes`; a battery of `report*` diagnostics enabled: missing imports/stubs, all unknown-type reports (parameter/argument/lambda/variable/member), missing type arguments, invalid TypeVar use, unnecessary isinstance/cast/comparison, duplicate imports, `reportPrivateUsage` as warning, unused import/variable/function/class. File is JSON with `//` comments (JSONC).
- **Best-practice intent**: The strictest available static analysis in both CI (mypy) and the editor (pyright) so developers see identical errors live while typing; dead code and unknown types are errors, not warnings.
- **Python-specific assumptions**: Pyright is a Python type checker; every setting targets Python semantics.
- **TS/Node equivalent**: Collapses (together with `[tool.mypy]` from `pyproject.toml`) into a single `tsconfig.json`: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `forceConsistentCasingInFileNames` — in TS the compiler and the editor language service read the same file, so the dual-checker redundancy disappears by design. Unused-code and unnecessary-condition checks beyond tsc's reach map to lint rules.
- **Open questions**: Which unused/unnecessary-code diagnostics belong in `tsconfig` vs the linter (e.g. typescript-eslint's `no-unnecessary-condition` analogs) — depends on linter selection.
- **Validation strategy**: Snippets exercising each ported diagnostic (unused variable, missing return, unchecked index, private-ish usage) fail `tsc --noEmit` or lint as intended; editor (VS Code) shows the same errors live.
- **Status**: Indexed

## Group: editor-ai-configs

# Index fragment: editor-ai-configs

Source repo: /Users/stevemorin/c/py-launch-blueprint @ 4828f8596b2332d74fbcff932ebab6f0030febd5

### `.cursor/rules/doc-template.mdc`
- **Target path**: `.cursor/rules/doc-template.mdc`
- **Port category**: Copy then modify
- **Purpose**: Cursor AI rule that defines the standardized structure every documentation page/rule in the project must follow, scoped to `docs/**/*.md` (`alwaysApply: false`).
- **Features/capabilities**: MDC frontmatter (`description`, `globs: docs/**/*.md`, `alwaysApply: false`); a named rule `doc-template` with a full markdown template containing required sections (Introduction, Purpose and Problem Solved, Getting Started, Usage, Configuration, Testing, Disabling the Feature, References); a `validation` block listing required sections and required elements (practical examples, standalone and integrated testing instructions, configuration options, disabling guidance, links to host docs); a `formatting` block (markdown, `##` headers, bullet lists, `[placeholder text]` markers, project-contextual examples).
- **Best-practice intent**: Every tool/feature doc has a consistent, complete shape — including how to test it and how to disable it — so contributors and AI assistants produce uniform, actionable documentation.
- **Python-specific assumptions**: None in the template structure itself; the instruction "examples are contextual to this project" implies examples will reference the Python toolchain in generated docs.
- **TS/Node equivalent**: Same file format and location — Cursor `.mdc` rules are language-agnostic. Copy verbatim; only ensure generated examples reference the TS toolchain.
- **Open questions**: none
- **Validation strategy**: Open the ts-launch-blueprint repo in Cursor and confirm the rule loads for files under `docs/`; write one sample doc and check the assistant enforces the required sections.
- **Status**: Indexed

### `.cursor/rules/projectenv.mdc`
- **Target path**: `.cursor/rules/projectenv.mdc`
- **Port category**: Copy then modify
- **Purpose**: Always-on Cursor rule (`alwaysApply: true`) that chains to the other AI-assistant config files: it tells Cursor to read `@.windsurfrules` for base project dependencies and `./doc-template.mdc` for documentation, and to use the `doc-template` rule.
- **Features/capabilities**: Three directives: read `@.windsurfrules` for base project dependencies; read `./doc-template.mdc` for base project documentation; use rule `doc-template`. Effectively makes the Windsurf rules file the single source of truth that Cursor also consumes.
- **Best-practice intent**: DRY across AI-assistant configs — one canonical project-conventions document referenced by multiple assistants rather than duplicated per tool.
- **Python-specific assumptions**: None directly, but it transitively pulls in `.windsurfrules`, which is Python-toolchain-heavy.
- **TS/Node equivalent**: Same file; the cross-reference pattern carries over unchanged. If the TS repo renames or restructures `.windsurfrules`, update the `@` reference accordingly.
- **Open questions**: Should the TS repo keep the `.windsurfrules` file as the canonical conventions doc, or promote CLAUDE.md/AGENTS.md to that role with Cursor/Windsurf files pointing at it? (Decision affects only the reference target, not the pattern.)
- **Validation strategy**: Open the repo in Cursor and verify the rule is active on every file and that the referenced files resolve.
- **Status**: Indexed

### `.vscode/extensions.json`
- **Target path**: `.vscode/extensions.json`
- **Port category**: Copy then modify
- **Purpose**: VS Code workspace extension recommendations shown to contributors on first open.
- **Features/capabilities**: 12 recommendations: Python-toolchain (`ms-python.python`, `ms-python.vscode-pylance`, `charliermarsh.ruff`, `matangover.mypy`), config-format helpers (`tamasfe.even-better-toml`, `redhat.vscode-yaml`), git/collaboration (`eamodio.gitlens`, `GitHub.vscode-pull-request-github`, `GitHub.vscode-github-actions`), quality (`streetsidesoftware.code-spell-checker`, `coderabbit.coderabbit-vscode`), and AI (`Anthropic.claude-code`).
- **Best-practice intent**: Zero-friction editor setup — contributors get the linter, type checker, formatter, spell checker, CI, and review tooling surfaced automatically, matching the project's quality gates.
- **Python-specific assumptions**: The four Python extensions (python, pylance, ruff, mypy) are toolchain-bound; even-better-toml serves `pyproject.toml` (still useful in a TS repo only for stray TOML like `taplo`/config files).
- **TS/Node equivalent**: Same file; keep the 8 cross-platform entries (gitlens, spell checker, coderabbit, GitHub PR, GH Actions, YAML, Claude Code, arguably TOML) and swap the Python four for TS equivalents — candidates depend on the chosen toolchain: `oxc.oxc-vscode` (if Oxlint), `dbaeumer.vscode-eslint`, `biomejs.biome`, `esbenp.prettier-vscode`; built-in TS language features may make a Pylance analogue unnecessary.
- **Open questions**: Which lint/format extension to recommend is downstream of the linter/formatter tool selection (oxc/Oxlint vs Biome vs ESLint+Prettier) decided in the research phase.
- **Validation strategy**: Open the TS repo in VS Code and confirm the recommendations prompt lists only extensions that exist on the marketplace and match the final toolchain; no recommendation for a tool the repo does not use.
- **Status**: Indexed

### `.vscode/launch.json`
- **Target path**: `.vscode/launch.json`
- **Port category**: Replace with TypeScript/Node ecosystem equivalent
- **Purpose**: VS Code debugger launch configurations for running the CLI entry point under the debugger.
- **Features/capabilities**: Two `type: "python"` launch configs against `${workspaceFolder}/py_launch_blueprint/projects.py`: a bare launch, and an args variant passing `--workspace test --limit 10`; both use `console: integratedTerminal`.
- **Best-practice intent**: One-keystroke (F5) debugging of the CLI, including a preconfigured realistic-arguments run, so contributors never debug via print statements.
- **Python-specific assumptions**: Entirely — `type: python` debug adapter and a `.py` program path into the `py_launch_blueprint` package.
- **TS/Node equivalent**: `.vscode/launch.json` with `type: "node"` configurations targeting the TS CLI entry (e.g. `src/cli.ts` via `tsx`/`ts-node` `runtimeArgs`, or the built `dist/` output), preserving the pattern of a no-args config plus an args config mirroring the ported CLI's flags. Exact `runtimeExecutable`/source-map settings depend on the chosen runner/build tool.
- **Open questions**: Depends on the TS runtime/loader choice (tsx vs ts-node vs compiled output vs bun) and the ported CLI's actual entry path and flag names.
- **Validation strategy**: In VS Code, run both launch configs with a breakpoint set in the CLI entry module; breakpoint must bind (source maps working) and the args variant must pass its flags through.
- **Status**: Indexed

### `.windsurf/rules/justfile-rules.md`
- **Target path**: `.windsurf/rules/justfile-rules.md`
- **Port category**: Copy then modify
- **Purpose**: Windsurf AI rule, glob-triggered on `Justfile`, enforcing formatting/style conventions when editing Just recipes.
- **Features/capabilities**: Frontmatter `trigger: glob`, `globs: Justfile`. Rules: blank line between recipes; every recipe must belong to an existing `[group(...)]`; every recipe must have a doc comment immediately above it. Includes a worked example showing `[group('install')]`/`[group('dev')]` recipes, `@`-prefixed quiet recipes, color variables (`{{GREEN}}`, `{{RED}}`, etc.), the `{{py_package_name}}` variable, and an `alias f := format` alias — examples use `cargo install taplo-cli` and `uvx --with-editable . ruff ...`.
- **Best-practice intent**: The Justfile stays self-documenting and organized — grouped, commented, consistently spaced recipes — even when an AI assistant edits it.
- **Python-specific assumptions**: Only in the illustrative example bodies (`uvx`, `ruff`, `py_package_name`); the actual rules (spacing, groups, doc comments) are toolchain-neutral.
- **TS/Node equivalent**: Same file and rules; rewrite the example recipes to invoke the TS toolchain (e.g. the ported `just format` using the chosen formatter, a `{{package_name}}`-style variable) once tools are selected. Assumes the TS repo also keeps `just` as its task runner (consistent with `.windsurfrules` conventions being carried forward).
- **Open questions**: Confirm `just` remains the task runner in ts-launch-blueprint (vs npm scripts only); example commands await formatter/linter selection.
- **Validation strategy**: Edit the TS repo's Justfile in Windsurf and confirm the rule triggers and the assistant preserves grouping/comments/spacing; example recipes in the rule must match real recipes in the ported Justfile.
- **Status**: Indexed

### `.windsurfrules`
- **Target path**: `.windsurfrules`
- **Port category**: Translate to TypeScript equivalent
- **Purpose**: Repo-wide Windsurf AI rules file documenting the project's development environment, toolchain, workflow commands, code-quality tools, docs stack, dependencies, and structure — also consumed by Cursor via `projectenv.mdc`.
- **Features/capabilities**: Declares: Justfile is the command surface, Makefile is bootstrap-only (no new targets); UV for package management, Python 3.10+; Hatch/hatchling + hatch-vcs build backend with VCS-derived versioning; `just` recipes catalog (install-dev, format, lint, typecheck, test, check, docs, docs-dev); quality tools (Ruff lint+format, MyPy strict, pre-commit, pytest+coverage); Sphinx docs with Furo theme and extension list (autodoc, viewcode, napoleon, autodoc-typehints, myst_parser, copybutton); core deps (click, questionary, python-dotenv, thefuzz, pyperclip, requests, rich), dev deps, docs deps; project structure (package `py_launch_blueprint`, command `py-projects`, `/docs`, `/tests`).
- **Best-practice intent**: A single authoritative machine-readable conventions document so AI assistants use the sanctioned commands and tools instead of improvising; separates command surface (Justfile) from bootstrap (Makefile).
- **Python-specific assumptions**: Nearly every line — UV, Hatch, hatch-vcs, Ruff, MyPy, pytest, Sphinx/Furo, and all named PyPI dependencies.
- **TS/Node equivalent**: Same file (`.windsurfrules`) rewritten section-by-section for the TS stack: package manager (pnpm/npm/bun — TBD), build/versioning (tsup/tsc + changesets or git-derived version — TBD), quality tools (oxc/Oxlint or Biome/ESLint, formatter, tsc typecheck, vitest, lefthook/husky), docs stack (TypeDoc/Starlight/VitePress — TBD), and the TS equivalents of the CLI deps (e.g. commander/clipanion for click, @inquirer/prompts for questionary, dotenv, fuzzy-match lib, clipboardy for pyperclip, fetch/undici for requests, chalk/ink for rich). Keep the Justfile-is-command-surface / Makefile-is-bootstrap-only rule verbatim.
- **Open questions**: Every named tool/dependency mapping is a research-phase decision; this file must be rewritten last, after toolchain and dependency selections, since it documents them.
- **Validation strategy**: Cross-check every command and tool named in the rewritten file against the actual Justfile recipes and package.json of ts-launch-blueprint — zero references to tools not present in the repo.
- **Status**: Indexed

### `CLAUDE.md`
- **Target path**: `CLAUDE.md`
- **Port category**: Translate to TypeScript equivalent
- **Purpose**: Claude Code agent guidelines: the sanctioned project commands, code-style rules, and developer-environment expectations for AI-assisted work in the repo.
- **Features/capabilities**: Project Commands section with `just` recipes and their raw fallbacks (setup via `uv pip install --editable ".[dev]"`, format/lint via `uvx ruff`, typecheck via `uvx ... mypy`, test-all and single-test via `uvx ... pytest tests/test_file.py::test_name`, `just check`, `just pre-commit-run`). Code Style: 88-char lines (Black standard), strict typing on all functions, sorted imports with relative imports preferred, PEP 8 naming via Ruff, explicit error handling over assertions, type annotations optional in tests, no hardcoded credentials / bandit rules. Developer Environment: Python 3.10+, `uv` recommended with pip supported, VS Code with Ruff/MyPy/Pylance extensions.
- **Best-practice intent**: The agent always uses project-native commands (including the single-test invocation), honors the style and security bar, and knows the supported environment — minimizing improvised or off-convention actions.
- **Python-specific assumptions**: All commands (uv/uvx/ruff/mypy/pytest), PEP 8/Black conventions, Python 3.10+ requirement, and the extension list.
- **TS/Node equivalent**: `CLAUDE.md` at repo root with the same three-section shape: `just` recipes plus raw TS fallbacks (package-manager install, formatter, linter, `tsc --noEmit`, test-all and single-test e.g. `vitest run path -t "name"` — pending tool selection); style section translated (line length per chosen formatter, `strict: true` tsconfig, import ordering, naming conventions per linter, explicit error handling, no hardcoded credentials); environment section with Node version, package manager, and the final VS Code extension list.
- **Open questions**: Concrete commands and style numbers depend on the research-phase toolchain choices; must be written to match the final Justfile exactly (keep `.windsurfrules`, `CLAUDE.md`, and Justfile mutually consistent).
- **Validation strategy**: Execute every command listed in the ported CLAUDE.md verbatim in a fresh clone and confirm each succeeds; diff its command list against the Justfile to catch drift.
- **Status**: Indexed

## Group: root-docs-build

# Fragment 05: root-docs-build

Source repo: /Users/stevemorin/c/py-launch-blueprint @ 4828f8596b2332d74fbcff932ebab6f0030febd5

### `CONTRIBUTORS.md`
- **Target path**: `CONTRIBUTORS.md`
- **Port category**: Copy then modify
- **Purpose**: Auto-generated contributor roster plus a short "How to Contribute" pointer to the fork/branch/Conventional-Commits/PR workflow and CONTRIBUTING.md.
- **Features/capabilities**: Header stating the file is auto-generated by COG (Cocogitto) and must not be edited manually; contributor names/emails between `<!-- COG-CONTRIBUTORS-LIST:START -->` / `<!-- COG-CONTRIBUTORS-LIST:END -->` marker comments (machine-updatable region); 5-step contribution recipe requiring Conventional Commits; link to CONTRIBUTING.md.
- **Best-practice intent**: Automated, zero-maintenance contributor recognition; a single generated artifact keeps credit current without manual tracking, and marker comments make regeneration idempotent.
- **Python-specific assumptions**: None — Cocogitto is a language-agnostic Rust binary driven by git history.
- **TS/Node equivalent**: Same file and same marker-comment pattern. Keep Cocogitto-driven generation if cog is retained for the TS repo; alternatives in the Node ecosystem include the all-contributors CLI/bot. Contents must be reset (the listed people are py-launch-blueprint contributors, not ts-launch-blueprint contributors).
- **Open questions**: Whether the TS repo keeps Cocogitto (external Rust binary) or switches to a Node-native contributor tool — depends on the repo-wide changelog/versioning tool decision.
- **Validation strategy**: Run the contributor-update recipe (e.g., `just update-contributors` or the cog-driven workflow) in the new repo and confirm the list between markers regenerates from ts-launch-blueprint git history; verify links (CONTRIBUTING.md) resolve.
- **Status**: Indexed

### `EXAMPLECLI.md`
- **Target path**: `EXAMPLECLI.md`
- **Port category**: Copy then modify
- **Purpose**: End-user documentation for the bundled example CLI (`py-projects`): features, installation, configuration, usage, and exit codes.
- **Features/capabilities**: Feature list (fuzzy project-name search, workspace filter, text/JSON/CSV output formats, clipboard integration, rich color terminal UI, secure token handling, paginated API access); install paths (PyPI `pip install`, source `pip install -e ".[dev]"`, direct `python projects.py`); token precedence chain `--token` flag > `PY_TOKEN` env var > `~/.config/py-launch-blueprint/.env` with `chmod 600` guidance; usage examples for `--workspace`, `--limit`, `--format json|csv`, `--copy`, `--output`, `--verbose`, `--no-color`, `--help`, `--version`; documented exit-code contract (0 success, 1 config, 2 auth, 3 API, 4 I/O, 5 user interrupt).
- **Best-practice intent**: The example CLI is a teaching artifact — documents a complete CLI UX contract: layered configuration with explicit precedence, secure secret storage, multiple output formats, and a stable numeric exit-code taxonomy.
- **Python-specific assumptions**: PyPI/pip installation commands, `python projects.py` invocation, `.[dev]` extras syntax, the `py-projects` entry-point name, `PY_TOKEN` naming.
- **TS/Node equivalent**: Same document restructured for the ported TS example CLI: npm registry install (`npm install -g` / `npx`), source install via the chosen package manager, `node`/`tsx` direct invocation, renamed binary and env var. The documented behaviors (precedence chain, formats, exit codes) should be preserved as the spec the TS CLI implements.
- **Open questions**: Final binary/package name and env-var name for the TS example CLI; whether config lives at `~/.config/<name>/.env` on Node too (XDG-style path is portable, so likely yes).
- **Validation strategy**: Every command shown in the doc is executed against the ported CLI and produces the documented behavior; exit codes asserted in the test suite so the doc's table stays truthful.
- **Status**: Indexed

### `Justfile`
- **Target path**: `Justfile`
- **Port category**: Copy then modify
- **Purpose**: Primary developer command runner — the canonical set of dev-workflow recipes (format, lint, typecheck, test, build, run, docs, release, CI-testing utilities), organized into named groups with single-letter aliases.
- **Features/capabilities**: Project variables (`py_package_name`, `repo_name`, `command_name`); ANSI color/style constants and CHECK/CROSS/DASH symbols; OS-aware `CLIPBOARD_CMD` (clip/xclip/pbcopy); default recipe lists all recipes; `check-deps` verifies uv, python3, just, pre-commit, taplo, go, yamlfmt are installed; `install-dev` (uv editable install with dev extras); `format` / `lint` (ruff via `uvx --with-editable .`, including isort-style `--select I --fix`); `format-toml`/`check-toml` (taplo with `.taplo.toml`); `typecheck` (mypy); `test` (pytest with pass-through options); `check` = test+lint+typecheck; `run` (uvx entry point); `build` (depends on check; has a `#TODO: fix this does not work` comment); pre-commit setup/uninstall/run-all; `version`; `debug-info` (OS/tool/dependency report for bug filing); `clean` (caches, dist, .venv, __pycache__); Sphinx docs recipes (`install-docs`, `init-docs`, `docs`, `docs-dev` hot reload, `docs-clean` — delegate to `docs/Makefile`); `update-contributors` via `git shortlog -sne`; Cocogitto recipes (`verify-commits` over a commit range, `bump` auto/semver, interactive `commit`, `install-cog` per-OS, `setup-cog-hooks` commit-msg hook); legacy pip-based variants of format/lint/typecheck/test; GitHub-Actions test workflows (`pr-to-testrepo` clones a PR into a fresh private repo with a marker file, `clean-pr-to-testrepo` guarded deletion, `create-test-pr` scripted branch+PR via gh) with `[confirm(...)]` guards; `dev` composite (format, lint, test) aliased `cycle`; `install-go`, `install-yamlfmt`, and yamlfmt format/lint/check recipes; group annotations (`[group('dev')]` etc.) and aliases (f, l, tc, t, ca, pc, b, c, ct, ft).
- **Best-practice intent**: One discoverable, self-documenting entry point for every dev task; dependency preflight before work; run tools through the package manager without global installs (uvx pattern); composite quality gates (`check`, `dev`); guarded destructive operations; recipes for reproducing/testing CI itself.
- **Python-specific assumptions**: uv/uvx everywhere, ruff, mypy, pytest, pip/venv legacy recipes, Sphinx docs chain, `__pycache__`/`.mypy_cache`/`.ruff_cache` cleanup paths, `pyproject.toml` grep in debug-info, `py_package_name` module import for version.
- **TS/Node equivalent**: Keep `just` as the runner (language-agnostic; explicitly a template selling point) and keep the group/alias/color/check-deps structure, but rewrite recipe bodies for the TS toolchain: package-manager install, TS formatter/linter, `tsc` (or chosen typechecker), TS test runner, TS docs tool, npm-based clean paths. Cross-cutting recipes port nearly as-is: cog/conventional-commit recipes, `update-contributors`, `pr-to-testrepo`/`create-test-pr` workflows, `debug-info` skeleton, taplo/yamlfmt recipes (fewer TOML files in a TS repo — may shrink). The broken `build` recipe TODO should be fixed, not ported.
- **Open questions**: Which TS tools fill each recipe body (formatter/linter — e.g., Biome vs ESLint+Prettier vs oxlint; test runner — e.g., Vitest vs node:test; docs generator; package manager — npm/pnpm) is deferred to the tool-selection research phase; whether taplo/go/yamlfmt remain required deps in check-deps for a TS repo; whether legacy pip-equivalent recipes have any TS analog worth keeping (probably drop).
- **Validation strategy**: `just --list` succeeds; every ported recipe runs green on a fresh clone (`just check-deps`, `just install-dev`, `just check`, `just dev`); recipe/alias/group inventory diffed against this index to confirm intent coverage; destructive workflow recipes smoke-tested against a scratch repo.
- **Status**: Indexed

### `Makefile`
- **Target path**: `Makefile`
- **Port category**: Copy then modify
- **Purpose**: Minimal bootstrap layer — because "almost everyone has make", it checks for and installs the two foundational tools (just, uv) before the Justfile takes over.
- **Features/capabilities**: `SHELL := /bin/zsh`; ANSI color constants and CHECK/CROSS symbols; `.PHONY` targets; `all` -> `help`; `check` prints a "System Requirements Status" table for just and uv, counts missing deps, exits 1 with a summary if any are missing (expected output documented in comments); `install-just` / `install-uv` print the official curl install one-liners plus docs links and PATH hints; `install-just-force` / `install-uv-force` actually curl-install to `~/bin` / `~/.local/bin` and idempotently append an `export PATH` line to `~/.zshenv` via an awk guard; `set-path` generic SET_PATH-to-.zshenv helper with usage error; self-documenting `help` target that greps `## ` comments from MAKEFILE_LIST.
- **Best-practice intent**: Zero-assumption onboarding: a new contributor with only make and curl can bootstrap the whole toolchain; dependency checks fail loudly with the exact remediation command; PATH edits are idempotent.
- **Python-specific assumptions**: uv is one of the two bootstrap dependencies (install URL, `~/.local/bin` path, astral.sh installer).
- **TS/Node equivalent**: Same Makefile pattern with uv swapped for the Node-side bootstrap dependency: check/install targets for just plus Node.js and/or the chosen package manager (e.g., a version manager like fnm/volta, or corepack-enabled pnpm). Structure, check-table output, help target, and set-path helper copy nearly verbatim. Note `SHELL := /bin/zsh` and `.zshenv` writes are macOS-centric — worth reconsidering (bash fallback) but that is a pre-existing trait, not a port blocker.
- **Open questions**: Which Node bootstrap tool replaces uv in `check`/`install-*` (depends on the package-manager decision from the research phase); whether to keep zsh as the hardcoded shell.
- **Validation strategy**: On a machine (or container) without the tools, `make check` exits 1 listing each missing dep with its install target; after `make install-*-force`, `make check` passes and `~/.zshenv` contains exactly one PATH entry per tool; `make help` lists all `##`-annotated targets.
- **Status**: Indexed

### `README.md`
- **Target path**: `README.md`
- **Port category**: Copy then modify
- **Purpose**: Front-page pitch and complete feature inventory for the template: why it exists (eliminating setup friction), who it is for, and a categorized list of every integrated tool and practice, with links to ReadTheDocs.
- **Features/capabilities**: MIT license badge; tagline positioning the repo as a production-ready template with integrated best practices; logo image at `./assets/images/logos/py_launch_blueprint_logo_100x100.png` (binary asset); "Features TLDR" (dev tools, AI-ready configs for Cursor/Windsurf/Claude Code, production stack, DX, CI/CD); categorized full feature list covering: make bootstrap, just runner, ruff lint+format, mypy, pre-commit, taplo TOML, yamllint/yamlfmt YAML; pyproject.toml single-config, dependency groups, uv, hatchling build, setuptools-scm git-tag versioning, license-header automation; Sphinx+MyST docs with Read the Docs; cog changelog; pytest, GitHub Actions CI with matrix testing, `just debug-info`; GitHub templates (PR, feature/bug/docs issues), cog contributor automation, conventional commits, security policy, code of conduct, contributing guidelines, CodeQL scanning, CLA Assistant; VS Code settings, PyRight, extension recommendations; Cursor/Windsurf rules; Slack notifications for PRs/issues and PR-review reminders; two links to py-launch-blueprint ReadTheDocs.
- **Best-practice intent**: The README doubles as the template's manifest: every tool choice is named, justified in one line, and linked to deeper docs — the "curated, explained defaults" discipline the port must carry forward.
- **Python-specific assumptions**: Nearly every named tool (ruff, mypy, uv, hatchling, setuptools-scm, pyproject.toml, Sphinx, pytest, PyRight) plus Python 3.10+ claims, PyPI/ReadTheDocs links, py-launch-blueprint naming and logo asset.
- **TS/Node equivalent**: Rewrite as the ts-launch-blueprint README preserving structure and category taxonomy (Dev Tools / Project Structure / Docs / Testing & QA / GitHub Integration / IDE / AI / Communication) and the one-line-justification style, substituting each Python tool with its selected TS counterpart once the research phase decides them (e.g., package.json/tsconfig for pyproject, tsc for mypy, chosen linter for ruff, chosen test runner for pytest). Cross-platform items (make/just, pre-commit, cog, GitHub templates, CodeQL, CLA, VS Code, Cursor/Windsurf/Claude configs, Slack) carry over with minimal edits. Needs a new logo asset and updated docs-hosting links.
- **Open questions**: Final TS tool roster (blocks the feature-list rewrite); docs hosting for the TS repo (Read the Docs supports non-Python but TS projects often use other hosts); new project name/badge/logo assets.
- **Validation strategy**: Every tool named in the rewritten README exists in the repo's config and CI; every relative link and image path resolves; feature list cross-checked against the final index so no ported capability is undocumented and nothing claimed is missing.
- **Status**: Indexed

## Group: assets-docs-infra

# Index fragment: assets-docs-infra

Source repo: /Users/stevemorin/c/py-launch-blueprint @ 4828f8596b2332d74fbcff932ebab6f0030febd5

### `assets/images/logos/py_launch_blueprint_logo_100x100.png`
- **Target path**: n/a (omitted)
- **Port category**: Omit with reason
- **Purpose**: Project logo, 100x100 px raster (binary asset, 9,974 bytes; content not read). Small-size variant used for docs/README branding.
- **Features/capabilities**: Branding image only; no behavior. Lives in a dedicated `assets/images/logos/` directory alongside 150x150 and 1024x1024 variants, giving a canonical home for brand assets at multiple resolutions.
- **Best-practice intent**: Keep brand assets versioned in-repo at a predictable path, in several sizes so docs/README/social previews never scale a mismatched source.
- **Python-specific assumptions**: None mechanically, but the artwork itself is py-launch-blueprint branding (Python snake/name) and must not be reused for the TS project.
- **TS/Node equivalent**: Same pattern — `assets/images/logos/ts_launch_blueprint_logo_100x100.png` — but with newly created ts-launch-blueprint artwork. The directory convention ports; the binary does not.
- **Open questions**: Who produces the new logo artwork, and in which sizes (mirror 100/150/1024 set?).
- **Validation strategy**: Visual check that new logo files exist at the analogous paths and are referenced correctly from README/docs; no broken image links in rendered docs.
- **Status**: Indexed

### `assets/images/logos/py_launch_blueprint_logo_1024x1024.png`
- **Target path**: n/a (omitted)
- **Port category**: Omit with reason
- **Purpose**: Project logo, 1024x1024 px master/high-resolution raster (binary asset, 289,468 bytes; content not read). Source-of-truth size for generating smaller variants and social/OG images.
- **Features/capabilities**: Branding image only; largest variant in the logo set.
- **Best-practice intent**: Keep a high-resolution master in-repo so downstream sizes can be regenerated without quality loss.
- **Python-specific assumptions**: None mechanically; artwork is py-launch-blueprint-specific branding.
- **TS/Node equivalent**: New `assets/images/logos/ts_launch_blueprint_logo_1024x1024.png` with fresh artwork; same multi-resolution convention.
- **Open questions**: Same as 100x100 — new artwork production and size set.
- **Validation strategy**: File exists at analogous path; smaller variants visually consistent with the master.
- **Status**: Indexed

### `assets/images/logos/py_launch_blueprint_logo_150x150.png`
- **Target path**: n/a (omitted)
- **Port category**: Omit with reason
- **Purpose**: Project logo, 150x150 px raster (binary asset, 17,576 bytes; content not read). Mid-size variant of the logo set.
- **Features/capabilities**: Branding image only; no behavior.
- **Best-practice intent**: Provide ready-made sizes for common embed contexts (README header, avatars) so consumers never rescale ad hoc.
- **Python-specific assumptions**: None mechanically; artwork is py-launch-blueprint-specific branding.
- **TS/Node equivalent**: New `assets/images/logos/ts_launch_blueprint_logo_150x150.png` with fresh artwork.
- **Open questions**: Same as other logo variants.
- **Validation strategy**: File exists at analogous path; renders correctly wherever referenced.
- **Status**: Indexed

### `docs/Makefile`
- **Target path**: replaced by docs scripts in `package.json` and/or `justfile` recipes (exact form depends on docs generator — TBD)
- **Port category**: Needs research
- **Purpose**: Sphinx documentation build entry point (31 lines). Wraps sphinx-build/sphinx-autobuild so contributors run `make html`, `make hotreloadhtml`, `make docs`, `make help` from `docs/`.
- **Features/capabilities**: `SPHINXBUILD ?= uv run --extra docs sphinx-build` and `SPHINXAUTOBUILD ?= uv run --extra docs sphinx-autobuild` (tooling invoked through uv with the `docs` extra, no separate venv activation); `SOURCEDIR=source`, `BUILDDIR=build`; default target `help`; catch-all `%:` target routing any unknown target to Sphinx "make mode" (`-M $@`); `hotreloadhtml` target running sphinx-autobuild for live-reload authoring; `docs` target building HTML with `-E` (force full re-read of sources).
- **Best-practice intent**: One-command docs builds with a hot-reload dev loop, using the project's package manager to guarantee the right docs dependencies without manual environment setup.
- **Python-specific assumptions**: Entirely Sphinx + uv specific: sphinx-build/sphinx-autobuild CLIs, uv extras (`--extra docs`), Sphinx make-mode target routing.
- **TS/Node equivalent**: Docs-generator CLI scripts, e.g. `docs:dev` / `docs:build` in `package.json` (or `just docs-dev` / `just docs-build`) using the chosen tool's built-in dev server (VitePress `vitepress dev`/`build`, Docusaurus `docusaurus start`/`build`, Astro Starlight `astro dev`/`build`, possibly TypeDoc for API reference). Hot reload comes free with all candidates. Tool not yet selected.
- **Open questions**: Which docs generator will ts-launch-blueprint adopt? Should docs commands live in the root justfile (matching the py repo's just-first workflow) or in package.json scripts, or both?
- **Validation strategy**: After tool selection: `docs build` command produces a static site with zero errors; dev-server command serves docs with live reload; commands are runnable from a fresh clone after dependency install.
- **Status**: Needs research

### `docs/source/_static/py_launch_blueprint_logo_100x100.png`
- **Target path**: n/a (omitted)
- **Port category**: Omit with reason
- **Purpose**: Copy of the 100x100 logo placed in Sphinx's static-assets directory (binary, 9,974 bytes — same size as the `assets/` copy; content not read). Referenced by `conf.py` (`html_logo`) and the `{figure}` directive at the top of `index.md`.
- **Features/capabilities**: Static asset served by the docs site; duplicated from `assets/images/logos/` because Sphinx only serves files under `html_static_path`.
- **Best-practice intent**: Docs site carries project branding (logo in sidebar/header) rather than a bare theme.
- **Python-specific assumptions**: Location is dictated by Sphinx's `_static` convention; artwork is py-launch-blueprint branding.
- **TS/Node equivalent**: The chosen docs generator's public/static assets directory (e.g. VitePress `docs/public/`, Docusaurus `static/`), holding the new TS logo; configured as the site logo in the generator's theme config.
- **Open questions**: Whether the TS repo should reference one canonical logo location instead of duplicating the binary (some generators can serve from a shared assets dir).
- **Validation strategy**: Built docs site displays the new logo in the theme header/sidebar; no 404s for image assets.
- **Status**: Indexed

### `docs/source/_templates/base.html`
- **Target path**: docs theme customization in the chosen generator (e.g. theme/layout config or slot override — TBD)
- **Port category**: Needs research
- **Purpose**: Sphinx/Furo Jinja2 template override (36 lines) that customizes the HTML `<title>` of the docs homepage and carries an MIT license header comment.
- **Features/capabilities**: `{%- extends "!base.html" %}` to inherit the Furo theme's base template; overrides `htmltitle` block with three cases — no `docstitle` → plain page title; `pagename == master_doc` (homepage) → hardcoded SEO title "py-launch-blueprint: A Production-Ready Python Project Template with Integrated Best Practices"; otherwise → "Page - Site" pattern; `site_meta` block passthrough via `{{ super() }}`; full MIT license text embedded as an HTML comment.
- **Best-practice intent**: SEO/branding polish — the docs homepage gets a descriptive marketing title instead of a generic one — plus explicit licensing on template files.
- **Python-specific assumptions**: Entirely Sphinx/Furo/Jinja2 specific: template inheritance with `!base.html`, `docstitle`/`pagename`/`master_doc` context variables, Jinja block syntax.
- **TS/Node equivalent**: Whatever the chosen docs generator uses for per-page titles: VitePress `titleTemplate` + homepage frontmatter `title`, Docusaurus `title`/`titleDelimiter` config, Starlight per-page frontmatter. Most candidates achieve this via config, not template override — this file likely collapses into one or two config lines rather than a template file.
- **Open questions**: Docs generator choice; exact homepage title string for ts-launch-blueprint (mirror the "Production-Ready ... Template with Integrated Best Practices" tagline); whether license headers on docs-site config files are still wanted.
- **Validation strategy**: Built homepage's `<title>` equals the chosen marketing string; interior pages render "Page Title - Site Title"; check via view-source or a link/meta checker on the built site.
- **Status**: Needs research

### `docs/source/conf.py`
- **Target path**: docs generator config (e.g. `docs/.vitepress/config.ts`, `docusaurus.config.ts`, or `astro.config.mjs` — TBD)
- **Port category**: Needs research
- **Purpose**: Sphinx configuration (85 lines): project metadata, extensions, Markdown support, theme, and branding for the docs site.
- **Features/capabilities**: Project metadata (name, copyright "2025, Steve Morin", author, release 0.1.0); extensions: `sphinx.ext.autodoc` (API docs from docstrings), `sphinx.ext.viewcode` (source links), `sphinx.ext.napoleon` (Google-style docstrings), `sphinx.ext.intersphinx` (cross-project refs), `sphinx_autodoc_typehints`, `myst_parser` (Markdown authoring), `sphinx_copybutton` (copy button on code blocks); MyST extensions `colon_fence` and `deflist`; dual source suffix `.rst` + `.md`; `templates_path=['_templates']`; `exclude_patterns` for `_build`/`Thumbs.db`/`.DS_Store`; `html_static_path=['_static']`; theme `furo` with `sidebar_hide_name: False` and two footer GitHub icons/links (inline SVG + "View on GitHub" text link) pointing at github.com/smorin/py-launch-blueprint; `html_logo` pointing at the 100x100 logo.
- **Best-practice intent**: Docs written in Markdown, API reference generated from typed source, copyable code blocks, cross-references, a modern accessible theme, and repo links in the footer — docs as a first-class, branded deliverable.
- **Python-specific assumptions**: Everything: Sphinx config format, autodoc/napoleon/typehints assume Python docstrings, Furo is a Sphinx theme, MyST is Sphinx's Markdown bridge.
- **TS/Node equivalent**: Config file of the chosen generator. Feature mapping to preserve: Markdown-first authoring (native in all candidates); autodoc/viewcode/typehints → TypeDoc (possibly typedoc-plugin-markdown integrated into the site); copybutton → built into VitePress/Docusaurus code blocks; theme + logo + GitHub footer/social links → generator theme config; intersphinx → plain links or generator-specific cross-ref plugins (weakest mapping, may be dropped). Candidates: VitePress, Docusaurus, Astro Starlight (+ TypeDoc for API reference).
- **Open questions**: Docs generator selection (primary open decision for this whole group); whether API-reference generation from TSDoc comments is in scope for the template; Read the Docs vs GitHub Pages/Netlify hosting (py repo deploys to Read the Docs, which has weaker Node support — hosting choice interacts with tool choice).
- **Validation strategy**: Built site has: Markdown pages rendering, working logo, GitHub link in footer/nav, copy buttons on code blocks, and (if in scope) generated API reference from a sample typed module; docs build is wired into CI.
- **Status**: Needs research

### `docs/source/index.md`
- **Target path**: docs homepage of the chosen generator (e.g. `docs/index.md`; final layout TBD)
- **Port category**: Copy then modify
- **Purpose**: Docs-site landing page (292 lines): logo, badges, project pitch, feature catalog, quick start, install/config/usage of the example CLI, and the site-wide table of contents.
- **Features/capabilities**: MyST `{figure}` directive embedding the logo; shields.io badges (license, repo, changelog, tests, stars, Discord) — note the Tests badge URL points at `simonw/llm`, a pre-existing bug to fix, not port; "Why choose" pitch; links to ReadTheDocs and Discord; Features TLDR (Ruff, MyPy, pre-commit, uv, AI-assistant configs, VS Code, GitHub Actions); 4-step quick start (`git clone`, `make check`, `just check-deps`/`install-dev`/`pre-commit-setup`, `just pre-commit-run`/`just run`); complete feature list organized by category (dev tools incl. taplo TOML and yamllint YAML checks, project structure with pyproject/uv/hatchling/setuptools-scm, docs with sphinx+MyST/RTD/cog changelog, testing with pytest + GH Actions matrix, `just debug-info` bug-reporting helper, GitHub templates/security policy/CoC/CodeQL/CLA-check, VS Code + PyRight IDE integration, Cursor/Windsurf/Claude Code AI configs, Slack PR/issue notifications); PyPI/source/direct install instructions; example CLI (`py-projects`) config precedence (flag > `PY_TOKEN` env > `~/.config/py-launch-blueprint/.env`), output formats (json/csv/clipboard/file), and numbered exit codes (0-5); MyST `{toctree}` (maxdepth 3) listing about/tasks/tools/tutorials/reference/contributing/github-templates sections.
- **Best-practice intent**: The template sells itself — a single landing page that states the value proposition, catalogs every quality practice the template encodes, and gets a newcomer from clone to running checks in four steps.
- **Python-specific assumptions**: Nearly every named tool (ruff, mypy, uv, hatchling, setuptools-scm, pytest, pyright, PyPI, sphinx) plus MyST directive syntax (`{figure}`, `{toctree}`) and py-specific CLI/config examples.
- **TS/Node equivalent**: Same-role homepage rewritten for the TS stack: tool names swapped for their chosen TS counterparts (e.g. oxc/Oxlint or Biome/ESLint, tsc, npm/pnpm, Vitest — per the port's tool decisions), quick start updated to the TS repo's make/just commands, example-CLI section rewritten for the ported CLI, badges repointed at ts-launch-blueprint (and Tests badge fixed), MyST directives converted to the chosen generator's syntax (frontmatter hero, sidebar config instead of toctree).
- **Open questions**: Docs generator (affects toctree/figure syntax and homepage format); final TS toolchain names to advertise (depends on other groups' research); whether ReadTheDocs/Discord links carry over.
- **Validation strategy**: Rendered homepage displays logo/badges correctly, every internal nav link resolves, quick-start commands are copy-paste runnable against the finished TS repo, and the feature list is audited to only claim features the TS repo actually has.
- **Status**: Indexed

### `docs/source/docs.md`
- **Target path**: docs contributor guide in the TS docs tree (e.g. `docs/docs.md` or `docs/contributing/documentation.md`; TBD)
- **Port category**: Copy then modify
- **Purpose**: "Documentation Guide" (180 lines) teaching contributors how to author docs: local dev loop, adding pages, cross-references, images, admonitions, troubleshooting.
- **Features/capabilities**: Quick start (`just install-docs`, then `cd docs && make hotreloadhtml` with live server at 127.0.0.1:8000); adding pages (create `.md` in `docs/source`, register in `toctree`); MyST reference targets (`(label)=`) and `{ref}` role with custom link text; static content workflow (`_static` dir, `![...]` and `{figure}` directive with alt/width/align); changing the logo via `html_logo` and Furo `light_logo`/`dark_logo` theme options; admonitions (`{note}`/`{warning}`/`{tip}`); fenced code blocks; Markdown tables; build commands (`make html`/`hotreloadhtml`/`clean`/`help`); troubleshooting section (missing TOC entries, broken refs, build errors → `make clean` first).
- **Best-practice intent**: Lower the barrier to docs contributions — a contributor should be able to add a page, cross-link it, and preview it live without knowing the docs toolchain in advance; docs-about-the-docs is itself part of the template.
- **Python-specific assumptions**: All mechanics are Sphinx/MyST/Furo-specific: toctree registration, `(label)=`/`{ref}` cross-reference syntax, `_static`, `conf.py` logo options, Sphinx make targets.
- **TS/Node equivalent**: Same guide rewritten for the chosen generator: dev loop (`docs:dev` script), page registration (sidebar config or file-based routing), cross-references (relative Markdown links or generator anchors), assets (public/ dir), admonitions (VitePress/Docusaurus container syntax `::: tip`), logo config, troubleshooting. Structure and section list carry over almost 1:1; every command and syntax example changes.
- **Open questions**: Docs generator choice drives all rewritten mechanics; none otherwise.
- **Validation strategy**: Follow the rewritten guide literally on a fresh clone: add a test page, cross-link it, add an image, run the dev server — every step must work as written.
- **Status**: Indexed

### `docs/source/github-templates.md`
- **Target path**: same-role page in TS docs tree (e.g. `docs/github-templates.md`)
- **Port category**: Copy then modify
- **Purpose**: Guide (141 lines) explaining GitHub issue and PR templates: what they are, which ones this project ships, how they work, and how downstream users customize them.
- **Features/capabilities**: Documents the project's three YAML issue forms (`bug-report.yml`, `feature-request.yml`, `documentation-request.yml`) and Markdown `PULL_REQUEST_TEMPLATE.md`; explains `.github/ISSUE_TEMPLATE/` structure (name/description/title prefix/auto-labels/body); annotated feature-request YAML example (markdown/input elements, `validations: required`); form element types (markdown, input, textarea, dropdown, checkboxes); `config.yml` advanced options (`blank_issues_enabled: false`, `contact_links` for e.g. security reports); explicit "starting point — customize for your project" framing; links to four GitHub official docs pages.
- **Best-practice intent**: Structured, label-automated issue intake and PR hygiene — and teaching template consumers to adapt the intake forms rather than treating them as fixed.
- **Python-specific assumptions**: None — GitHub templates are platform features, fully language-agnostic. Only incidental py-launch-blueprint naming in examples.
- **TS/Node equivalent**: Same Markdown page, nearly verbatim: update project name references, keep in sync with whatever issue/PR templates the TS repo's `.github/` actually ships (indexed by another group), and adjust the PR-template path mention if the TS repo places it under `.github/` rather than repo root (the text says "repository root", verify against the actual ported location).
- **Open questions**: None beyond staying consistent with the ported `.github/` templates themselves.
- **Validation strategy**: Cross-check every template filename and path mentioned in the page against the TS repo's actual `.github/` contents; link checker for the four external GitHub docs URLs.
- **Status**: Indexed

## Group: docs-about-contributing

# Index Fragment: docs-about-contributing

### `docs/source/about/features.md`
- **Target path**: docs/source/about/features.md (adjust root if the TS docs toolchain uses a different layout)
- **Port category**: Copy then modify
- **Purpose**: Marketing/overview page listing the template's key features: zero-config setup, type safety, modern tooling, production readiness, developer experience, and target audience.
- **Features/capabilities**: Bullets naming concrete tools and claims: MyPy + Pylance type checking with VS Code integration, Ruff for linting/formatting, pre-commit hooks, Python 3.10+ support, `uv` dependency management, GitHub Actions CI/CD, pre-configured tests, curated VS Code extensions, git hooks, "Perfect For" audience list.
- **Best-practice intent**: Sells the template's value proposition — every quality tool is pre-configured and documented so teams get best practices from day one.
- **Python-specific assumptions**: Names MyPy, Pylance, Ruff, uv, Python 3.10+ — the entire tool list is Python-toolchain-specific.
- **TS/Node equivalent**: Same page with the tool list rewritten for the chosen TS stack (e.g. tsc strict mode, oxc/Oxlint per repo goal.md, chosen package manager, Node LTS support, Vitest or similar). Exact names depend on the tool-selection research phase.
- **Open questions**: Final TS tool choices (linter/formatter, package manager, test runner) and the docs framework (Sphinx/MyST vs a JS-native docs tool) are decided in a later phase; this page must be rewritten after those decisions.
- **Validation strategy**: Docs build succeeds; every tool named on the page actually exists in the ported repo's config; link check passes.
- **Status**: Indexed

### `docs/source/about/index.md`
- **Target path**: docs/source/about/index.md (or the equivalent section index in the chosen docs tool)
- **Port category**: Copy then modify
- **Purpose**: Landing/index page for the "About" docs section; introduces the section and wires up navigation.
- **Features/capabilities**: Two-sentence intro plus a MyST/Sphinx `{toctree}` directive (`maxdepth: 2`) including `philosophy` and `features`.
- **Best-practice intent**: Structured, navigable documentation with explicit section landing pages and a declared table of contents.
- **Python-specific assumptions**: The `{toctree}` directive is Sphinx/MyST syntax; project name "Py Launch Blueprint".
- **TS/Node equivalent**: Same content with navigation expressed in the chosen docs framework's idiom (Sphinx toctree if Sphinx is kept; sidebar config in VitePress/Docusaurus/Starlight otherwise) and renamed to Ts Launch Blueprint.
- **Open questions**: Which docs framework the TS repo adopts (decided in research phase) determines how the toctree is expressed.
- **Validation strategy**: Docs build succeeds and the About section renders with working nav links to philosophy and features pages.
- **Status**: Indexed

### `docs/source/about/philosophy.md`
- **Target path**: docs/source/about/philosophy.md
- **Port category**: Copy then modify
- **Purpose**: States the project's guiding principles, open-source rationale, and vision.
- **Features/capabilities**: Three philosophy pillars (Heavily Documented, Pragmatic, Modular — easy to remove/replace/add features), "Why Open Source?" (Transparent, Collaborative), and a Vision statement ("go-to Python project template").
- **Best-practice intent**: Encodes the template's design discipline: explain every choice, prefer pragmatism over dogma, keep the template modular so users can swap tools.
- **Python-specific assumptions**: Only naming — "Python project template" / "Py Launch Blueprint"; the principles themselves are language-agnostic.
- **TS/Node equivalent**: Near-verbatim copy with "Python" → "TypeScript" and project name swapped; the philosophy transfers wholesale.
- **Open questions**: none
- **Validation strategy**: Proofread for stale Python references; docs build and link check pass.
- **Status**: Indexed

### `docs/source/contributing/CODE_OF_CONDUCT.md`
- **Target path**: docs/source/contributing/CODE_OF_CONDUCT.md
- **Port category**: Copy as-is
- **Purpose**: Community code of conduct: pledge, behavior standards, enforcement, reporting.
- **Features/capabilities**: Expected/unacceptable behavior lists, enforcement ladder (warnings, temporary bans, permanent removal), reporting channel with an `[INSERT CONTACT]` placeholder, attribution to Contributor Covenant 2.0.
- **Best-practice intent**: Inclusive, harassment-free community with a clear, enforceable conduct policy — a standard OSS governance artifact.
- **Python-specific assumptions**: none
- **TS/Node equivalent**: Identical file; language-agnostic. Note the `[INSERT CONTACT]` placeholder should be preserved as a template placeholder (or filled) deliberately, not accidentally shipped.
- **Open questions**: Whether the TS template fills the reporting contact or keeps it as a documented placeholder for downstream users.
- **Validation strategy**: File present, referenced from contributing index, attribution link resolves.
- **Status**: Indexed

### `docs/source/contributing/cla/cla-setup-guide.md`
- **Target path**: docs/source/contributing/cla/cla-setup-guide.md
- **Port category**: Copy as-is
- **Purpose**: Maintainer-facing walkthrough for enabling cla-assistant.io on a GitHub repo.
- **Features/capabilities**: Steps to sign in to cla-assistant.io and configure a repo; create a CLA.md GitHub Gist and link its raw URL; exempt bot accounts via the `*[bot]` pattern (with rationale); a four-step end-to-end test procedure (first-time PR flow, signing, badge turning green, persistence across PRs); monitoring signatories via the dashboard.
- **Best-practice intent**: Repeatable, verified legal-compliance automation on PRs — including testing the automation itself and avoiding noise on bot PRs.
- **Python-specific assumptions**: none — entirely GitHub/CLA Assistant process.
- **TS/Node equivalent**: Identical file; the CLA Assistant workflow is language-agnostic.
- **Open questions**: none
- **Validation strategy**: Link check on cla-assistant.io/GitHub URLs; if the TS repo actually enables CLA Assistant, run the guide's own test procedure.
- **Status**: Indexed

### `docs/source/contributing/cla/corporate_cla.md`
- **Target path**: docs/source/contributing/cla/corporate_cla.md
- **Port category**: Copy as-is
- **Purpose**: Legal text of the Corporate Contributor License Agreement between a contributing entity and the maintainers.
- **Features/capabilities**: 8 sections: definitions of Contribution/Corporation/Maintainers, perpetual irrevocable copyright license grant, patent license grant with litigation-termination clause, representations (authority, employee authorization, originality), warranty disclaimer, limitation of liability, third-party submission marking ("Submitted on behalf of a third party"), signature section.
- **Best-practice intent**: Protects the project's legal right to use corporate contributions; standard Apache-CLA-style IP hygiene.
- **Python-specific assumptions**: none — pure legal text, project-agnostic.
- **TS/Node equivalent**: Identical file.
- **Open questions**: none
- **Validation strategy**: File present and linked from cla_faq and contributing index; text unmodified from source (diff check).
- **Status**: Indexed

### `docs/source/contributing/cla/individual_cla.md`
- **Target path**: docs/source/contributing/cla/individual_cla.md
- **Port category**: Copy as-is
- **Purpose**: Legal text of the Individual Contributor License Agreement.
- **Features/capabilities**: 9 sections: definitions, copyright license grant, patent license grant with litigation-termination clause, representation of legal entitlement (including employer-IP carve-out referencing the Corporate CLA), originality representation, no-support-obligation clause with AS-IS disclaimer, third-party submission marking, duty to notify of inaccuracies, signature section.
- **Best-practice intent**: Same IP-hygiene discipline as the corporate CLA, scoped to individual contributors, including the employer-rights edge case.
- **Python-specific assumptions**: none
- **TS/Node equivalent**: Identical file.
- **Open questions**: none
- **Validation strategy**: File present and linked from cla_faq and contributing index; text unmodified from source (diff check).
- **Status**: Indexed

### `docs/source/contributing/cla_faq.md`
- **Target path**: docs/source/contributing/cla_faq.md
- **Port category**: Copy as-is
- **Purpose**: Contributor-facing FAQ explaining what a CLA is, why it's required, and how signing works.
- **Features/capabilities**: Q&A covering: CLA definition, rationale, signing via the CLA Assistant bot on PR open, relative links to `cla/individual_cla.md` and `cla/corporate_cla.md`, sign-once persistence, irrevocability, and contact path (GitHub issue or maintainers).
- **Best-practice intent**: Lowers contributor friction around the legal gate by answering the predictable questions up front.
- **Python-specific assumptions**: none
- **TS/Node equivalent**: Identical file; keep the relative links intact if the cla/ directory structure is preserved.
- **Open questions**: none
- **Validation strategy**: Docs link check confirms the two relative CLA links resolve.
- **Status**: Indexed

### `docs/source/contributing/index.md`
- **Target path**: docs/source/contributing/index.md
- **Port category**: Copy then modify
- **Purpose**: Main contributing guide and index for the contributing docs section.
- **Features/capabilities**: Bug-report and enhancement-request issue templates (title/description/repro/use-cases fields); PR guidelines (coding style, tests pass, docs updated, clear description) with a link to `../tasks/contributing_code.md#development-workflow`; CLA section linking the setup guide and both CLA texts plus CLA Assistant bot behavior; contributor tracking via COG (Cocogitto) into CONTRIBUTORS.md (triggered on push to main, PR merge, or `just contributors`; counts commits, excludes noreply.github.com emails, sorts by commit count); Code of Conduct link; docs-contribution rules (all docs in `docs/source/`, keep directory structure, use Sphinx `:doc:`/`:ref:` cross-references); a `{toctree}` listing cla_faq, CODE_OF_CONDUCT, individual_cla, corporate_cla.
- **Best-practice intent**: One canonical entry point for contributors covering process, legal, community, and docs conventions; automates contributor attribution.
- **Python-specific assumptions**: Sphinx/MyST syntax (`{toctree}`, `:doc:`/`:ref:` guidance), `docs/source/` layout, py-launch-blueprint naming and repo URLs; `just contributors` recipe (just itself is language-agnostic; Cocogitto is a Rust binary operating on git history, also language-agnostic).
- **TS/Node equivalent**: Same guide with project name/URLs updated, cross-reference guidance rewritten for the chosen docs framework, the `../tasks/contributing_code.md` link kept only if that page is ported, and the COG/`just contributors` section kept if the TS repo retains Cocogitto (it can) or rewritten for whatever contributor-tracking mechanism is chosen.
- **Open questions**: Does the TS repo keep Sphinx/MyST or switch docs frameworks (affects toctree and `:doc:`/`:ref:` instructions)? Does it retain Cocogitto + just for contributor tracking? Both are research-phase decisions.
- **Validation strategy**: Docs build and link check (especially the cross-section link to tasks/contributing_code.md); if COG is kept, run the contributors recipe and confirm CONTRIBUTORS.md updates.
- **Status**: Indexed

## Group: docs-reference-tasks

# Fragment 08: docs-reference-tasks

### `docs/source/reference/cli_reference.md`
- **Target path**: docs/source/reference/cli_reference.md (under whichever docs generator the TS repo adopts)
- **Port category**: Copy then modify
- **Purpose**: Reference page documenting every `just` recipe exposed by the project's Justfile, grouped by area (run, quality, deps, docs, dev tools, build, utility).
- **Features/capabilities**: Documents recipes: `just run [cmd] [args]` (default cmd `py-projects`), `check` (lint+typecheck+test), `lint`, `format`, `typecheck`, `test [OPTIONS]` (extra pytest options), `install-dev`, `install-dev-pip`, `install-docs`, `init-docs`, `docs-help`, `docs [target]` (html/latexpdf), `docs-dev` (hot-reload docs server), `docs-clean`, `pre-commit-setup`, `pre-commit-run`, `contributors` (updates CONTRIBUTORS.md), `build`, `version`, `clean`, plus pip-fallback variants `format-pip`, `lint-pip`, `typecheck-pip`, `test-pip`.
- **Best-practice intent**: Every developer-facing task has a single documented entry point via a task runner; the CLI surface is discoverable without reading the Justfile source.
- **Python-specific assumptions**: Recipe payloads are Python-toolchain (pytest options, pip editable installs, Sphinx docs targets, `py-projects` entry point); dual uv/pip recipe variants; the `just` runner itself is language-agnostic.
- **TS/Node equivalent**: Same doc structure documenting the TS repo's task runner surface (Justfile recipes and/or package.json scripts wrapping the chosen TS toolchain); rewrite each command's payload; drop the pip-variant section (no dual-package-manager analog unless the TS repo keeps one).
- **Open questions**: Whether the TS repo keeps `just` as the runner or uses package.json scripts only; final recipe list depends on toolchain choices (test runner, linter, docs tool) made in the research phase.
- **Validation strategy**: After the TS Justfile/scripts exist, run every documented command verbatim and confirm it succeeds; doc build passes with no broken cross-references.
- **Status**: Indexed

### `docs/source/reference/configuration_files.md`
- **Target path**: docs/source/reference/configuration_files.md
- **Port category**: Copy then modify
- **Purpose**: Reference page listing each root-level configuration file and what it controls, with links to the files on GitHub.
- **Features/capabilities**: Describes four files: `pyproject.toml` (project metadata, deps, tool config), `.pre-commit-config.yaml` (pre-commit quality hooks), `pyrightconfig.json` (Pyright type-checker settings: includes/excludes, target Python version, reporting options), `cog.toml` (Cocogitto: repo URL, changelog style, commit parsing categories, contributor list formatting/sorting).
- **Best-practice intent**: All project configuration is enumerated and explained in one place so template adopters know what to customize.
- **Python-specific assumptions**: Three of four entries are Python-toolchain files (pyproject.toml, pyrightconfig.json, pre-commit's Python-centric hooks); cog.toml/Cocogitto is language-agnostic.
- **TS/Node equivalent**: Rewrite entries for the TS repo's config set — package.json, tsconfig.json, linter/formatter config (e.g. oxlint/Biome/ESLint config per later tool selection), git-hook manager config (pre-commit vs husky/lefthook TBD), cog.toml likely carried over as-is; update GitHub links to the ts-launch-blueprint repo.
- **Open questions**: Final config-file inventory depends on toolchain research (linter, formatter, hook manager, docs tool).
- **Validation strategy**: Cross-check the doc against the actual root of the TS repo — every config file present is documented and every documented file exists; links resolve.
- **Status**: Indexed

### `docs/source/reference/index.md`
- **Target path**: docs/source/reference/index.md
- **Port category**: Copy then modify
- **Purpose**: Landing page for the Reference section with a Sphinx/MyST toctree.
- **Features/capabilities**: One intro sentence plus a `{toctree}` directive (maxdepth 2) listing project_structure, configuration_files, cli_reference, versioning.
- **Best-practice intent**: Diátaxis-style docs organization — a dedicated Reference category with explicit navigation.
- **Python-specific assumptions**: MyST/Sphinx `{toctree}` directive syntax; otherwise none.
- **TS/Node equivalent**: Equivalent section index/nav entry in the chosen TS docs tool (e.g. sidebar config in VitePress/Docusaurus/Starlight, or kept as MyST if Sphinx is retained); same four child pages.
- **Open questions**: Docs generator for the TS repo is undecided (research phase); nav mechanism follows from that.
- **Validation strategy**: Docs site builds; Reference section renders with all four child pages reachable from the index.
- **Status**: Indexed

### `docs/source/reference/project_structure.md`
- **Target path**: docs/source/reference/project_structure.md
- **Port category**: Copy then modify
- **Purpose**: Annotated directory-tree reference explaining the purpose of every top-level directory and file in the template.
- **Features/capabilities**: Short and detailed ASCII trees covering .github/ (issue templates, PR template, workflows), docs/ (Sphinx source, CLA files), py_launch_blueprint/ (`__init__.py`, `_version.py`, `projects.py`), tests/ (test_api/test_cli/test_config/test_projects), plus per-file descriptions of .gitignore, .pre-commit-config.yaml, .python-version, .readthedocs.yaml, .vscode/extensions.json, CLAUDE.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md, EXAMPLECLI.md, Justfile, Makefile, PULL_REQUEST_TEMPLATE.md, pyproject.toml, cog.toml, CONTRIBUTORS.md, pyrightconfig.json, README.md, SECURITY.md. Note: source has known defects — duplicated tree entries (tests/, docs/ listed twice) and pyrightconfig.json misdescribed as "a static type checker for TypeScript and JavaScript"; do not carry these forward.
- **Best-practice intent**: Template adopters can understand every file's role at a glance; nothing in the repo is unexplained.
- **Python-specific assumptions**: Entire tree reflects the Python layout (package dir, .python-version, pyproject.toml, pyrightconfig.json, Sphinx docs).
- **TS/Node equivalent**: Same doc regenerated from the actual ts-launch-blueprint tree once it exists (src/, tests/, package.json, tsconfig.json, node version pin, etc.); keep the cross-platform entries (GitHub templates, CODE_OF_CONDUCT, SECURITY, Justfile, cog.toml).
- **Open questions**: Final TS tree depends on nearly every other porting decision; this doc should be written late, after the structure stabilizes.
- **Validation strategy**: Diff the documented tree against `git ls-files`-derived actual structure of the TS repo; every path in the doc exists and is described accurately.
- **Status**: Indexed

### `docs/source/reference/versioning.md`
- **Target path**: docs/source/reference/versioning.md
- **Port category**: Needs research
- **Purpose**: Explains Git-tag-driven automatic versioning via setuptools_scm/hatch, release creation, dev-version formatting, and the release CI workflow.
- **Features/capabilities**: Tag-to-version derivation (`v1.2.3` → `1.2.3`), dev versions like `1.2.4.dev1+gabcdef12`, fallback `0.0.0`, release steps (`git tag -a` + push), `hatch build`, `local_scheme` customization table (no-local-version, node-and-date, node-and-timestamp, dirty-tag, local-version), release.yml workflow walkthrough (tag trigger, `fetch-depth: 0`, uv setup, hatch build, tag-vs-package version validation gate), troubleshooting section (0.0.0, CI mismatch, dirty suffix, `v*` tag format).
- **Best-practice intent**: Single source of truth for versions is the Git tag; CI enforces tag/package version alignment; releases are reproducible and semver-formatted.
- **Python-specific assumptions**: Entirely built on setuptools_scm/hatch semantics — PEP 440 dev/local version formats (`+gabcdef12`), `local_scheme` options, `pyproject.toml` config, importable `__version__`.
- **TS/Node equivalent**: Uncertain — candidates for tag-driven versioning in Node include changesets, semantic-release, or a lightweight git-describe script stamping package.json at build/release time; npm has no PEP 440 local-version analog (semver prerelease/build metadata differ). Tool selection deferred to research phase; the doc then gets rewritten around the chosen mechanism while preserving the tag-is-truth + CI-validation intent.
- **Open questions**: Which release/versioning tool the TS template adopts; whether dev builds get version metadata at all; how the CI tag-vs-package validation gate is implemented for package.json.
- **Validation strategy**: After tooling is chosen: tag a test release in a scratch clone, run the documented commands verbatim, confirm the release workflow's version-validation step passes/fails as documented.
- **Status**: Needs research

### `docs/source/tasks/contributing_code.md`
- **Target path**: docs/source/tasks/contributing_code.md
- **Port category**: Copy then modify
- **Purpose**: Task guide for contributors: code style rules, fork/branch/test/commit workflow, Justfile usage, code review process, docs contribution rules, CLA requirement, and automated contributor tracking.
- **Features/capabilities**: Style rules (88-char lines, strict typing on all functions, sorted imports preferring relative, PEP 8 naming, explicit error handling over assertions, optional annotations in tests, bandit security rules, no hardcoded credentials); 8-step dev workflow (fork, clone, branch, `uv pip install --editable ".[dev]"`, change, `just test`, Conventional Commits, push); `just --list` discovery; review expectations; docs live in `docs/source/` with Sphinx `:doc:`/`:ref:` cross-refs; CLA gate with link; Cocogitto-driven CONTRIBUTORS.md (auto-updates on main push/PR merge or `just contributors`; counts commits, excludes noreply domains, sorts by commit count).
- **Best-practice intent**: Contributions are consistent (style + Conventional Commits), legally clean (CLA), verified before push (tests), and attribution is automated rather than manual.
- **Python-specific assumptions**: PEP 8, 88-char (Black/Ruff) line length, bandit, uv editable install, pytest via `just test`, Sphinx cross-reference syntax.
- **TS/Node equivalent**: Same guide with TS substitutions — style rules restated for the chosen linter/formatter config, install step becomes the Node package-manager install, Sphinx cross-ref guidance becomes the chosen docs tool's link syntax; Conventional Commits, CLA, review process, and Cocogitto contributor tracking carry over unchanged.
- **Open questions**: Exact style-rule list depends on linter/formatter selection (goal.md mentions oxc/Oxlint); security-linting analog to bandit for TS is unselected.
- **Validation strategy**: Follow the guide end-to-end on a fresh clone (install, test, commit with hook enforcement); `just contributors` (or equivalent) regenerates CONTRIBUTORS.md; all internal doc links resolve.
- **Status**: Indexed

### `docs/source/tasks/debugging_configuration.md`
- **Target path**: docs/source/tasks/debugging_configuration.md
- **Port category**: Copy then modify
- **Purpose**: Guide for launching debug sessions in VS Code, Cursor, and Windsurf using the shared `.vscode/launch.json`.
- **Features/capabilities**: General 5-step debugging flow (open project, open debug panel per editor, pick config, set breakpoints, start); documents two launch.json configurations: `Python: Launch Main` (runs `py_launch_blueprint/projects.py`) and `Python: Launch Main (With Args)` (adds `--workspace test --limit 10`); notes Cursor and Windsurf reuse the same launch.json format. File ends with a dangling "see the documentation of each editor:" (no links) — a defect not to carry forward.
- **Best-practice intent**: Working debugger configs ship with the template so contributors get breakpoint debugging in any VS Code-family editor with zero setup.
- **Python-specific assumptions**: `"type": "python"` debug adapter (debugpy) and a Python entry-file program path with CLI args.
- **TS/Node equivalent**: Same doc with launch.json examples using the `node` debug type (or tsx/ts-node runtime args, per chosen dev-run strategy) pointing at the TS CLI entry point, one plain and one with-args configuration.
- **Open questions**: How the TS entry point is executed in dev (tsx, ts-node, compiled dist) determines the launch config shape.
- **Validation strategy**: Open the TS repo in VS Code, run both documented configurations, hit a breakpoint in the entry module.
- **Status**: Indexed

### `docs/source/tasks/index.md`
- **Target path**: docs/source/tasks/index.md
- **Port category**: Copy then modify
- **Purpose**: Landing page for the Tasks (how-to) section with a Sphinx/MyST toctree.
- **Features/capabilities**: Intro paragraph plus `{toctree}` (maxdepth 2) listing setting_up_development, type_checking_code, using_ci_cd, managing_dependencies, contributing_code, debugging_configuration.
- **Best-practice intent**: Diátaxis-style separation — task-oriented how-to guides get their own navigable section.
- **Python-specific assumptions**: MyST/Sphinx toctree syntax only.
- **TS/Node equivalent**: Section index/sidebar entry in the chosen TS docs tool listing the same six ported task pages.
- **Open questions**: Docs generator choice (same open question as reference/index.md).
- **Validation strategy**: Docs build succeeds; all six task pages reachable from the section index.
- **Status**: Indexed

### `docs/source/tasks/managing_dependencies.md`
- **Target path**: docs/source/tasks/managing_dependencies.md
- **Port category**: Replace with TypeScript/Node ecosystem equivalent
- **Purpose**: Task guide for installing, updating, removing, and freezing dependencies via uv (primary) and pip (fallback).
- **Features/capabilities**: uv install (`pip install uv`), editable dev install (`uv pip install --editable ".[dev]"`), `uvx` tool invocations (ruff format/check, mypy, pytest, pytest-cov with coverage flags), optional pre-commit install/run, upgrade/uninstall commands, `uv pip freeze > requirements.lock`; pip path: venv creation/activation (Unix + Windows), editable install, direct tool runs.
- **Best-practice intent**: Dependency management is documented as copy-pasteable commands; a fast modern manager is primary with a vanilla fallback; lockfile discipline.
- **Python-specific assumptions**: Entire content is uv/pip/venv/extras semantics — no venv, editable installs, extras syntax, or `uvx` in Node; lockfiles are automatic in Node package managers.
- **TS/Node equivalent**: Rewritten "Managing Dependencies" guide around the chosen Node package manager (npm/pnpm/bun — selection pending): install, add/remove/update (`pnpm add/remove/update` or equivalents), dev vs prod dependencies replacing extras, automatic lockfile replacing manual freeze; the dual uv/pip structure likely collapses to a single manager.
- **Open questions**: Which package manager the template standardizes on; whether a secondary/fallback manager path is kept at all.
- **Validation strategy**: Execute every documented command verbatim on a fresh clone; lockfile behavior matches the doc's claims.
- **Status**: Indexed

### `docs/source/tasks/setting_up_development.md`
- **Target path**: docs/source/tasks/setting_up_development.md
- **Port category**: Copy then modify
- **Purpose**: Onboarding guide: verify base tools with `make check`, then set up the dev environment via uv or pip, including formatter/linter/typecheck/test/coverage commands, running the CLI, pre-commit hooks, and template-customization steps for new projects.
- **Features/capabilities**: `make check` dependency preflight; Python 3.10+ pin via `.python-version`; uv path (`uv pip install --editable ".[dev]"`, `uvx ruff format/check`, `uvx --with-editable . mypy|pytest`, coverage with `--cov=py_launch_blueprint.projects --cov-report=term-missing`, running `py-projects` via uvx); pip path (venv create/activate for Unix/Windows, editable install, direct tool runs, `py-projects --version`); optional pre-commit install/run for both paths; "Customization for New Projects" section (replace package name in CI version-verification step, update CI python-version).
- **Best-practice intent**: A new contributor goes from clone to fully verified dev environment with copy-paste commands; environment prerequisites are checked before setup (`make check`); template adopters know exactly what to rename.
- **Python-specific assumptions**: uv/pip/venv, `.python-version`, ruff/mypy/pytest/pytest-cov, editable installs, Python entry-point script, CI snippets referencing `uv run python -c "import …__version__"`.
- **TS/Node equivalent**: Same doc shape: keep `make check` preflight (retargeted to node/npm/just etc.), Node version pin (.nvmrc or package.json engines) replacing .python-version, single package-manager install path, format/lint/typecheck/test/coverage commands from the chosen TS toolchain, running the CLI binary, hook setup, and a template-customization section (package name in package.json, Node versions in CI matrix).
- **Open questions**: Node version-pinning convention (.nvmrc vs engines vs volta) and whether dual setup paths are kept; toolchain commands pending research.
- **Validation strategy**: Fresh-clone walkthrough: `make check` then every setup command in order on a clean machine/container; CLI `--version` works at the end.
- **Status**: Indexed

### `docs/source/tasks/type_checking_code.md`
- **Target path**: docs/source/tasks/type_checking_code.md
- **Port category**: Replace with TypeScript/Node ecosystem equivalent
- **Purpose**: Task guide for setting up and running static type checking with MyPy and Pyright, plus type-annotation best practices and troubleshooting.
- **Features/capabilities**: MyPy setup (install, `[tool.mypy]` in pyproject.toml, run via `uvx --with-editable . mypy` or `just typecheck`); Pyright setup (install, pyrightconfig.json, run via uvx); best practices (annotate all functions, use type hints, avoid `Any`, use `TypedDict`, check third-party stubs); five common issues with fixes (missing annotations, incompatible types, `# type: ignore` / `# pyright: ignore` suppression comments, installing `types-<library>` stubs, checking specific files).
- **Best-practice intent**: Strict static typing is mandatory and enforced by tooling; suppressions are explicit and sparing; the guide teaches discipline, not just commands.
- **Python-specific assumptions**: Entire dual-checker premise (MyPy + Pyright), stub packages, PEP 484 hint vocabulary, pyproject/pyrightconfig configuration.
- **TS/Node equivalent**: Rewritten guide around `tsc --noEmit` with a strict tsconfig (strict, noUncheckedIndexedAccess, etc.): the dual-checker concept collapses since types are native to TS; best-practices section maps to avoiding `any`, using interfaces/type aliases (TypedDict analog), `@ts-expect-error` over `@ts-ignore` for suppression, and `@types/<pkg>` DefinitelyTyped packages as the stub analog; checking specific files maps to tsc project references or file args.
- **Open questions**: Exact strictness flag set for the template tsconfig; whether an additional checker/lint layer (typescript-eslint type-aware rules or oxlint equivalents) supplements tsc.
- **Validation strategy**: Run every documented command; introduce a deliberate type error and confirm the documented workflow catches it and the documented suppression syntax silences it.
- **Status**: Indexed

### `docs/source/tasks/using_ci_cd.md`
- **Target path**: docs/source/tasks/using_ci_cd.md
- **Port category**: Copy then modify
- **Purpose**: Guide explaining the GitHub Actions CI workflow: triggers, jobs, full YAML listing, and customization recipes.
- **Features/capabilities**: Documents `.github/workflows/ci.yaml`: triggers on push/PR to main; test job on ubuntu-latest with Python 3.10/3.11 matrix; steps: actions/checkout@v4, astral-sh/setup-uv@v5, actions/setup-python@v5, `uv sync --all-extras --dev`, then `uvx mypy`, `uvx ruff check`, `uvx pytest`; customization examples: extend the version matrix, add bandit security scanning, cache .venv keyed on pyproject.toml hash.
- **Best-practice intent**: CI runs typecheck + lint + tests on a version matrix for every push/PR to main; the workflow is documented alongside the code with copy-paste customization patterns.
- **Python-specific assumptions**: setup-uv/setup-python actions, Python version matrix, uv sync, mypy/ruff/pytest/bandit commands, pyproject-keyed caching.
- **TS/Node equivalent**: Same doc rewritten for the TS workflow: actions/setup-node (with built-in dependency caching) or the chosen PM's setup action, Node LTS version matrix, install + typecheck (tsc) + lint + test steps, customization examples for extending the matrix and adding a security/audit step (e.g. `npm audit` or a TS security scanner — TBD).
- **Open questions**: Node version matrix policy; CI toolchain commands pending linter/test-runner selection; bandit-equivalent security scan choice.
- **Validation strategy**: The documented YAML matches the actual workflow file byte-for-byte (or is generated from it); a test PR exercises the workflow and all documented jobs pass.
- **Status**: Indexed

## Group: docs-tools

# Index fragment: docs-tools (docs/source/tools/)

Source repo: /Users/stevemorin/c/py-launch-blueprint @ 4828f8596b2332d74fbcff932ebab6f0030febd5

Note applying to the whole group: these pages are Sphinx/MyST markdown under `docs/source/tools/`. The docs framework itself (Sphinx + MyST) is Python-toolchain; whether the TS repo keeps a `docs/source/` Sphinx layout or moves to a Node-native docs generator (VitePress, Docusaurus, Starlight, TypeDoc-based) is an open repo-level research question. Target paths below assume a mirrored `docs/source/tools/` layout and should be re-derived once the docs framework decision lands.

### `docs/source/tools/cla-assistant.md`
- **Target path**: docs/source/tools/cla-assistant.md
- **Port category**: Copy then modify
- **Purpose**: Documents the CLA Assistant integration: what it is, how contributors sign the CLA, how maintainers configure/disable it.
- **Features/capabilities**: Setup steps (configured via cla-assistant.io dashboard); CLA documents stored at `docs/source/contributing/cla/` (individual + corporate); PR flow (bot comments with sign link, blocks merge until signed); testing instructions (open PR from unsigned account, verify block/unblock); disabling via branch-protection override or dashboard removal; reference links to individual/corporate CLA pages and CONTRIBUTING.md.
- **Best-practice intent**: Legal compliance discipline — every contribution is covered by a signed CLA, enforced automatically as a required status check rather than manual tracking.
- **Python-specific assumptions**: None in the mechanism; only project-name references ("Py Launch Blueprint") and relative links to Python-repo paths.
- **TS/Node equivalent**: Same tool — CLA Assistant is GitHub-level and language-agnostic. Update project name, repo links, and relative CLA paths for the TS repo.
- **Open questions**: Whether the TS template will actually carry CLA docs/integration, and where the CLA markdown files live in the new docs layout.
- **Validation strategy**: Link-check the page (relative links to CLA docs and CONTRIBUTING resolve); confirm referenced paths exist in the TS repo; if CLA integration is enabled, open a test PR to observe the bot check.
- **Status**: Indexed

### `docs/source/tools/github_actions.md`
- **Target path**: docs/source/tools/github_actions.md
- **Port category**: Translate to TypeScript equivalent
- **Purpose**: Explains the project's GitHub Actions CI setup with an example workflow and best practices.
- **Features/capabilities**: Example `CI/CD` workflow YAML triggered on push/PR to `main`; matrix over Python 3.10/3.11; steps: `actions/checkout@v4`, `astral-sh/setup-uv@v5`, `actions/setup-python@v5`, `uv sync --all-extras --dev`, `uvx mypy py_launch_blueprint/`, `uvx ruff check py_launch_blueprint/`. Best-practices list: keep it simple, matrix builds, cache dependencies, fail fast, monitor regularly.
- **Best-practice intent**: CI on every push/PR to main; type check + lint gate; test across multiple runtime versions; documented so contributors understand the pipeline.
- **Python-specific assumptions**: Entire example workflow is Python-toolchain (setup-python, setup-uv, uv sync, mypy, ruff, Python version matrix, `py_launch_blueprint/` package path).
- **TS/Node equivalent**: Same page concept with a Node workflow example: `actions/setup-node` (or setup for the chosen package manager), Node LTS version matrix, install via chosen package manager, run typecheck (`tsc --noEmit`) and the chosen linter. Exact commands depend on Phase-research tool picks (package manager, linter).
- **Open questions**: Final CI tool commands depend on unresolved package-manager/linter/test-runner selections; whether the TS repo's actual workflow files will match the doc example (source repo's doc example should be treated as illustrative, not authoritative — verify against actual `.github/workflows/` when porting).
- **Validation strategy**: Diff the doc's example workflow against the TS repo's real `.github/workflows/` files; run the workflow in CI and confirm steps match the documented ones.
- **Status**: Indexed

### `docs/source/tools/index.md`
- **Target path**: docs/source/tools/index.md
- **Port category**: Copy then modify
- **Purpose**: Landing page for the Tools docs section: intro paragraph, bulleted tool list with links, and a Sphinx `{toctree}` directive.
- **Features/capabilities**: Bulleted links to ruff, taplo, yaml_lint, mypy, pytest, uv, github_actions, vs_code, makefiles, justfiles, precommit_hooks, cla-assistant; MyST `{toctree}` (maxdepth 2) listing most of the same pages. Known defects to not carry forward: toctree entry `yaml-lint` does not match the actual filename `yaml_lint`, and `precommit_hooks` is in the bullet list but missing from the toctree.
- **Best-practice intent**: Every developer tool in the template has a dedicated, discoverable doc page; the tools section is a curated map of the toolchain.
- **Python-specific assumptions**: The tool list is almost entirely Python-toolchain (ruff, mypy, pytest, uv, taplo); the `{toctree}` directive is Sphinx/MyST syntax.
- **TS/Node equivalent**: Equivalent section index in the chosen docs framework, listing the TS toolchain pages (type checker, linter/formatter, test runner, package manager, plus retained cross-platform pages: GitHub Actions, VS Code, Makefiles, Justfiles, pre-commit-equivalent, CLA Assistant, YAML formatting).
- **Open questions**: Docs framework (Sphinx/MyST vs Node-native) determines whether a toctree-equivalent is needed; final page list depends on tool-selection research.
- **Validation strategy**: Docs build succeeds with no missing-page/orphan warnings; every tools page in the directory is linked from the index; link checker passes.
- **Status**: Indexed

### `docs/source/tools/justfiles.md`
- **Target path**: docs/source/tools/justfiles.md
- **Port category**: Copy then modify
- **Purpose**: Explains the project Justfile: what `just` is, how to install it, and the common development recipes.
- **Features/capabilities**: Install via `make install-just` / `make install-just-force`; discover recipes with `just --list`; documented recipes: `setup`, `format`, `lint`, `typecheck`, `test`, `check` (all checks), `version`, `clean`, `pre-commit-setup`, `build`, `install-dev`; `-pip` variants (`format-pip`, `lint-pip`, `typecheck-pip`, `test-pip`) for running tools directly inside an activated virtualenv instead of via `uvx`; link to a full CLI reference page.
- **Best-practice intent**: One standardized, discoverable command interface for all dev tasks — contributors never need to memorize raw tool invocations.
- **Python-specific assumptions**: The uvx-vs-activated-virtualenv duality (`-pip` recipe variants) and recipe bodies (ruff/mypy/pytest under the hood); `install-dev` editable-install concept.
- **TS/Node equivalent**: Keep `just` (language-agnostic command runner) and this page; rewrite the recipe list to match the TS Justfile (setup, format, lint, typecheck, test, check, build, clean, etc.). The `-pip` variant concept likely has no TS analogue (package-manager scripts vs direct binaries in `node_modules/.bin` is the nearest parallel) and may be dropped.
- **Open questions**: Whether the TS repo keeps just as primary runner vs package.json scripts (or both, with just delegating); final recipe names.
- **Validation strategy**: Every recipe named in the doc exists in the TS repo's Justfile (`just --list` diff against the doc); each documented command runs successfully in a fresh clone.
- **Status**: Indexed

### `docs/source/tools/makefiles.md`
- **Target path**: docs/source/tools/makefiles.md
- **Port category**: Copy then modify
- **Purpose**: Explains Makefile basics (targets/dependencies/commands) and the project's two Makefiles: the root bootstrap Makefile and the Sphinx-generated docs Makefile.
- **Features/capabilities**: General Makefile syntax primer; root Makefile targets: `make check` (system requirements), `make install-just` / `install-just-force` (installs to `~/bin`, PATH via `~/.zshenv`), `make install-uv` / `install-uv-force` (installs to `~/.local/bin`); print-vs-force install pattern (non-force prints the install command, force runs the official install script); docs/Makefile described as sphinx-quickstart-generated and not to be called directly (use just instead).
- **Best-practice intent**: Zero-assumption bootstrap — `make` (universally available) checks and installs the toolchain before any project-specific tooling exists; layered runners (make bootstraps, just runs dev tasks).
- **Python-specific assumptions**: `install-uv` targets (Python package manager); docs/Makefile tied to Sphinx.
- **TS/Node equivalent**: Keep the page and the bootstrap-Makefile pattern; replace uv install targets with the chosen Node toolchain bootstrap (e.g., check for node/package manager, install just). The Sphinx docs/Makefile section is dropped or replaced per the docs-framework decision.
- **Open questions**: Which tools the TS root Makefile bootstraps (node version manager? pnpm/bun? just only?) — depends on tool-selection research.
- **Validation strategy**: Each documented make target exists and behaves as described on a clean machine (`make check` reports missing tools; force installs succeed); doc/Makefile drift check.
- **Status**: Indexed

### `docs/source/tools/mypy.md`
- **Target path**: docs/source/tools/typescript.md (or tsc.md — a type-checking page for the TS toolchain)
- **Port category**: Replace with TypeScript/Node ecosystem equivalent
- **Purpose**: Documents the dual type-checking setup: Mypy for CI/pre-commit strictness, Pylance for real-time editor feedback; teaches type-annotation practices.
- **Features/capabilities**: Rationale for Mypy (CI) + Pylance (editor) split; detailed `disallow_untyped_defs = true|false` comparison with code examples and when-to-use guidance (true for new projects, false for legacy/tests); recommended VS Code Pylance settings JSON (`typeCheckingMode: strict`, workspace diagnostics, inlay hints, relative imports); common annotation examples (Optional, generics/TypeVar, type aliases, Callable); troubleshooting (installing type stubs like types-requests, `# type: ignore` / `# pyright: ignore`, checking specific files). Contains duplicated disallow_untyped_defs content near the end (source-doc defect; do not carry forward).
- **Best-practice intent**: Strict static typing from day one, enforced both in CI and live in the editor; explicit guidance on strictness trade-offs so teams can dial it deliberately.
- **Python-specific assumptions**: Entirely Python: mypy, pyright/Pylance, Python typing module, type stubs, pip.
- **TS/Node equivalent**: `tsc --noEmit` with `"strict": true` in tsconfig.json is the unambiguous equivalent; the strictness discussion maps to `noImplicitAny`/`strict`-family flags; editor feedback comes from VS Code's built-in TypeScript language server (no separate tool needed — the CI-vs-editor duality collapses); ignore mechanisms map to `// @ts-expect-error`; type stubs map to `@types/*` packages from DefinitelyTyped.
- **Open questions**: Whether the TS repo also adopts a faster checker frontend (e.g., tsgo) alongside tsc; exact tsconfig strictness flag set — defer to research phase.
- **Validation strategy**: Documented tsconfig flags match the repo's actual tsconfig.json; documented commands (`tsc --noEmit` or just typecheck) run clean; code examples in the page compile.
- **Status**: Indexed

### `docs/source/tools/precommit_hooks.md`
- **Target path**: docs/source/tools/precommit_hooks.md (name TBD by hook-manager choice)
- **Port category**: Needs research
- **Purpose**: Brief page listing the pre-commit hooks used in the repo and why hooks matter.
- **Features/capabilities**: Enumerates seven hooks: `check-yaml`, `end-of-file-fixer`, `trailing-whitespace`, `check-toml`, `check-added-large-files`, `mypy` (type errors), `ruff` (lint + format). One-line description per hook.
- **Best-practice intent**: Catch formatting, syntax, hygiene, type, and lint errors at commit time, before they reach the repository or CI.
- **Python-specific assumptions**: The pre-commit framework itself is a Python tool (pip-installed); the mypy and ruff hooks are Python-toolchain. The first five hooks are language-agnostic.
- **TS/Node equivalent**: Undecided between (a) keeping the pre-commit framework (works fine for non-Python repos; language-agnostic hooks carry over directly, swap mypy/ruff hooks for tsc/linter hooks) and (b) Node-native hook managers (husky + lint-staged, lefthook). Tool selection belongs to the research phase; the doc will be rewritten around whichever manager is chosen, preserving the same hook intents (YAML/JSON validity, EOF/whitespace hygiene, large-file guard, typecheck, lint).
- **Open questions**: Hook manager choice (pre-commit vs husky/lint-staged vs lefthook); whether typecheck runs at commit time or is CI-only in the TS repo (tsc on staged files is awkward).
- **Validation strategy**: Doc's hook list matches the actual hook config file; make a commit violating each documented rule and confirm the hook blocks it.
- **Status**: Needs research

### `docs/source/tools/pytest.md`
- **Target path**: docs/source/tools/<test-runner>.md (name TBD, e.g., vitest.md)
- **Port category**: Replace with TypeScript/Node ecosystem equivalent
- **Purpose**: Full guide to the pytest test framework: install, write, run, configure, fixtures, best practices, troubleshooting.
- **Features/capabilities**: Install via `uv pip install pytest`; conventions (`tests/` dir, `test_*.py` files, `test_` functions); plain-assert examples; run via `uvx pytest`; feature list (assertions, discovery, fixtures, parametrization, plugins); `pyproject.toml` config example (`[tool.pytest.ini_options]` with `testpaths`, `python_files`); fixture example using `tmp_path`; best practices (isolation, descriptive names, edge cases, Arrange-Act-Assert); troubleshooting (discovery naming, editable install for imports).
- **Best-practice intent**: Testing is a first-class, documented workflow: standardized layout and naming, discovery-driven runs, fixtures over duplication, AAA structure.
- **Python-specific assumptions**: Entirely pytest/Python: uv install, pytest naming conventions, pyproject config, tmp_path fixture, editable installs.
- **TS/Node equivalent**: Equivalent doc page for the chosen TS test runner. Candidates: Vitest, node:test (built-in), Jest. All support discovery conventions (`*.test.ts`), config file, setup/teardown analogues to fixtures, and parametrized tests (`test.each`); the page's intent (conventions + config + best practices + troubleshooting) ports directly once the runner is chosen.
- **Open questions**: Which test runner — defer to research phase (Vitest vs node:test vs Jest trade-offs: speed, TS-native support, ecosystem).
- **Validation strategy**: Documented commands and config match the repo's actual test setup; example tests from the doc run and pass; `just test` exercises the documented flow.
- **Status**: Needs research

### `docs/source/tools/ruff.md`
- **Target path**: docs/source/tools/<linter>.md (name TBD, e.g., oxlint.md or biome.md)
- **Port category**: Replace with TypeScript/Node ecosystem equivalent
- **Purpose**: Introduces Ruff as the all-in-one Python linter/formatter, with pros/cons and a line-length standards discussion.
- **Features/capabilities**: Pros (Rust-fast; consolidates Flake8/Black/isort/pydocstyle/pyupgrade/autoflake; customizable rule selection; CI/IDE integration; autofix) and cons (relative newness); Python line-length standards comparison (79/80 PEP 8, 88 Black default — recommended, 100 Google, 120 max) with rationale; `pyproject.toml` snippet setting `line-length = 88` and pycodestyle `max-line-length`.
- **Best-practice intent**: Prefer one fast consolidated tool over a pile of single-purpose linters; make style decisions (line length) explicit, reasoned, and configured rather than implicit.
- **Python-specific assumptions**: Entirely Ruff/Python: the consolidated-tools list, PEP 8/Black line-length culture, pyproject.toml config.
- **TS/Node equivalent**: Equivalent doc for the chosen JS/TS linter+formatter. Candidates: oxc/Oxlint (repo's goal.md leans this way per commit history), Biome (closest philosophical match — one fast Rust tool replacing ESLint+Prettier), or ESLint + Prettier (incumbent). The line-length discussion maps to formatter printWidth conventions (80/100/120).
- **Open questions**: Linter/formatter selection (oxlint vs Biome vs ESLint+Prettier, and whether lint and format are one tool or two) — research phase; chosen printWidth standard.
- **Validation strategy**: Documented config matches the repo's actual linter config file; `just lint` / `just format` run the documented tool; deliberately misformatted sample is caught.
- **Status**: Needs research

### `docs/source/tools/taplo.md`
- **Target path**: n/a (omitted)
- **Port category**: Omit with reason
- **Purpose**: Guide to Taplo, the Rust-based TOML formatter/linter used for `pyproject.toml` and `cog.toml`.
- **Features/capabilities**: Benefits (fast, configurable, formats + validates, taplo-lsp editor integration, CI via `taplo format`/`taplo check`); install via `just install-taplo`; usage via `just format-toml`, `just check-toml`, `just pre-commit-run`; recommended `.taplo.toml` config (line-width 80, indent-width 4, align-entries, align-comments, array-auto-expand, newline-style LF, respect-ignores); disabling/removal instructions; references.
- **Best-practice intent**: Even config files get enforced, automated formatting — no hand-drift in TOML.
- **Python-specific assumptions**: Its reason for existing here is `pyproject.toml` (and cog.toml) — Python packaging's config format. Taplo itself is language-agnostic.
- **TS/Node equivalent**: Omit: a TS/Node template's config surface is JSON (package.json, tsconfig.json) and YAML, not TOML, so there is nothing for Taplo to format. The intent (config files are format-enforced) transfers to the JSON/YAML formatting story (covered by the chosen formatter and the yamlfmt page). Reinstate Taplo only if the final TS repo actually carries TOML files (e.g., lefthook.toml, wrangler.toml).
- **Open questions**: Confirm at plan time that the final TS file inventory contains no TOML; if it does, flip this to Copy then modify.
- **Validation strategy**: Completeness audit confirms the omission is recorded as deliberate in TS_PORT_INDEX.md; final-repo file scan shows no unformatted TOML.
- **Status**: Indexed

### `docs/source/tools/uv.md`
- **Target path**: docs/source/tools/<package-manager>.md (name TBD, e.g., pnpm.md)
- **Port category**: Replace with TypeScript/Node ecosystem equivalent
- **Purpose**: Guide to using the UV package manager for dependency management in the project.
- **Features/capabilities**: Install via `pip install uv` or `make install-uv`/`make install-uv-force`; installing deps (`uv pip install -r requirements.txt` / from pyproject.toml); adding/removing packages (`uv pip install/uninstall <pkg>`); lockfile creation (`uv pip freeze > requirements.lock`). Note: the doc uses the older `uv pip` interface rather than `uv add`/`uv sync` used elsewhere in the repo (github_actions.md uses `uv sync`) — internal inconsistency; do not carry the stale interface forward.
- **Best-practice intent**: Fast, standardized dependency management with lockfile-based reproducibility, plus a project-blessed install path (make targets).
- **Python-specific assumptions**: Entirely uv/pip/pyproject/requirements — the whole page is Python packaging.
- **TS/Node equivalent**: Equivalent doc for the chosen Node package manager. Candidates: pnpm (speed/strictness, closest uv analogue), npm (zero-install baseline), bun, yarn. Concepts map directly: install deps (`<pm> install`), add/remove (`<pm> add/remove`), lockfile (package-lock.json/pnpm-lock.yaml), bootstrap via make target.
- **Open questions**: Package manager selection — research phase; whether Node version pinning (`.nvmrc`/`engines`/volta) is documented here or in a separate page.
- **Validation strategy**: Every documented command runs successfully against the TS repo; lockfile behavior matches the description; make install targets align with makefiles.md.
- **Status**: Needs research

### `docs/source/tools/vs_code.md`
- **Target path**: docs/source/tools/vs_code.md
- **Port category**: Copy then modify
- **Purpose**: Lists recommended VS Code extensions for the project and how to install them.
- **Features/capabilities**: Eight extensions with IDs and one-line rationales: Python (ms-python.python), Pylance (ms-python.vscode-pylance), Ruff (charliermarsh.ruff), MyPy (matangover.mypy), Even Better TOML (tamasfe.even-better-toml), YAML (redhat.vscode-yaml), GitLens (eamodio.gitlens), Code Spell Checker (streetsidesoftware.code-spell-checker); GUI install steps and `code --install-extension` CLI block for all eight.
- **Best-practice intent**: Editor experience is part of the template — contributors get a curated, one-command-installable extension set matching the toolchain (implies keeping `.vscode/extensions.json` in sync).
- **Python-specific assumptions**: Five of eight extensions are Python-toolchain (Python, Pylance, Ruff, MyPy, Even Better TOML for pyproject); YAML, GitLens, and Code Spell Checker are language-agnostic.
- **TS/Node equivalent**: Same page structure; swap the extension list for the TS toolchain: built-in TypeScript support plus the chosen linter/formatter extension (dbaeumer.vscode-eslint, biomejs.biome, or oxc.oxc-vscode — tracks the linter decision), test-runner extension (e.g., vitest.explorer — tracks the runner decision), retain YAML, GitLens, Code Spell Checker; drop TOML extension with Taplo. Keep the CLI install block pattern and mirror into `.vscode/extensions.json`.
- **Open questions**: Final extension list is downstream of linter/formatter/test-runner selections.
- **Validation strategy**: Doc list matches `.vscode/extensions.json` exactly; each extension ID resolves on the marketplace; `code --install-extension` block runs clean.
- **Status**: Indexed

### `docs/source/tools/yaml_lint.md`
- **Target path**: docs/source/tools/yaml_lint.md (consider renaming to yamlfmt.md for accuracy)
- **Port category**: Copy then modify
- **Purpose**: Documents YAML formatting/linting with yamlfmt for config files, GitHub Actions workflows, and issue templates.
- **Features/capabilities**: Benefits (single Go binary for lint + format, no Node.js needed, configurable via `.yamlfmt`, pre-commit integrated, GitHub-Actions-file compatible); install via `just install-go` + `just install-yamlfmt`; usage via `just format-yaml`, `just lint-yaml`, `just check-yaml`; pre-commit integration with example `.pre-commit-config.yaml` snippet pinning google/yamlfmt v0.13.0 on `\.ya?ml$`; skip via `git commit --no-verify`; disable by editing `.yamlfmt` or removing hooks/just commands. Known defects: the pre-commit section text says "the yamllint hook" while the snippet and tool are yamlfmt (conflation), the `.yamlfmt` configuration section is an empty stub, and the "No Node.js Required" selling point reads oddly in a Node project.
- **Best-practice intent**: YAML (the CI/config lingua franca) is format-enforced automatically at commit time, not hand-maintained.
- **Python-specific assumptions**: None in the tool (yamlfmt is Go); only the pre-commit framework hosting the hook and just-recipe names are project-toolchain details.
- **TS/Node equivalent**: Keep yamlfmt and this page largely as-is (YAML formatting matters just as much in a TS repo with GitHub Actions); update the hook-integration section to whichever hook manager the TS repo adopts; rewrite the "No Node.js Required" framing; fill the empty `.yamlfmt` config section; fix the yamllint/yamlfmt naming conflation. Alternative if consolidating tools: Prettier/Biome can format YAML — fold into the formatter page instead.
- **Open questions**: Keep standalone yamlfmt vs fold YAML formatting into the main formatter (depends on linter/formatter research); hook-manager dependency (see precommit_hooks.md).
- **Validation strategy**: Documented just recipes exist and run; hook config matches the doc; a misformatted YAML file is caught at commit; `.yamlfmt` referenced in the doc exists in the repo.
- **Status**: Indexed

## Group: docs-tutorials

### `docs/source/tutorials/full_project_setup.md`
- **Target path**: docs/source/tutorials/full_project_setup.md (final location depends on the docs-site generator chosen for ts-launch-blueprint; e.g. docs/tutorials/full-project-setup.md under VitePress/Docusaurus)
- **Port category**: Copy then modify
- **Purpose**: End-to-end tutorial walking a new user through setting up a project from the template: clone, install dependencies, install pre-commit hooks, verify with `just check`, configure project metadata, init git, set up CI/CD, and begin the dev loop.
- **Features/capabilities**: Concrete command sequences: `git clone` of the template repo; `uv pip install --editable ".[dev]"`; `uvx --with-editable . pre-commit install`; `just check` / `just test` / `just format` / `just lint`; pointer to `.github/workflows/ci.yaml` for CI customization. A "Project Commands" reference table mapping just recipes to raw tool invocations (`uvx ruff format py_launch_blueprint/`, `uvx --with-editable . mypy py_launch_blueprint/`, `uvx --with-editable . pytest`, single-test invocation `pytest tests/test_file.py::test_name`, `just pre-commit-run`). A "Code Style Guidelines" section (88-char line length/Black standard, strict typing for all functions, sorted imports, PEP 8 naming via Ruff, explicit error handling over assertions, relaxed type annotations in tests, no hardcoded credentials/bandit rules). A "Developer Environment" section (Python 3.10+, uv recommended/pip supported, VS Code with Ruff/MyPy/Pylance extensions). Cross-links to ../tasks/type_checking_code.md, ../tasks/managing_dependencies.md, ../tasks/using_ci_cd.md.
- **Best-practice intent**: A newcomer must be able to go from zero to a fully verified dev environment (deps, hooks, checks green, CI understood) by following one document; the dual just-recipe/raw-command table teaches both the ergonomic and underlying invocations; style/environment bars are stated up front.
- **Python-specific assumptions**: Entirely Python-toolchain-flavored content: Python 3.10+, uv/uvx, pip editable installs, pre-commit, Ruff, MyPy, pytest, Black line length, PEP 8, bandit, pyproject.toml, py_launch_blueprint package path, VS Code Python extensions. The structure/intent is toolchain-agnostic but nearly every command and guideline needs rewriting.
- **TS/Node equivalent**: Same tutorial rewritten for the TS stack once tools are selected: Node LTS + package manager (pnpm/npm), `just` recipes retained, package.json instead of pyproject.toml, chosen linter/formatter (e.g. oxc/Oxlint per repo direction, or Biome/ESLint+Prettier), `tsc` for typechecking, chosen test runner (Vitest/node:test), git hooks equivalent (lefthook/husky or retained pre-commit), VS Code extensions for the chosen tools, TS style guidelines (line length, strict tsconfig, import sorting, no hardcoded credentials).
- **Open questions**: Final command table and style-guideline section depend on tool selections made in the later research phase (package manager, linter/formatter, test runner, git-hook manager, docs generator); repo clone URL for ts-launch-blueprint; whether `just` recipe names (`check`, `test`, `format`, `lint`, `pre-commit-run`, `setup`, `typecheck`) are carried over verbatim (recommended for parity).
- **Validation strategy**: Manual walkthrough: execute every command in the ported tutorial verbatim on a clean clone and confirm each succeeds and matches the described output; cross-check that every command named in the doc exists in the TS repo's justfile/package.json scripts; verify all relative doc links resolve in the built docs site.
- **Status**: Indexed

### `docs/source/tutorials/index.md`
- **Target path**: docs/source/tutorials/index.md (or the chosen docs generator's section-index/sidebar mechanism, e.g. a VitePress sidebar entry or Docusaurus category)
- **Port category**: Copy then modify
- **Purpose**: Landing page for the Tutorials section of the documentation; introduces the section and declares its table of contents.
- **Features/capabilities**: Two short intro paragraphs; a commented-out "Table of Contents" heading; a MyST/Sphinx `{toctree}` directive with `maxdepth: 2` listing a single entry, `full_project_setup`.
- **Best-practice intent**: Diátaxis-style docs organization — tutorials are a distinct top-level section with an index page that frames the learning path and wires child pages into the site navigation.
- **Python-specific assumptions**: The ```{toctree}``` fenced directive is Sphinx/MyST-specific and only renders under the Python Sphinx docs toolchain; the prose itself is generic.
- **TS/Node equivalent**: Prose copies over with "Py Launch Blueprint"/Python wording updated; the toctree becomes the chosen docs generator's navigation mechanism (VitePress sidebar config, Docusaurus `sidebars` category / `_category_.json`, or Starlight sidebar entry). Candidates for the docs generator: VitePress, Docusaurus, Astro Starlight — selection pending.
- **Open questions**: Which docs-site generator ts-launch-blueprint adopts (decided at the docs-toolchain level, not per-page); whether section indexes remain standalone pages or are replaced by sidebar-only navigation in that tool.
- **Validation strategy**: Build the docs site and confirm the Tutorials section renders with the tutorial page reachable from its navigation entry; link checker passes on the section.
- **Status**: Indexed

## Group: python-src-tests

# Index fragment — group "python-src-tests"

Source repo: /Users/stevemorin/c/py-launch-blueprint @ 4828f8596b2332d74fbcff932ebab6f0030febd5

### `py_launch_blueprint/__init__.py`
- **Target path**: `src/index.ts`
- **Port category**: Translate to TypeScript equivalent
- **Purpose**: Package entry point for the demo package. Carries the MIT license header, exposes the package version, and re-exports the CLI entry function.
- **Features/capabilities**: Resolves `__version__` at runtime via `importlib.metadata.version("py_launch_blueprint")` (single source of truth: installed package metadata, not a hardcoded string); re-exports `main` from `projects.py` (`from .projects import main as main`) so the package is importable as a library and consumable as a console-script entry point.
- **Best-practice intent**: One canonical version source read from package metadata; a clean public API surface at the package root; license header on every source file.
- **Python-specific assumptions**: `importlib.metadata` reads installed dist metadata; Python package `__init__.py` semantics; console-script entry points declared in pyproject.toml.
- **TS/Node equivalent**: `src/index.ts` that re-exports the CLI/library API; version read from `package.json` (e.g. `createRequire`/`JSON` import of `package.json`, or an injected constant at build time). The `bin` field in `package.json` replaces the console-script entry point.
- **Open questions**: Whether the TS template reads version from `package.json` at runtime or bakes it in at build time (interacts with bundler choice, decided in research phase).
- **Validation strategy**: `<cli> --version` prints the `package.json` version; importing the package root exposes the documented API; unit test asserting version output matches `package.json`.
- **Status**: Indexed

### `py_launch_blueprint/_version.py`
- **Target path**: n/a (superseded by `package.json` `version` field)
- **Port category**: Replace with TypeScript/Node ecosystem equivalent
- **Purpose**: Machine-generated version file produced by setuptools-scm ("file generated by setuptools-scm / don't change, don't track in version control"), deriving version from git state (`0.1.dev338`).
- **Features/capabilities**: Exports `__version__`, `version`, `__version_tuple__`, `version_tuple`; a `TYPE_CHECKING` shim for the tuple type. Imported by `projects.py` for `click.version_option`.
- **Best-practice intent**: Version derived from git tags/history rather than hand-edited; generated artifact excluded from version control.
- **Python-specific assumptions**: Entirely setuptools-scm/Python packaging machinery; no direct file-level analog needed in Node.
- **TS/Node equivalent**: `package.json` `version` is the canonical source in Node. Git-tag-driven versioning, if kept as a discipline, maps to release tooling (candidates: `changesets`, `semantic-release`, plain `npm version` + tags) — selection belongs to the release-workflow research item.
- **Open questions**: Whether the TS template wants setuptools-scm-style "version from git" automation or standard `package.json` versioning; depends on release tooling chosen later.
- **Validation strategy**: Version reported by `--version` and by `npm pkg get version` agree; release workflow bumps/tags produce a consistent version.
- **Status**: Indexed

### `py_launch_blueprint/projects.py`
- **Target path**: `src/projects.ts` (or `src/cli.ts` + `src/client.ts` + `src/config.ts` if the TS template prefers module-per-concern; keep as one file to mirror the template's deliberately small footprint unless research phase decides otherwise)
- **Port category**: Translate to TypeScript equivalent
- **Purpose**: The template's single demo application: a "Py Project Search" CLI that authenticates to a fictional REST API, lists/filters projects, lets the user interactively multi-select, and outputs results in several formats. It exists to exercise the toolchain (typing, lint, tests, packaging), not as a real product.
- **Features/capabilities**: (1) Custom exceptions `PyError`/`ConfigError` with distinct process exit codes (1 config/no-token, 3 API error, 4 unexpected error). (2) `Config` dataclass with layered config: CLI `--token` > env var `PY_TOKEN` > `.env` file at `~/.config/py-cli/.env` (Windows-aware `USERPROFILE` handling via `get_config_path`), with a rich multi-option help message when no token is found. (3) `PyClient` HTTP client: `requests.Session` with `Authorization: Bearer` + `Accept: application/json` headers, `BASE_URL = https://app.py.com/api/1.0`, `_request` wrapper that surfaces API error payload messages (`errors[0].message`), `get_workspaces()`, `get_projects(workspace_name, limit)` with case-insensitive workspace-name resolution to `gid` and `opt_fields` param. (4) Click CLI flags: `--token`, `--config` (path, must exist), `--workspace`, `--limit` (default 200), `--format` choice text|json|csv (default text), `--copy` (clipboard via pyperclip), `--output` (write file), `--no-color`, `--verbose`, `--version`. (5) Rich console UX: stderr error console, progress spinner during fetch, table display (Project Name/Workspace, +ID when verbose). (6) `questionary.checkbox` interactive multi-select. (7) `format_output` producing JSON (`{"projects": [...]}`), CSV (`id,name` header), or newline-separated ids.
- **Best-practice intent**: Demonstrates the repo's quality bar on a realistic-but-small program: full type annotations, docstrings on every function, layered configuration with clear precedence, helpful actionable error messages, distinct exit codes, separation of config/client/CLI concerns, testable seams (pure `format_output`, injectable config).
- **Python-specific assumptions**: click, requests, rich, questionary, pyperclip, python-dotenv, dataclasses; a leftover `# mypy: ignore-errors` TODO at module top (do NOT carry the escape hatch forward — the TS port should typecheck cleanly).
- **TS/Node equivalent**: A TS CLI with the same behaviors. Candidate libraries (final selection is a research-phase decision): CLI parsing — commander/clipanion/citty/yargs; interactive multi-select — @clack/prompts/@inquirer/prompts; styled output + spinner + table — picocolors/chalk + ora + cli-table3 (or @clack alone); HTTP — built-in `fetch`/undici; env file — Node 20+ `--env-file`/`process.loadEnvFile` or dotenv; clipboard — clipboardy.
- **Open questions**: Library choices above; whether to split into multiple modules; whether the fictional "Py API" demo domain is renamed (e.g. "Ts API"/`TS_TOKEN` env var, `~/.config/ts-cli/`) — naming decision affects tests and docs repo-wide.
- **Validation strategy**: Port the three test suites (api/cli/config) and keep behavior parity: exit codes, config precedence, `--format` outputs, `--version`, workspace filtering, clipboard and file output paths; plus lint/typecheck with no suppressions.
- **Status**: Indexed

### `scripts/update_contributors.py`
- **Target path**: `scripts/update-contributors.ts` (run via tsx/node) or `scripts/update-contributors.mjs`
- **Port category**: Translate to TypeScript equivalent
- **Purpose**: Maintenance script that regenerates the contributor list in `CONTRIBUTORS.md` from git history.
- **Features/capabilities**: Runs `git log --format=%aN <%aE>`, dedupes into a set, sorts alphabetically, and rewrites the region of `CONTRIBUTORS.md` between `<!-- COG-CONTRIBUTORS-LIST:START -->` and `<!-- COG-CONTRIBUTORS-LIST:END -->` markers via regex (DOTALL); prints a count summary. Carries a `# ruff: noqa: S603` suppression for the subprocess-security lint rule (deliberate, scoped suppression rather than disabling the rule globally).
- **Best-practice intent**: Automated, idempotent generation of ack/credits content; marker-delimited regions so manual prose around the list survives regeneration; narrowly scoped lint suppressions.
- **Python-specific assumptions**: `subprocess`, `re`; invoked by the repo's task runner (justfile) and/or docs workflow — the TS port must wire the equivalent invocation.
- **TS/Node equivalent**: Small Node script using `child_process.execFileSync("git", ...)` + string/regex replacement between the same HTML comment markers; the S603-style suppression maps to whatever security lint the TS repo adopts (e.g. eslint-plugin-security or oxlint rule) if triggered.
- **Open questions**: Script runtime convention for the TS repo (plain .mjs vs tsx-run .ts) — pick consistently with other repo scripts in the research phase.
- **Validation strategy**: Run against the repo; verify CONTRIBUTORS.md region is rewritten idempotently (second run = no diff), names sorted and unique, content outside markers untouched.
- **Status**: Indexed

### `tests/__init__.py`
- **Target path**: n/a (omitted)
- **Port category**: Omit with reason
- **Purpose**: Marks `tests/` as a Python package (license header + docstring only, no code).
- **Features/capabilities**: None beyond package marking and the standard MIT header.
- **Best-practice intent**: Proper Python test-package layout so pytest/import resolution behaves predictably; license header discipline.
- **Python-specific assumptions**: Entirely a Python packaging artifact.
- **TS/Node equivalent**: None needed — TS test runners (vitest/jest/node:test) discover `*.test.ts` files by glob; no package-marker file exists in Node. The license-header discipline is carried by the header-check tooling indexed elsewhere.
- **Open questions**: none
- **Validation strategy**: Test runner discovers and runs all test files without any marker file.
- **Status**: Indexed

### `tests/test_api.py`
- **Target path**: `tests/api.test.ts` (naming convention subject to chosen test runner)
- **Port category**: Translate to TypeScript equivalent
- **Purpose**: Unit tests for the `PyClient` HTTP API client using mocked transport (no network).
- **Features/capabilities**: Fixture-created client with fake token; asserts auth/accept headers set on the session; successful `_request` returns parsed JSON; failed request raises `PyError` with the API error message surfaced; `get_workspaces` parses list; `get_projects` respects `limit`; workspace-name filter resolves to `gid` and is passed as request param (asserted via mock call args); unknown workspace name raises `PyError("Workspace not found")`.
- **Best-practice intent**: Test the client seam in isolation with mocked HTTP; assert both happy paths and error translation; verify outgoing request parameters, not just return values.
- **Python-specific assumptions**: pytest fixtures, `unittest.mock.Mock/patch`, `requests` exception types, and knowledge of `_request` internals.
- **TS/Node equivalent**: Same coverage in the chosen TS runner. Mocking candidates depend on HTTP choice: undici `MockAgent`, msw, nock, or vi.mock/fetch-mock. Test runner candidates: vitest, node:test, jest (selection in research phase).
- **Open questions**: Test runner and HTTP-mocking library pairing (must match the HTTP client chosen for `projects.ts`).
- **Validation strategy**: Ported suite passes in CI with no network access; mutation check — breaking header setup or error translation in the client fails a test.
- **Status**: Indexed

### `tests/test_cli.py`
- **Target path**: `tests/cli.test.ts`
- **Port category**: Translate to TypeScript equivalent
- **Purpose**: End-to-end-ish CLI tests via click's in-process `CliRunner`, with the API client and interactive prompt mocked.
- **Features/capabilities**: Tests: `--help` exit 0 + usage text; `--version` contains package version; no-token path exits 1 with "No Py token provided"; token path exits 0; `--workspace Test` forwards `workspace_name="Test", limit=200` to the client; `--format json` output parses as JSON after stripping the progress line, `--format csv` contains `id,name` header, text format contains the id; `--output <file>` writes the formatted result to disk (tmp dir); `--copy` invokes the clipboard function with the formatted result. Uses fixtures for runner and mocked client; patches `questionary.checkbox` to bypass interactivity.
- **Best-practice intent**: Exercise the CLI through its real argument-parsing entry point (not by calling internals), assert exit codes and user-facing output, keep tests hermetic by mocking network/clipboard/prompt boundaries.
- **Python-specific assumptions**: `click.testing.CliRunner` (in-process invocation with captured output), `unittest.mock.patch` of module attributes, pytest `tmp_path`.
- **TS/Node equivalent**: Depends on CLI framework: in-process invocation (e.g. commander `parseAsync` with injected streams, clipanion `Cli.run`) or subprocess invocation via execa against the built binary; prompt and clipboard mocked via the runner's mock facility. There is no universal `CliRunner` analog in Node — the harness pattern must be designed alongside the CLI framework choice.
- **Open questions**: In-process vs subprocess CLI test harness; how progress-spinner output is suppressed/stripped in tests (the Python test regex-strips the "Fetching projects" line — a `CI`/non-TTY guard in the TS CLI may be cleaner).
- **Validation strategy**: Ported suite passes headlessly in CI (no TTY); exit-code assertions preserved (0/1); output-format assertions preserved.
- **Status**: Indexed

### `tests/test_config.py`
- **Target path**: `tests/config.test.ts`
- **Port category**: Translate to TypeScript equivalent
- **Purpose**: Unit tests for layered configuration loading.
- **Features/capabilities**: Config from `PY_TOKEN` env var; config from a `.env` file (tmp dir) with env cleared; precedence test proving env var beats `.env` file; missing-file + unset-env path raises `ConfigError("No PY_TOKEN found")`.
- **Best-practice intent**: Pin the documented config precedence (env > file) with tests; test error path for absent configuration; isolate env state per test (patch.dict/monkeypatch so tests don't leak).
- **Python-specific assumptions**: `unittest.mock.patch.dict(os.environ)`, pytest `monkeypatch.delenv` and `tmp_path`, python-dotenv semantics (existing process env not overridden by `.env` — this is what makes precedence work and must be preserved in the port).
- **TS/Node equivalent**: Same suite in the chosen runner; env isolation via runner facilities (e.g. vitest `vi.stubEnv`/manual save-restore of `process.env`); temp dirs via `fs.mkdtemp`. Note: dotenv's default of not overriding existing `process.env` matches python-dotenv, but Node's `--env-file` differs — the precedence test guards this behavior.
- **Open questions**: none beyond the shared test-runner/env-loading choices already flagged.
- **Validation strategy**: Ported suite passes; deliberately inverting precedence in the config loader fails the precedence test.
- **Status**: Indexed

---

# Part 2 — Feature-level extraction (Phase 2)

Deliberate design decisions identified across 8 feature areas, each mapped to
source files and an intended TypeScript representation. Tool choices flagged
"needs research" are resolved in TS_PORT_RESEARCH.md.

# Feature area: ci-security

Source: py-launch-blueprint @ 4828f8596b2332d74fbcff932ebab6f0030febd5. All line references are to that tree.

## Feature area: ci-security

### Two-version Python matrix on push/PR to main
**Where**: `.github/workflows/ci.yaml` lines 22-34
**Behavior**: The `CI/CD` workflow triggers on `push` to `main` and `pull_request` targeting `main` only (no other branches, no tags). A single `test` job (display name `continuous-integration`) runs on `ubuntu-latest` with `strategy.matrix.python-version: ["3.10", "3.11"]` — the minimum supported version plus one newer version, not the full supported range.
**Intent**: Cheap compatibility signal across the supported floor and a newer interpreter without paying for a full version x OS matrix; keeps template CI fast and free-tier friendly.
**TS representation**: Same trigger shape (`push`/`pull_request` on `main`). Matrix over Node versions instead: minimum supported Node LTS plus current LTS (e.g. `["20", "22"]` — exact versions need research at port time against the chosen `engines.node` floor). `actions/setup-node@v4` with `node-version: ${{ matrix.node-version }}`.

### Toolchain bootstrap: uv + interpreter pin + venv injected into PATH
**Where**: `.github/workflows/ci.yaml` lines 37-54
**Behavior**: Steps are `actions/checkout@v4` → `astral-sh/setup-uv@v5` → `actions/setup-python@v5` with the matrix version → `extractions/setup-just@v2` → `uv venv .venv && uv sync --all-extras --dev` then `echo "$PWD/.venv/bin" >> $GITHUB_PATH`. Installing all extras plus dev dependencies makes every later step run against the full dependency surface; appending the venv bin dir to `GITHUB_PATH` lets subsequent steps call tools without `uv run` prefixes. No explicit cache configuration appears in the workflow — dependency caching is delegated to `setup-uv@v5` defaults.
**Intent**: One fast, standard package-manager path (uv) shared with local dev; `just` installed in CI so CI executes the *same* task-runner recipes developers use, eliminating drift between local and CI commands.
**TS representation**: `actions/checkout@v4` → `actions/setup-node@v4` (with `cache: 'pnpm'`/`'npm'` per chosen package manager — package manager choice itself needs research; pnpm is the closest uv analog in speed/lockfile discipline) → `extractions/setup-just@v2` → single install command (`pnpm install --frozen-lockfile` or equivalent). Preserve the "CI calls just recipes" principle. `node_modules/.bin` is already on PATH for `run` scripts, so the `GITHUB_PATH` trick has no direct analog — drop it.

### Dual enforcement: direct tool steps AND full pre-commit run in CI
**Where**: `.github/workflows/ci.yaml` lines 57-76; `Justfile` lines 102-107 (`install-taplo`), 181-182 (`pre-commit-setup`), 191-194 (`pre-commit-run`); `.pre-commit-config.yaml` (mypy, ruff, ruff-format, yamlfmt, taplo, hygiene hooks)
**Behavior**: CI runs the type checker (`uvx mypy py_launch_blueprint/`), linter (`uvx ruff check py_launch_blueprint/`), and TOML format check (`taplo check '**/*.toml'`, after `just install-taplo` which cargo-installs taplo-cli) as *named individual steps*, and then ALSO runs the entire pre-commit suite (`just pre-commit-setup` + `just pre-commit-run` = `uvx --with-editable . pre-commit run --all`), which re-executes mypy, ruff, ruff-format, yamlfmt, taplo, and file-hygiene hooks. So the core checks are deliberately executed twice.
**Intent**: (1) Named steps give per-tool pass/fail granularity in the PR checks UI; (2) the pre-commit run guarantees the locally-installed git hooks and CI can never disagree — contributors who skip installing hooks still get the identical check set; (3) `uvx` runs tools in isolated ephemeral environments so tool versions do not pollute the project venv.
**TS representation**: Named steps calling `just` recipes for typecheck (`tsc --noEmit`), lint (Oxlint or Biome or ESLint — per repo's TS_PORT_DECISIONS; do not re-decide here), and format check; plus a hook-manager run-all step if the port keeps a pre-commit-style manager (options: keep `pre-commit` itself which is language-agnostic, or `lefthook`/`husky` + a `just check-all` recipe — needs research and must match whatever the git-hooks feature area decides). Preserve the invariant "CI runs the exact hook suite".

### CodeQL advanced setup: weekly cron, least-privilege permissions, extensible language matrix
**Where**: `.github/workflows/codeql.yml` lines 33-39 (triggers), 49 (runner expression), 50-59 (permissions), 61-74 (matrix), 75-111 (steps)
**Behavior**: Triggers on push/PR to `main` plus `schedule: cron '44 21 * * 4'` (weekly, Thursday 21:44 UTC — an arbitrary-minute cron to avoid the top-of-hour thundering herd). The `analyze` job declares a job-level least-privilege permissions block: `security-events: write`, `packages: read`, `actions: read`, `contents: read`. `runs-on` is an expression selecting `macos-latest` only for a hypothetical `swift` matrix entry, else `ubuntu-latest`. Matrix uses `include` with `fail-fast: false`, single entry `{language: python, build-mode: none}`. Steps: checkout → `github/codeql-action/init@v3` (languages + build-mode from matrix; custom `queries:` line present but commented) → a guard step that deliberately `exit 1`s if `build-mode == 'manual'` without real build commands → `github/codeql-action/analyze@v3` with `category: "/language:${{matrix.language}}"`.
**Intent**: SAST on every change plus a weekly rescan so newly-published CodeQL queries flag existing code; explicit minimal token permissions; the scaffolded matrix/runner-expression/manual-build stub keeps the file copy-paste extensible to more languages without restructuring.
**TS representation**: Same workflow nearly verbatim — CodeQL natively supports TS. Matrix entry becomes `{language: javascript-typescript, build-mode: none}` (no compile step needed for JS/TS extraction). Keep the cron, the `fail-fast: false` + `include` matrix shape, the permissions block, and the `category` parameter exactly.

### Dependency Review gate with always-on PR comment
**Where**: `.github/workflows/dependency-review.yml` lines 30-32 (trigger), 40-43 (permissions), 45-58 (job)
**Behavior**: Runs only on `pull_request` to `main`. Workflow-level permissions: `contents: read`, `pull-requests: write` — the write is present solely because of `comment-summary-in-pr: always` (documented inline as such). Single step `actions/dependency-review-action@v4` diffs the PR's dependency manifests against known-vulnerable versions and always posts a summary comment. Stricter knobs (`fail-on-severity: moderate`, `deny-licenses: ...`, `retry-on-snapshot-warnings`) are present but commented out as template configuration points.
**Intent**: Supply-chain gate that surfaces vulnerable-dependency introductions in the PR conversation even when it passes, while leaving severity/license policy as an explicit opt-in for template consumers rather than imposing a default.
**TS representation**: Identical workflow — `actions/dependency-review-action@v4` supports npm/pnpm/yarn lockfiles natively. Keep the commented policy knobs (adjust `deny-licenses` examples to licenses relevant for JS deps) and the permissions comment explaining why `pull-requests: write` exists.

### Manual, environment-gated PR security scan with attributed PR comment
**Where**: `.github/workflows/manual-pr-security-scan.yml` lines 22-32 (dispatch inputs), 37 (environment), 39-48 (checkout + scan), 50-76 (comment)
**Behavior**: `workflow_dispatch`-only, with two required string inputs: `pr_number` and `reviewer` (a human name). The job declares `environment: security-review`, so the `SAFETY_API_KEY` secret it uses can be stored as an environment secret behind protection rules (required approvers), and runs are auditable per-environment. It checks out `refs/pull/<pr_number>/head` (untrusted PR code), runs `pyupio/safety-action@v1` (SCA against the Safety vulnerability DB), then uses `actions/github-script@v7` to post a "Security Review Results" comment on the PR containing pass/fail status, raw scanner output, and `Reviewer: @<reviewer>` attribution.
**Intent**: Resolves the fork-PR secret-exposure problem: automatic secret-bearing scans of fork PRs are unsafe (and the automatic Safety job in ci.yaml is disabled — see next feature), so scanning untrusted code with an API-key-bearing tool is human-initiated, gated behind a protected environment, and leaves an attributed audit trail on the PR itself.
**Known defect to fix in port**: the Safety step has no `id: safety`, yet lines 54-55 reference `steps.safety.outputs.cli-output` / `steps.safety.outputs.exit-code` — those expressions evaluate to empty strings, so the posted comment never contains real results. Also, interpolating scanner output directly into a JS template literal (line 54) is a script-injection risk; the port should pass it via `env:` instead.
**TS representation**: Keep the pattern (workflow_dispatch inputs + `environment:` gate + attributed PR comment via github-script). The scanner itself needs research: candidates are `npm audit` / `pnpm audit` (no API key needed — which may remove the need for the environment secret but keep the environment gate for auditability), OSV-Scanner, or Socket; do not casually pick. Add the missing step `id` and env-based output passing.

### Disabled-but-documented automation: Safety job and PyPI publish as commented scaffolding
**Where**: `.github/workflows/ci.yaml` lines 78-110
**Behavior**: Three blocks are kept as comments inside ci.yaml: (1) a codecov upload step; (2) a `security` job running `pyupio/safety-action@v1` guarded by `if: github.event.pull_request.head.repo.full_name == github.repository` (skip fork PRs so `secrets.SAFETY_API_KEY` is never exposed to untrusted code), annotated "TODO: Waiting on response from support@pyup.io disabled until then"; (3) a `publish` job with `needs: [test, security]` and `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` that builds and twine-uploads to PyPI using a token secret.
**Intent**: The template deliberately ships these as executable documentation — the exact guard conditions (same-repo check for secrets, push-to-main gate for publishing, `needs` ordering publish behind test+security) are the hard-won parts, preserved so a template consumer can enable them by uncommenting rather than rediscovering the security conditions.
**TS representation**: Preserve the pattern: commented (or `if: false`-guarded) jobs in the CI workflow showing (a) an automated SCA job with the same-repo fork guard, (b) an npm publish job gated on push-to-main/tag with `needs: [test, security]`. For publish, prefer npm Trusted Publishing / provenance (`npm publish --provenance` with OIDC, `id-token: write`) over a long-lived token — exact npm trusted-publishing setup needs research at port time. Coverage upload slot (codecov or artifact) kept commented likewise.

### Explicit-but-inconsistent workflow permissions hygiene
**Where**: `.github/workflows/changelog.yml` lines 29-30 (`permissions: contents: write # Explicit permission for better security`); `.github/workflows/update-contributors.yml` lines 29-31 (`contents: write`, `pull-requests: write`); `.github/workflows/dependency-review.yml` lines 40-43; `.github/workflows/codeql.yml` lines 50-59 (job-level); `.github/workflows/ci.yaml` and `.github/workflows/release.yml` (no permissions block at all)
**Behavior**: Workflows that need write access declare it explicitly at workflow level with comments explaining why; CodeQL scopes permissions at job level. But ci.yaml and release.yml declare nothing and therefore inherit the repository default token permissions.
**Intent**: The declared blocks show a deliberate least-privilege intent (the changelog comment says so verbatim); the gaps are an inconsistency, not a decision.
**TS representation**: Normalize in the port: every workflow gets an explicit top-level `permissions:` block — `contents: read` for CI and read-only workflows, elevated scopes only where a comment justifies them (mirror the existing comment style). This is a strict improvement consistent with the template's stated intent, not a new feature.

### Action pinning policy: major version tags, not SHAs
**Where**: all files in `.github/workflows/` — e.g. `ci.yaml` lines 37, 40, 42, 48; `codeql.yml` lines 77, 81, 109; `update-contributors.yml` lines 39 (`actions/checkout@v3`), 44 (`setup-python@v4`), 78 (`peter-evans/create-pull-request@v5`)
**Behavior**: Every third-party action is pinned to a floating major tag (`@v4`, `@v5`, `@v3`), never to a commit SHA. Versions are also not uniform across workflows (checkout is v4 in five workflows but v3 in update-contributors; setup-python v5 vs v4).
**Intent**: Deliberate simplicity trade-off: major tags auto-receive patches without bot-driven bump PRs, at the cost of trusting action publishers (no immutability guarantee). The version skew is drift, not a decision.
**TS representation**: Decide once at port time: either keep major-tag pinning (document the trade-off) or move to SHA-pinning with an update bot — SHA-pinning only makes sense if paired with dependabot/renovate for `github-actions` ecosystem (see next feature), otherwise pins rot. Needs a deliberate decision; at minimum unify versions (checkout@v4, setup-python's Node analog) across all workflows.

### No dependabot/renovate config despite SECURITY.md claiming Dependabot
**Where**: absent — no `.github/dependabot.yml`, no `renovate.json` anywhere in the tree; `.github/SECURITY.md` "Security Controls" section lists "Dependabot alerts and updates" and "Regular dependency audits"
**Behavior**: The repo contains no dependency-update automation config. Dependabot *alerts* (which SECURITY.md references) are a GitHub repo setting, not a file; Dependabot *updates* ("and updates") would require `.github/dependabot.yml`, which does not exist. Vulnerable-dependency defense is therefore: dependency-review on PRs + CodeQL + the manual Safety scan.
**Intent**: The alerts-side is settings-level and invisible in-tree; the missing updates config is a gap between the documented security posture and the tree.
**TS representation**: Close the gap in the port: add `.github/dependabot.yml` covering at least the `github-actions` ecosystem and `npm` ecosystem (weekly schedule, grouped minor/patch updates), or renovate — tool choice needs research/owner preference. Keep SECURITY.md's claims and the actual config in sync.

### Release supply-chain guard: tag/package version consistency check
**Where**: `.github/workflows/release.yml` lines 22-25 (trigger `push: tags: ['v*']`), 51-58 (verification)
**Behavior**: On any `v*` tag push, the workflow builds the package (uv + hatch) and then asserts that the tag version (`${GITHUB_REF#refs/tags/v}`) exactly equals the package's runtime `__version__`; a mismatch fails the workflow. Nothing is published (publish lives commented in ci.yaml), so the workflow's sole enforced outcome is this consistency gate plus a build smoke test.
**Intent**: Prevents the classic release-integrity failure where the git tag and the built artifact's self-reported version diverge — a prerequisite for trustworthy provenance before any publishing is enabled.
**TS representation**: Same gate: on `v*` tags, build, then compare tag version to `package.json` `version` (and any runtime-exported version constant) and fail on mismatch. Trivial with `node -p "require('./package.json').version"`. Pair with the changesets/version-bump tooling the release feature area chooses.

### Automated contributors-list bot PR (permissions + branch-sync pattern)
**Where**: `.github/workflows/update-contributors.yml` lines 22-31 (triggers + permissions), 51-66 (branch sync), 69-85 (commit + `peter-evans/create-pull-request@v5`)
**Behavior**: On push/PR to main and manual dispatch, regenerates CONTRIBUTORS.md from git log via a script, then — instead of pushing to main — syncs/creates a long-lived `update-contributors` branch (checking whether it exists on the remote first to avoid errors), commits as `github-actions[bot]`, and opens/updates a PR against main via peter-evans/create-pull-request with `delete-branch: true`. Requires `contents: write` + `pull-requests: write`.
**Intent**: Bot changes to the repo go through PR review rather than direct pushes to a protected main; the remote-branch-existence check makes repeated runs idempotent.
**TS representation**: Port the pattern as-is (the script becomes a TS/Node script or stays language-agnostic shell); keep the PR-not-push principle and the explicit permissions block. Upgrade the stale action versions (checkout@v3→v4, create-pull-request v5→current major at port time).

### Changelog workflow is a stub
**Where**: `.github/workflows/changelog.yml` lines 22-39
**Behavior**: Triggers on push/PR to main + dispatch, declares `contents: write`, checks out with `fetch-depth: 0` (full history, as changelog generation needs) — and then has no further steps. It generates nothing. (Actual changelog tooling in the repo is `cog.toml` / cocogiteau, used locally.)
**Intent**: Scaffolding for CI-driven changelog generation that was never completed; the full-history checkout and write permission signal the intended design.
**TS representation**: Either complete it (wire the port's conventional-commit changelog tool — choice belongs to the release feature area) or drop the workflow. Do not port a permission-bearing no-op workflow verbatim: `contents: write` on a stub is unnecessary attack surface.

## Feature area: cli

Source of truth: `py_launch_blueprint/projects.py`, `py_launch_blueprint/__init__.py`, `py_launch_blueprint/_version.py`, `tests/test_cli.py`, `pyproject.toml` (entry point), `EXAMPLECLI.md` (documented conventions). All line references verified against pinned SHA 4828f85.

### Single flat command with declarative option parsing

**Where**: `py_launch_blueprint/projects.py:317-344` (`@click.command` + nine `@click.option` decorators + `main` signature); `pyproject.toml:64-65` (`[project.scripts] py-projects = "py_launch_blueprint.projects:main"`); `py_launch_blueprint/__init__.py:26` (re-export of `main`).

**Behavior**: The CLI is one command (no subcommands) named `py-projects` via the console-script entry point. All behavior is expressed through flags: `--token`, `--config`, `--workspace`, `--limit` (default 200), `--format` (constrained choice), `--copy`, `--output`, `--no-color`, `--verbose`, plus `--version` and click's automatic `--help`. Each option carries a `help` string, so `--help` output is fully generated from declarations; the one-line command description ("Search and select Py projects.") comes from the `main` docstring (line 344, asserted in `tests/test_cli.py:48-52`). `--config` uses `click.Path(exists=True)`, so a nonexistent config path is rejected by the parser itself (click usage error, exit code 2) before any application code runs. `--format` uses `click.Choice(["text", "json", "csv"])` so invalid values are parser-rejected with the valid set echoed back. The module is also directly runnable (`if __name__ == "__main__": main()`, lines 411-412; documented in `EXAMPLECLI.md` "Direct Usage").

**Intent**: Keep the demo CLI a single-verb tool whose entire contract (flags, defaults, valid values, help text) is declared in one place next to the handler; push input validation into the framework so the handler only sees valid input; expose the CLI both as an installed binary and an importable/runnable module.

**TS representation**: `bin` field in `package.json` replacing `[project.scripts]`; a single-command CLI built with a declarative parser framework — candidates: commander, clipanion, citty, yargs (final pick needs research, must support: option defaults, enumerated choices with parser-level rejection, auto-generated help from declarations, and an in-process test harness — see the testability feature below). Path-exists validation has no framework freebie in most Node CLI libs; implement as a custom option validator that produces a usage-style error and the usage exit code.

### Version flag backed by VCS-derived single-source version

**Where**: `py_launch_blueprint/projects.py:46` (import), `projects.py:318` (`@click.version_option(version=__version__)`); `py_launch_blueprint/_version.py` (generated file, header "file generated by setuptools-scm ... don't track"); `pyproject.toml:22` (`dynamic = ["version"]`), `pyproject.toml:71-73` (`[tool.setuptools_scm] write_to = ... fallback_version = "0.0.1"`), `pyproject.toml:173-177` (hatch-vcs `version.source = "vcs"`, `local_scheme = "no-local-version"`); `py_launch_blueprint/__init__.py:22-24` (`__version__ = metadata.version(...)` — resolved from installed package metadata, not hardcoded); test at `tests/test_cli.py:55-59`.

**Behavior**: `py-projects --version` prints the package version and exits 0. The version string is never hand-maintained: it is derived from git tags at build time (setuptools-scm/hatch-vcs), written into a generated `_version.py` which is lint-excluded (`pyproject.toml:114`) and untracked, with a `fallback_version` for tag-less builds and `no-local-version` so builds from dirty trees don't get `+g<sha>` suffixes. The CLI imports from the generated file; the package `__init__` independently resolves the same version from installed metadata. The test asserts the printed version matches `__version__` (case-insensitively).

**Intent**: Single source of truth for the version (git tags), zero manual bumps, `--version` guaranteed consistent with the published artifact; a regression test pins the CLI-flag-to-package-version linkage.

**TS representation**: `--version` flag reading `package.json`'s `version` (via `createRequire`/JSON import or a build-time injected constant). The git-tag-derived versioning half is a release-tooling decision (semantic-release, changesets, or manual tags — needs research, belongs to the packaging/release feature area); the CLI-area contract to preserve is: `--version` exits 0, prints exactly the packaged version, and a test asserts CLI output == package.json version.

### Differentiated exit codes per failure class

**Where**: `py_launch_blueprint/projects.py:266-270` (`ConfigError` → exit 1 in `setup_config`), `projects.py:351-353` (missing token → exit 1), `projects.py:401-403` (`PyError` i.e. API failure → exit 3), `projects.py:404-408` (any other `Exception` → exit 4); custom exception hierarchy at lines 53-63 (`PyError`, `ConfigError`); exit-code assertions in `tests/test_cli.py:51,58,66,84,102`.

**Behavior**: The `main` body is wrapped in a single try/except ladder mapping failure classes to distinct exit codes: 0 = success (including the benign "no projects found" at line 364-366 and "no projects selected" at line 383-385, both early-`return` with a yellow notice, NOT errors); 1 = configuration problems (no token); 3 = API errors (`PyError`, printed as `Py API error: ...`); 4 = unexpected exceptions (printed as `Error: ...`). Exit code 2 is implicitly reserved by click for usage errors (bad flag value, nonexistent `--config` path). All error text goes to stderr with a red `Error:`-style prefix. `--verbose` additionally prints a full traceback (`error_console.print_exception()`, line 407) only for the unexpected-exception class.

**Intent**: Scriptability — callers can branch on the exit code to distinguish "fix your config" from "the API is down" from "file a bug"; empty results are deliberately not failures; tracebacks are opt-in diagnostics, never shown to normal users.

**TS representation**: Custom error classes (e.g. `ApiError`, `ConfigError`) plus a top-level catch ladder in the CLI entry calling `process.exit(1|3|4)`; verify the chosen CLI framework's usage-error exit code (commander default is 1, click's is 2 — decide and document whether to preserve the code-2 convention; needs a deliberate decision). Verbose-gated stack trace printing (`if (verbose) console.error(err.stack)`). Port the exit-code test assertions verbatim.

### stdout/stderr stream separation via dual consoles

**Where**: `py_launch_blueprint/projects.py:48-50` (`console = Console()`, `error_console = Console(stderr=True)`); usage split throughout: errors/warnings/config guidance on `error_console` (lines 90-104, 269, 352, 402, 405), data and success notices on `console` (lines 314, 365, 384, 393, 395, 399).

**Behavior**: Two Rich console instances are created at module scope: one bound to stdout for results and status, one bound to stderr for everything a pipe consumer must not see (the missing-token tutorial, config errors, API errors, unexpected errors). The formatted result itself (line 395) goes to stdout, so `py-projects --format json | jq` works even when warnings are emitted.

**Intent**: Machine-readable stdout / human-diagnostic stderr is a hard convention of the template, not an accident — it is what makes the `--format` outputs pipeable.

**TS representation**: Two writer abstractions (or plain `process.stdout.write` for data vs `console.error` for diagnostics); if a styled-output library is chosen it must support targeting stderr explicitly (most do; verify for the picked lib). Encode the rule in the port docs: results → stdout, everything else → stderr.

### Actionable, multi-remedy error guidance on missing token

**Where**: `py_launch_blueprint/projects.py:88-105` (`Config.from_env` missing-token message), consumed via `setup_config` at lines 251-270.

**Behavior**: When no `PY_TOKEN` is found, before raising `ConfigError` the CLI prints (to stderr, yellow-highlighted headline) a numbered list of all three remediation paths — export the env var, create `~/.config/py-cli/.env`, or pass `--token` — each with a copy-pasteable example command, plus the URL where a token can be obtained. Note two latent inconsistencies to fix (not preserve) in the port: the message's example invokes `py-cli` while the installed binary is `py-projects`, and the config path in the message/code (`~/.config/py-cli/.env`, `get_config_path` at lines 110-117) disagrees with `EXAMPLECLI.md`'s documented `~/.config/py-launch-blueprint/.env`.

**Intent**: Error messages as documentation — a first-run failure teaches the full configuration precedence instead of just failing; the exact same three options are the documented precedence order in `EXAMPLECLI.md`.

**TS representation**: A dedicated "missing token" error renderer emitting the same numbered, copy-pasteable remediation list to stderr before exiting 1; derive the binary name and config path from single constants so message, docs, and behavior cannot drift (the drift above is the cautionary tale).

### Layered token configuration surfaced through CLI flags

**Where**: `py_launch_blueprint/projects.py:110-117` (`get_config_path`, Windows `USERPROFILE` vs Unix `Path.home()`), lines 120-147 (`get_config`: file loaded first, env var overrides), lines 251-270 (`setup_config`: default path `~/.config/py-cli/.env` when `--config` absent, `.env` file may be missing without error — line 84-86), lines 345-349 (`--token` flag overrides everything last). Precedence asserted behaviorally in `tests/test_config.py` and documented in `EXAMPLECLI.md` ("in order of precedence").

**Behavior**: Effective token = `--token` flag > `PY_TOKEN` env var > `.env` file (`--config` path if given and it must exist per click validation; otherwise the default per-user config dir, silently skipped if absent). Config-dir resolution is explicitly cross-platform (Windows `USERPROFILE`). The precedence is implemented by ordered assignment: file first, env overwrites, flag overwrites in `main`.

**Intent**: Standard 12-factor-style config layering with the most explicit source winning; missing optional config is not an error; cross-platform home resolution is deliberate template guidance.

**TS representation**: Same three-layer precedence; config dir via `os.homedir()` (Node normalizes Windows) — consider the XDG convention question deliberately rather than hardcoding `~/.config`. Env-file parsing: Node 20+ `process.loadEnvFile`/`--env-file` or `dotenv` (needs research, coordinate with the config feature area — this section claims only the CLI-visible contract: flag beats env beats file, `--config` must exist, default file optional).

### Constrained machine-readable output formats with a pure formatter

**Where**: `py_launch_blueprint/projects.py:323-328` (`--format` as `click.Choice(["text","json","csv"])`, default `text`), lines 273-291 (`format_output` — a pure function), lines 368-370 (Rich table shown only when `format == "text"`), lines 387-395 (result routing); tests at `tests/test_cli.py:108-138`.

**Behavior**: `format_output` is a side-effect-free string builder: `json` → `{"projects": [...]}` wrapper object, 2-space indent; `csv` → literal `id,name` header then rows (no quoting/escaping — naive by design for a demo); `text` → newline-separated project IDs only (no names — optimized for `xargs`/shell composition). The pretty Rich table (Project Name/Workspace columns, `ID` column added only with `--verbose`, lines 294-314) is a separate concern rendered only in text mode and only as a pre-selection preview; the final emitted result is always the plain `format_output` string. Tests parse the JSON output after regex-stripping the progress line and assert the CSV header.

**Intent**: Separate "display for humans" (Rich table, colors) from "output for machines" (pure formatter), keep the formatter trivially unit-testable, and make invalid formats impossible via parser-level choice constraints.

**TS representation**: A pure `formatOutput(projects, format): string` mirroring the three formats byte-for-byte (JSON key `projects`, CSV header `id,name`, text = ids joined by `\n`); format enum enforced by the CLI framework's choice mechanism; keep table rendering out of the formatter. Table lib candidates: cli-table3 or the chosen prompt/UX suite's table primitive (needs research together with the framework pick).

### Rich progress/status UX that degrades for pipes and tests

**Where**: `py_launch_blueprint/projects.py:358-362` (Rich `Progress` context with an indeterminate "Fetching projects..." task), lines 364-366, 383-385, 393, 399 (color-tagged status notices: yellow for benign-empty, green for success confirmations); test workaround at `tests/test_cli.py:125` (regex-strips the `Fetching projects` line before JSON-parsing).

**Behavior**: Network fetch is wrapped in a spinner/progress display with `total=None` (indeterminate) marked completed after the call. Status messages use a consistent color vocabulary: yellow = non-fatal notice, green = success confirmation, red = error prefix. Rich auto-disables ANSI when not a TTY, but the progress *text* still lands in captured output — which is why the JSON test must strip it; this is a known wart the port should improve (emit progress to stderr and/or suppress when non-TTY, so stdout stays clean without test regexes).

**Intent**: Perceived responsiveness during network calls and a consistent color semantics, without (intending to) break pipe consumers.

**TS representation**: Spinner candidates: ora, or the integrated spinner of @clack/prompts (needs research, tied to framework choice). Deliberately improve on the source: route spinner/progress to stderr and gate on `process.stderr.isTTY` (and `CI` env) so `--format json | jq` needs no stripping; keep the yellow/green/red vocabulary via a color lib (picocolors/chalk — needs research) that honors `NO_COLOR`/non-TTY.

### Interactive multi-select as a pipeline stage

**Where**: `py_launch_blueprint/projects.py:372-385` (`questionary.Choice` construction with `"{name} ({workspace})"` titles and full project dicts as values; `questionary.checkbox(...).ask()`; empty selection → yellow notice, exit 0); mocked in every CLI test (`tests/test_cli.py:81,99,120,154,181`).

**Behavior**: After fetch (and optional table preview), the user checkbox-selects a subset of projects; choice labels combine project name and workspace, while the bound value is the full project object so downstream formatting needs no re-lookup. Selecting nothing is a graceful no-op (exit 0). Only the *selected* subset flows into `format_output` and the output/copy sinks — the interactive step is a filter in the data pipeline, not an afterthought. There is no non-interactive bypass flag; tests cope by patching `questionary.checkbox` wholesale.

**Intent**: Demonstrate the pattern label-for-humans/value-for-code in prompts, graceful empty-selection handling, and keeping interactivity mockable at a single seam.

**TS representation**: Multi-select prompt candidates: @inquirer/prompts (`checkbox`) or @clack/prompts (`multiselect`) — needs research alongside how the chosen lib behaves headlessly. Recommend the port add what the source lacks: a documented non-TTY behavior (fail clearly or `--no-input` select-all) since `.ask()` on a non-TTY is undefined-ish in the source; keep the prompt behind an injectable function so tests mock one seam.

### Result routing: stdout, file, and clipboard sinks

**Where**: `py_launch_blueprint/projects.py:329-330` (`--copy` flag, `--output` with `click.Path()`), lines 390-399 (routing: `--output` writes file + green confirmation; else print to stdout; `--copy` additionally copies the same string and confirms); tests at `tests/test_cli.py:141-165` (file) and 168-185 (clipboard, asserting `pyperclip.copy` called with the exact formatted string).

**Behavior**: The single formatted result string is routed: to a file if `--output` is given (confirmation notice replaces the data on stdout), otherwise to stdout; `--copy` is orthogonal and additive (clipboard via pyperclip, works alongside either sink), always copying the identical `format_output` string. Confirmations are green, human-oriented notices.

**Intent**: One canonical result string, multiple orthogonal delivery mechanisms; clipboard integration is a first-class UX feature (called out in `EXAMPLECLI.md` features list) with the exact-payload contract pinned by a test.

**TS representation**: `fs.writeFileSync` for `--output`; clipboard via clipboardy (the de-facto Node option, but flag: clipboard access in headless/CI environments needs research — the port should degrade with a clear error rather than crash); preserve the tests asserting the clipboard receives exactly the formatted string.

### Declared-but-unimplemented `--no-color` (port must implement, not copy)

**Where**: `py_launch_blueprint/projects.py:331` (option declared), `main` signature line 341 — the `no_color` parameter is never read anywhere in the function body.

**Behavior**: `--no-color` is accepted and documented in `--help` ("Disable colored output") but has zero effect; Rich's own TTY detection is the only color suppression that actually happens. This is a latent bug/TODO in the template (alongside the `# mypy: ignore-errors` TODO at line 27-28).

**Intent**: The *intended* convention is user-controllable color suppression for logs/pipes — standard CLI etiquette; the implementation just never landed.

**TS representation**: Implement it for real: `--no-color` flag plus honoring the `NO_COLOR` env var and `FORCE_COLOR`, wired into whichever color library is chosen (picocolors/chalk both support env conventions — needs research on flag-to-lib wiring). Do not port the dead parameter.

### In-process CLI test harness contract

**Where**: `tests/test_cli.py:33-45` (fixtures: `CliRunner`, mocked `PyClient` patched at the module attribute), and every test: exit-code + output assertions through the real argument parser with network (`PyClient`), prompt (`questionary.checkbox`), clipboard (`pyperclip.copy`), and config (`get_config`) all mocked at module seams; `tmp_path` for `--output`.

**Behavior**: All CLI tests invoke `main` through click's in-process `CliRunner` — real flag parsing, captured stdout, no subprocess — and assert user-observable contract only: exit codes, help text presence, version string, forwarded client arguments (`workspace_name="Test", limit=200`), format outputs, file contents, clipboard payload. Every external boundary is mocked; tests are hermetic and TTY-free.

**Intent**: Test the CLI at its public surface (argv in, exit code/output out), not internals; enumerate the exact seams a CLI must keep mockable: HTTP client, prompt, clipboard, config loader, filesystem.

**TS representation**: Choose the CLI framework partly on this criterion: it must support in-process invocation with injectable stdout/stderr (clipanion's `Cli.run` and commander's `exitOverride`+`configureOutput` both can; needs research to pick). Test runner (vitest/node:test — needs research, coordinate with testing feature area) with module mocking for client/prompt/clipboard seams; replicate each test case one-to-one as the port's behavior-parity gate.

### Shell completion: inherited from click, not configured

**Where**: No explicit code — a property of `click.command` (`py_launch_blueprint/projects.py:317`) plus the console-script name (`pyproject.toml:65`); no docs mention it.

**Behavior**: Because the CLI is click-based, `py-projects` automatically supports shell completion via click's `_PY_PROJECTS_COMPLETE=<shell>_source` mechanism for bash/zsh/fish, completing option names and `click.Choice` values. The template neither documents nor tests this; it is a framework freebie, not a deliberate feature.

**Intent**: None deliberate — but it is a real capability difference to be aware of when choosing the TS framework.

**TS representation**: Decide explicitly whether completion is in scope. Node frameworks differ sharply here (yargs has built-in `completion`, citty/commander need extras like omelette or @pnpm/tabtab) — needs research; if dropped, record it in TS_PORT_DECISIONS.md as an accepted behavior gap.

# Feature fragment: config-env

Source repo: /Users/stevemorin/c/py-launch-blueprint @ 4828f8596b2332d74fbcff932ebab6f0030febd5

## Feature area: config-env

### Layered token precedence: CLI flag > env var > config file
**Where**: `py_launch_blueprint/projects.py:120-147` (`get_config`), `projects.py:345-349` (`main` applies `--token` last), `tests/test_config.py:47-55` (`test_config_precedence`), `EXAMPLECLI.md:35-41` (documented order).
**Behavior**: Three token sources are merged with explicit precedence: (1) `--token` CLI option wins over everything (applied in `main` after `setup_config` returns), (2) the `PY_TOKEN` environment variable wins over the config file (`get_config` re-reads `os.getenv("PY_TOKEN")` after loading the file and overwrites the file value), (3) a dotenv-format config file is the lowest layer. The env-over-file guarantee is enforced twice: `python-dotenv`'s `load_dotenv()` defaults to `override=False` (a file can never clobber a real env var in-process), and `get_config` explicitly re-checks the env var afterward.
**Intent**: Standard 12-factor CLI layering — ephemeral invocation flags beat session env, which beats persistent file config. The double enforcement makes precedence robust regardless of dotenv library semantics.
**Known quirk the port must decide on**: in the Python source, `setup_config` calls `Config.from_env`, which raises `ConfigError` (exit 1) whenever `PY_TOKEN` is absent from both env and file — *before* `main` can apply `--token`. So `--token` alone actually fails, contradicting both the error message's own advice ("3. Use the --token option") and `EXAMPLECLI.md`. Tests miss this because `test_cli.py:77-83` patches `get_config`. The TS port should implement the *documented* behavior (flag alone works, validation happens after all three layers merge) and record the deviation in TS_PORT_DECISIONS.md.
**TS representation**: A `resolveConfig({ tokenFlag, configPath })` function that merges the three layers in order and validates once at the end. Dotenv-file parsing: needs research (candidates: `dotenv` npm package with default non-override semantics, or a small hand-rolled parser to avoid a dependency; do not casually pick). Precedence itself should be explicit application code, not delegated to a config framework.

### Default config file location with per-OS home resolution
**Where**: `py_launch_blueprint/projects.py:110-117` (`get_config_path`), `projects.py:261-264` (`setup_config` builds `<config dir>/.env` default), `EXAMPLECLI.md:41-57`.
**Behavior**: Default config file is `~/.config/py-cli/.env`. Home is resolved as `%USERPROFILE%` on Windows (`os.name == "nt"`) and `Path.home()` elsewhere, but the `.config` subdirectory is hardcoded on *all* platforms — it does not honor `XDG_CONFIG_HOME`, nor use `%APPDATA%` on Windows. When the user passes `--config`, that path replaces the default entirely.
**Intent**: Predictable, documented single location for persistent secrets, XDG-flavored without full XDG compliance; the Windows branch shows deliberate cross-platform intent.
**Doc/code mismatch the port must resolve**: the code and its error message use `~/.config/py-cli/.env` (`projects.py:97,117`), but `EXAMPLECLI.md:41,47,52` documents `~/.config/py-launch-blueprint/.env`. Pick one name for the TS project (derive from the CLI binary name) and make code, error text, and docs agree.
**TS representation**: `os.homedir()` + hardcoded `.config/<cli-name>/.env` for strict fidelity; whether to instead honor `XDG_CONFIG_HOME`/platform dirs (e.g. the `env-paths` package) is a deliberate improvement decision — needs research/decision record.

### Missing config file is tolerated; explicitly passed --config path is validated
**Where**: `py_launch_blueprint/projects.py:84-86` (comment: "Don't error if .env file is missing, just try to load if it exists"), `projects.py:320` (`--config` declared with `click.Path(exists=True)`), `tests/test_config.py:58-62`.
**Behavior**: Two different strictness levels. The *default* config path (`~/.config/py-cli/.env`) may be absent — `load_dotenv` silently no-ops and resolution falls through to env vars. But a path given explicitly via `--config` is validated by the CLI layer (`click.Path(exists=True)`) and produces a usage error before any config logic runs. Internally, `Config.from_env("/nonexistent/path")` does not raise for the missing file itself, only for the resulting missing token.
**Intent**: Optional persistent config should never punish users who haven't created it; an explicit user-supplied path that doesn't exist is a user mistake and should fail loudly and early.
**TS representation**: Default path: attempt read, swallow ENOENT. `--config` option: existence check in the CLI option layer (Commander does not have a built-in `exists` validator, so a custom argParser/validation step; framework choice for the CLI is owned by the cli area — needs research).

### Actionable multi-remedy error message for missing token
**Where**: `py_launch_blueprint/projects.py:88-105` (`Config.from_env` guidance block + `ConfigError` raise), `projects.py:266-270` (`setup_config` catches `ConfigError`, prints `Configuration error: ...`, `sys.exit(1)`), `projects.py:351-353` (post-merge fallback: `Error: No Py token provided`, exit 1), `EXAMPLECLI.md:108-115` (exit-code table: 1 = configuration error).
**Behavior**: When no token is found, before raising, the tool prints to stderr a yellow-highlighted notice plus all three remediation paths with copy-pasteable commands (`export PY_TOKEN=...`, create `~/.config/py-cli/.env`, `--token` flag) and the URL where a token can be obtained. Then it raises `ConfigError("No PY_TOKEN found in environment or config file")`, which `setup_config` converts into a red `Configuration error:` line and exit code 1. A second, terser guard in `main` covers the token-still-empty case with exit 1.
**Intent**: Errors should teach the fix — a first-run user gets the complete onboarding recipe in the failure message instead of a bare stack trace. Configuration failures have a stable, documented exit code (1) distinct from API errors (3) and generic errors (4) for scriptability.
**TS representation**: Reproduce the exact remediation text (updated paths/URL) written to stderr; a `ConfigError extends Error` class; centralized exit-code constants matching the EXAMPLECLI table. Styled terminal output library: needs research (owned by the output/UX area — e.g. picocolors/chalk/kleur; pick once project-wide).

### Distinct error taxonomy: ConfigError vs PyError
**Where**: `py_launch_blueprint/projects.py:54-63` (both exception classes), `projects.py:266-270` (ConfigError → exit 1), `projects.py:401-408` (PyError → exit 3, generic Exception → exit 4).
**Behavior**: `ConfigError(Exception)` and `PyError(Exception)` are separate hierarchies (ConfigError deliberately does *not* subclass PyError). Config problems are caught close to the source (`setup_config`) and mapped to exit 1; API problems propagate to `main`'s handler and map to exit 3; anything else maps to exit 4 (with a traceback only under `--verbose`).
**Intent**: Callers and shell scripts can distinguish "your setup is wrong" from "the remote API failed" from "unexpected bug" purely by exit code; error type determines both message prefix and exit status.
**TS representation**: `class ConfigError extends Error` and `class PyError extends Error` (set `name`, use `cause` for the wrapped original error); a top-level catch in the CLI entry mapping instanceof → exit code. No external library needed.

### Secret hygiene: token kept in memory only, docs mandate file permissions
**Where**: `py_launch_blueprint/projects.py:151-169` (`PyClient.__init__` puts token only into the `Authorization: Bearer` session header), `projects.py:71` (`Config.token: str | None`), `EXAMPLECLI.md:55-57` (`chmod 600` on the `.env` file), `tests/test_api.py:33-38`.
**Behavior**: The token is read, held in a plain in-memory `Config` dataclass, and injected once into the HTTP session's `Authorization` header. It is never written to disk by the tool, never echoed in any log/console output (verbose mode prints tracebacks, not config), and the docs instruct users to `chmod 600` the `.env` file they create themselves.
**Intent**: Minimal secret surface: the tool consumes secrets but never persists or displays them; persistence is the user's explicit action with documented least-privilege permissions.
**TS representation**: Same pattern — token flows `resolveConfig → client constructor → Authorization header` and nowhere else; port the `chmod 600` guidance into the TS docs; ensure no debug/verbose path serializes the config object.

### stderr/stdout channel separation for config diagnostics
**Where**: `py_launch_blueprint/projects.py:49-50` (`console` vs `error_console = Console(stderr=True)`), `projects.py:90-104,269,352,402-407` (all config/error output goes through `error_console`).
**Behavior**: Two output channels are created at module load; every configuration warning, remediation hint, and error goes to stderr, while data output (project lists, json/csv/text results) goes to stdout. This keeps `py-projects --format json | jq ...` clean even when the missing-token guidance fires.
**Intent**: Unix composability — machine-readable stdout is never contaminated by human-facing diagnostics.
**TS representation**: `console.error`/`process.stderr` for all diagnostics and `process.stdout` for results, mirrored as two wrapper writers if a styling library is adopted (library choice: needs research, shared with output area).

# Feature area: devex

Source repo: /Users/stevemorin/c/py-launch-blueprint @ 4828f8596b2332d74fbcff932ebab6f0030febd5

## Feature area: devex

### Two-layer bootstrap: Makefile bootstraps, Justfile is the command surface
**Where**: `Makefile` (lines 1, 37-183), `Justfile` (whole file), `.windsurfrules` (lines 8-9), `README.md` (lines 33-35), `Makefile` `help` target (lines 172-183)
**Behavior**: The Makefile exists ONLY to solve the chicken-and-egg problem of installing the task runner itself. `make check` (Makefile 59-87) verifies exactly two tools — `just` and `uv` — printing a `[✓]/[✗]` status table and, for each missing tool, the exact remediation target (`make install-just`, `make install-uv`), exiting 1 if any are missing. `make install-just` / `make install-uv` (89-96, 120-126) deliberately only *print* the curl install command (safe-by-default); the `-force` variants (98-117, 128-148) actually run the installer AND idempotently append the install dir to `PATH` in `~/.zshenv` using an awk duplicate-check. `make help` (172-183) states the rationale: "make it easy to check for and install the main dependencies because almost everyone has make". Every other task lives in the Justfile; `.windsurfrules` line 9 codifies "Makefile is just used to bootstrap the project, no new targets should be added there". Note the Makefile hard-pins `SHELL := /bin/zsh` (line 1) and writes to `~/.zshenv` — a deliberate macOS-first choice.
**Intent**: Zero-assumption onboarding: a new contributor with only `make` and `curl` gets a guided path to the full toolchain, while keeping a single authoritative task surface (Justfile) that never duplicates into Make.
**TS representation**: Keep the identical pattern: a minimal `Makefile` whose `check` verifies `just` + the chosen JS toolchain binary (e.g. a Node version manager / package manager — exact tool needs research alongside the port's package-manager decision: pnpm vs bun vs npm+corepack), with print-first `install-*` and opt-in `install-*-force` targets. Consider generalizing the `~/.zshenv` PATH edit to detect the user's shell rather than hard-coding zsh.

### Grouped, aliased, self-listing Justfile command surface
**Where**: `Justfile` lines 50-53 (`@default: just --list --unsorted`), 55-73 (group taxonomy comment block), 76-78 (`select-shell` via `just --choose`), single-letter aliases at 93 (`c`), 119 (`f`), 126 (`ft`), 133 (`ct`), 142 (`l`), 151 (`tc`), 158 (`t`), 165 (`ca`), 177 (`b`), 194 (`pc`), 634-635 (`cycle := dev`); `.windsurf/rules/justfile-rules.md` (lines 1-34)
**Behavior**: Bare `just` lists all recipes in file order (unsorted, so the curated ordering is preserved). Every recipe carries one or more `[group(...)]` attributes drawn from a documented taxonomy (setup/install/update/dev/test/build/run/docs/pre-commit/help/utilities/debug/releases/workflow/quick start/clean/legacy), with a "quick start" group cross-cutting the essentials (`install-dev`, `check`, `run`, `dev`). High-frequency recipes get single-letter/two-letter aliases. `just select-shell` opens the interactive `--choose` picker. A Windsurf glob rule (`justfile-rules.md`, triggered on `Justfile`) enforces the house style — blank line between recipes, every recipe in an existing group, doc comment directly above each recipe — so AI edits preserve the convention.
**Intent**: The Justfile doubles as living onboarding documentation: discoverability by default (`just` = menu), muscle-memory shortcuts for the inner loop, and machine-enforced conventions so the surface stays coherent as it grows.
**TS representation**: Port the Justfile nearly 1:1 (just is language-agnostic): same groups, same aliases, recipes delegating to the TS toolchain (`tsc`, test runner, linter/formatter — tool choices owned by other areas). Keep the Windsurf/AI rule that enforces recipe grouping+doc-comments. Mirror key recipes as `package.json` scripts only if the team wants npm-native entry points (needs research: single source in Justfile vs. duplication into package.json scripts).

### `check-deps` with actionable per-tool remediation
**Where**: `Justfile` lines 81-93; `install-dev` gate at line 97 (`@install-dev: check-deps`)
**Behavior**: `just check-deps` probes each required binary (`uv`, `python3`, `just`, `pre-commit`, `taplo`, `go`, `yamlfmt`) with `command -v` and on failure prints the tool name in yellow plus the exact colored command to fix it (`make install-uv`, `just install-taplo`, ...), exiting 1 — except `pre-commit`, which is deliberately a WARNING (non-fatal). `install-dev` depends on `check-deps`, so the first setup command a contributor runs fails fast with instructions rather than mid-install.
**Intent**: Convert "works on my machine" toolchain drift into a one-command diagnosis where every failure message is its own fix.
**TS representation**: Same recipe shape in the ported Justfile, checking the TS-era tool list (node, package manager, just, git hooks tool, any TOML/YAML formatters retained). The list shrinks naturally since Node tools install via the package manager; only out-of-ecosystem binaries need checking.

### `uvx --with-editable .` no-activation dev workflow (with legacy pip escape hatch)
**Where**: `Justfile` lines 112-177 (`format`, `lint`, `typecheck`, `test`, `check`, `run`, `build` all invoke `uvx --with-editable . <tool>`), 380-415 (`[group('legacy')]` `setup-venv`, `install-dev-pip`, `format-pip`, `lint-pip`, `typecheck-pip`, `test-pip`); `CLAUDE.md` lines 3-11, 22-25; `.windsurfrules` lines 14-17
**Behavior**: Every dev-loop command runs tools through `uvx --with-editable .`, meaning: no virtualenv activation is ever required, the project itself is importable in editable mode, and the tool versions resolve from project config. A parallel `legacy` recipe group provides pip/activated-venv equivalents for contributors who prefer classic workflows, explicitly segregated so `just --list` shows them under "legacy". `just run cmd=py-projects *args` (169-170) runs the packaged CLI the same way. `just check` = test + lint + typecheck (162-163); `just dev` = format → lint → test (626-632) as the inner-loop cycle.
**Intent**: Remove the #1 Python onboarding papercut (venv activation state) while not forcing the opinion on everyone; a fresh clone goes `make check` → `just install-dev` → `just check` with zero environment ceremony.
**TS representation**: This mostly dissolves in Node: `package-manager exec` / local `node_modules/.bin` resolution already gives activation-free tooling. Represent it as: Justfile recipes call the package manager's exec form (e.g. `pnpm exec tsc`) so recipes work without global installs; a "legacy" group is unnecessary (document the decision to drop it in port notes). The composite recipes `check` (test+lint+typecheck) and `dev` (format→lint→test) with alias `cycle` should be ported verbatim.

### `just debug-info`: one-command bug-report bundle wired into contributor flow
**Where**: `Justfile` lines 201-249; `.github/CONTRIBUTING.md` lines 29-39
**Behavior**: `just debug-info` emits a markdown-formatted report (`## Debug Information`) with OS-family-specific system details (macOS `sw_vers`, Linux `lsb_release`/`/etc/os-release`, Windows `systeminfo`, via just's `os_family()`), versions of every dev tool (python, uv, ruff, git, just), the installed CLI version, the project version pulled from the package, `uv pip list` output, and declared deps grepped from pyproject.toml. CONTRIBUTING.md instructs bug reporters to run it and paste output into the bug-report issue form, with a manual fallback list if the command fails.
**Intent**: Collapse the "what's your environment?" back-and-forth in bug triage to a single copy-pasteable command, pre-formatted for GitHub markdown.
**TS representation**: Port as a `debug-info` Justfile recipe (or small TS script) reporting node/package-manager/tsc/git/just versions, OS info, project version from package.json, and installed dependency list. `envinfo` (npm) is the established tool for this — needs research whether to depend on it or keep a dependency-free shell recipe. Keep the CONTRIBUTING.md wiring.

### Multi-assistant AI config mesh with cross-references (CLAUDE.md / Cursor / Windsurf)
**Where**: `CLAUDE.md` (lines 1-26), `.windsurfrules` (lines 1-91), `.cursor/rules/projectenv.mdc` (lines 1-12), `.cursor/rules/doc-template.mdc` (lines 1-79), `.windsurf/rules/justfile-rules.md` (lines 1-34); `README.md` lines 109-115
**Behavior**: Three AI assistants get first-class project context, deliberately layered rather than duplicated wholesale: (1) `CLAUDE.md` is a terse command card — the just/uvx command for every task including "test single", plus code-style rules (88-char lines, strict typing, PEP 8 via ruff, no hardcoded credentials) and environment facts. (2) `.windsurfrules` is the deep project charter: tool roles (including the Makefile-is-bootstrap-only rule), full dependency inventory with purposes, docs stack, and project-structure names. (3) `.cursor/rules/projectenv.mdc` (`alwaysApply: true`) does NOT restate anything — it points Cursor at `.windsurfrules` for dependencies and at `doc-template.mdc` for docs, making Windsurf's file the single source of truth. (4) Scoped rules trigger by glob: `doc-template.mdc` on `docs/**/*.md` prescribes a mandatory 8-section documentation template (Introduction / Purpose / Getting Started / Usage / Configuration / Testing / Disabling the Feature / References) with validation lists; `justfile-rules.md` on `Justfile` enforces recipe conventions.
**Intent**: Any AI coding agent lands with correct commands and conventions on first prompt; cross-referencing instead of copying keeps the three configs from drifting; glob-scoped rules put style enforcement where the edit happens.
**TS representation**: Port all four files with TS-era commands (CLAUDE.md command card is the highest-value item; include the "run a single test" incantation for the chosen test runner). Keep the hub-and-spoke referencing pattern. Needs research: whether to adopt the emerging `AGENTS.md` convention as the hub with CLAUDE.md/.cursor/.windsurf as thin pointers, given 2026 assistant-config standardization.

### VS Code onboarding via extension recommendations + ready-made debug configs (no settings.json)
**Where**: `.vscode/extensions.json` (lines 1-16), `.vscode/launch.json` (lines 1-25), `CLAUDE.md` line 25, `docs/source/tools/vs_code.md`
**Behavior**: `extensions.json` recommends 12 extensions spanning language tooling (Python, Pylance, Ruff, mypy), config formats (Even Better TOML, YAML), collaboration (GitLens, GitHub PRs, GitHub Actions), quality (Code Spell Checker, CodeRabbit), and AI (Anthropic Claude Code) — so VS Code prompts new contributors to one-click install the whole environment. `launch.json` ships two F5-ready debug configurations for the example CLI: bare, and with realistic sample args (`--workspace test --limit 10`). Deliberately, there is NO `.vscode/settings.json` — behavior is driven by tool config files (pyproject.toml, pyrightconfig.json) rather than editor-local settings, avoiding editor/CI divergence.
**Intent**: Editor setup becomes a prompt instead of a wiki page; debugging the CLI works on first F5 including an args example; keeping settings out of `.vscode` ensures the CLI/CI toolchain is authoritative.
**TS representation**: `extensions.json` with the TS equivalents (lint/format extension depends on the linting-area tool choice — ESLint vs Biome vs oxc, needs research; plus Even Better TOML if TOML retained, YAML, GitLens, spell checker, GitHub PR/Actions, Claude Code). `launch.json` with two `node`-type configs for the example CLI (plain + args), using `tsx`/source-map support per the chosen runner (needs research). Preserve the no-settings.json principle.

### Dual type-checker strategy: strict CI checker + strict editor checker
**Where**: `pyrightconfig.json` (lines 1-35, `"typeCheckingMode": "strict"` plus ~20 explicit `reportUnknown*`/unused-code rules), `Justfile` lines 145-151 (`typecheck` runs mypy), `README.md` lines 104-105, `.vscode/extensions.json` (Pylance + matangover.mypy)
**Behavior**: CI/CLI type checking uses mypy (via `just typecheck`), while the editor gets real-time checking from Pyright/Pylance configured to strict in `pyrightconfig.json` — both tuned to Python 3.10 and both strict, so in-editor red squiggles approximate what CI will say without waiting for a run.
**Intent**: Instant in-editor feedback matching (approximately) the CI gate; strictness is enforced at both the fast path and the authoritative path.
**TS representation**: This collapses naturally in TypeScript: `tsc --noEmit` with `"strict": true` (plus the extra lint-ish compiler flags like `noUnusedLocals`, `noUncheckedIndexedAccess` mirroring pyright's unused/unknown reports) serves both editor and CI from one `tsconfig.json`. Document the collapse in port notes; no second checker needed.

### Marker-driven CONTRIBUTORS.md automation (script + bot workflow + recipe)
**Where**: `CONTRIBUTORS.md` (markers at lines 8 and 20: `<!-- COG-CONTRIBUTORS-LIST:START/END -->`), `scripts/update_contributors.py` (git log `--format=%aN <%aE>` → dedupe → sort → regex-replace between markers), `.github/workflows/update-contributors.yml` (lines 20-86), `Justfile` lines 302-311
**Behavior**: Contributor recognition is fully automated three ways: (1) a Python script regenerates only the region between HTML comment markers in CONTRIBUTORS.md from `git log` authors (unique, alphabetized), preserving surrounding prose; (2) a GitHub Actions workflow runs it on push/PR to main and on manual dispatch, then commits as `github-actions[bot]` to a persistent `update-contributors` branch and opens/updates a PR via `peter-evans/create-pull-request` (never pushes to main directly — human merges the recognition PR); (3) a local `just update-contributors` recipe exists but uses a cruder full-overwrite via `git shortlog -sne` — and note the recipe above it is malformed (line 304 `@contributors:` has no body; line 305 `update-contributors:` is orphaned at top level), a latent Justfile bug worth NOT porting. The file header claims cog generates it, but the actual generator is the script — a doc/implementation mismatch to fix in the port.
**Intent**: Zero-maintenance contributor acknowledgment with human review in the loop (PR, not direct push), robust to manual edits outside the marker block.
**TS representation**: Port `update_contributors.py` as a small TS script (child_process `git log`, same marker-replace); keep the workflow verbatim minus the Python setup step. Fix the Justfile recipe to call the script instead of the divergent shortlog overwrite. Alternative: the all-contributors bot/spec — needs research whether git-log-authors or all-contributors-style recognition is wanted.

### CLA program: agreements in-repo + CLA Assistant bot + maintainer setup guide
**Where**: `.github/CONTRIBUTING.md` (lines 5-18), `docs/source/contributing/cla/individual_cla.md`, `docs/source/contributing/cla/corporate_cla.md`, `docs/source/contributing/cla/cla-setup-guide.md`, `docs/source/contributing/cla_faq.md`, `docs/source/tools/cla-assistant.md`, `README.md` line 99
**Behavior**: The template ships a complete CLA program, not just a mention: both Individual and Corporate CLA texts live in-repo under docs; CONTRIBUTING.md front-loads the CLA requirement (it is the first section) and routes individuals vs. corporations to the right document; the external cla-assistant.io bot gates PR merges on signature (contributor gets a sign link as a PR comment; status flips automatically); a step-by-step maintainer guide documents how to stand up CLA Assistant for a fresh instance of the template (create account, configure repo, host CLA text as a GitHub Gist); an FAQ handles contributor questions.
**Intent**: Legal readiness for serious open source from day one — enforceable, automated, and reproducible by template adopters (the setup guide is what makes it template-grade rather than repo-specific).
**TS representation**: Fully language-agnostic — port all documents and the tools page as-is (paths adjusted to the TS docs layout). CLA Assistant itself is unchanged. No tool research needed; only decide during docs-area work where the CLA pages land in the new docs tree.

### Open-source hygiene bundle with per-file license headers (and a missing root LICENSE)
**Where**: `.github/CODE_OF_CONDUCT.md`, `.github/SECURITY.md`, `.github/FUNDING.yml` (line 22: `github: smorin`), `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/` (3 form-based templates + config.yml), `pyproject.toml` line 26 (`license = { text = "MIT" }`), MIT header blocks at the top of `Makefile`-adjacent files (`pyproject.toml` 1-18, `.github/workflows/*.yml`, `scripts/*.py`, `.github/FUNDING.yml`), `README.md` lines 1 (MIT badge) and 61 ("Copyright license automation")
**Behavior**: Full community-health file set: condensed Contributor-Covenant-style code of conduct; security policy with supported-versions table and controls list; GitHub Sponsors funding; a heavily annotated PR template that enforces branch-naming convention (`feature/...`) and issue linkage (`Closes #123`) via instructional comments; three structured issue forms. Licensing is declared MIT in pyproject + README badge, and the full MIT text is embedded as a comment header in individual config/workflow/script files (README line 61 describes this as automated). Notably there is NO root `LICENSE` file in the repo — GitHub will not detect the license; this is a defect to correct, not a behavior to replicate.
**Intent**: Pass GitHub's community-standards checklist and set contributor expectations (conduct, security disclosure, PR structure) before the first external PR arrives; per-file headers keep license attached to files copied out of context.
**TS representation**: Copy the `.github/` set verbatim (language-agnostic); set `"license": "MIT"` in package.json; ADD a root `LICENSE` file. For header automation, needs research on the TS-side tool (e.g. a lint rule enforcing headers vs. a header-insertion script) — do not casually pick; also decide whether per-file headers are worth keeping at all given a root LICENSE.

### Template instantiation kit (clone → rename → clean → verify)
**Where**: `TEMPLATE_USAGE.md` (lines 1-210), `scripts/init_from_template.py`, `scripts/cleanup_template.py`, `scripts/rename_template.py`, `Justfile` lines 1-5 (project-wide `py_package_name` / `repo_name` / `command_name` variables)
**Behavior**: The repo is explicitly designed to be forked into new projects via a scripted path: `init_from_template.py` orchestrates `cleanup_template.py` (removes template-only files: EXAMPLECLI.md, logos, empty dirs) and `rename_template.py` (rewrites package name, repo name, CLI command name, and GitHub user across .py/.md/.rst/.json/.yaml/.toml/workflows and renames the package directory), interactively or fully non-interactive via flags (`--package-name --repo-name --cli-command --github-user --auto-yes`, plus `--skip-cleanup/--skip-rename`). TEMPLATE_USAGE.md documents naming conventions per identifier type (underscores for package, hyphens for repo/CLI), post-init verification (`just check`), git-history reset steps, troubleshooting, and an "already customized" detection warning. The Justfile centralizes the three names as top-of-file variables so recipes never hard-code them.
**Intent**: Make template adoption a 2-minute scripted operation with verifiable success (`just check`) instead of an error-prone grep-and-rename session; the non-interactive flags make it automatable.
**TS representation**: Port the three scripts as Node/TS scripts (same flags, same identifier taxonomy: package name / repo name / CLI bin name / GitHub user) and keep name variables at the top of the Justfile. Needs research: whether to instead adopt a scaffolding front-end (`npm create` initializer / GitHub template-repo + post-clone script) — the in-repo script approach has the advantage of working on a plain `git clone` with no registry publish.

### Self-installing toolchain recipes with per-OS dispatch
**Where**: `Justfile` lines 101-108 (`install-taplo` via cargo), 336-363 (`install-cog` with uname-based Linux/cargo, macOS/brew, Windows/manual dispatch), 638-661 (`install-go` brew/apt dispatch), 664-676 (`install-yamlfmt` via `go install`), 265-274 (`install-docs`); cross-platform primitives at line 46 (`CLIPBOARD_CMD` per `os_family()`) and 210-232 (`os_family()` branching in debug-info); destructive-op guards at 419 and 499 (`[confirm(...)]` on `pr-to-testrepo` / `clean-pr-to-testrepo`)
**Behavior**: Tools that live outside the Python ecosystem (taplo/cargo, yamlfmt/go, cog/cargo-or-brew, go itself) each get a `just install-*` recipe that no-ops if already installed, dispatches on OS, and prints guided failure messages (e.g. "try `rustup update`"). Cross-platform behavior is handled with just's built-ins (`os()`, `os_family()`) — e.g. clipboard command resolves to clip/xclip/pbcopy. Recipes that create or delete GitHub repos are wrapped in just's `[confirm]` attribute so they prompt before running.
**Intent**: The Justfile is not just a runner but an installer — the answer to "how do I get tool X?" is always `just install-X`, keeping the README free of per-OS install matrices; confirmation gates make the powerful workflow recipes safe to expose.
**TS representation**: Far fewer out-of-ecosystem tools should survive the port (TOML/YAML formatting may not be needed, or may come from npm packages), so keep the *pattern* — idempotent `install-*` recipes with OS dispatch and `[confirm]` on destructive recipes — but regenerate the list from the final TS tool choices. Which non-npm binaries remain (e.g. cocogitto vs. a JS conventional-commit stack) is owned by the release/commit-tooling area; needs research there.

### Per-tool "why and how to disable" documentation pages
**Where**: `docs/source/tools/` (13 pages: `justfiles.md`, `makefiles.md`, `uv.md`, `mypy.md`, `ruff.md`, `pytest.md`, `precommit_hooks.md`, `taplo.md`, `yaml_lint.md`, `vs_code.md`, `github_actions.md`, `cla-assistant.md`, `index.md`), template enforced by `.cursor/rules/doc-template.mdc` (required sections incl. "Purpose and Problem Solved" and "Disabling the Feature")
**Behavior**: Every tool in the stack gets a standardized documentation page following the 8-section template, mandatorily including the tool's value proposition, project-specific usage/config/testing instructions, and — unusually — instructions for disabling it. The Cursor rule validates the structure for any new docs page.
**Intent**: The template's stated philosophy ("detailed documentation explaining each tool choice", README line 4): adopters should be able to understand, evaluate, and *remove* any opinion the template imposes; the disable section is what makes the template unopinionated in practice.
**TS representation**: Recreate the tools docs directory with one page per chosen TS tool, same 8-section template (port `doc-template.mdc` as the enforcement rule). The docs engine itself is the docs area's decision; this feature is the *convention* — carry the "Disabling the Feature" requirement over verbatim.

# Feature fragment: docs

Source repo: /Users/stevemorin/c/py-launch-blueprint @ 4828f8596b2332d74fbcff932ebab6f0030febd5

## Feature area: docs

### Markdown-first Sphinx via MyST (not reStructuredText)

**Where**: `docs/source/conf.py` (lines 21-41: `myst_parser` in `extensions`, `myst_enable_extensions = ['colon_fence', 'deflist']`, `source_suffix` mapping `.md` -> markdown); every content page under `docs/source/**` is `.md` — there is not a single `.rst` content file.

**Behavior**: Sphinx is configured so authors write plain Markdown, with two MyST extensions deliberately enabled: `colon_fence` (`:::` directive fences that stay readable as raw Markdown) and `deflist` (definition lists). `.rst` remains registered as a fallback suffix but is unused. Sphinx directives (toctree, figure, note/warning/tip admonitions, `{ref}` cross-reference roles, `(label)=` targets) are all expressed in MyST-flavored Markdown.

**Intent**: Lower the contribution barrier — contributors write GitHub-flavored-looking Markdown instead of learning reST, while retaining Sphinx's toctree/cross-reference/directive machinery. The colon-fence choice specifically keeps files legible when viewed raw on GitHub.

**TS representation**: The generator choice for the TS port is genuinely open — **needs research**. Candidates that preserve the "plain Markdown + directives/components" property: VitePress, Docusaurus (MDX), Astro Starlight; keeping Sphinx+MyST itself is also viable (it is language-agnostic) but adds a Python toolchain to a TS repo. Whatever is picked must support: nested sidebars/TOC from config, stable cross-page anchors/labels, admonition callouts, and Markdown-visible source.

### Diátaxis-style information architecture (tutorials / tasks / reference / about / tools / contributing)

**Where**: `docs/source/index.md` lines 281-292 (root toctree: `about/index`, `tasks/index`, `tools/index`, `tutorials/index`, `reference/index`, `contributing/index`, `github-templates`); section indexes at `docs/source/about/index.md`, `docs/source/tasks/index.md`, `docs/source/tools/index.md`, `docs/source/tutorials/index.md`, `docs/source/reference/index.md`; leaf pages e.g. `docs/source/tasks/setting_up_development.md`, `docs/source/tools/ruff.md`, `docs/source/reference/cli_reference.md`.

**Behavior**: Content is partitioned by reader intent, closely following the Diátaxis framework: `tutorials/` = guided learning (`full_project_setup.md`); `tasks/` = how-to guides for concrete workflows (setup, type checking, CI/CD, dependencies, contributing, debugging); `reference/` = technical lookup (project structure, configuration files, CLI reference, versioning); `about/` = explanation (philosophy, features); plus a template-specific `tools/` section with one page per tool (ruff, mypy, uv, pytest, taplo, yamllint, GitHub Actions, VS Code, Makefiles, Justfiles, pre-commit, CLA assistant) documenting what the tool is, why it was chosen, and its configuration. Each section has its own `index.md` with an intro paragraph plus its own `{toctree}`.

Known drift to NOT replicate: `docs/source/tools/index.md` toctree (lines 22-38) lists `yaml-lint` but the file is `yaml_lint.md`, and omits `precommit_hooks` from the toctree while linking it in the prose list — the toctree and the manual bullet list have diverged.

**Intent**: "Heavily documented" is a stated core principle (`docs/source/about/philosophy.md` lines 5-8); the one-page-per-tool pattern makes the template's *decisions* self-explaining and keeps tooling modular/swappable. Intent-based partitioning means readers with different goals never wade through the wrong genre of doc.

**TS representation**: Port the IA verbatim: `tutorials/`, `tasks/`, `reference/`, `about/`, `contributing/`, and a `tools/` section rewritten for the TS toolchain (e.g. pages for oxc/Oxlint, the chosen formatter, tsc, the chosen test runner, package manager, Justfile, Makefile, pre-commit, GitHub Actions, VS Code). Keep per-section index pages with explicit nav ordering (sidebar config in the chosen generator). Fix the toctree/list drift rather than porting it.

### Docs-about-docs meta guide with labeled cross-references

**Where**: `docs/source/docs.md` (entire file; labels at lines 5, 47, 74: `(quickstart-docs)=`, `(cross-references)=`, `(static-content)=`).

**Behavior**: A dedicated page teaches contributors how to work on the documentation itself: install docs deps (`just install-docs`), run the hot-reload server (`cd docs && make hotreloadhtml`, serves at 127.0.0.1:8000), add a page and register it in a toctree, create `(label)=` targets and `{ref}` links, add images/figures to `_static/`, swap the logo (including Furo's `light_logo`/`dark_logo` options), use admonitions and tables, and troubleshoot the three most common failures (page missing from TOC, broken references, stale build fixed by `make clean`). The page itself demonstrates the label feature it documents.

**Intent**: Make documentation contribution zero-friction and self-hosting — the docs system documents itself so a first-time contributor never has to read Sphinx upstream docs for routine edits.

**TS representation**: Direct carry-over: a `docs.md` (or `contributing/writing-docs.md`) page rewritten for the chosen generator, covering the same lifecycle (install, dev server, add page + nav entry, cross-links, images/logo, callouts, troubleshooting). Generator-agnostic requirement, no research needed beyond the generator pick itself.

### Docs dependencies as an installable extra, builds via ephemeral runner

**Where**: `pyproject.toml` lines 51-61 (`[project.optional-dependencies] docs = [sphinx>=7.0.0, sphinx-rtd-theme, furo, myst-parser, sphinx-autodoc-typehints, cogapp, sphinx-copybutton, sphinx-autobuild, sphinxext-opengraph]`); `docs/Makefile` lines 7-8 (`SPHINXBUILD ?= uv run --extra docs sphinx-build`, `SPHINXAUTOBUILD ?= uv run --extra docs sphinx-autobuild`).

**Behavior**: All doc tooling lives in an optional dependency group named `docs`, separate from runtime and dev deps. The docs Makefile invokes builders through `uv run --extra docs ...`, so building docs requires no manual venv activation or prior install — uv resolves and provides the extra on demand. Discrepancies worth knowing: `sphinxext-opengraph` and `sphinx-rtd-theme` are declared but never activated in `conf.py` (opengraph is absent from `extensions`; the theme is `furo`), and `cogapp` in the docs extra serves the cog content-generation system, not Sphinx. Also `just install-docs` (Justfile lines 266-273) installs only a subset (`sphinx`, `sphinx-rtd-theme`, `sphinx-autobuild`, `myst-parser`) via `uv pip install` instead of installing the extra — drift from the declared group.

**Intent**: Dependency-group separation is a stated feature ("main, dev, and doc categories" — `docs/source/index.md` line 99): contributors who never touch docs never install Sphinx, and CI docs builds are reproducible from one declared group. The `uv run --extra` pattern makes every docs command self-bootstrapping.

**TS representation**: In `package.json`, docs tooling as `devDependencies` (npm has no true extras) — or, if the docs generator has its own lockfile-heavy dependency tree, an npm workspace / separate `docs/package.json` to isolate it, which is the closest analog to the extras group; **needs research** once the generator is chosen. Preserve the self-bootstrapping property via package scripts (`npm run docs:build` just works after `npm ci`). Do not port the declared-but-unused deps (`sphinxext-opengraph`, `sphinx-rtd-theme`) or the `install-docs` subset drift.

### Layered doc build commands: Sphinx Makefile wrapped by Justfile recipes

**Where**: `docs/Makefile` lines 13-31 (`help` with extra hint text, catch-all `%: Makefile` pass-through to `sphinx-build -M`, `hotreloadhtml` via sphinx-autobuild, `docs` target building html with `-E` to force a fresh environment/full reread); `Justfile` lines 265-300 (`install-docs`, `init-docs` — one-time `sphinx-quickstart`, kept but documented as "not usually needed"; `docs-help`; `docs target="html"` — parameterized so `just docs latexpdf` selects any Sphinx builder; `docs-dev` — hot reload; `docs-clean`), each tagged with Just `[group('docs')]` plus a secondary group (`install`/`setup`/`help`/`build`/`run`/`clean`) so recipes appear under multiple headings in `just help` output.

**Behavior**: Two layers: the standard Sphinx Makefile (kept intact so any Sphinx builder name works as a make target) extended with two custom targets (`hotreloadhtml`, `docs`), and top-level Justfile recipes that `cd docs && make ...` so all project workflows are launchable from the repo root with consistent naming. The dev loop is `just docs-dev` -> `make hotreloadhtml` -> `sphinx-autobuild` (rebuild + browser reload on save). `just docs` accepts an output-format argument defaulting to `html`.

**Intent**: One discoverable command surface at the repo root (part of the template's just-as-command-runner philosophy), while preserving the underlying tool's native interface for power users; hot reload makes doc writing a live-preview experience; the parameterized target exposes multi-format builds without extra recipes.

**TS representation**: Keep the Justfile layer verbatim (`docs`, `docs-dev`, `docs-clean`, `docs-help`, `install-docs` in `[group('docs')]`), delegating to the chosen generator's CLI or `package.json` scripts (`docs:build`, `docs:dev`, `docs:clean`) instead of a Sphinx Makefile. Modern JS doc generators ship a dev server, so `docs-dev` maps to e.g. `vitepress dev` / `docusaurus start`. Whether a `docs/Makefile` shim is kept at all is a port decision — the root-level Just recipes are the contract to preserve.

### Read the Docs hosting with multi-format output (html + pdf + epub + htmlzip)

**Where**: `.readthedocs.yaml` lines 25-55 (`version: 2`; `build.os: ubuntu-22.04`, `build.tools.python: "3.10"`; `build.jobs.post_create_environment` installs uv and prints its version; `sphinx.configuration: docs/source/conf.py`; `python.install` = pip install `.` with `extra_requirements: [docs]`; `formats: [pdf, epub, htmlzip]`).

**Behavior**: Docs auto-build and host on readthedocs.io on every push. RTD installs the package itself with the `docs` extra (single source of truth for doc deps — same group used locally). The uv install in `post_create_environment` is aspirational; the actual dependency install still goes through pip/extras. Beyond HTML, RTD produces downloadable PDF, EPUB, and zipped-HTML artifacts. The published site is linked from the landing page (`docs/source/index.md` line 27) and `README.md`.

**Intent**: Zero-maintenance hosted, versioned documentation with offline/print formats, wired so a fork only needs to activate the repo on RTD — no CI config to write.

**TS representation**: **Needs research.** Options: (a) Read the Docs does support arbitrary static-site generators via `build.commands` (keeps versioned hosting + PR previews); (b) GitHub Pages via an Actions workflow (fits the template's existing GH Actions investment); (c) Netlify/Vercel. PDF/EPUB output is a real feature gap in most JS generators — decide whether multi-format output is a requirement or is dropped, and document the decision. Whichever host is chosen, keep the "config file in-repo, activate-and-forget" property.

### Furo theme with branded footer, logo, and SEO title override

**Where**: `docs/source/conf.py` lines 55-85 (`html_theme = 'furo'`; `html_theme_options` with `sidebar_hide_name: False` and two `footer_icons` entries — an inline GitHub SVG icon and a "View on GitHub" text link, both to the repo URL; `html_logo = "_static/py_launch_blueprint_logo_100x100.png"`; `html_static_path`, `templates_path`); `docs/source/_templates/base.html` lines 22-32 (Jinja child template extending Furo's `!base.html`, overriding the `htmltitle` block so the landing page's `<title>` becomes the full marketing tagline "py-launch-blueprint: A Production-Ready Python Project Template with Integrated Best Practices" while inner pages keep `{{ title }} - {{ docstitle }}`); `docs/source/_static/py_launch_blueprint_logo_100x100.png`; `docs/source/index.md` lines 1-5 (logo rendered via `{figure}` directive on the landing page).

**Behavior**: The theme is Furo (modern, light/dark aware) rather than the also-installed sphinx-rtd-theme. Branding is threaded through three mechanisms: sidebar logo via `html_logo`, custom footer with a raw-SVG GitHub icon plus text link, and a minimal template override that swaps only the home page's HTML title for an SEO/marketing tagline without forking the theme. The docs guide (`docs/source/docs.md` lines 100-112) additionally documents Furo's per-mode `light_logo`/`dark_logo` for downstream customizers.

**Intent**: Professional first impression and search-result presentation with the smallest possible theme-customization surface — one block override instead of a custom theme, so theme upgrades stay cheap. Explicit repo backlink from every page footer.

**TS representation**: Map to the chosen generator's theming: site logo + repo/social footer links are first-class config in VitePress (`themeConfig.logo`, `socialLinks`), Docusaurus (`navbar.logo`, `footer`), and Starlight. The landing-page-only title override maps to per-page frontmatter (`title:`) on the index page — no template forking needed in JS generators. Preserve: dark/light-capable theme, sidebar logo, GitHub link in chrome, distinct SEO tagline on the home page.

### Multi-resolution logo asset pipeline (assets/ master, _static/ deployment copy)

**Where**: `assets/images/logos/` (`py_launch_blueprint_logo_1024x1024.png`, `py_launch_blueprint_logo_150x150.png`, `py_launch_blueprint_logo_100x100.png`); deployed copy at `docs/source/_static/py_launch_blueprint_logo_100x100.png`; consumed by `docs/source/conf.py` line 85 and `docs/source/index.md` lines 1-5; `README.md` also displays the logo.

**Behavior**: Brand logo is maintained at three resolutions in a top-level `assets/` directory that is *outside* the docs source tree; the size needed by the docs (100x100) is copied into `_static/` (Sphinx only serves files under `html_static_path`). The 1024px master exists for future derivations; the filename encodes the pixel dimensions.

**Intent**: Single canonical home for brand assets independent of any one consumer (docs, README, future social cards), with dimension-suffixed filenames making the right variant self-selecting.

**TS representation**: Keep `assets/images/logos/` verbatim at the repo root (rename files for the TS project brand); copy the needed size into the generator's static dir (`docs/public/` in VitePress, `static/` in Docusaurus). Pure convention — no tooling needed.

### Copy-button and API-docs Sphinx extensions

**Where**: `docs/source/conf.py` lines 21-29: `sphinx.ext.autodoc`, `sphinx.ext.viewcode`, `sphinx.ext.napoleon`, `sphinx.ext.intersphinx`, `sphinx_autodoc_typehints`, `sphinx_copybutton`.

**Behavior**: The extension set wires (a) reader ergonomics: sphinx-copybutton adds a one-click copy button to every code block; and (b) API-reference capability: autodoc extracts docs from Python docstrings, napoleon parses Google-style docstring sections, sphinx-autodoc-typehints renders signature type hints into the docs, viewcode links each documented object to highlighted source, intersphinx enables cross-linking into other projects' inventories. Note: the capability is configured but latent — no page in `docs/source/` currently invokes autodoc directives, so no API reference is actually rendered; the CLI is documented manually in `reference/cli_reference.md`.

**Intent**: Code-forward docs UX (copyable snippets everywhere) plus a ready-to-use path for generated API reference from source docstrings/type hints, so docs stay next to code.

**TS representation**: Copy button: built into VitePress/Docusaurus code blocks — free. Generated API reference from TSDoc comments + type signatures: TypeDoc (optionally typedoc-plugin-markdown feeding the site) or API Extractor — **needs research**, including whether to keep it latent-but-wired as the Python template does. Intersphinx-style external cross-linking has no direct JS equivalent; treat as dropped unless the generator pick provides one.

### Marketing-grade landing page duplicating README pitch

**Where**: `docs/source/index.md` lines 1-45 (logo figure, shields.io badge row — license, release/changelog, tests, stars, Discord; "Why Choose" pitch; feature TLDR with emoji), lines 47-73 (quick start), lines 75-170 (complete annotated feature list, each entry naming the tool and the benefit), lines 279-292 (root toctree, `maxdepth: 3`).

**Behavior**: The docs home page is not a bare TOC — it reproduces the README's full marketing pitch: badges, "Perfect For" audience statement, quick-start commands (`make check` -> `just install-dev` -> `just pre-commit-setup`), and a categorized feature list where every bullet is "**capability with `tool`**: benefit sentence". Content is manually duplicated from `README.md` (not included/transcluded), and has drifted in places (e.g. the Tests badge at line 14 points at `simonw/llm`'s workflow, a copy-paste artifact; a stale `python projects.py` direct-usage reference at line 195).

**Intent**: The docs site must sell the template to a first-time visitor arriving from search/RTD without a hop back to GitHub; badges signal project health; the annotated feature list doubles as a map of every deliberate design decision in the template.

**TS representation**: Same landing-page role (JS generators have first-class "hero" home layouts, e.g. VitePress home frontmatter or Docusaurus landing components). Decide deliberately between manual duplication (as here) vs single-sourcing README and docs home from one file — **needs research** on transclusion support in the chosen generator; fix rather than port the drifted badges/commands.

# Feature fragment (Phase 2)

Source repo: /Users/stevemorin/c/py-launch-blueprint @ 4828f8596b2332d74fbcff932ebab6f0030febd5

## Feature area: lint-format-type

### Single-tool lint + format + import-sort via ruff, with a curated security-inclusive rule set
**Where**: `pyproject.toml` lines 75-124 (`[tool.ruff]`), `Justfile` lines 110-142 (`format`, `lint` recipes), `.pre-commit-config.yaml` lines 37-48, `.github/workflows/ci.yaml` lines 64-66.
**Behavior**: One tool (ruff) does linting, formatting, and import sorting — no separate black/isort/flake8/bandit. The rule set is deliberately curated, not "select everything": `E, F, I, B, C4, UP, N, RUF, W, YTT, S` (pyproject.toml:83-95) — pycodestyle, pyflakes, isort, bugbear, comprehensions, pyupgrade, pep8-naming, ruff-native, flake8-2020, and notably `S` (flake8-bandit security checks) folded into the everyday linter. `fix = true` (line 103) with an empty `lint.unfixable` list means autofix is on by default everywhere. Line length is 88 (Black-compatible) set in two places (lines 81 and 117-118). `target-version = "py310"` matches `requires-python`. Import sorting is exposed as part of `just format` via `ruff check --select I --fix` (Justfile:117), so "format" means code style + import order in one gesture. Every rule group and every ignore carries an explanatory comment (e.g. lines 122-124 explain exactly what S101/S105/S106 flag and why).
**Intent**: Minimize toolchain sprawl and config drift by consolidating on one fast Rust-based tool; make security linting a default-on part of style checking rather than a separate audit step; keep autofix safe-by-default so the hook/CLI loop is low-friction; document every deviation inline so template users can make informed edits.
**TS representation**: The port's stated leaning is oxc/Oxlint (per `typescript_port_process_prompt.md`); Oxlint covers lint (incl. many `eslint-plugin-*` and some security/suspicious rules) but formatter coverage is a separate decision (Biome, Prettier, dprint, or oxc's formatter when stable) — needs research to pick the lint+format+import-order combination that stays single-tool in spirit. Whatever is chosen must: enable a curated rule set including security/suspicious categories (Oxlint's `suspicious`/`correctness` plus `eslint-plugin-security`-equivalents, or Biome's `suspicious`+`security` groups), turn safe autofix on by default, enforce deterministic import ordering, and comment every rule-group choice and ignore in the config.

### Per-context lint relaxations (tests and barrel files), with rationale comments
**Where**: `pyproject.toml` lines 119-124 (`[tool.ruff.lint.per-file-ignores]`).
**Behavior**: Exactly two scoped exemptions: `__init__.py` ignores `F401` (re-export/barrel pattern produces "unused import"), and `tests/*` ignores `S101, S105, S106` (asserts and hardcoded test credentials are legitimate in tests). Each exemption has an inline comment explaining the security rationale for why the rule exists and why tests are exempt.
**Intent**: Keep the strict rule set globally honest by carving out only the two contexts where the rules produce false positives, instead of weakening the rules project-wide; teach template users the pattern of narrow, documented overrides.
**TS representation**: File-pattern overrides in the chosen linter config (Oxlint `overrides`, ESLint flat-config per-glob objects, or Biome `overrides`): `index.ts` barrel files exempt from unused-export/import-cycle style rules if triggered; `tests/**` or `*.test.ts` exempt from assertion-style and hardcoded-secret rules (e.g. Oxlint/Biome `noSecrets`-type rules, `no-non-null-assertion`). Preserve the inline "why" comments.

### Strict-by-default static typing enforced by two independent checkers
**Where**: `pyproject.toml` lines 131-170 (`[tool.mypy]`), `pyrightconfig.json` lines 1-35, `docs/source/tasks/type_checking_code.md`, `Justfile` lines 144-151 (`typecheck`), `.pre-commit-config.yaml` lines 22-27, `.github/workflows/ci.yaml` lines 60-62, `.vscode/extensions.json` (Pylance + `matangover.mypy`).
**Behavior**: mypy runs with `strict = true` PLUS the individual strictness flags spelled out redundantly and grouped with comments (disallow-any-generics/untyped-calls/defs/decorators, `no_implicit_optional`, `warn_unused_ignores`, `warn_return_any`, `warn_unreachable`, etc., lines 143-160) and human-friendly error output (`pretty`, `show_error_codes`, `show_column_numbers`, lines 162-165). `ignore_missing_imports = false` (line 139) forces real stubs — dev deps include `types-requests`, `types-Pygments` (pyproject.toml:46-47) and the pre-commit mypy hook carries its own `additional_dependencies` stub list. A second checker, pyright, is configured at `typeCheckingMode: "strict"` with every `reportUnknown*` diagnostic explicitly enabled and dead-code diagnostics (`reportUnusedImport/Variable/Function/Class`) on; `reportPrivateUsage` is deliberately downgraded to `"warning"` (pyrightconfig.json:30). mypy is the enforced gate (Justfile `typecheck`, pre-commit hook, CI step); pyright serves the editor (Pylance) and manual runs — it is not in CI. Tests get one relaxation: `disallow_untyped_defs = false` for `tests.*` (pyproject.toml:168-170), and pyright's `include` covers both `py_launch_blueprint` and `tests`.
**Intent**: Maximum type strictness on shipped code with a documented, minimal escape hatch for tests; spelling out flags redundantly makes the strictness auditable and survives a future `strict = true` semantic change; supporting both checkers keeps CLI truth (mypy) and editor experience (Pylance/pyright) consistent so developers never see green in the editor and red in CI.
**TS representation**: TypeScript collapses the dual-checker story: `tsc` is both the CI gate and the editor engine, so one `tsconfig.json` gives the consistency the Python template needed two configs for. Represent the strictness ethos as `"strict": true` plus the flags strict does NOT include, explicitly listed and commented: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`, `forceConsistentCasingInFileNames`, plus `skipLibCheck: false` as the analog of `ignore_missing_imports = false`. Test relaxation via a `tsconfig.test.json` that extends base and loosens e.g. `noUnusedLocals`/unused-param rules, or via linter overrides. Whether to also run a second checker (`tsgo` for speed as the future default) — needs research.

### Config files are first-class formatting targets: taplo for TOML, yamlfmt for YAML
**Where**: `.taplo.toml` lines 23-33, `.yamlfmt` lines 3-31, `Justfile` lines 121-133 (`format-toml`, `check-toml`) and 678-693 (`format-yaml`, `lint-yaml`, `check-yaml`), `.pre-commit-config.yaml` lines 49-63, `.github/workflows/ci.yaml` lines 57-58 and 68-70, `Justfile` lines 100-108 and 663-676 (installers for taplo, go, yamlfmt).
**Behavior**: TOML formatting is pinned by `.taplo.toml`: 80-col width, 4-space indent, `align-entries = true` and `align-comments = true` (produces the visibly aligned pyproject.toml), arrays auto-expand but never auto-collapse, LF newlines, `respect-ignores`. YAML formatting is pinned by `.yamlfmt`: basic formatter, 2-space indent, no `---` document start, LF, `retain_line_breaks_single` (keeps intentional blank lines), `indentless_arrays` (sequences flush with parent key), 160-col max width "match your yamllint config", trailing-whitespace trim, 2-space comment padding, with vendored/build dirs excluded. Both tools run everywhere: Just recipes with check and write variants, pre-commit hooks (yamlfmt via its upstream hook pointing at `-conf .yamlfmt`; taplo as a `language: system` local hook with `--config .taplo.toml`), and CI runs `taplo check '**/*.toml'` as a distinct step. Both are non-Python binaries (Rust taplo via cargo, Go yamlfmt via `go install`) with dedicated Just install recipes and presence checks in `check-deps` (Justfile:88-90).
**Intent**: Everything in the repo — not just source code — has a canonical machine-enforced format, eliminating config-file diff noise; the check-vs-write split lets CI verify without mutating; tool choice deliberately crosses language ecosystems to get the best formatter per file type.
**TS representation**: The principle ports directly; the file mix changes (package.json/tsconfig JSON, YAML workflows, possibly no TOML). yamlfmt is language-agnostic and could be kept as-is with the same `.yamlfmt`; alternatively the code formatter (Prettier/Biome/dprint) may cover YAML+JSON in one tool, which better preserves the "fewer tools" ethos — needs research together with the code-formatter decision. If any TOML remains (e.g. `taplo.toml` itself, `lefthook.toml`, Rust-tool configs), keep taplo unchanged. Whatever is chosen must keep: pinned config file in repo root, check and write modes, hook + CI wiring, LF endings, exclusion of build output.

### Layered quality gates: editor → pre-commit → task runner → CI, with CI re-running the hooks
**Where**: `.vscode/extensions.json` lines 1-16; `.pre-commit-config.yaml` (whole file); `Justfile` lines 160-165 (`check` = test+lint+typecheck), 179-194 (pre-commit setup/run recipes), 626-635 (`dev` = format+lint+test); `.github/workflows/ci.yaml` lines 28-76; `docs/source/tools/precommit_hooks.md`.
**Behavior**: The same checks are wired at four escalating layers. (1) Editor: recommended extensions install ruff, mypy, Pylance, even-better-toml (taplo engine), redhat YAML — the exact tools the gates use, so feedback starts at keystroke time. (2) Pre-commit: mypy (with stub deps), file-hygiene hooks (check-yaml, check-toml, end-of-file-fixer, trailing-whitespace, check-added-large-files), ruff autofix then ruff-format (order matters: fixes land before formatting), yamlfmt, taplo, and — unusually — the FULL pytest suite on every commit (`pass_filenames: false`, `stages: [pre-commit]`, lines 64-72). Ruff hooks use `--force-exclude --no-cache` so pre-commit's file-passing cannot bypass configured excludes. (3) Task runner: `just check` aggregates test+lint+typecheck for a one-command local gate; `just dev` is the format→lint→test inner loop. (4) CI (`ci.yaml`): runs mypy and ruff directly as named steps (scoped to `py_launch_blueprint/` only — tests are gated by pre-commit's pytest hook and the lint per-file-ignores, not by the direct steps), `taplo check`, and then installs and re-runs the ENTIRE pre-commit suite (`just pre-commit-setup && just pre-commit-run`, lines 73-76) across a Python 3.10/3.11 matrix, so `--no-verify` locally cannot skip anything and CI-vs-local can never disagree about what the hooks do.
**Intent**: Fail as early and cheaply as possible (editor, then commit) but make CI the single source of truth by literally executing the same hook definitions; duplicating mypy/ruff as direct CI steps gives readable per-check failure signals before the monolithic hook run.
**TS representation**: Same four layers. Editor: `.vscode/extensions.json` recommending the chosen linter/formatter extensions (e.g. `oxc.oxc-vscode`, Biome or Prettier extension, even-better-toml if TOML kept). Hooks: git-hook manager choice — pre-commit framework (language-agnostic, keeps the `repos:` file portable), Lefthook, or Husky+lint-staged — needs research; must support running the full test suite on commit (fast with Bun test/Vitest) and autofix-then-format ordering. Task runner: keep the Justfile with `check` = test+lint+typecheck and `dev` = format+lint+test aggregates. CI: direct named steps for typecheck (`tsc --noEmit`), lint, format-check, then re-run the identical hook suite (e.g. `lefthook run pre-commit --all-files` or `pre-commit run --all`) on a Node/Bun version matrix mirroring the 3.10/3.11 matrix.

### Generated-file exemption from all format/lint gates
**Where**: `pyproject.toml` lines 107-115 (ruff `exclude` includes `py_launch_blueprint/_version.py` and `docs/source/conf.py`), `.pre-commit-config.yaml` lines 32-33 (`end-of-file-fixer` `exclude: '^py_launch_blueprint/_version\.py$'`) and lines 73-103 (long comment block documenting global vs hook-level exclusion patterns), `pyproject.toml` lines 71-73 (`write_to = "py_launch_blueprint/_version.py"` — the file is generated by setuptools-scm/hatch-vcs).
**Behavior**: The VCS-generated version file is excluded from ruff and from the end-of-file-fixer hook specifically (hook-level, not global), so formatters never fight the generator. The pre-commit config carries a deliberately preserved comment essay (lines 73-103) explaining global exclusion vs hook-level exclusion and recommending the narrowest scope — the template documents the technique, not just the instance. Ruff hooks pass `--force-exclude` so excludes hold even when pre-commit passes filenames explicitly.
**Intent**: Machine-generated artifacts must never trip or be mutated by quality gates; exclusions should be as narrow as possible and educational for template users.
**TS representation**: Exclude the generated version artifact (whatever replaces `_version.py` — e.g. a build-time-injected `version.ts` or reading from `package.json`) and `dist/`/build output from the linter (`ignorePatterns`/`files.ignore`), formatter, and any end-of-file/whitespace hooks at the narrowest scope; port the explanatory comment about narrow-vs-global exclusion into the hook config.

### Conventional-commit message linting via two configured paths (gitlint config + cocogitto hooks)
**Where**: `.gitlint` lines 1-13, `.gitmessage` (template), `Justfile` lines 313-318 (`verify-commits` via `cog verify`), 329-333 (`commit` via `cog commit`), 366-370 (`setup-cog-hooks` installs cog's `commit-msg` hook), `cog.toml` lines 36-48 (`conventional_commits = true`, commit parsers).
**Behavior**: Commit-message rules are pinned: title ≤ 50 chars, body lines ≤ 72 chars, conventional-commit title required with an explicit allowed-type list `feat,fix,docs,style,refactor,test,chore,ci,build,perf` (.gitlint:10-13 using the `contrib-title-conventional-commits` rule). A `.gitmessage` template teaches the same format interactively (note: it lists a smaller type set — feat,fix,docs,style,refactor,test,chore — a minor internal inconsistency with `.gitlint`). Enforcement, however, is wired through cocogitto, not gitlint: `just setup-cog-hooks` installs cog's `commit-msg` git hook, `just verify-commits` checks a commit range, and `cog.toml` filters unconventional commits out of the changelog. The `.gitlint` file is present and complete but referenced by nothing in pre-commit, Justfile, or CI — it is a dormant/alternative configuration. Commit-message linting is opt-in local tooling only; CI never validates messages (the changelog workflow just consumes them).
**Intent**: Structured commit history feeds automated changelog and version bumping (cog); the 50/72 limits enforce git display conventions; providing both a template (education) and a hook (enforcement) covers authoring and validation.
**TS representation**: Pick ONE enforcement path instead of porting the dormant duplicate: either keep cocogitto (language-agnostic Rust binary, already provides verify + bump + changelog, matching the release area) or move to commitlint (`@commitlint/config-conventional`) on a `commit-msg` hook — needs research jointly with the release/changelog feature area since cog couples message linting to changelog/bump. Either way port: the exact allowed-type list (use the `.gitlint` superset incl. ci/build/perf), 50/72 length limits, a `.gitmessage` template consistent with the enforced type list (fix the inconsistency), and a Just recipe to verify a commit range.

### Toolchain presence checks precede all quality commands
**Where**: `Justfile` lines 81-93 (`check-deps` verifies uv, python3, just, pre-commit, taplo, go, yamlfmt with per-tool remediation commands), `Makefile` (bootstrap installers), `Justfile` install recipes at lines 100-108 (taplo), 636-676 (go, yamlfmt).
**Behavior**: `just check-deps` (aliased `c`, dependency of `install-dev`) tests each required binary and prints the exact install command to run on failure (`just install-taplo`, `make install-go`, ...); hard-fails for required tools, warns for pre-commit. Every exotic tool the quality gates depend on (Rust taplo, Go yamlfmt, cocogitto) has its own cross-platform install recipe with OS detection.
**Intent**: The polyglot formatter toolchain (Rust+Go+Python binaries) is the template's main setup hazard; making dependency checking a first-class named command with actionable errors keeps "clone → contribute" friction low.
**TS representation**: Keep the pattern: a `just check-deps` verifying bun/node, the chosen linter/formatter binaries, the hook manager, and any retained cross-language tools (taplo/yamlfmt/cog), each failure printing its `just install-*` remediation. If the TS toolchain consolidates into package.json devDependencies (Oxlint/Biome/commitlint install via bun), most install recipes collapse into `bun install`, which should be preferred; only out-of-ecosystem binaries (cog, taplo, yamlfmt if kept) need bespoke installers.

# Feature fragment: testing

Source of truth: py-launch-blueprint @ 4828f8596b2332d74fbcff932ebab6f0030febd5. All line references verified against the working tree.

## Feature area: testing

### Explicit pytest discovery config, three test modules mirroring app concerns

**Where**
- `pyproject.toml:126-129` (`[tool.pytest.ini_options]` — `testpaths = ["tests"]`, `python_files = ["test_*.py"]`)
- `tests/__init__.py` (tests directory is a real package, docstring + MIT header)
- `tests/test_config.py`, `tests/test_api.py`, `tests/test_cli.py`

**Behavior**
Test discovery is pinned in config rather than left to defaults: only `tests/` is scanned, only `test_*.py` files match. The app is a single module (`py_launch_blueprint/projects.py`), but tests are split by concern into three files — config resolution, HTTP API client, CLI behavior — not one file per source file. `addopts = "-v"` exists but is deliberately commented out (`pyproject.toml:129`). `tests/__init__.py` makes tests an importable package and carries the repo-wide MIT header convention.

**Intent**
Deterministic, fast discovery (no accidental collection of scripts/docs); test layout follows the architecture's logical layers rather than its file layout, signaling to template users where each kind of test belongs.

**TS representation**
Vitest is the leading candidate (config-file `include: ['tests/**/*.test.ts']`), with `node:test` as a zero-dependency alternative — final runner choice needs research against the repo's oxc/Oxlint toolchain direction. Keep three files: `tests/config.test.ts`, `tests/api.test.ts`, `tests/cli.test.ts`.

### CLI smoke tests run in-process via the framework's test runner, not a subprocess

**Where**
- `tests/test_cli.py:27,33-36` (`from click.testing import CliRunner`; `runner` fixture)
- `tests/test_cli.py:48-59` (`test_cli_help`, `test_cli_version`)
- `py_launch_blueprint/projects.py:333` (`main` click command under test)

**Behavior**
Every CLI test invokes the click command object in-process with `runner.invoke(main, [...])` and asserts on `result.exit_code` and `result.output`. Smoke tests pin: `--help` exits 0 and contains the command's help text `"Search and select Py projects."`; `--version` exits 0 and the dynamic SCM-derived version (`from py_launch_blueprint._version import __version__`, test_cli.py:29) appears in the output — the expected value is imported from the same source the CLI uses, so the test never hardcodes a version string.

**Intent**
In-process invocation keeps CLI tests fast and debuggable (no subprocess spawning, real stack traces), while still exercising the full argument-parsing → execution → output pipeline. Importing `__version__` makes the version test invariant under releases.

**TS representation**
Depends on the CLI framework chosen for the port (needs research — e.g., a commander `program.parseAsync(argv)` with `exitOverride()` and captured stdout, or clipanion's built-in `Cli.run` testability). Requirement to preserve: invoke the command object directly with an argv array, capture output and exit code in-process; import the version constant from the same module the CLI reads.

### Boundary mocking: every side-effectful dependency is patched at the import site

**Where**
- `tests/test_cli.py:39-45` (`mock_client` fixture: `patch("py_launch_blueprint.projects.PyClient")` yielding `Mock(spec=PyClient)`)
- `tests/test_cli.py:64,78-80` (`patch("py_launch_blueprint.projects.get_config", return_value=Config(...))`)
- `tests/test_cli.py:81,120,154,181` (`patch("questionary.checkbox")` — interactive multi-select prompt)
- `tests/test_cli.py:168` (`@patch("pyperclip.copy")` — clipboard)
- `tests/test_cli.py:158` (`patch("py_launch_blueprint.projects.format_output", return_value="1")`)

**Behavior**
CLI tests never touch the network, the terminal's interactive prompt, the clipboard, or the user's real config. Each boundary is replaced: the API client constructor is patched where `projects.py` imports it, config resolution returns a constructed `Config`, `questionary.checkbox(...).ask()` returns a canned selection list, and `pyperclip.copy` is a spy asserted with `mock_copy.assert_called_with("1")` (test_cli.py:185). `Mock(spec=PyClient)` constrains the mock to the real client's interface so calls to nonexistent methods fail.

**Intent**
Tests are hermetic and CI-safe (no TTY, no network, no OS clipboard), and interaction points are asserted as contracts (e.g., `get_projects.assert_called_with(workspace_name="Test", limit=200)`, test_cli.py:103-105, pinning the default `--limit 200` from projects.py:322).

**TS representation**
`vi.mock`/`vi.spyOn` at module boundaries if Vitest is chosen; the `spec=` interface-conformance property maps to typed mocks (e.g., `vi.mocked`, or `vitest-mock-extended` — needs research). The interactive-prompt seam (questionary → likely `@inquirer/prompts` or `prompts` in TS — needs research) and clipboard (`clipboardy` candidate) must remain injectable/mocked the same way.

### HTTP client tested by mocking the transport method, pinning headers and error mapping

**Where**
- `tests/test_api.py:30-38` (`client` fixture; `test_client_initialization` asserts `Authorization: Bearer test_token` and `Accept: application/json` session headers)
- `tests/test_api.py:42-65` (`@patch("requests.Session.request")`; success unwrap and `HTTPError` → `PyError` mapping with message match)
- `tests/test_api.py:101-117` (`test_get_projects_with_workspace`: workspace name resolved to gid, asserted via `mock_request.call_args[1]["params"]["workspace"] == "ws1"`)
- `tests/test_api.py:120-126` (unknown workspace raises `PyError, match="Workspace not found"`)
- `py_launch_blueprint/projects.py:151-242` (the behaviors under test)

**Behavior**
Tests patch exactly one seam — `requests.Session.request` — and drive everything above it for real. Pinned contracts: auth/accept headers are set once at session construction; `_request` returns the parsed JSON body; a failed request raises the domain error `PyError` (not a raw HTTP error) carrying the server's error message; `get_projects(workspace_name=...)` performs a two-step lookup (list workspaces → translate name to `gid` → pass as query param) and fails with `"Workspace not found: <name>"` when the name does not resolve. `@patch.object(PyClient, "get_workspaces")` is used to isolate the lookup step from the projects call.

**Intent**
Mock at the lowest owned boundary so header construction, response unwrapping, error translation, and parameter building are all covered by real code paths; error tests assert the domain exception type and message, making the client's error contract part of the test suite.

**TS representation**
Mock the fetch/transport layer, not the client methods: `vi.spyOn(globalThis, 'fetch')` or an interception library (`msw`, `undici` MockAgent — needs research based on which HTTP approach the port uses). Preserve assertions on request headers, query params, domain-error class (`PyError` equivalent), and error-message propagation.

### Config tests pin the precedence chain and the failure message via env/filesystem isolation

**Where**
- `tests/test_config.py:30-34` (`patch.dict(os.environ, {"PY_TOKEN": "test_token"})`)
- `tests/test_config.py:37-44` (`tmp_path` fixture writes a real `.env` file; `patch.dict(os.environ, {}, clear=True)` guarantees the env var is absent)
- `tests/test_config.py:47-55` (`test_config_precedence`: env var wins over `.env` file)
- `tests/test_config.py:58-62` (`monkeypatch.delenv("PY_TOKEN", raising=False)`; `pytest.raises(ConfigError, match="No PY_TOKEN found")` for a nonexistent path)
- `py_launch_blueprint/projects.py:68-120` (`Config.from_env`, `get_config`)

**Behavior**
Four tests pin the entire config contract: (1) token read from `PY_TOKEN` env var; (2) token read from a `.env` file when the env var is absent (real temp file, not a mocked reader); (3) the env var takes precedence over the file; (4) neither source present → `ConfigError` whose message matches `"No PY_TOKEN found"`. Environment isolation is explicit in both directions — injected with `patch.dict`, cleared with `clear=True`/`monkeypatch.delenv` — so tests pass regardless of the developer's shell environment.

**Intent**
Configuration precedence is a user-facing behavior of the template, so it is locked by tests; using a real temp `.env` file exercises the actual dotenv parsing instead of a stub.

**TS representation**
Same four tests: stub env with `vi.stubEnv`/save-restore of `process.env`, write a real `.env` into a temp dir (`fs.mkdtemp`), assert precedence and a typed `ConfigError` with matching message. Dotenv-parsing library choice for the port is out of scope here but the test must go through it for real.

### Exit-code and stderr contract asserted explicitly

**Where**
- `tests/test_cli.py:62-67` (`test_cli_no_token`: exit code 1, output contains `"No Py token provided"`)
- `tests/test_cli.py:51,58,84,102,126,132,137,163,184` (every invocation asserts `result.exit_code` — 0 on all success paths)
- `py_launch_blueprint/projects.py:352-353` (error print + `sys.exit(1)`); `projects.py:403,408` (exit 3 on user cancel, exit 4 on `PyError` — currently untested)

**Behavior**
Every test asserts the process exit code, making exit status part of the pinned interface: 0 for success (including the "user selected nothing" path, test_cli.py:84), 1 for missing token with a specific error message. Source also defines exit 3 (prompt cancelled) and 4 (API error) which the suite does not yet cover — a known coverage gap, not a contract change.

**Intent**
The CLI is designed for scripting/composition; exit codes are API. Tests enforce that refactors cannot silently change them.

**TS representation**
Assert `process.exitCode`/thrown exit-override value on every CLI test. Consider closing the gap by also pinning exit 3 and 4 in the port (flag as an improvement, not a behavior change).

### Output-format behaviors pinned, including tolerance of the progress line

**Where**
- `tests/test_cli.py:108-138` (`test_cli_output_formats`: JSON, CSV, text)
- `tests/test_cli.py:125,127` (strips `"Fetching projects..."` line with a regex, then `json.loads` the remainder)
- `tests/test_cli.py:133` (CSV pinned to start with header `"id,name"`)
- `tests/test_cli.py:141-165` (`--output` writes the formatted result to a file, verified by reading it back)
- `tests/test_cli.py:168-185` (`--copy` sends the formatted result to the clipboard spy)
- `py_launch_blueprint/projects.py:273` (`format_output`)

**Behavior**
The three `--format` modes are validated behaviorally: JSON output must be machine-parseable (`json.loads`) after removing the human-facing `Fetching projects...` progress line — the test encodes the fact that status text and data share the captured stream in the test harness; CSV must contain the `id,name` header; text must contain the project id. `--output <file>` must create the file with exactly the formatted content (trailing whitespace stripped in the assertion); `--copy` must pass the formatted string to the clipboard function.

**Intent**
Formats are consumed by other tools, so validity (parseable JSON, CSV header) is tested rather than exact string equality; the regex-strip acknowledges that progress messages must never corrupt piped data in real usage (source sends them to stderr via a separate console — the CLI-area fragment covers that split).

**TS representation**
Same behavioral assertions: `JSON.parse` the captured stdout, check CSV header, check file contents for `--output`, spy on clipboard for `--copy`. If the port cleanly separates stdout (data) from stderr (progress), the regex-strip becomes unnecessary — capture streams separately and assert stdout is pure data (an improvement worth making explicit).

### Small function-scoped fixtures instead of shared setup

**Where**
- `tests/test_cli.py:33-45` (`runner`, `mock_client` fixtures)
- `tests/test_api.py:30-33` (`client` fixture returning `PyClient("test_token")`)
- `tests/test_cli.py:141,149`; `tests/test_config.py:37-39` (pytest built-in `tmp_path` for real temp files)

**Behavior**
There is no `conftest.py` and no class-based setup; each test module declares only the two or three fixtures it needs, function-scoped (fresh per test). Built-in `tmp_path` provides isolated, auto-cleaned temp directories for file-writing tests. Remaining setup (patches) is done inline per test with context managers so each test reads as a self-contained scenario.

**Intent**
Template-grade readability: a newcomer can read any single test top-to-bottom without hunting for hidden global state; fresh fixtures per test prevent cross-test leakage.

**TS representation**
Plain factory helpers (`makeClient()`, `makeRunner()`) or Vitest `test.extend` fixtures, kept per-file; `fs.mkdtemp` + `afterEach` cleanup (or `tmp` helper — needs research) as the `tmp_path` analog. Avoid a global setup file for these; keep setup local to each test file.

### Coverage tooling installed but not enforced as a gate

**Where**
- `pyproject.toml:42` (`pytest-cov>=4.1.0` in `dev` extra)
- `Justfile:254-258` (`clean` removes `.pytest_cache`, `.coverage`, `htmlcov`)
- `.github/workflows/ci.yaml:78-80` (codecov upload step present but commented out)
- No `[tool.coverage]` section and no `--cov` in any default command.

**Behavior**
Coverage can be produced on demand (`just test --cov=py_launch_blueprint` style invocation) and its artifacts are known to the clean recipe, but no command runs coverage by default, no threshold fails the build, and CI upload is deliberately left as a commented template for adopters to enable.

**Intent**
The template ships the capability without imposing a coverage-gate policy on downstream projects — enabling is a one-line uncomment, a recurring pattern in this repo (scaffold present, enforcement opt-in).

**TS representation**
Vitest built-in coverage (`--coverage`, v8 provider) as the candidate; keep it out of the default `test` script, add coverage output dirs to clean recipes/`.gitignore`, and ship a commented-out coverage-upload CI step. Threshold config intentionally absent.

### Tests run through `just test` (ephemeral editable env) and gate commits via pre-commit; CI runs them only through the pre-commit hook

**Where**
- `Justfile:153-158` (`test` recipe: `uvx --with-editable . pytest {{options}}`; alias `t`)
- `Justfile:161-163` (`check: test lint typecheck` — tests run first)
- `Justfile:626-631` (`dev` cycle: format → lint → test)
- `Justfile:412-415` (`test-pip` legacy recipe for activated-venv workflows)
- `.pre-commit-config.yaml:64-71` (local `pytest` hook: `language: system`, `types: [python]`, `pass_filenames: false` — full suite on any Python change, `stages: [pre-commit]`)
- `.github/workflows/ci.yaml:29-34,73-76` (matrix Python 3.10/3.11; CI runs mypy, ruff, taplo, then `just pre-commit-run` — there is no standalone `pytest` CI step; tests execute inside the pre-commit hook)

**Behavior**
The canonical local invocation is `just test [options]`, which builds an ephemeral uvx environment with the package installed editable — tests always run against an installed package, never against a stale venv, and extra pytest args pass through. The pre-commit hook runs the full suite (not just changed files) whenever any Python file is staged, and CI reuses exactly that hook rather than duplicating a test step, so local gate and CI gate cannot drift. A parallel `*-pip` legacy group exists for developers who prefer activated venvs.

**Intent**
One source of truth for what "tests pass" means across dev machine, commit gate, and CI; ephemeral envs eliminate "works in my venv" failures; the matrix pins support for both declared Python versions (`requires-python >=3.10`).

**TS representation**
`just test` delegating to the package manager script (e.g., `pnpm test` → vitest run — package manager choice needs research); pre-commit equivalent hook running the full suite on staged TS changes (lefthook/husky/prek — needs research; if the port keeps pre-commit itself, a `language: system` local hook translates directly); CI matrix over supported Node versions (e.g., current LTS pair) invoking the same hook/script rather than a bespoke CI-only command.

### Lint and type-checking rules deliberately relaxed for test code

**Where**
- `pyproject.toml:119-124` (`[tool.ruff.lint.per-file-ignores]` — `"tests/*" = ["S101", "S105", "S106"]` with inline comments explaining each: asserts allowed, hardcoded token strings/variables allowed in tests)
- `pyproject.toml:167-170` (`[[tool.mypy.overrides]]` — `module = ["tests.*"]`, `disallow_untyped_defs = false` while the package itself is `strict = true`)

**Behavior**
Production code runs under strict mypy and the bandit security ruleset; test files are exempted from exactly three security rules (bare `assert`, hardcoded "passwords" like `"test_token"`) and from the requirement that every function be fully typed. Each ruff exemption carries a comment stating why the rule exists and why tests are exempt.

**Intent**
Keep the strictness signal high for shipped code while not taxing tests with rules that fight the testing idiom (asserts are the point; fake tokens are inert). The documented exemptions teach template users the reasoning rather than hiding it.

**TS representation**
Per-glob linter overrides for `tests/**` in the Oxlint/ESLint config (e.g., relax `no-hardcoded-credentials`-style and any assertion-related rules — exact rule ids depend on final linter choice, needs research); tsconfig for tests can stay strict since TS test typing is low-friction, but allow `any`-tolerant test utilities if mocking demands it. Preserve the explanatory comments next to each exemption.

# Feature fragment: versioning-release

## Feature area: versioning-release

### Git-tag-derived version (single source of truth is the VCS tag)
**Where**
- `pyproject.toml` lines 20-22 (`dynamic = ["version"]`), lines 67-73 (`[build-system]` requires `hatchling`, `hatch-vcs`, `setuptools>=64`, `setuptools-scm>=8`; `[tool.setuptools_scm]` with `write_to = "py_launch_blueprint/_version.py"`, `fallback_version = "0.0.1"`), lines 172-177 (`[tool.hatch] version.source = "vcs"`, `build.hooks.vcs.version-file = "py_launch_blueprint/_version.py"`, `[tool.hatch.version.raw-options] local_scheme = "no-local-version"`)
- `py_launch_blueprint/_version.py` (whole file; generated by setuptools-scm, header comment at lines 1-2: "file generated by setuptools-scm / don't change, don't track in version control")

**Behavior**
The version is never hand-written in `pyproject.toml` or source code. `version` is declared `dynamic` and hatch resolves it from the git tag via `hatch-vcs`/`setuptools-scm` at build time, writing a generated `_version.py` module containing `__version__` and `__version_tuple__`. Between tags the version is a dev version derived from commit distance (e.g. `0.1.dev338`). `fallback_version = "0.0.1"` covers builds outside a git checkout (e.g. sdist without `.git`). `local_scheme = "no-local-version"` strips the `+g<sha>[.dirty]` local segment so dev builds remain uploadable to package indexes (PyPI rejects local versions).

Known inconsistency in the template: `_version.py` says "don't track in version control" but IS git-tracked at the pinned SHA (it is not in `.gitignore`). Treat the generated-and-untracked variant as the intent.

**Intent**
Eliminate version-drift bugs: the git tag is the only place a version is set, so a release cannot ship with a stale hard-coded version, and every commit gets a unique, index-safe dev version for free.

**TS representation**
No exact npm-ecosystem twin: npm requires a concrete `"version"` field in `package.json`, so "fully dynamic from git" is not idiomatic. Two candidate mappings: (a) keep `package.json` version as the on-disk value but make the release tool (see bump feature) the only thing that writes it, tag and field updated atomically in one release commit; (b) compute version at publish time from the tag in CI (`npm version --no-git-tag-version $TAG` before `npm publish`). Option (a) via cocogitto's `cog bump` with a package-json bump hook, or tools like `semantic-release` — needs research to pick without breaking the cog-centric workflow below. The generated `_version.py` maps to either reading `package.json` at build time or a codegen step emitting `src/version.ts`; embedding via bundler define (e.g. tsup/esbuild `define`) is a candidate — needs research.

### Runtime version exposure through package metadata (no hard-coded string)
**Where**
- `py_launch_blueprint/__init__.py` line 24: `__version__ = metadata.version("py_launch_blueprint")` (via `importlib.metadata`)
- `py_launch_blueprint/projects.py` line 46 (`from py_launch_blueprint._version import __version__`) and line 318 (`@click.version_option(version=__version__)`)
- `justfile` lines 196-199 (`version` recipe runs `<cli> --version`), lines 240-241 (debug-info prints both CLI `--version` and `python -c 'import pkg; print(pkg.__version__)'`)

**Behavior**
The package exposes `__version__` two ways: the package `__init__` resolves it from installed distribution metadata at import time, while the CLI module imports the generated `_version.py` directly and wires it into `--version` on the click entry point. Justfile recipes verify both paths (installed CLI version and importable package version) in `debug-info`, deliberately surfacing mismatches between "what's installed" and "what the tag says".

**Intent**
`--version` output and programmatic `pkg.__version__` always agree with the built artifact; no string to forget to bump. The dual read paths (metadata vs generated file) also work in editable installs.

**TS representation**
CLI `--version` should read the version from `package.json` (e.g. `createRequire(import.meta.url)('../package.json').version` or a build-time-injected constant) and pass it to the CLI framework's version option (Commander `.version()` / clipanion / oclif equivalent — framework choice belongs to the CLI feature area). Export a `VERSION` constant from the package root mirroring `__version__`. A justfile `version` and `debug-info` recipe should print both the installed CLI's `--version` and the source-tree `package.json` version.

### Conventional-commit enforcement and authoring via cocogitto (cog)
**Where**
- `justfile` lines 313-318 (`verify-commits start="HEAD~10" end="HEAD"` → `cog verify --from --to`), lines 328-333 (`commit` → interactive `cog commit`), lines 365-370 (`setup-cog-hooks` → `cog install-hook commit-msg`, auto-installs cog first if missing), lines 335-363 (`install-cog`: per-OS install — cargo on Linux, Homebrew on macOS, manual download link on Windows, each guarded with a friendly error if the package manager is absent)
- `cog.toml` lines 36-38 (`[changelog.git] conventional_commits = true`, `filter_unconventional = true`)
- `docs/source/tasks/contributing_code.md` line 38 (Conventional Commits required for contributions)

**Behavior**
Cocogitto is the single tool for the whole conventional-commit lifecycle: `just verify-commits` checks a commit range (defaulting to the last 10 commits, overridable via just arguments) against the conventional format and exits non-zero with a red ✗ on failure; `just commit` gives an interactive conventional-commit prompt; `just setup-cog-hooks` installs a git `commit-msg` hook so malformed messages are rejected at commit time. Every cog-dependent recipe first probes `command -v cog` and fails (or self-heals via `install-cog`) with a colored, actionable message rather than a raw command-not-found.

**Intent**
Commit hygiene is enforced mechanically at three layers (hook at commit time, on-demand range verification, guided authoring), which is what makes automatic semver bumping and changelog generation trustworthy. The check-then-instruct pattern ("tool missing → here is the install command") is a template-wide convention.

**TS representation**
Cocogitto is language-agnostic (a Rust binary operating on git), so the cleanest port is to keep cog and this justfile section nearly verbatim — `cog.toml` needs no Python-specific changes. The JS-native alternative stack (commitlint + `@commitlint/config-conventional` + husky/simple-git-hooks + commitizen) is more conventional in npm projects but replaces one tool with four; whether to keep cog or switch — needs research / a deliberate TS_PORT_DECISIONS entry. The `verify-commits` default range `HEAD~10..HEAD` and the colored precondition checks should be preserved either way.

### Changelog configuration: grouped sections and release-commit self-filtering
**Where**
- `cog.toml` lines 20-48: `[changelog]` (`repository = "https://github.com/smorin/py-launch-blueprint"`, `template = "conventional"`, `remote = "origin"`, `path = "CHANGELOG.md"`), `[changelog.sections]` (feat→features, fix→fixes, perf, docs, test, chore+refactor→maintenance), `[changelog.git] commit_parsers` (feat→Features, fix→Bug Fixes, docs, perf, refactor, test; `^chore\(release\): prepare for` → `skip = true`; remaining `^chore` → Miscellaneous Tasks)
- `justfile` lines 372-374: `changelog` recipe present but commented out (`cog generate --config cog.toml`)
- `.github/workflows/changelog.yml` lines 20-39: "Generate Changelog" workflow triggered on push/PR to main and `workflow_dispatch`, with explicit `permissions: contents: write`, but its only step is `actions/checkout@v4` with `fetch-depth: 0` — the generation step is intentionally absent (a stub)
- No `CHANGELOG.md` exists in the repo at the pinned SHA.

**Behavior**
The changelog is fully configured but not yet automated: cog.toml defines the repository URL (for commit/PR links), the conventional template, a section mapping from commit types to human headings, and a parser rule that skips cog's own `chore(release): prepare for X` bump commits so releases don't list themselves. Both the local recipe and the CI workflow are deliberately incomplete scaffolds (commented recipe; checkout-only workflow with write permission already granted and full history already fetched — the two prerequisites for changelog generation).

**Intent**
Ship the configuration and the safety details (release-commit skip, full-history fetch, least-privilege-but-sufficient permissions) so a template user only has to uncomment/add one command; avoid committing a generated CHANGELOG.md into a template where it would be meaningless history.

**TS representation**
Port `cog.toml` as-is with the repository URL swapped to the TS repo (it has no Python coupling), including the `chore(release): prepare for` skip rule and the sections mapping. Reproduce the stub state faithfully: a commented `changelog` recipe in the justfile and a checkout-only `changelog.yml` with `contents: write` and `fetch-depth: 0`. If the port decides against cog, `git-cliff` (same author ecosystem, near-identical config) or `conventional-changelog` are the candidates — needs research, and must be decided jointly with the commit-enforcement feature above.

### Auto-detected semver bump from commit history
**Where**
- `justfile` lines 320-326: `bump type="auto"` recipe → `cog bump {{type}}` (with cog presence check)

**Behavior**
`just bump` runs `cog bump auto`: cocogitto scans conventional commits since the last tag and computes the semver increment (feat→minor, fix/others→patch, breaking-change marker→major), then creates the version commit and the git tag. Passing an explicit type (`just bump major|minor|patch`) overrides auto-detection. Note for the port: in stock cocogitto the literal argument is a flag (`cog bump --auto` / `--major`), while the recipe passes it positionally — the recipe's intent (default auto, overridable) is what matters, and the invocation may need a flag fix.

**Intent**
Releases are computed from commit semantics rather than chosen by hand, closing the loop that commit-message enforcement opens: verified conventional commits → deterministic version bump → tag → (tag-triggered) release workflow.

**TS representation**
Keep `just bump type="auto"` calling cog, with a cog `bump_hook`/`pre_bump_hooks` entry in `cog.toml` that also rewrites `package.json`'s version (e.g. `npm version {{version}} --no-git-tag-version` as a pre-bump hook) so the npm-required static version stays in lockstep with the tag — this is the key adaptation the TS ecosystem forces. Alternatives (`npm version`, `changesets`, `semantic-release`) each restructure the workflow significantly — needs research if cog is dropped.

### Tag-triggered release workflow with tag/package version-match guard
**Where**
- `.github/workflows/release.yml` lines 20-58: trigger `on: push: tags: ['v*']`; job `publish`; steps: checkout with `fetch-depth: 0`, `astral-sh/setup-uv@v5`, Python 3.10 setup, `uv venv`, `uv pip install hatch build`, `uv run hatch build`, then "Verify version matches tag" (lines 51-58): strips `refs/tags/v` prefix, imports `py_launch_blueprint.__version__`, and `exit 1` on mismatch with an explicit "Version mismatch: Tag X vs Package Y" message

**Behavior**
Pushing any `v*` tag builds the distributable artifacts and then asserts that the version baked into the built package equals the tag (minus the `v` prefix). Two deliberate details: `fetch-depth: 0` is required so hatch-vcs can see tags to compute the version at all, and the guard compares the runtime-imported `__version__` (not a file grep) so it validates the whole dynamic-version chain end to end. Notably, despite the job being named `publish`, there is NO actual publish/upload step (no PyPI/twine/`gh release` step) — the template deliberately stops at build+verify and leaves index publishing (credentials, provenance) to the adopting project.

**Intent**
Make an inconsistent release structurally impossible (a tag that doesn't match the built package fails CI before anything ships), while keeping the template free of registry credentials and publish policy decisions.

**TS representation**
GitHub workflow on `push: tags: ['v*']`: checkout with `fetch-depth: 0`, setup the chosen runtime/package manager, build (`npm pack` or the project build), then guard: `TAG_VERSION=${GITHUB_REF#refs/tags/v}`; compare against `node -p "require('./package.json').version"` — or better, against the version read from the packed tarball / the built CLI's `--version` output to mirror the "validate the real artifact" spirit. Preserve the no-publish stance: stop at build+verify, leaving `npm publish` (and provenance/trusted publishing) as a documented extension point.

### Colored, self-diagnosing tool preconditions on all release recipes
**Where**
- `justfile` lines 317, 324, 332, 368 (each cog recipe: `command -v cog >/dev/null 2>&1 || { echo "{{RED}}Error: Cocogitto (cog) is not installed{{NC}}"; exit 1; }`; `setup-cog-hooks` instead falls through to `just install-cog`)
- `justfile` lines 335-363 (`install-cog` per-OS dispatch with post-install verification line 363: green ✓ / red ✗)

**Behavior**
Every recipe that shells out to cog first checks for the binary and fails fast with a colored, named error rather than a shell "command not found"; the setup recipe self-heals by invoking the installer; the installer ends by re-probing and printing an explicit success/failure verdict. Recipes are also tagged with just `[group(...)]` attributes (`releases`, `pre-commit`, `install`, `setup`) so `just --list` groups the release workflow discoverably.

**Intent**
The release toolchain is external to the language ecosystem (a Rust binary), so the template treats "tool missing" as an expected state with a guided path, not an error dump — a core template UX principle worth carrying over exactly.

**TS representation**
Port verbatim: same `command -v cog` guards, same color variables, same `[group('releases')]` tagging in the TS justfile. If the port swaps cog for npm-installed tools, the precondition pattern still applies to non-npm tools (just, git hooks manager) and should be kept for whatever binary the release flow depends on.

### Cross-area note: contributor metadata in cog.toml
**Where**
- `cog.toml` lines 50-58: `[contributors]` (markdown format, sort by commits, show stats, exclude `noreply.github.com` domains)

**Behavior**
cog.toml carries a `[contributors]` section, but the actual CONTRIBUTORS.md automation does not use cog: `justfile` lines 302-311 use `git shortlog -sne`, and `.github/workflows/update-contributors.yml` runs `scripts/update_contributors.py`. The section is configuration-ahead-of-implementation (and `[contributors]` is not a standard cocogitto table).

**Intent**
Keep contributor-listing policy (sorting, exclusions) declared next to the other git-history-derived outputs, even though wiring is elsewhere (owned by the community/contributors feature area).

**TS representation**
Carry the section over only if cog is retained; otherwise document the policy where the contributors script lives. Primary ownership: the github-community feature area — flag to avoid double-porting.
