# Key Features of TS Launch Blueprint

- **Zero Configuration Setup**: get started immediately with pre-configured
  development tools — linting, formatting, type checking, and git hooks are
  wired up before you write a line of code.
- **Type Safety First**: a strict `tsc` configuration
  (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and
  more) plus a committed VS Code `typescript.tsdk` pin, so the editor's
  language service and the CI type-check gate always agree on the same
  compiler version.
- **Modern Development Tools**:
  - Oxlint + Oxfmt for lightning-fast linting and formatting (one Rust-based
    toolchain covers TypeScript, JavaScript, JSON, YAML, and Markdown)
  - lefthook git hooks for code quality enforcement, with commitlint checking
    every commit message
  - Type checking with `tsc --noEmit`, run as its own gate in hooks, `just`
    recipes, and CI

## Production Ready

- **Node.js 24+ Support**: targets the current Active LTS floor, tested in CI
  against both the LTS (`24.x`) and Current (`26.x`) release lines.
- **Dependency Management**: uses `pnpm` (with `pnpm-lock.yaml`) for fast,
  reproducible installs; `engines` enforces the Node floor, and `packageManager`
  field with `.npmrc` (`managePackageManagerVersions` / `packageManagerStrict` /
  `packageManagerStrictVersion`) enforce pnpm version compliance.
- **CI/CD Ready**: includes GitHub Actions workflows for quality gates (lint,
  format, typecheck, test, build), CodeQL security analysis, dependency
  review on pull requests, and a manual OSV-based PR security scan.
- **Comprehensive Testing**: Vitest 4 with v8 coverage enforced at 95%
  lines/functions, 90% branches, 95% statements, plus a two-tier CLI test
  strategy — fast in-process dependency-injected tests and a subprocess
  end-to-end tier that exercises the built CLI binary.
- **Automated Releases**: [release-please](https://github.com/googleapis/release-please)
  bumps `package.json` and the changelog from Conventional Commit history —
  no hand-edited version file — and publishing uses
  [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC),
  so no long-lived npm token is ever stored.

## Developer Experience

- **VS Code Integration**: a curated set of recommended extensions (Oxc,
  TOML, YAML, GitLens, spell-checker, GitHub PRs/Actions, Claude Code) plus
  the minimal `typescript.tsdk` pin — no other opinionated editor settings
  are imposed.
- **Command Surface**: a single [`Justfile`](../../Justfile) exposes every
  common task (`just build`, `just test`, `just lint`, `just format`,
  `just all`, `just docs-check`, `just pack-check`, and more) — run `just`
  with no arguments to list them all.
- **Clear Documentation**: this `docs/` tree explains every tool choice and
  configuration in plain Markdown, alongside a full
  [CLI reference](../reference/cli-reference.md) for the bundled `ts-projects`
  example CLI.
- **Git Hooks**: [lefthook](../tools/lefthook.md) formats and lints staged
  files and type-checks the repo before each commit, and checks commit
  messages against Conventional Commits — installed automatically by
  `pnpm install`.
- **Open Source Ready**: a Code of Conduct, issue/PR templates, a
  Contributor License Agreement flow via [CLA Assistant](../tools/cla-assistant.md),
  and an automated `CONTRIBUTORS.md` are included out of the box.

## Perfect For

- Professionals looking for a production-ready TypeScript CLI/library
  template.
- Teams wanting a standardized TypeScript development environment.
- Projects requiring maintainable, type-safe code with an enforced coverage
  bar.
- Developers who value clean, consistent code style with a single fast
  lint/format toolchain.
- Anyone looking to adopt TypeScript best practices from day one.

Start your next TypeScript project with confidence, knowing you're building
on a foundation of best practices and modern development tools.
