# P12 — AI-readiness simplification and review workflows

**References**

- **Trunk:** [PROJECTS.md](../PROJECTS.md)
- **Design:** [TS_PORT_DECISIONS.md](../docs/port/TS_PORT_DECISIONS.md)
- **Design:** [AGENTS.md](../AGENTS.md)

Refresh AGENTS.md hub, add CodeRabbit/Greptile/Claude workflows, and llms.txt

### Scope

- Refresh `AGENTS.md` as the sole canonical AI-context hub: add `apps/web` and `apps/api` to overview/structure, replace stale `"None yet — slices S3a/S3b"` runtime dependencies claim with accurate per-package dependencies, align commitlint docs to `100/200/200` (`Q9.A`), add pre-PR verification flow, PR review-thread merge guard (`required_review_thread_resolution` + GraphQL resolve), doc link policy (`just docs-check`), and release rules (`--merge` / `release-please` / Trusted Publishing), fold in Justfile conventions (`.windsurf/rules/justfile-rules.md`) and the 8-section doc template (`.cursor/rules/doc-template.mdc`), and reflect `P06` landed setup/toolchain commands (`make bootstrap`, `make hook-check`, `just setup`, `just dev`, `just cycle`, `just select-shell`, `just hooks-run`, `just verify-commits`, `just api-dev`, `mise`/`flox`/Dev Container) without prematurely claiming `P07`'s `new-ts-project` skill.
- Collapse `CLAUDE.md` to 7 lines importing `@AGENTS.md`, delete `.cursor/rules/` (`projectenv.mdc`, `doc-template.mdc`) and `.windsurf/rules/` (`justfile-rules.md`) (`Q10.A`, Py ADR 0014), and refresh `.claude/settings.json` `companyAnnouncements` to cover `apps/web`, `just setup`, `just api`, `just web`, `just coverage`, and `just docs-check`.
- Add `.coderabbit.yaml` (`fail_commit_status: false`, `commit_status: true`, `knowledge_base` targeting `AGENTS.md`/`CLAUDE.md`/`docs/`, TS/YAML `path_instructions`), `.greptile/config.json`, and `.greptile/rules.md` (with PR-head prompt-injection guard and TS convention checklist).
- Add `.github/workflows/claude-code-review.yml` (same-repo + non-bot author/sender guards, graceful skip when `CLAUDE_CODE_OAUTH_TOKEN` is unset) and `.github/workflows/claude.yml` (`@claude` mention responder with fork/bot/token guards), both with `# SPDX-License-Identifier: MIT`, top-level `permissions: {}`, and 40-hex SHA-pinned `anthropics/claude-code-action`.
- Add `.github/CODEOWNERS` protecting workflows and agent configs, add `## Review Trigger` (`@coderabbitai review`, `@greptile-apps review`, `@cubic-dev-ai review`) to `.github/pull_request_template.md` while removing the stray `-->` at line 85, and add root `llms.txt` indexing architecture, CLI/API/web contracts, docs, `AGENTS.md`/`CLAUDE.md`, and setup/release links.
- Add `tests/repo-hygiene.test.ts` meta-tests enforcing all `AGENTS.md`/`CLAUDE.md`/retirements/AI-review/workflow/PR-template/`llms.txt` contracts, and verify `just press-verify` across all new files.
- Complete mandatory `ci-fix --optimize` closeout on the measured green PR CI run.

### Out of scope

- Shipping `.agents/plugins/marketplace.json` for Codex local skills (deferred until official upstream TS toolchain skill plugins exist).
- Documenting `P07` skill/guard artifacts (`new-ts-project`, `scripts/guard.sh`) in `AGENTS.md` (`P07` launches after `P06`; `P06` merged before `P12` so `AGENTS.md` aligns with `P06` while `new-ts-project` stays deferred to `P07`).
- Modifying GitHub repository variables or secrets (`CLAUDE_CODE_OAUTH_TOKEN` remains untouched; workflows skip cleanly when unset).

