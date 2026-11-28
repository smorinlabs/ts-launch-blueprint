# Configuration Files

This section documents the configuration files used by this project:
the TOML file `ts-projects` reads at runtime, and the project's own
tooling configuration (package manifest, TypeScript, lint/format,
hooks, tests, build, release). Understanding these files will help you
customize and extend the project.

## User Configuration (TOML + XDG)

`ts-projects` resolves configuration from a 3-layer TOML hierarchy
(`system` → `user` → `project`) plus env/flag-only secrets
(`apps/cli/src/cli/config.ts`, `apps/cli/src/cli/xdg-paths.ts`).

### File locations (ADR 0011)

`XDG_CONFIG_HOME`, `XDG_CONFIG_DIRS`, `XDG_DATA_HOME`, `XDG_STATE_HOME`,
and `XDG_CACHE_HOME` win on **all** platforms whenever set, non-empty, and
absolute. When unset:

- **POSIX**:
  - System: `/etc/xdg/ts-projects/ts-projects_config.toml`
  - User: `~/.config/ts-projects/ts-projects_config.toml`
  - Data / State / Cache: `~/.local/share/ts-projects`, `~/.local/state/ts-projects`, `~/.cache/ts-projects`
- **Windows**:
  - System: `%PROGRAMDATA%\ts-projects\ts-projects_config.toml` (`XDG_CONFIG_DIRS` splits on `;`)
  - User: `%APPDATA%\ts-projects\ts-projects_config.toml`
  - Data / State / Cache: `%LOCALAPPDATA%\ts-projects`, `%LOCALAPPDATA%\ts-projects`, `%LOCALAPPDATA%\ts-projects\Cache`
- **Project layer** (all platforms): `./.ts-projects_config.toml` if present,
  else `./ts-projects_config.toml`.

`--config <path>` (or `TS_PROJECTS_CONFIG`) replaces 3-layer discovery:
a missing explicit file is tolerated, while unreadable or invalid TOML
raises `ConfigError` (`TS001`, exit `1`).

### Keys and Schema

```toml
workspace = "My Workspace"  # optional default workspace filter
limit = 200                 # optional default maximum number of projects

[output]
format = "text"             # text | json | csv | markdown
color = "auto"              # auto | always | never

[logging]
level = "warning"           # debug | info | warning | error | critical
file = ""                   # optional log file path
file_level = "debug"        # debug | info | warning | error | critical
format = "text"             # text | json
```

All keys are optional and validated with Zod (`configFileSchema` in
`apps/cli/src/cli/config.ts`). Invalid discovered files or invalid keys
emit a single `warning:` on stderr and degrade to valid defaults (ADR 0004).

### Token & Setting Precedence (ADR 0002)

Tokens are **never** read from or written to TOML config files:

1. `--token <token>` flag
2. `TS_PROJECTS_TOKEN` environment variable

`workspace`, `limit`, `[output]`, and `[logging]` merge across
`system` → `user` → `project`, and explicit CLI flags/env vars always win.

### Atomic Writes & Permissions

`ts-projects config init` and `ts-projects config set` write via atomic
`temp + fsync + rename` (`0o600` on POSIX, user profile ACLs on Windows)
and refuse to overwrite corrupt existing TOML files (`ConfigError`, exit `1`).

### Managing Configuration

```bash
ts-projects config init --yes
ts-projects config path
ts-projects config get output.color
ts-projects config set logging.level info
```

See [CLI Reference: `config`](./cli-reference.md#config) and
[`EXAMPLECLI.md`](../../EXAMPLECLI.md) for the full walkthrough.

---

## Project Configuration Files

The files below configure the project's own toolchain — they are not
read by `ts-projects` at runtime.

### `pnpm-workspace.yaml`

Declares the pnpm workspace (D-040): `packages/*` (the shared core
library) and `apps/*` (the CLI today; the API and web app later). See
[pnpm](../tools/pnpm.md).

### `package.json` (workspace root)

The private workspace root (`ts-launch-blueprint-workspace`,
`"private": true`): the shared dev tooling (devDependencies), the root
scripts (`build`, `typecheck`, `test`, `test:coverage`, `prepare`), the
`packageManager` field pinning pnpm 10 (D-035), the
`engines`/`devEngines.runtime` Node >=24 floor, and `pnpm.overrides`.
Its version is bumped by release-please and kept equal to the CLI's (see
[Versioning](./versioning.md)). See
[package.json](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/package.json)
and [pnpm](../tools/pnpm.md).

### `apps/cli/package.json` and `packages/core/package.json`

`apps/cli/package.json` is the published package (`ts-launch-blueprint`):
the `ts-projects` bin entry, the ESM `exports` map, the `build` script,
and the runtime dependencies. It depends on the core through
`"@ts-launch-blueprint/core": "workspace:*"` as a devDependency, because
the core is bundled into `dist/` and is never installed from npm.
`packages/core/package.json` is the private core library
(`@ts-launch-blueprint/core`), whose only entry is `src/index.ts` (no
build step). See
[apps/cli/package.json](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/apps/cli/package.json).

### `.npmrc`

pnpm configuration (D-035). pnpm 10 does not read `devEngines` for
package-manager enforcement, so `managePackageManagerVersions`,
`packageManagerStrict`, and `packageManagerStrictVersion` here — together
with the `packageManager` field — pin and verify the exact pnpm version
(the Corepack replacement). See [pnpm](../tools/pnpm.md).

