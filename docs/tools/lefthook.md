# Git Hooks (lefthook)

Hooks are designed to maintain clean, consistent, and error-free code and configuration files. They save time by catching issues before they make it into your repository.

This project uses [lefthook](https://lefthook.dev) instead of the Python
ecosystem's `pre-commit` framework — a single Go binary, no Python runtime
required, configured entirely in [`lefthook.yml`](../../lefthook.yml).

## Installation

Hooks are activated automatically: `npm install` runs the package.json
`prepare` script (`lefthook install`). To (re)install them explicitly and wire
up the commit-message template in one step:

```bash
just setup-hooks
```

## What runs, and when

### `pre-commit` (parallel jobs, staged files only)

- **`format`** — runs `oxfmt` on staged `*.{ts,tsx,js,mjs,cjs,json,jsonc,yml,yaml,md}`
  files and re-stages any fixes it makes (`stage_fixed: true`). This one job
  covers what the Python source split across several pre-commit hooks:
  `end-of-file-fixer`, `trailing-whitespace`, and the parse-validity intent of
  `check-yaml`/`check-toml` for every format Oxfmt formats (see
  [Code, JSON, YAML & Markdown formatting](formatting.md)). Port-process
  artifacts (`TS_PORT_*.md`, `TS_EXISTING_REPO_REVIEW.md`, `goal.md`,
  `typescript_port_process_prompt.md`) are excluded — they cross-reference each
  other by line number, so reformatting would corrupt those references.
- **`check-large-files`** — a dependency-free POSIX shell job that rejects any
  staged file over 500KB, the equivalent of pre-commit's
  `check-added-large-files`.
- **`lint`** — runs `oxlint` on staged `*.{ts,tsx,js,mjs,cjs}` files (excluding
  `dist/**` and `coverage/**`), the equivalent of the source's `ruff` lint
  hook.
- **`typecheck`** — runs `tsc --noEmit` on the _whole_ program, not just the
  staged files, because type-checking needs the full module graph. This
  mirrors the source's repo-wide `mypy` hook.

### `commit-msg`

- **`commitlint`** — checks the commit message against Conventional Commits
  (via `commitlint.config.mjs`), replacing the source's `gitlint` hook.

### `pre-push` (opt-in)

- **`test`** — runs the full `just test` suite, but only if you export
  `TS_PROJECTS_PREPUSH_TESTS=1`; otherwise it prints a skip notice. Unlike the
  Python source (which ran `pytest` on every commit), the test suite here does
  not run automatically at commit time — a full run on every commit taxes
  contributor DX and trains people to reach for `--no-verify`. CI is the
  backstop, and `just pre-commit-run` gives you the same gates locally on
  demand.

## Running the gates yourself

`just pre-commit-run` (alias `just pc`) runs `format-check`, `lint`,
`typecheck`, and `test` on **all** files — the same underlying gates as the
hooks, without needing a commit. CI runs this too (`npx lefthook run
pre-commit --all-files`) so the committed hook discipline is exercised on
every push, not just locally.

## Skipping hooks

Use `git commit --no-verify` to skip pre-commit/commit-msg hooks for a single
commit. This is a deliberate escape hatch, not encouraged practice — CI still
runs the full gate set.

## References

- [lefthook documentation](https://lefthook.dev)
- [`lefthook.yml`](../../lefthook.yml) in this repository
- [`commitlint.config.mjs`](../../commitlint.config.mjs) in this repository
- [Code, JSON, YAML & Markdown formatting](formatting.md)
