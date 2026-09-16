# CLAUDE.md - Agent Guidelines for TS Launch Blueprint

See AGENTS.md for the full project charter (canonical AI-context hub).

## Project Commands

- Setup: `just install` (installs shell analyzers, dependencies, and git hooks)
- Format: `just format` (or `pnpm exec oxfmt`)
- Format check: `just format-check` (or `pnpm exec oxfmt --check`)
- Lint: `just lint` (or `pnpm exec oxlint`); autofix: `just lint-fix`
- Type check: `just typecheck` (or `pnpm exec tsc --noEmit`)
- Test all: `just test`
- Test single: `pnpm exec vitest run tests/version.test.ts -t 'test name'`
- All checks: `just all` (format-check, lint, shell/workflow checks, typecheck, test)
- Hook suite on all files: `just pre-commit-run`
- Install hooks + commit template: `just setup-hooks`
- Build: `just build`

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
- IDE: VS Code with the oxc extension; editor TypeScript pinned to the
  workspace version via `.vscode/settings.json`