### `tsconfig.base.json` and `tsconfig.json`

`tsconfig.base.json` holds the shared compiler options; the root
`tsconfig.json` and each package's `tsconfig.json` extend it. The root
one typechecks the whole workspace in one `tsc` run. They configure `tsc`, used here as the typecheck gate only (`noEmit:
true` — build output is owned by tsdown). Notable settings: `strict`
mode plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
and `isolatedDeclarations` (enables tsdown's fast oxc-based `.d.ts`
emission). See
[tsconfig.base.json](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/tsconfig.base.json)
and [Type Checking](../tasks/type-checking-code.md).

### `.oxlintrc.json`

Configures Oxlint, the linter. The `correctness` and `suspicious`
categories run at `error` severity, with additional rules for
security-adjacent built-ins (`no-eval`, `no-implied-eval`, ...) and
modernization (`no-var`, `prefer-const`). An `overrides` block relaxes
a few rules under `**/tests/**`. See
[.oxlintrc.json](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/.oxlintrc.json)
and [Oxlint](../tools/oxlint.md).

### `.oxfmtrc.json`

Configures Oxfmt, the formatter (also used for import sorting via
`sortImports`, and for formatting JSON/YAML/TOML/Markdown). `printWidth:
100`, `singleQuote: true`, `trailingComma: "es5"`. An
`ignorePatterns` list excludes the port's own process-log documents,
which cross-reference each other by line number. See
[.oxfmtrc.json](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/.oxfmtrc.json).

### `lefthook.yml`

Configures lefthook, the git-hooks runner (installed via the
package.json `prepare` script). Runs `shellcheck` + `actionlint` +
`editorconfig-checker` + `cspell` + `pnpm-lock-check` + `format` +
`check-large-files` + `lint` + `boundaries` + `typecheck` in parallel on
`pre-commit`, `commitlint` on `commit-msg`, and `press-verify` + an
opt-in test run on `pre-push` (`TS_PROJECTS_PREPUSH_TESTS=1`). See
[lefthook.yml](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/lefthook.yml)
and [Lefthook](../tools/lefthook.md).

### `commitlint.config.mjs` and `commitlint.dependabot.config.mjs`

Configures commitlint, which enforces Conventional Commits on every
commit message (`commit-msg` hook and CI `commitlint.yml`). Extends
`@commitlint/config-conventional` with a fixed `type-enum` list
(`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`,
`build`, `perf`, `revert`) and 100/200/200 header/body/footer
line-length limits (`commitlint.dependabot.config.mjs` disables body/footer
line-length checks for Dependabot PRs). `commitlint.config.d.mts`
declares its shape for the repo-hygiene meta-test. See
[commitlint.config.mjs](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/commitlint.config.mjs).

### `.editorconfig`, `.editorconfig-checker.json`, and `cspell.json`

`.editorconfig` defines cross-editor encoding, line endings, final
newlines, and indentation defaults; `.editorconfig-checker.json`
configures `editorconfig-checker` (installed via `just install-editorconfig-checker`)
with `Indentation`/`IndentSize` delegated to Oxfmt. `cspell.json`
configures Node-native spell-checking across `just check-spelling`,
lefthook, CI, and the recommended VS Code extension.

### `vitest.config.ts`

Configures Vitest, the test runner. Node environment, no injected
globals, v8 coverage with `['text', 'html', 'lcov']` reporters and
95/95/90/95 (lines/functions/branches/statements) thresholds.
`apps/cli/src/cli.ts` and `apps/cli/src/cli/adapters.ts` are excluded
from coverage as thin I/O adapters exercised by the subprocess/e2e test
tier instead. See
[vitest.config.ts](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/vitest.config.ts)
and [Vitest](../tools/vitest.md).

### `.codecov.yml`

Configures Codecov coverage checks and PR comments: requires CI to pass
(`require_ci_to_pass: true`), enforces `auto` ±1% project coverage and
`80%` patch coverage, and scopes the `unittests` flag to `packages/`
and `apps/`. Uploaded tokenlessly via OIDC on Node `24.x` in CI. See
[.codecov.yml](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/.codecov.yml).

### `apps/cli/tsdown.config.ts`

Configures tsdown, the bundler. Two entry points (`apps/cli/src/cli.ts`,
`apps/cli/src/lib.ts`), ESM output, `.d.ts` emission via the isolated-
declarations fast path, source maps, and `clean: true`. The private
workspace core is bundled into `dist/` (`deps.alwaysBundle`, for both
the JS and the `.d.ts`), so the published package never imports it. See
[apps/cli/tsdown.config.ts](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/apps/cli/tsdown.config.ts).

### `release-please-config.json` and `.release-please-manifest.json`

Configure release-please, which owns version bumps and changelog
generation from Conventional Commits (`release-type: node`,
`bump-minor-pre-major: true`, manifest mode). The `changelog-sections`
list maps commit types to CHANGELOG.md headings. See
[Versioning and Release Management](./versioning.md) for the full
release flow, and
[release-please-config.json](https://github.com/smorinlabs/ts-launch-blueprint/blob/main/release-please-config.json).