### Decisions

- **Q10.A (Single `AGENTS.md` hub & vendor rule retirement):** Make `AGENTS.md` the sole canonical agent guide, collapse `CLAUDE.md` to 7 lines importing `@AGENTS.md` (enforced by meta-test), and retire `.cursor/rules/` and `.windsurf/rules/` after folding Justfile and doc-template rules into `AGENTS.md` (Py ADR 0014).
- **Defer `.agents/plugins/marketplace.json` (open question settled):** Defer repo-local Codex plugin marketplace until official upstream TS toolchain skill plugins (`oxc`/`pnpm`/`vitest`) exist (`typescript-lsp` and `ast-grep` remain configured in `.claude/settings.json`).
- **Workflow hygiene & `press-verify` conformance:** `claude-code-review.yml` and `claude.yml` must include `# SPDX-License-Identifier: MIT`, top-level `permissions: {}`, and 40-hex SHA-pinned `anthropics/claude-code-action` (plus PR-only `concurrency` on `claude-code-review.yml`) to satisfy `tests/repo-hygiene.test.ts`; all new files (`AGENTS.md`, `CLAUDE.md`, `.coderabbit.yaml`, `.greptile/*`, `.github/CODEOWNERS`, `llms.txt`) must pass `just press-verify`.
- **Closeout:** Mandatory `ci-fix --optimize` pass on the measured green PR CI run before merge.

### Tests & Tasks

- [x] [P12-TS01] Add meta-tests in `tests/repo-hygiene.test.ts` verifying `CLAUDE.md` imports `@AGENTS.md` minimally (`<= 10` lines), `.cursor/` and `.windsurf/` do not exist, `AGENTS.md` documents `apps/web`/`apps/api`/accurate runtime deps/`100/200/200` commitlint/verification flow/merge guard/doc link policy/Justfile & doc-template rules and `P06` setup/toolchain commands without stale `S3a/S3b` or `50-char` or unlanded `new-ts-project` claims, and `.claude/settings.json` covers `apps/web` and `just setup`.
- [x] [P12-TS02] Add meta-tests in `tests/repo-hygiene.test.ts` verifying `.coderabbit.yaml`, `.greptile/{config.json,rules.md}` (PR-head prompt-injection guard), `.github/CODEOWNERS`, `.github/pull_request_template.md` (`## Review Trigger`, no stray `-->`), root `llms.txt`, and `claude-code-review.yml` / `claude.yml` (SPDX header, top-level `permissions: {}`, SHA-pinned `anthropics/claude-code-action`, fork/bot/sender guards, and bash-verified graceful skip when `CLAUDE_CODE_OAUTH_TOKEN` is empty).
- [x] [P12-T01] Refresh `AGENTS.md`, collapse `CLAUDE.md` to 7 lines importing `@AGENTS.md`, delete `.cursor/rules/` and `.windsurf/rules/`, and refresh `.claude/settings.json` `companyAnnouncements`.
- [x] [P12-T02] Add `.coderabbit.yaml`, `.greptile/config.json`, `.greptile/rules.md`, `.github/CODEOWNERS`, and root `llms.txt`, and add `## Review Trigger` to `.github/pull_request_template.md` (removing the stray `-->` at line 85).
- [x] [P12-T03] Add `.github/workflows/claude-code-review.yml` and `.github/workflows/claude.yml` with `# SPDX-License-Identifier: MIT`, top-level `permissions: {}`, fork/bot/token guards, and 40-hex SHA-pinned `anthropics/claude-code-action`.
- [x] [P12-T04] Run `just all`, `just coverage`, `just pack-check`, `just docs-check`, `just press-verify`, and `project-audit P12`; open PR, run `ci-fix --optimize` closeout on green CI, resolve review threads via `pr-merge-flow`, mark `P12` `[x]`, and merge via `--merge`.
