# P11 — CLI v4 noun-verb and config modernization

Add config init/get/set, doctor bundle, completion, layered config, and pager

### Notes

**Decisions (2026-11-27):**

- **Q3.A:** Clean pre-1.0 cutover to a pure `plbp`-style noun-verb hierarchy (`projects list`, `projects get <id>`, `config init|path|get|set`, `doctor [--bundle]`, `completion {bash,zsh,fish}`), with bare `ts-projects` printing help and `projects list` retaining interactive multi-select in TTY mode.
- **Q4.A:** Align all three CLI contract seams with Py v4 and `cli-standards` (superseding `D-017(1,3)` and `D-033`):
  - Tokens resolve from `--token` > `TS_PROJECTS_TOKEN` only (never stored in or read from TOML; `0600` file mode kept as defense-in-depth per Py ADR 0002).
  - `XDG_*` env vars win on all platforms; POSIX/macOS defaults stay `~/.config/ts-projects`, while Windows defaults use `%APPDATA%`/`%LOCALAPPDATA%`/`%PROGRAMDATA%` (Py ADR 0011).
  - Global `-o/--output {text,json,csv,markdown}`, `--json`, and `--output-file <path>` across all subcommands.
- Finish with a `ci-fix --optimize` closeout pass.

Largest single-area maturity gap: `apps/cli` ported pre-v3 `py-projects`, whereas Py `v4.2.0` ships the full `gh`-style `plbp` CLI (`docs/design/0001`, ADRs 0003–0012):

- **Noun-verb subcommands:** `projects list`, `projects get <id>` (depends on `P10`), `config init | path | get | set` (with `--dry-run`, `-y/--yes`, atomic temp-file + `fsync` + `rename` writes, corrupt-file write refusal), `doctor [--bundle]` (redacted bug-report snapshot), and `completion {bash,zsh,fish}`.
- **Global format contract:** Make `--format`/`--json` work across **all** subcommands (currently hardcoded to `projects` only; `config --show` ignores `--json`), add Markdown (`GFM` table) output alongside `text`/`json`/`csv`, and unify `ConfigError` instead of duplicating it in `apps/cli` and `apps/api`.
- **Full R5.1 config layering & resilience:** Implement missing `system` and `project` (`./ts-projects_config.toml`) layers alongside `user`, degrade invalid discovered layers to warnings (Py ADR 0004), and complete XDG `data`/`state`/`cache` dirs.
- **Diagnostics & interactive UX:** Add structured `hint` + append-only error-code registry on domain/CLI errors, unexpected-error crash log in XDG state dir, interactive text pager (`TS_PROJECTS_PAGER` > `PAGER` > `less -FRX`), one-time first-run onboarding hint, and optional `--log-file` / `--log-level`.
- **Docs cleanup:** Remove stale S5 placeholder note in `EXAMPLECLI.md:27` and update `EXAMPLECLI.md` / `docs/reference/cli-reference.md`.

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P11` when ready. -->
