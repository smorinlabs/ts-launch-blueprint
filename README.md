![CI](https://github.com/smorinlabs/ts-launch-blueprint/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

# TS Launch Blueprint

A batteries-included TypeScript project template — CLI + library — with a
strong developer-experience, CI, release, and open-source-readiness
baseline. It is the TypeScript port of
[py-launch-blueprint](https://github.com/smorinlabs/py-launch-blueprint),
built in tested vertical slices (see `docs/port/TS_PORT_PLAN.md`).

Zero-config development environment with type safety built in: clone it,
rename a few seam variables, and you have a linted, formatted,
type-checked, tested, and release-automated TypeScript project.

## Features

- **Zero Configuration Setup**: linting, formatting, type checking, and git
  hooks are wired up before you write a line of code.
- **Type Safety First**: a strict `tsc` configuration (`strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and more) plus the
  TypeScript 7 VS Code extension configured for the workspace package, so the
  editor and the CI type-check gate use the same compiler version.
- **Modern Toolchain**: Oxlint + Oxfmt (one Rust-based toolchain for
  linting and formatting TypeScript, JSON, YAML, and Markdown), lefthook
  git hooks with commitlint-checked commit messages, and Vitest 4 for
  testing with v8 coverage thresholds enforced.
- **CI/CD Ready**: GitHub Actions workflows for quality gates (lint,
  format, typecheck, test, build), CodeQL security analysis, dependency
  review on pull requests, and a manual OSV-based PR security scan.
- **Automated Releases**: [release-please](https://github.com/googleapis/release-please)
  bumps `package.json` and the changelog from Conventional Commit history,
  and publishing uses [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers)
  (OIDC) — no long-lived npm token is ever stored.
- **Open Source Ready**: a Code of Conduct, issue/PR templates, a
  Contributor License Agreement flow, and an automated `CONTRIBUTORS.md`
  are included out of the box.
- **A Worked Example**: `ts-projects`, a full CLI (interactive multi-select,
  text/JSON/CSV output, clipboard integration) with its own UX spec
  ([EXAMPLECLI.md](./EXAMPLECLI.md)), showing every tool choice applied to
  real code rather than an empty scaffold.

See [docs/about/features.md](./docs/about/features.md) for the complete
feature list and [docs/about/philosophy.md](./docs/about/philosophy.md) for
the principles behind it.

## Quickstart

This repository is a _template_: clone it, rename the seam variables, and
build on top of `ts-projects` or delete it and start fresh.

```bash
git clone https://github.com/smorinlabs/ts-launch-blueprint.git
cd ts-launch-blueprint

# Rename the template for your own project: edit the seam variables at the
# top of the Justfile (ts_package_name, repo_name, command_name), then
# update package.json's name/bin/repository fields to match.

make check      # verify the foundational tools (just, node) are installed
just install    # install shell analyzers, dependencies, and git hooks
export PATH="$HOME/.local/bin:$PATH" # make installed analyzers available
just setup-hooks
just all        # every quality gate: format-check, lint, shell/workflow checks, typecheck, test
```

Run `just` (no arguments) to list every available recipe.

Optionally, `just test-bun` runs the non-e2e tests under [Bun](https://bun.sh)
as an advisory forward-compatibility signal (D-036) — installs stay pnpm-only
and the published package is unchanged; see
[Setting Up Development](./docs/tasks/setting-up-development.md#bun-lane-optional).

## Using the example CLI

`ts-projects` fetches projects from the (placeholder) API, lets you
interactively multi-select, and emits the selection as text, JSON, or
CSV — results on stdout, everything else on stderr:

```bash
export TS_PROJECTS_TOKEN=your_token_here

ts-projects                                   # fetch, preview, select
ts-projects --workspace "My Workspace"        # filter by workspace
ts-projects --no-input --format json | jq .   # pipe-safe, no prompt
ts-projects --format csv --output out.csv     # write to a file
ts-projects --copy                            # copy result to clipboard
```

See [EXAMPLECLI.md](./EXAMPLECLI.md) for the full UX spec (configuration
precedence, environment variables including `TS_PROJECTS_API_URL`, output
formats, and the exit-code contract) and
[docs/reference/cli-reference.md](./docs/reference/cli-reference.md) for
the flag-by-flag reference.

## Command surface

The [`Justfile`](./Justfile) is the canonical command surface; every
recipe below has a one-line doc comment above it in the file, and `just
--list` groups them (`build`, `dev`, `docs`, `releases`, ...). Highlights:

| Recipe                                      | Purpose                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| `just check-deps` (`c`)                     | Verify required tools (`just`, `node`, `pnpm`) are installed                   |
| `just install`                              | Install dependencies (generates/updates `pnpm-lock.yaml`)                      |
| `just build` (`b`)                          | Bundle CLI + library to `dist/` with tsdown                                    |
| `just typecheck` (`tc`)                     | `tsc --noEmit`                                                                 |
| `just test` (`t`)                           | Run tests with Vitest                                                          |
| `just test-bun`                             | Optional/advisory: run non-e2e tiers under Bun (D-036; no-op if absent)        |
| `just coverage`                             | Run tests with coverage thresholds enforced                                    |
| `just format` / `format-check` (`f` / `fc`) | Format (oxfmt) / check formatting                                              |
| `just lint` / `lint-fix` (`l`)              | Lint (oxlint) / lint with autofixes                                            |
| `just all` (`a`)                            | Every quality gate: format-check, lint, shell/workflow checks, typecheck, test |
| `just setup-hooks`                          | Install lefthook git hooks + wire the commit template                          |
| `just docs-check`                           | Verify every relative Markdown link in `README.md` + `docs/` resolves          |
| `just docs-api`                             | Generate API reference docs with TypeDoc (optional, not CI-gated)              |
| `just release-status`                       | Check version drift (`package.json`, manifest, latest tag)                     |
| `just pack-check`                           | Validate the packaged distribution locally (publint, attw, npm pack)           |
| `just contributors`                         | Render `CONTRIBUTORS.md` via contributors-please                               |
| `just debug-info`                           | Collect system/tool/dependency info for bug reports                            |
| `just clean`                                | Remove build artifacts, caches, and installed dependencies                     |

### Git hooks

`pnpm install` activates the [lefthook](https://lefthook.dev) git hooks via
the `prepare` script. To (re)install them and wire the commit-message
template:

```bash
just setup-hooks
```

Pre-commit formats (oxfmt) and lints (oxlint) staged files and type-checks
the repo; commit messages are checked by commitlint (Conventional Commits,
50/72). Tests run on push only if you opt in: `export
TS_PROJECTS_PREPUSH_TESTS=1`.

## Documentation

Full documentation lives in [`docs/`](./docs/docs.md) — plain
GitHub-Flavored Markdown, no generated site:

- [About](./docs/about/index.md) — philosophy and full feature list
- [Tutorials](./docs/tutorials/index.md) — guided full-project-setup walkthrough
- [Tasks](./docs/tasks/index.md) — how-to guides (dependencies, type checking, CI/CD, debugging, contributing code)
- [Tools](./docs/tools/index.md) — what each tool does and why it was chosen (TypeScript, Vitest, Oxlint, pnpm, lefthook, GitHub Actions, VS Code, Justfiles, Makefiles, CLA Assistant)
- [Reference](./docs/reference/index.md) — CLI reference, configuration files, project structure, versioning
- [Contributing](./docs/contributing/index.md) — how to contribute, CLA process, Code of Conduct
- [GitHub Templates](./docs/github-templates.md) — issue/PR template guide
- [Documentation Guide](./docs/docs.md) — how this `docs/` tree itself is organized and validated

## Releases

Versions are bumped automatically by [release-please](https://github.com/googleapis/release-please) from Conventional Commit history; there is no hand-edited version file. When you merge a Release PR (titled `chore(release): publish v*`), release-please tags the commit as `vX.Y.Z`, which triggers the `publish.yml` workflow. That workflow runs a `verify` job (free of registry contact) that confirms the tag matches package.json and `.release-please-manifest.json`, then runs the full quality gate and build before queuing the `publish` job. Merging the Release PR cuts the release; publishing then requires a one-click approval of the `npm` environment deployment.

Publishing uses [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) — no long-lived npm token is ever stored. Use `just release-status` to check for version drift (package.json, manifest, latest tag) and `just pack-check` to locally validate the packaged distribution. See [docs/maintainers-release.md](./docs/maintainers-release.md) for setup and release runbook details.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./.github/CONTRIBUTING.md)
for the workflow and [docs/contributing/index.md](./docs/contributing/index.md)
for the CLA process and Code of Conduct. Contributors are tracked
automatically in [CONTRIBUTORS.md](./CONTRIBUTORS.md).

## License

MIT — see [LICENSE](./LICENSE).
