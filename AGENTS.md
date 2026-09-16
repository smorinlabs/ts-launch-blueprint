# AGENTS.md — Project Charter for ts-launch-blueprint

This file is the canonical AI-assistant context hub for this repository
(D-024(5); it replaces the Python source's `.windsurfrules`). Spokes:
`CLAUDE.md` (terse command card), `.cursor/rules/*.mdc` (Cursor glob rules),
`.windsurf/rules/justfile-rules.md` (Justfile conventions glob rule).

## Base Rules

- `Justfile` is used to configure `just` commands and has all commands to run
  the project
- `Makefile` is just used to bootstrap the project; no new targets should be
  added there

## Project Overview

ts-launch-blueprint is a production-ready TypeScript project template — the
TypeScript port of [py-launch-blueprint](https://github.com/smorinlabs/py-launch-blueprint).
It ships a small example CLI (`ts-projects`) plus the full quality-gate,
packaging, and repo-hygiene scaffolding a serious npm package needs.

- Package name: `ts-launch-blueprint`
- Command name: `ts-projects`
- Env-var prefix: `TS_PROJECTS_*`

## Development Environment

### Package Management

- **pnpm 10**: package manager (D-035; bootstrapped once via `make
install-pnpm`, not bundled with Node — it self-manages to the version
  pinned in `package.json`'s `packageManager` field via `.npmrc`); lockfile
  `pnpm-lock.yaml` is committed
- Node version: requires Node.js 24 or higher (`.nvmrc`, `engines`,
  `devEngines.runtime` all agree; a meta-test enforces it)

### Build System

- **tsdown**: bundles `src/cli.ts` + `src/lib.ts` to `dist/` (ESM-only) with
  declarations and sourcemaps
- Version management: `package.json` is the single version source, bumped only
  by release-please Release PRs; `src/version.ts` inlines it at build time.
  `pnpm-lock.yaml` does not duplicate the root project version, so release PRs
  need no follow-up lockfile mutation and must remain atomic.

## Development Workflow

### Task Runner

- **Just**: used for command automation (see Justfile for available commands)
  - `just install`: install dependencies (also installs git hooks via prepare)
  - `just format`: run the formatter (oxfmt, writes fixes + sorts imports)
  - `just format-check`: check formatting without writing
  - `just lint`: run the linter (oxlint)
  - `just lint-fix`: run the linter with autofixes
  - `just typecheck`: run type checking (tsc --noEmit)
  - `just test`: run tests (Vitest)
  - `just test-bun`: OPTIONAL/ADVISORY — run non-e2e tiers under Bun (D-036;
    no-op if bun absent). Never `bun install` (pnpm-only lockfile), never bare
    `bun test` (Vitest drives via `bun run vitest`); e2e stays Node-only.
  - `just all`: run all checks (format-check, lint, typecheck, test)
  - `just pre-commit-run`: run the full hook suite on all files (CI mirror)
  - `just setup-hooks`: install git hooks + commit-message template
  - `just build`: build distributable `dist/`
  - `just check-deps` / `just debug-info`: toolchain diagnosis

### Code Quality Tools

- **Oxlint**: linter — correctness + suspicious categories at error severity,
  security-adjacent built-ins (no-eval family), `^_` unused-code convention;
  per-context relaxations for `tests/**` (`.oxlintrc.json`)
- **Oxfmt**: formatter (exact-pinned beta) — 100 cols, single quotes, semis,
  es5 trailing commas, LF, `sortImports`; also formats JSON/YAML/Markdown
  (`.oxfmtrc.json`)
- **tsc**: strict type checking (`tsc --noEmit`), strict flag union incl.
  `isolatedDeclarations` — annotate all exports explicitly
- **lefthook**: git hooks — pre-commit (staged format with stage_fixed, staged
  lint, full typecheck), commit-msg (commitlint), opt-in pre-push tests
  (`lefthook.yml`)
- **commitlint**: Conventional Commits, 50-char subject / 72-char body lines,
  types `feat, fix, docs, style, refactor, test, chore, ci, build, perf,
revert` (`commitlint.config.mjs`, mirrored in `.gitmessage`)
- **Vitest**: testing with v8 coverage, thresholds 95/95/90/95
  (lines/functions/branches/statements)

## Dependencies

### Runtime Dependencies

- None yet — the CLI feature set (commander, prompts, clipboard, TOML config)
  lands in slices S3a/S3b

### Development Dependencies

- typescript, tsdown: type checking and build
- vitest, @vitest/coverage-v8: testing with coverage
- oxlint, oxfmt: linting and formatting
- lefthook, @commitlint/cli, @commitlint/config-conventional: git hooks and
  commit linting
- tsx: run TypeScript directly (VS Code debug configs)
- yaml: YAML parsing in repo-hygiene meta-tests

## Project Structure

- Package name: `ts-launch-blueprint`
- Command name: `ts-projects`
- Source in `/src` (`cli.ts` bin entry, `lib.ts` public API, `version.ts`)
- Tests in `/tests` (`*.test.ts`)
- Build output in `/dist` (gitignored)

## Shell checks

Run `just install-shell-tools` once and put `~/.local/bin` on PATH. It installs
checksum-verified ShellCheck 0.11.0 and actionlint 1.7.12. `just all` includes
`just check-shell` for tracked `.sh`/`.bash` files and `just check-workflows`
for embedded workflow shell commands. Staged checks run through lefthook;
CI explicitly provisions both analyzers and repeats the checks.
