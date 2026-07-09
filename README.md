# ts-launch-blueprint

A batteries-included TypeScript project template — CLI + library — with a strong
developer-experience, CI, release, and open-source-readiness baseline. It is the
TypeScript port of
[py-launch-blueprint](https://github.com/smorinlabs/py-launch-blueprint), built in
tested vertical slices (see `TS_PORT_PLAN.md`); the full README lands in slice S6b.

## Install

```bash
# Placeholder — not yet published to npm.
npm install -g ts-launch-blueprint
ts-projects --version
```

## Usage

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

See [EXAMPLECLI.md](./EXAMPLECLI.md) for the full UX spec:
configuration precedence, environment variables (including
`TS_PROJECTS_API_URL`), output formats, and the exit-code contract.

## Development quickstart

```bash
make check      # verify the foundational tools (just, node) are installed
npm install     # install dev dependencies (also installs git hooks)
just build      # bundle CLI + library to dist/ (tsdown)
just typecheck  # tsc --noEmit
just test       # vitest
just all        # every quality gate: format-check, lint, typecheck, test
```

Run `just` (no arguments) to list every available recipe.

### Git hooks

`npm install` activates the [lefthook](https://lefthook.dev) git hooks via the
`prepare` script. To (re)install them and wire the commit-message template:

```bash
just setup-hooks
```

Pre-commit formats (oxfmt) and lints (oxlint) staged files and type-checks the
repo; commit messages are checked by commitlint (Conventional Commits, 50/72).
Tests run on push only if you opt in: `export TS_PROJECTS_PREPUSH_TESTS=1`.

## Releases

Versions are bumped automatically by [release-please](https://github.com/googleapis/release-please) from Conventional Commit history; there is no hand-edited version file. When you merge a Release PR (titled `chore(release): publish v*`), release-please tags the commit as `vX.Y.Z`, which triggers the `publish.yml` workflow. That workflow runs a `verify` job (free of registry contact) that confirms the tag matches package.json and `.release-please-manifest.json`, then runs the full quality gate and build before queuing the `publish` job. Merging the Release PR cuts the release; publishing then requires a one-click approval of the `npm` environment deployment.

Publishing uses [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) — no long-lived npm token is ever stored. Use `just release-status` to check for version drift (package.json, manifest, latest tag) and `just pack-check` to locally validate the packaged distribution. See [docs/maintainers-release.md](./docs/maintainers-release.md) for setup and release runbook details.

## License

MIT — see [LICENSE](./LICENSE).
