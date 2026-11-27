# P12 — AI-readiness simplification and review workflows

Refresh AGENTS.md hub, add CodeRabbit/Greptile/Claude workflows, and llms.txt

### Open questions

- Retire `.cursor/rules/` and `.windsurf/rules/` spokes (following Py ADR 0014 / SIMP-02, since Cursor, Windsurf, and Codex read `AGENTS.md` natively) or retain them with synced references?
- Ship a Codex repo-local plugin marketplace (`.agents/plugins/marketplace.json`) for TS toolchain skills (e.g. `oxc`/`pnpm`/`vitest`), or wait for upstream TS skill plugins?

### Notes

Ports Py `P02` (SIMP-02 / ADR 0014), AI code-review ecosystem, and LLM discovery files:

- **Refresh stale `AGENTS.md` and collapse `CLAUDE.md`:**
  - Fix stale `AGENTS.md` claims (`Runtime Dependencies: None yet — lands in slices S3a/S3b`, missing `apps/web` and `apps/api` in overview/structure).
  - Add Py's operational sections: two-level setup, pre-PR verification flow, PR review-thread merge guard (pre-validate -> reply -> GraphQL resolve), doc link policy, and release rules.
  - Collapse `CLAUDE.md` to `@AGENTS.md` (zero drift by construction) and refresh `.claude/settings.json` `companyAnnouncements` to include `apps/web`.
- **AI code-review configs & workflows:**
  - Add `.coderabbit.yaml` (`fail_commit_status: false`, knowledge base pointing at `AGENTS.md`/`docs/`, path instructions for `**/*.ts(x)` & workflows).
  - Add `.greptile/{config.json,rules.md}` with PR-head prompt-injection guard and TS convention checklist.
  - Add `.github/workflows/claude-code-review.yml` (already anticipated in `D-024(6)`) and `.github/workflows/claude.yml` (`@claude` mentions) with fork/bot guards and graceful skip when `CLAUDE_CODE_OAUTH_TOKEN` is unset.
  - Add `.github/CODEOWNERS` protecting workflows and agent configs, plus bot-review trigger block in `.github/pull_request_template.md`.
- **LLM index:** Add root `llms.txt` indexing architecture, CLI/API/web contracts, docs, and release/setup links.

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P12` when ready. -->
