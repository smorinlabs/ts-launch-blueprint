# CLAUDE.md - Agent Guidelines for TS Launch Blueprint

See AGENTS.md for the full project charter (canonical AI-context hub).

## Project Commands

- Setup: `just install` (installs shell analyzers, dependencies, and git hooks)
- Format: `just format` (or `pnpm exec oxfmt`)
- Format check: `just format-check` (or `pnpm exec oxfmt --check`)
- Lint: `just lint` (or `pnpm exec oxlint`); autofix: `just lint-fix`
- Type check: `just typecheck` (or `pnpm exec tsc --noEmit`)
- Test all: `just test`
- Test single: `pnpm exec vitest run apps/cli/tests/version.test.ts -t 'test name'`
- All checks: `just all` (format-check, lint, check-boundaries, shell/workflow checks, typecheck, test)
- Hook suite on all files: `just pre-commit-run`
- Install hooks + commit template: `just setup-hooks`
- Build: `just build`
- Boundaries: `just check-boundaries` after changing imports; never silence a
  boundary rule, fix the import (`docs/reference/boundary-rules.md`)
- Architecture: read `docs/about/architecture.md` before adding a feature

## Code Style Guidelines

- Line length: 100 chars; single quotes; semicolons; es5 trailing commas (oxfmt)
- Imports: sorted by oxfmt `sortImports` — never hand-order
- Types: strict tsc union incl. `isolatedDeclarations` — annotate all exports
- Unused code: prefix intentionally-unused vars/args with `_`
- Security: no eval-family constructs (oxlint), no hardcoded credentials
- Commits: Conventional Commits, subject <= 50 chars, body lines <= 72
  (types in `.gitmessage`; enforced by commitlint via lefthook)

## Developer Environment

- Node: >= 24 required (`.nvmrc`); package manager: pnpm 10 (D-035; `pnpm
install`, `pnpm exec`, `pnpm-lock.yaml`)
- IDE: VS Code with the oxc and TypeScript 7 extensions; on first open, accept
  the TypeScript extension's workspace-version prompt so the native language
  service uses the package registered by `.vscode/settings.json`

## project-harness — project workflow skills

This repo uses the `project-harness` plugin. Project state lives
in `PROJECTS.md` (the trunk) and `projects/P<NN>-*.md` (per-project
files). When the user mentions a project, plan, milestone, or
backlog, route through one of:

- `using-project-harness` — bootstrap and orientation
- `project-next` — what's in progress / next / recently touched
- `project-add` — capture an idea (≤4 questions, atomic ID reserve)
- `project-refine` — flesh out / scope / decompose / refine
  references
- `project-audit` — verify state matches conventions; fix per
  finding

**Schema (self-describing for external tools).** Trunk rows use
the standard markdown-link format
`- [<glyph>] **P<NN>** — [<title>](projects/P<NN>-<slug>.md)`.
Every non-`[?]` per-project file has a `**References**` block at
the top whose first bullet is
`- **Trunk:** [PROJECTS.md](../PROJECTS.md)` — the back-pointer
to the trunk — followed by canonical labels (`Spec`, `Design`,
`Plan`, `Depends on`, `Successor of`, `Tracking`, `Discussion`,
`Prior art`). Bidirectional links mean a tool that lands on
either file can navigate to the other without prior knowledge of
the conventions. See project-audit's references-block format
(project-audit skill, project-harness plugin) for the full format
and the discovery helper.
