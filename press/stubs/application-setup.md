# Application Setup

This guide prepares this application's development environment, runs its quality
gates, and builds its packages. Run the commands from the repository root.
Source-template provenance is recorded in
[the press receipt](../../press/press-receipt.toml) under `[press.from]`.

## 1. Level 1: Bootstrap Foundational Tools

```bash
make bootstrap   # ensures node >=24, pnpm 10, and just are installed, then runs make check
```

Node **24 or newer** (`.nvmrc`, `engines.node`), pnpm 10 (`packageManager` in
`package.json`), and `just` are required. Optional `mise install`,
`flox activate`, and VS Code Dev Container configurations are also provided —
see [Setting Up Development](../tasks/setting-up-development.md) for details.

## 2. Level 2: Run Unified Setup

```bash
just setup
```

`just setup` is idempotent: it verifies the Level 1 toolchain (`make check`),
installs the pinned analyzers (`shellcheck`, `actionlint`,
`editorconfig-checker`, `gitleaks`), runs `pnpm install`, wires git hooks and
`.gitmessage` via `just setup-hooks`, and runs `just check-deps`.

## 3. Verify Quality Gates

```bash
just all
just docs-check
```

`just all` runs formatting checks, linting, architecture boundary checks, shell
and workflow checks, EditorConfig and spelling checks, type checking, and the
Vitest suite.

## 4. Build and Run

```bash
just build
just run --help
just version
```

The CLI command name is listed in `apps/cli/package.json` under `bin` (see
[EXAMPLECLI.md](../../EXAMPLECLI.md) and
[CLI Reference](../reference/cli-reference.md)). For the HTTP API, run
`just api` (built bundle) or `just api-dev` (`tsx watch` reload mode) and see
[API Reference](../reference/api-reference.md).

## 5. Configure Releases and Repository Services

See [Release Runbook](../maintainers-release.md) to configure the `npm`
environment, npm Trusted Publishing (OIDC), and `release-please` credentials
before cutting your first release.
