# 0003. Noun-verb CLI surface and global output formats

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`Q3.A`, `Q4.A`, `D-016`, `D-018`, `D-033`)
- **Related:** `apps/cli/src/cli/router.ts`, `apps/cli/src/cli/format.ts`, `EXAMPLECLI.md`

## Context

An earlier CLI iteration exposed `projects` as a default bare-root action and
placed formatting flags on individual commands. That prevented adding sibling
noun groups (`config`, `doctor`, `completion`) cleanly and created inconsistent
output/error contracts across subcommands.

## Decision

We will adopt a **clean pre-1.0 noun-verb CLI surface** with **global output
controls**:

- Bare `ts-projects` prints top-level help and exits `0` (no default
  subcommand).
- Noun-verb groups: `projects list|get`, `config init|path|get|set`,
  `doctor [--bundle]`, and `completion {bash,zsh,fish}`.
- Global flags `-o, --output {text,json,csv,markdown}`, `--json`, and
  `--output-file <path>` apply uniformly across data-emitting subcommands
  (`projects`, `config`, `doctor`); `completion` emits raw shell scripts
  regardless of `-o`/`--json` while still honoring `--output-file <path>`.
- Machine-mode errors emit a single structured JSON object on stderr while
  keeping stdout pure for requested output; progress/spinners write only to
  stderr when TTY-safe.
- Standard exit codes follow `0/1/2/3/4/5/130/143` (`cli-standards` R6.1).

## Consequences

- Every data-emitting subcommand shares identical formatting, file-output, and
  JSON error contracts (and `completion` emits raw shell completions with
  `--output-file` support), pinned by 80-column `--help` snapshots.
- Legacy bare-root invocation (`ts-projects --limit 5`) is removed cleanly
  before `1.0.0`.

## Alternatives considered

- **Keep `{ isDefault: true }` on `projects`** — causes ambiguous flag parsing
  and breaks `gh`-style noun-verb discoverability.
- **Per-command `--format` flags** — forces duplicate option plumbing and
  inconsistent `csv`/`markdown`/`--output-file` support.
