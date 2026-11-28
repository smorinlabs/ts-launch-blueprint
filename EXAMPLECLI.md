# ts-projects Example CLI

`ts-projects` is the template's example CLI — a TypeScript port of
`py-launch-blueprint`'s `plbp` v4 CLI (`Q3.A`, `Q4.A`). This document is
its UX spec.

## Features

- 🧭 Clean noun-verb command tree (`projects`, `config`, `doctor`, `completion`)
- 🏢 Filter projects by workspace or fetch a single project by ID
- 📋 Global output formats (`text`, `json`, `csv`, `markdown`) and `--output-file`
- ✅ Interactive multi-select on `projects list` in TTY mode
- 📎 Clipboard integration (`--copy`)
- 🎨 Terminal UI with color support (`--no-color`/`NO_COLOR`/`[output].color`)
- 🔐 Env/flag-only token handling (tokens are never stored in TOML config files)
- 📁 3-layer TOML config discovery (`system` → `user` → `project`) with warning degradation
- 📖 Interactive pager (`TS_PROJECTS_PAGER` > `PAGER` > `less -FRX`) for tall text output
- 🩺 Diagnostics (`doctor [--bundle]`) and shell completion (`completion {bash,zsh,fish}`)
- 🪵 Dual-sink logging (`--log-level`, `--log-file`) and `TS000` crash log
- 🤖 Pipe-safe: results on stdout only, diagnostics/warnings/errors on stderr

## Installation

### From npm

```bash
npm install -g ts-launch-blueprint
```

### From Source

```bash
git clone https://github.com/smorinlabs/ts-launch-blueprint.git
cd ts-launch-blueprint
pnpm install
just build
```

### Direct Usage

You can also run the built entry directly:

```bash
node apps/cli/dist/cli.js --help
```

## Configuration

### Token Precedence (No Tokens in Config Files)

Per ADR 0002, `ts-projects` never reads or writes `token` in TOML config
files. Tokens resolve strictly from:

1. Command-line flag: `--token <token>`
2. Environment variable: `TS_PROJECTS_TOKEN`

Empty strings are treated as unset. Running `ts-projects config set token ...`
is rejected with `ConfigError` (`TS001`).

### 3-Layer Config Discovery & Platform Paths (ADR 0004, ADR 0011)

Without `--config` or `TS_PROJECTS_CONFIG`, `ts-projects` merges three
TOML layers from lowest to highest precedence:

1. **System**: `$XDG_CONFIG_DIRS` (colon-separated on POSIX, semicolon-separated
   on Windows; defaults to `/etc/xdg/ts-projects/ts-projects_config.toml`
   on POSIX and `%PROGRAMDATA%\ts-projects\ts-projects_config.toml` on Windows)
2. **User**: `$XDG_CONFIG_HOME/ts-projects/ts-projects_config.toml`
   (defaults to `~/.config/ts-projects/ts-projects_config.toml` on POSIX
   and `%APPDATA%\ts-projects\ts-projects_config.toml` on Windows)
3. **Project**: `./.ts-projects_config.toml` in the current working directory if
   present, otherwise `./ts-projects_config.toml`

`XDG_CONFIG_HOME`, `XDG_CONFIG_DIRS`, `XDG_DATA_HOME`, `XDG_STATE_HOME`,
and `XDG_CACHE_HOME` win on **all** platforms when set, non-empty, and
absolute. On Windows, unset XDG variables default to `%APPDATA%`
(config), `%LOCALAPPDATA%` (data/state), and `%LOCALAPPDATA%\ts-projects\Cache`
(cache).

If a discovered config file or setting value is invalid, `ts-projects`
emits a `warning:` on stderr once (suppressed in JSON mode) and degrades
gracefully to valid defaults. Explicit `--config <path>` (or
`TS_PROJECTS_CONFIG`) replaces discovery: a missing file is tolerated,
while unreadable or malformed TOML raises `ConfigError` (`TS001`, exit `1`).

### Config Schema & Interactive Management

```toml
workspace = "My Workspace"  # optional default workspace filter for projects list
limit = 200                 # optional default limit for projects list

[output]
format = "text"   # text | json | csv | markdown
color = "auto"    # auto | always | never

[logging]
level = "warning"     # debug | info | warning | error | critical
file = ""             # optional log file path
file_level = "debug"  # debug | info | warning | error | critical
format = "text"       # text | json
```

Manage config safely (atomic `temp + fsync + rename`, `0o600` on POSIX,
corrupt-target write refusal):

```bash
ts-projects config init              # guided prompts on stderr (--yes, --dry-run)
ts-projects config path              # print resolved target path and existence
ts-projects config get output.color  # show value and source (config | default)
ts-projects config get token         # masked ****XXXX and source (flag | env | -)
ts-projects config set logging.level info --yes
```

## Usage

Bare `ts-projects` (and bare `ts-projects projects` / `ts-projects config`)
prints help to stdout and exits `0`. Misspelled commands and flags suggest
near matches (`Did you mean ...?`) and exit `2`.

### `projects list` and `projects get <id>`

