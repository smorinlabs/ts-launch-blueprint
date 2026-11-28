# 0014. Hook-CI parity, Node-native cspell, and commitlint conventions

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`Q9.A`, `D-020`)
- **Related:** `lefthook.yml`, `cspell.json`, `commitlint.config.mjs`, `commitlint.dependabot.config.mjs`

## Context

Local git hooks that diverge from CI checks let PR failures surprise
contributors, while Python-based spellcheckers (`codespell`) introduce an
extra Python runtime requirement for Node developers and strict 50/72 commit
limits routinely reject Dependabot PRs.

## Decision

We will align local hooks and CI around Node-native tooling (`lefthook` +
`cspell` + `commitlint`):

- **`lefthook.yml`** mirrors CI gates across `pre-commit` (oxfmt, oxlint,
  depcruise, shellcheck, actionlint, editorconfig-checker, cspell,
  pnpm-lock-check, check-large-files, gitleaks, `tsc --noEmit`), `commit-msg`
  (commitlint), and `pre-push` (`gitleaks-range`, `press-verify`, opt-in tests).
- **`cspell`** (`cspell.json`) replaces Python `codespell` (`Q9.A`).
- **`commitlint`** (`Q9.A`) uses `100/200/200` header/body/footer limits for
  humans (matching `.gitmessage`) and `commitlint.dependabot.config.mjs` for
  Dependabot PRs.

## Consequences

- Zero Python runtime is required for day-to-day Node development and spelling
  checks.
- Dependabot PRs pass commitlint without manual body wrapping.

## Alternatives considered

- **Keep Python `codespell` or 50/72 commit limits** — forces Python setup on
  pure-TS contributors and breaks automated dependency PRs.
