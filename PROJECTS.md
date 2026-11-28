# Projects

Index of every project in this repo. Per-project files live in
`projects/`. Skills in the `project-harness` plugin operate on this
file plus those.

## Status legend

| Glyph | Meaning                | File state                          |
| ----- | ---------------------- | ----------------------------------- |
| `[?]` | Idea / exploratory     | stub file, trailing-hyphen filename |
| `[ ]` | Scoped, not started    | full scope + tasks                  |
| `[~]` | In progress            | full + some `[x]` tasks             |
| `[x]` | Completed              | all tasks `[x]`                     |
| `[-]` | Decided not to do      | reason at top of file               |
| `[>]` | Proceeded to successor | redirects to successor's file       |

## Conventions

- Filename: `projects/P<NN>-<kebab-slug>.md` for scoped/active/done;
  `projects/P<NN>-<roughName>-.md` (trailing hyphen) for ideas.
- Trunk row: `- [<glyph>] **P<NN>** — [<title>](projects/<filename>)`.
  The title is a standard markdown link to the per-project file —
  external tools (markdown linters, doc generators, AI agents
  reading the repo without project-harness loaded) can parse the
  schema without prior knowledge of the conventions.
- Every non-`[?]` per-project file has a `**References**` block at
  the top whose first bullet is `- **Trunk:** [PROJECTS.md](../PROJECTS.md)`,
  the back-pointer to this file. Bidirectional schema.
- One trunk row per file; one file per trunk row.
- Status glyph mirrors the rolled-up state of the per-project file.
- Flip task checkboxes immediately as each task lands (no batching).
- TDD bias: every project has at least one `TS` task before its first
  `T` task. Opt out with `**TDD: not applicable**` in the body.

### Project workflow skills (plugin: project-harness)

- `using-project-harness` — bootstrap: when to use which skill below
- `project-next` — orient: what's in progress, what's next, what's recently touched
- `project-add` — capture an idea (≤4 questions, reserves the ID with a commit)
- `project-refine` — flesh out / scope / decompose an existing project
- `project-audit` — verify state matches conventions; fix per finding

## Project index

<!-- One row per project. Scoped / in-progress / done first; ideas last. -->

- [x] **P01** — [Switch press-verify to template-press v5.0.0](projects/P01-switch-press-verify-to-template-press-v5.md) — Replace temporary template-press git SHA pin with PyPI v5.0.0 once released
- [x] **P02** — [Enforce CI coverage and pack-check smoke](projects/P02-enforce-ci-coverage-and-pack-check-smoke.md) — Run coverage thresholds, Codecov OIDC, and pack-check smoke tests on every PR
- [x] **P03** — [Slim PR CI and add cross-OS matrix](projects/P03-slim-pr-ci-and-add-cross-os-matrix.md) — Add merge_group, PR concurrency, change fast paths, ci-ok gate, and 3-OS matrix
- [x] **P04** — [Secret scanning and scheduled dependency audits](projects/P04-secret-scanning-and-scheduled-dependency-audits.md) — Add gitleaks, TruffleHog CI, weekly dep-audit, canary, and CodeQL/Dependabot
- [x] **P05** — [Hook and CI quality gate parity](projects/P05-hook-and-ci-quality-gate-parity.md) — Mirror commitlint, large-file, codespell, EditorConfig, and lockfile/TOML gates
- [x] **P06** — [Turnkey toolchains and unified local setup](projects/P06-turnkey-toolchains-and-unified-local-setup.md) — Add mise, flox, devcontainer, make bootstrap, just setup, and Justfile DX fixes
- [~] **P07** — [Template-press fork guard and bootstrap skill](projects/P07-template-press-fork-guard-and-bootstrap-skill.md) — Add guard.sh, CI bootstrap acceptance, press cleanups, and new-ts-project skill
- [x] **P08** — [Testing resilience and web browser E2E](projects/P08-testing-resilience-and-web-browser-e2e.md) — Add Vitest shuffle, fast-check properties, CLI snapshots, and Playwright E2E
- [x] **P12** — [AI-readiness simplification and review workflows](projects/P12-ai-readiness-simplification-and-review-workflows.md) — Refresh AGENTS.md hub, add CodeRabbit/Greptile/Claude workflows, and llms.txt
- [?] **P09** — [Production API hardening and GHCR container publish](projects/P09-production-api-hardening-and-ghcr-container-publish-.md) — Add secure headers, CORS, rate limit, readyz, Dockerfile cache, and GHCR deploy
- [?] **P10** — [Core domain depth and API contract snapshots](projects/P10-core-domain-depth-and-api-contract-snapshots-.md) — Add getProject, strict HTTP envelope, pagination, idempotency, and tRPC diff
- [?] **P11** — [CLI v4 noun-verb and config modernization](projects/P11-cli-v4-noun-verb-and-config-modernization-.md) — Add config init/get/set, doctor bundle, completion, layered config, and pager
- [?] **P13** — [Release runbook and governance docs polish](projects/P13-release-runbook-and-governance-docs-polish-.md) — Add PROJECT_SETUP, full RELEASE guide, ADRs, SECURITY/OSS kit, logos and badges
- [?] **P14** — [Audit-triage and pre-push hook hardening](projects/P14-audit-triage-and-pre-push-hook-hardening-.md) — Adapt muse audit-triage for dependency audits, partial-run resume, and multi-ref pre-push scanning