```bash
# List projects (interactive multi-select in TTY mode)
ts-projects projects list

# Filter by workspace and limit
ts-projects projects list --workspace "My Workspace" --limit 50

# Fetch a single project by ID
ts-projects projects get 12345 --json

# Demo mode without token or network
ts-projects projects list --source memory --no-input --json
TS_PROJECTS_SOURCE=memory ts-projects projects get p-1 --json
```

Selecting nothing in interactive mode prints `No projects selected` on stderr
and exits `0`. Interrupting a prompt (`Ctrl-C`) prints `Cancelled.` on stderr
and exits `130`.

### Global Output Formats (`-o/--output`, `--json`, `--output-file`)

Every subcommand honors global output flags before or after the verb:

```bash
ts-projects projects list -o text       # terminal table (paged if tall)
ts-projects projects list -o json       # 2-space JSON
ts-projects projects list --json        # overrides -o / env / config -> json
ts-projects projects list -o csv        # RFC 4180 CSV
ts-projects projects list -o markdown   # GFM table with ## heading and \| escaping
ts-projects doctor --bundle --output-file report.json --json
```

Precedence: `--json` > `-o/--output` > `TS_PROJECTS_OUTPUT` > `[output].format` > `text`.

### Interactive Pager (ADR 0008)

In `text` mode on an interactive stdout TTY without `--output-file` or
`--no-input`, output with line count `>=` terminal rows pipes through
`TS_PROJECTS_PAGER` > `PAGER` > `less -FRX`. Set-but-empty `TS_PROJECTS_PAGER=""`
or `PAGER=""` disables paging. Spawn failures fall back cleanly to stdout.

### First-Run Onboarding & Crash Log

- **First-run hint**: On an interactive TTY stderr run when no config file
  exists (`--no-input`, `-q`, `--json`, and `config init` excluded), a
  one-time hint is shown and recorded at
  `<state>/ts-projects/ts-projects_first_run.marker`.
- **Crash log (`TS000`)**: Unexpected non-domain errors append a UTC
  timestamp and stack trace to `<state>/ts-projects/ts-projects_crash.log`
  and print `full traceback: <path>` (or `traceback_path` in JSON errors).

### `doctor [--bundle]` and `completion`

```bash
ts-projects doctor            # checks node (>=24), platform, config-file, token
ts-projects doctor --bundle   # redacted snapshot for bug reports
ts-projects completion bash   # also zsh, fish
```

### Structured JSON Errors (ADR 0006)

When JSON output is active, errors on stderr emit a single JSON line:

```json
{
  "error": {
    "code": 4,
    "name": "AUTH",
    "message": "No TS_PROJECTS_TOKEN found (never stored in the config file).",
    "error_code": "TS002",
    "hint": "supply it via --token or $TS_PROJECTS_TOKEN; `ts-projects doctor` checks setup"
  }
}
```

## Environment Variables

| Variable                   | Effect                                                                           |
| -------------------------- | -------------------------------------------------------------------------------- |
| `TS_PROJECTS_TOKEN`        | Personal access token (only env/flag token source; empty treated as unset)       |
| `TS_PROJECTS_CONFIG`       | Explicit config file path (replaces 3-layer discovery)                           |
| `TS_PROJECTS_OUTPUT`       | Default output format (`text`, `json`, `csv`, `markdown`)                        |
| `TS_PROJECTS_PAGER`        | Pager command (`""` disables paging)                                             |
| `TS_PROJECTS_LOG_LEVEL`    | Explicit console log level (`debug`, `info`, `warning`, `error`, `critical`)     |
| `TS_PROJECTS_LOG_FILE`     | File sink path (`""` enables default `<state>/ts-projects/ts-projects.log`)      |
| `TS_PROJECTS_LOG_FORMAT`   | File sink format (`text` or `json` JSONL)                                        |
| `TS_PROJECTS_API_URL`      | Overrides the API root (default `https://app.ts.com/api/1.0`)                    |
| `TS_PROJECTS_SOURCE`       | Data source: `http` (default) or `memory`                                        |
| `XDG_CONFIG_HOME` / `...`  | XDG base-directory overrides (`CONFIG`, `CONFIG_DIRS`, `DATA`, `STATE`, `CACHE`) |
| `NO_COLOR` / `FORCE_COLOR` | Color overrides (`--no-color` > `NO_COLOR` > `FORCE_COLOR` > `[output].color`)   |
| `CI`                       | Any non-empty value suppresses the fetch spinner                                 |

## Exit Codes

Per cli-standards R6.1:

| Code  | Name        | Meaning                                                |
| ----- | ----------- | ------------------------------------------------------ |
| `0`   | `SUCCESS`   | Success (including bare help and benign empty results) |
| `1`   | `ERROR`     | Config (`TS001`), API (`TS003`), clipboard, or `TS000` |
| `2`   | `USAGE`     | Invalid flag, argument, command, or env choice         |
| `3`   | `NOT_FOUND` | Project (`TS005`) or workspace (`TS006`) not found     |
| `4`   | `AUTH`      | Missing or rejected token (`TS002`)                    |
| `5`   | `CONFLICT`  | Conflict                                               |
| `130` | `SIGINT`    | Interrupted / cancelled / prompt declined (`TS004`)    |
| `143` | `SIGTERM`   | Terminated                                             |
