# Git Hooks (lefthook)

Hooks are designed to maintain clean, consistent, and error-free code and configuration files. They save time by catching issues before they make it into your repository.

This project uses [lefthook](https://lefthook.dev) instead of the Python
ecosystem's `pre-commit` framework — a single Go binary, no Python runtime
required, configured entirely in [`lefthook.yml`](../../lefthook.yml).

## Installation

Hooks are activated automatically: `pnpm install` runs the package.json
`prepare` script (`lefthook install`). To (re)install them explicitly and wire
up the commit-message template in one step:

```bash
just setup-hooks
```

## What runs, and when

### `pre-commit` (parallel jobs, staged files only)

- **`format`** — runs `oxfmt` on staged `*.{ts,tsx,js,mjs,cjs,json,jsonc,yml,yaml,toml,md}`
  files and re-stages any fixes it makes (`stage_fixed: true`). This one job
  covers what the Python source split across several pre-commit hooks:
  `end-of-file-fixer`, `trailing-whitespace`, and the parse-validity intent of
  `check-yaml`/`check-toml` for every format Oxfmt formats (see
  [Code, JSON, YAML & Markdown formatting](formatting.md)). Port-process
  artifacts (`docs/port/TS_PORT_*.md`, `docs/port/TS_EXISTING_REPO_REVIEW.md`,
  `docs/port/goal.md`, `docs/port/typescript_port_process_prompt.md`) are
  excluded — they cross-reference each other by line number, so reformatting
  would corrupt those references. `.claude/settings.local.json` (untracked
  local session settings) is excluded too.
- **`check-large-files`** — a dependency-free POSIX shell job that rejects any
  staged file over 1MB (`1048576` bytes) outside `docs/assets/`, matching
  `.github/workflows/large-file-guard.yml`.
- **`editorconfig-checker`** — checks staged files against `.editorconfig`
  using `.editorconfig-checker.json` (excluding `docs/port/` and generated trees).
- **`cspell`** — spell-checks staged files using `cspell.json`
  (`--no-must-find-files --files {staged_files}`).
- **`pnpm-lock-check`** — verifies `pnpm-lock.yaml` is in sync whenever
  `package.json`, `**/package.json`, `pnpm-workspace.yaml`, or `pnpm-lock.yaml`
  is staged.
- **`lint`** — runs `oxlint` on staged `*.{ts,tsx,js,mjs,cjs}` files (excluding
  `**/dist/**` and `coverage/**`), the equivalent of the source's `ruff` lint
  hook.
- **`typecheck`** — runs `tsc --noEmit` on the _whole_ program, not just the
  staged files, because type-checking needs the full module graph. This
  mirrors the source's repo-wide `mypy` hook.

### `commit-msg`

- **`commitlint`** — checks the commit message against Conventional Commits
  (via `commitlint.config.mjs`, 100/200/200 header/body/footer limits), replacing
  the source's `gitlint` hook.

### `pre-push`

- **`press-verify`** — runs `just press-verify` to verify template-press
  rebrand hygiene before pushing.
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
hooks, without needing a commit. CI runs this too (`pnpm exec lefthook run
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
