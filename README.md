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
npm install     # install dev dependencies
just build      # bundle CLI + library to dist/ (tsdown)
just typecheck  # tsc --noEmit
just test       # vitest
```

Run `just` (no arguments) to list every available recipe.

## License

MIT — see [LICENSE](./LICENSE).
