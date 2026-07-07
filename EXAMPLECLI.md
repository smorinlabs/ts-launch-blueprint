# ts-projects Example CLI

`ts-projects` is the template's example CLI — a TypeScript port of the
source repo's `py-projects` tool (D-024(11)). This document is its UX
spec.

> **S3a partial**: this revision covers configuration, environment
> variables, precedence, and exit codes. The remaining sections
> (features, installation, usage, output formats, clipboard/file sinks)
> land in slice S3b.

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

## Environment Variables

| Variable            | Effect                                                   |
| ------------------- | -------------------------------------------------------- |
| `TS_PROJECTS_TOKEN` | Personal access token (beats the config file)            |
| `XDG_CONFIG_HOME`   | Overrides the config base directory                      |
| `NO_COLOR`          | Disables colored output (any non-empty value)            |
| `FORCE_COLOR`       | Forces colored output even when not a TTY (`0` disables) |

An empty `TS_PROJECTS_TOKEN` is treated as unset. `--no-color` beats
`NO_COLOR`, which beats `FORCE_COLOR`, which beats TTY detection
(D-026/D-018(2)).

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
