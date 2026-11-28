# Project

This TypeScript workspace was generated from a template. Its source identity is
recorded in [the press receipt](./press/press-receipt.toml) under `[press.from]`.

## Quickstart

Start with [Full Project Setup](./docs/tutorials/full-project-setup.md) and
[Setting Up Development](./docs/tasks/setting-up-development.md).

```bash
make bootstrap      # Level 1: ensure node >=24, pnpm 10, and just are installed
just setup          # Level 2: install pinned analyzers, pnpm install, git hooks, check-deps
just all            # format-check, lint, boundaries, shell/workflow, editorconfig, cspell, typecheck, test
just build          # build apps/*/dist/ with tsdown
```

Optional turnkey environments are also included: `mise install` (`mise.toml`),
`flox activate` (`.flox/env/manifest.toml`), and VS Code Dev Containers
(`.devcontainer/devcontainer.json`).

Run `just` with no arguments to list all available recipes (`just dev`,
`just api`, `just api-dev`, `just web`). The CLI command name is defined in
`apps/cli/package.json` under `bin` (documented in
[EXAMPLECLI.md](./EXAMPLECLI.md) and
[CLI Reference](./docs/reference/cli-reference.md)), and the optional HTTP API
is documented in [API Reference](./docs/reference/api-reference.md).

## Documentation

- [About](./docs/about/index.md) — philosophy, features, and architecture
- [Tutorials](./docs/tutorials/index.md) — guided setup walkthrough
- [Tasks](./docs/tasks/index.md) — development, dependencies, CI/CD, and contributing
- [Tools](./docs/tools/index.md) — toolchain rationale and configuration
- [Reference](./docs/reference/index.md) — CLI, API, boundaries, configuration, and versioning
- [Release Runbook](./docs/maintainers-release.md) — npm Trusted Publishing setup and release flow
- [Contributing](./.github/CONTRIBUTING.md) — workflow, CLA, and Code of Conduct

## License

MIT — see [LICENSE](./LICENSE).
