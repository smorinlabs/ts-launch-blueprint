# ts-projects Example CLI

`ts-projects` is the template's example CLI — a TypeScript port of the
source repo's `py-projects` tool (D-024(11)). This document is its UX
spec.

## Features

- 🏢 Filter by workspace
- 📋 Multiple output formats (text, JSON, CSV)
- ✅ Interactive multi-select of the fetched projects
- 📎 Clipboard integration
- 🎨 Terminal UI with color support (`--no-color`/`NO_COLOR` honored)
- 🔐 Secure token handling
- 🤖 Pipe-safe: results on stdout only, diagnostics on stderr

> The source advertised "fuzzy search for project names" but never
> implemented it; the claim (and its dead dependencies) are dropped per
> D-031. The checkbox prompt's built-in list navigation is the
> selection aid.

## Installation

### From npm

```bash
# Placeholder — not yet published to npm (publishing lands in S5).
npm install -g ts-launch-blueprint
```

### From Source

```bash
git clone https://github.com/smorinlabs/ts-launch-blueprint.git
cd ts-launch-blueprint
npm install
just build
```

### Direct Usage

You can also run the built entry directly:

```bash
node dist/cli.js --help
```

## Configuration

The tool supports multiple ways to provide your ts-projects Personal
Access Token (PAT), in order of precedence:

1. Command-line argument: `--token`
2. Environment variable: `TS_PROJECTS_TOKEN`
3. Configuration file: `~/.config/ts-projects/ts-projects_config.toml`

