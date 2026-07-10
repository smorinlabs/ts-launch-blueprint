# Code, JSON, YAML & Markdown Formatting (Oxfmt)

## Introduction

This project uses files extensively for configuration: TypeScript/JavaScript
source, `package.json` and other JSON, GitHub Actions workflows in YAML, and
Markdown docs. To keep all of them consistently formatted, this repo uses a
single tool, [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html), for
everything — code, JSON, YAML, _and_ Markdown.

**Key benefits**:

- **Single tool**: one formatter for `.ts`/`.tsx`/`.js`/`.mjs`/`.cjs`, JSON/JSONC,
  YAML, and Markdown — no conflicting tools fighting over the same files.
- **Fast**: Oxfmt is built on the [oxc](https://oxc.rs) Rust toolchain.
- **Pre-commit integration**: runs automatically on staged files via
  [lefthook](lefthook.md), with auto-fixes re-staged.
- **No extra runtime**: it is a `pnpm` devDependency already installed by
  `pnpm install` — no Go toolchain, no separate binary to manage.

## Usage

### Format everything (writes fixes)

```bash
just format
```

_Runs `oxfmt` in write mode across the repo, including import sorting (see
below). Equivalent to `pnpm exec oxfmt`._

### Check formatting without writing (CI-parity gate)

```bash
just format-check
```

_Runs `oxfmt --check`; exits non-zero if anything is unformatted. This is the
gate CI and `just pre-commit-run` both use. Equivalent to `pnpm exec oxfmt --check`._

## Configuration

Oxfmt is configured in [`.oxfmtrc.json`](../../.oxfmtrc.json):

| Option           | Value    | Notes                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `printWidth`     | `100`    | Org-consistent width; the Python source's 88-column `ruff` width was a Python norm, not portable intent.                                                                                                                                                                                                                                                                     |
| `singleQuote`    | `true`   |                                                                                                                                                                                                                                                                                                                                                                              |
| `semi`           | `true`   |                                                                                                                                                                                                                                                                                                                                                                              |
| `trailingComma`  | `"es5"`  |                                                                                                                                                                                                                                                                                                                                                                              |
| `endOfLine`      | `"lf"`   |                                                                                                                                                                                                                                                                                                                                                                              |
| `sortImports`    | `true`   | Enables Oxfmt's built-in perfectionist-like import sorter — the equivalent of `ruff`'s `I` (isort) rules, kept as a formatting concern rather than a separate lint plugin.                                                                                                                                                                                                   |
| `ignorePatterns` | see file | Excludes port-process artifacts (`docs/port/TS_PORT_*.md`, `docs/port/TS_EXISTING_REPO_REVIEW.md`, `docs/port/goal.md`, `docs/port/typescript_port_process_prompt.md`) that cross-reference each other by line number — reformatting would corrupt those references — plus `.claude/settings.local.json`, an untracked local-session file that must never fail format-check. |

Oxfmt also formats JSON/JSONC, YAML, and Markdown using these same repo-wide
settings — there is no separate config file for those formats.

## Pre-commit integration

Formatting runs automatically on every commit via
[lefthook](lefthook.md#pre-commit-parallel-jobs-staged-files-only): the
`format` job runs `oxfmt` on staged files matching
`*.{ts,tsx,js,mjs,cjs,json,jsonc,yml,yaml,md}` and re-stages any fixes
(`stage_fixed: true`).

## Why no yamlfmt or taplo

The Python source used two extra single-purpose formatters: `yamlfmt` (Go
binary, YAML only) and `taplo` (TOML only). Both are omitted here, not carried
over 1:1:

- **YAML** (`yamlfmt`): Oxfmt formats YAML directly (Prettier-compatible
  output), so a second Go binary and its `just install-go` /
  `just install-yamlfmt` bootstrap step are unnecessary. The intent — every
  YAML file is machine-formatted — is preserved; the tool is not.
- **TOML** (`taplo`): this repo ships no TOML files that need a dedicated
  formatter (`.taplo.toml` and `cog.toml` were dropped along with the
  Python-specific release tooling they belonged to). If a TOML file is ever
  added, Oxfmt formats TOML as well, so no new dependency would be needed.

## Skipping formatting

- To skip the pre-commit format job for a single commit, use
  `git commit --no-verify` (not encouraged — CI still runs `format-check`).
- To change formatting rules, edit `.oxfmtrc.json`.
- To remove the check entirely, remove the `format` job from `lefthook.yml`
  and the `format`/`format-check` recipes from the `Justfile`.

## References

- [Oxfmt documentation](https://oxc.rs/docs/guide/usage/formatter.html)
- [`.oxfmtrc.json`](../../.oxfmtrc.json) in this repository
- [Git Hooks (lefthook)](lefthook.md)
