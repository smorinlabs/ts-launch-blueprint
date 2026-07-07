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

## License

MIT — see [LICENSE](./LICENSE).