The configuration file is TOML (cli-standards R5.2; D-017(1)). If
`XDG_CONFIG_HOME` is set, the file lives at
`$XDG_CONFIG_HOME/ts-projects/ts-projects_config.toml`; the
`~/.config` fallback applies on ALL platforms, including Windows
(`%USERPROFILE%\.config\ts-projects\`), matching the source's
cross-platform `~/.config` behavior.

> **Migration note (Python source)**: the source stored the token in a
> dotenv file (`~/.config/py-cli/.env` with `PY_TOKEN=...`). The port
> replaces that tier with the TOML file above — move your token to
> `token = "..."` in `ts-projects_config.toml`. There is no `.env`
> config tier and no dotenv dependency (D-017(5)).

### Setting Up the Configuration File

1. Create the config directory:

```bash
mkdir -p ~/.config/ts-projects
```

2. Create `ts-projects_config.toml`:

```bash
cat > ~/.config/ts-projects/ts-projects_config.toml <<'EOF'
token = "your_token_here"
EOF
```

3. Set proper permissions (POSIX):

```bash
chmod 600 ~/.config/ts-projects/ts-projects_config.toml
```

The CLI warns (non-fatally) when a token-bearing config file is
readable by group/others, and its own config writes use mode `0600`.

> **Windows note (D-017(6))**: file modes cannot express user/group/
> other on Windows, so the `chmod 600` step does not apply. Files under
> `%USERPROFILE%` are already scoped to your account by the profile
> directory's default ACLs. To harden explicitly:
>
> ```
> icacls "%USERPROFILE%\.config\ts-projects\ts-projects_config.toml" /inheritance:r /grant:r "%USERNAME%:F"
> ```

### Optional Config Keys

```toml
token = "your_token_here"   # personal access token
workspace = "My Workspace"  # default workspace filter
limit = 200                 # default maximum number of projects
```

`workspace` and `limit` act as defaults for the matching flags; an
explicit `--workspace`/`--limit` flag always wins (cli-standards R5.1).

### `--config <path>`

`--config` points the CLI at an explicit config file. The path must
exist (a missing path is a usage error, exit 2) and it REPLACES
discovery — the default user config is not merged in (cli-standards
R5.4).

### Inspecting the Effective Configuration

```bash
# Print effective values (token redacted) and their source
ts-projects config --show
```

## Usage

`projects` is the default command: bare `ts-projects` runs it, exactly
like bare `py-projects` did in the source.

### Basic Usage

```bash
# Search for projects (fetch, preview, interactive multi-select)
ts-projects

# Filter by workspace (case-insensitive name match)
ts-projects --workspace "My Workspace"

# Limit results (default: 200)
ts-projects --limit 50
```

After the fetch, an interactive checkbox prompt (rendered on stderr)
lets you select the subset of projects to output. Only the selected
projects flow into the output formats and sinks. Selecting nothing is a
graceful no-op: `No projects selected` on stderr, exit 0.

### Non-Interactive Use

The prompt requires a TTY. With `--no-input`, or whenever stdin/stderr
is not a TTY (pipes, CI, cron), the prompt is skipped and ALL fetched
projects are selected:

```bash
# Pipe-safe: stdout carries exactly one JSON document, nothing else
ts-projects --no-input --format json | jq '.projects[].name'
```

The fetch spinner renders on stderr only, and only when stderr is a
TTY outside CI — piped output never needs stripping.

### Output Formats

```bash
# JSON output: {"projects": [...]} with 2-space indent
ts-projects --format json

# CSV output: id,name header, one row per selected project
ts-projects --format csv

# Text output (default): one project ID per line (xargs-friendly)
ts-projects --format text
```

### Result Sinks

```bash
# Write to a file instead of stdout (confirmation goes to stderr)
ts-projects --output projects.txt

# Additionally copy the exact result string to the clipboard
ts-projects --copy
```

`--copy` needs a display server. In headless environments (CI,
containers, bare Linux servers without `xsel`/`wl-clipboard`) it fails
with a clear error on stderr and exit 1 — never a crash — after the
result has already been written to stdout or the `--output` file.

### Additional Options

```bash
# Verbose diagnostics (repeatable; adds the ID column to the preview)
ts-projects --verbose

# Disable colors
ts-projects --no-color

# Show help
ts-projects --help

# Show version
ts-projects --version
```

## Environment Variables

| Variable              | Effect                                                                             |
| --------------------- | ---------------------------------------------------------------------------------- |
| `TS_PROJECTS_TOKEN`   | Personal access token (beats the config file)                                      |
| `TS_PROJECTS_API_URL` | Overrides the API root (testing/self-hosted; default `https://app.ts.com/api/1.0`) |
| `XDG_CONFIG_HOME`     | Overrides the config base directory                                                |
| `NO_COLOR`            | Disables colored output (any non-empty value)                                      |
| `FORCE_COLOR`         | Forces colored output even when not a TTY (`0` disables)                           |
| `CI`                  | Any non-empty value suppresses the fetch spinner                                   |

An empty `TS_PROJECTS_TOKEN` is treated as unset. `--no-color` beats
`NO_COLOR`, which beats `FORCE_COLOR`, which beats TTY detection
(D-026/D-018(2)).

`TS_PROJECTS_API_URL` exists so the e2e test tier (and anyone pointing
the CLI at a compatible self-hosted API) can override the placeholder
API root without code changes.

## Exit Codes

Per cli-standards R6.1 (D-016(2)):

| Code | Meaning                                                |
| ---- | ------------------------------------------------------ |
| 0    | Success (including benign empty results)               |
| 1    | Generic/config/API error, unexpected exception         |
| 2    | Usage error (bad flag/command, nonexistent `--config`) |
| 3    | Not found (e.g. workspace not found)                   |
| 4    | Authentication error (missing/invalid token)           |
| 5    | Conflict                                               |
| 130  | Interrupted (SIGINT)                                   |
| 143  | Terminated (SIGTERM)                                   |

> **Mapping vs the Python source (D-024(11))**: the source _documented_
> 0 success / 1 configuration / 2 authentication / 3 API / 4 I/O /
> 5 interrupt, and _implemented_ 1 for config-and-missing-token, 3 for
> API errors, and 4 for unexpected exceptions. The port adopts the
> normative cli-standards ladder instead: missing/invalid token moves
> 1 → 4 (auth), API/network failures move 3 → 1, unexpected exceptions
> move 4 → 1, workspace-not-found stays 3, usage errors are 2, and the
> doc-only "5 = user interrupt" is replaced by the standard 130/143
> signal codes.
