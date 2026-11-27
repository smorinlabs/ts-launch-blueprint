# P11 — CLI v4 noun-verb and config modernization

Add config init/get/set, doctor bundle, completion, layered config, and pager

### Open questions

- Keep bare `ts-projects` as the default interactive multi-select alias alongside `ts-projects projects list` / `ts-projects projects get <id>`, or break cleanly to `plbp`-style noun-verb subcommands only?
- Keep `token` allowed in `0600` user TOML config (current `D-017(1,6)` per `cli-standards` R5.1) or align with Py ADR 0002 (forbid secrets in config files)?
- Keep `~/.config/<tool>` on Windows (`D-017(3)`) or switch to Windows-native `%APPDATA%`/`%LOCALAPPDATA%` (Py ADR 0011)?
- Keep `--output` as file sink (`D-033`) or align with Py's `-o/--output <format>` + `--output-file <path>`?

### Notes

Largest single-area maturity gap: `apps/cli` ported pre-v3 `py-projects`, whereas Py `v4.2.0` ships the full `gh`-style `plbp` CLI (`docs/design/0001`, ADRs 0003–0012):

- **Noun-verb subcommands:** `projects list`, `projects get <id>` (depends on `P10`), `config init | path | get | set` (with `--dry-run`, `-y/--yes`, atomic temp-file + `fsync` + `rename` writes, corrupt-file write refusal), `doctor [--bundle]` (redacted bug-report snapshot), and `completion {bash,zsh,fish}`.
- **Global format contract:** Make `--format`/`--json` work across **all** subcommands (currently hardcoded to `projects` only; `config --show` ignores `--json`), add Markdown (`GFM` table) output alongside `text`/`json`/`csv`, and unify `ConfigError` instead of duplicating it in `apps/cli` and `apps/api`.
- **Full R5.1 config layering & resilience:** Implement missing `system` and `project` (`./ts-projects_config.toml`) layers alongside `user`, degrade invalid discovered layers to warnings (Py ADR 0004), and complete XDG `data`/`state`/`cache` dirs.
- **Diagnostics & interactive UX:** Add structured `hint` + append-only error-code registry on domain/CLI errors, unexpected-error crash log in XDG state dir, interactive text pager (`TS_PROJECTS_PAGER` > `PAGER` > `less -FRX`), one-time first-run onboarding hint, and optional `--log-file` / `--log-level`.
- **Docs cleanup:** Remove stale S5 placeholder note in `EXAMPLECLI.md:27` and update `EXAMPLECLI.md` / `docs/reference/cli-reference.md`.

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P11` when ready. -->
