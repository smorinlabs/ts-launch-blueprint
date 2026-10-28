# Project Structure

TS Launch Blueprint is a pnpm workspace (D-040): a shared core library
in `packages/core`, and the apps that use it in `apps/` (the CLI, the API
and the web app). Each part has its own `package.json`, and
deleting an app is deleting its folder. Repo-level checks live in
`tests/` and documentation in `docs/`. This section walks through the
actual directory layout and the purpose of each file.

The layers and the direction of imports between them are enforced by
boundary rules; see [Architecture Boundary Rules](./boundary-rules.md). For why
the code is shaped this way and how to add a feature, see
[Architecture](../about/architecture.md).

## Directory Layout

```
ts-launch-blueprint/
├── packages/core/                  # Shared core library (schemas, repositories, services)
├── apps/cli/                       # The ts-projects CLI — the published npm package
├── apps/api/                       # Hono + tRPC API (private, not published)
├── apps/web/                       # React + Vite web app (private, not published)
├── tests/                          # Repo-level meta-tests (repo-hygiene)
├── docs/                           # Documentation (this tree)
├── .github/                        # GitHub Actions workflows, issue/PR templates
├── Justfile                        # Command surface (build/test/lint/release/...)
├── Makefile                        # Bootstrap: check-deps / install-node / install-just
├── package.json                    # Private workspace root (shared dev tooling, scripts)
├── pnpm-workspace.yaml             # Workspace package list
└── pnpm-lock.yaml                  # pnpm lockfile (fast, reproducible installs)
```

## Detailed Layout

```
ts-launch-blueprint/
├── .github/
│   ├── ISSUE_TEMPLATE/              # Issue templates (feature/docs/bug)
│   ├── workflows/                   # CI, CodeQL, dependency-review, release-please, publish
│   ├── CODE_OF_CONDUCT.md
│   ├── CONTRIBUTING.md
│   ├── dependabot.yml
│   ├── FUNDING.yml
│   ├── pull_request_template.md
│   └── SECURITY.md
├── docs/                            # Flattened CommonMark documentation tree (D-023)
│   ├── about/                       # Project context and philosophy
│   ├── contributing/                # Contribution guidelines, incl. cla/ (CLA docs)
│   ├── port/                        # Port process records (D-006; see docs/port/README.md)
│   ├── reference/                   # Technical references (this page's directory)
│   ├── tasks/                       # Step-by-step workflows
│   ├── tools/                       # Technical tooling reference (one page per tool)
│   ├── tutorials/                   # Guided learning paths
│   ├── docs.md                      # Docs-about-docs
│   ├── github-templates.md          # GitHub issue/PR template reference
│   └── maintainers-release.md       # Release runbook (one-time setup + routine flow)
├── packages/core/                   # @ts-launch-blueprint/core (private, no build step)
│   ├── src/
│   │   ├── schemas/                 # Zod schemas, converters, domain errors
│   │   ├── repositories/            # ProjectsRepository interface + HTTP / in-memory
│   │   ├── services/                # Business rules (projects service)
│   │   ├── composition.ts           # Composition root: picks the repository
│   │   └── index.ts                 # The core's only public entry
│   └── tests/                       # Core unit, contract, and public-API tests
├── apps/cli/                        # ts-launch-blueprint (the published package)
│   ├── src/
│   │   ├── cli/                     # CLI controller: router, commands, deps, config,
│   │   │                            #   colors, logger, format, adapters, exit codes
│   │   ├── api.ts                   # createApiClient compatibility wrapper
│   │   ├── cli.ts                   # Thin process entry (argv, signals, exit code)
│   │   ├── lib.ts                   # Library entry point (importable package surface)
│   │   └── version.ts               # VERSION, read from package.json at build time
│   ├── tests/                       # In-process, e2e, and public-API tests
│   ├── scripts/                     # copy-package-files.mjs (README/LICENSE for npm)
│   ├── dist/                        # tsdown build output (generated, not tracked)
│   └── tsdown.config.ts             # Build (bundler) configuration
├── apps/api/                        # @ts-launch-blueprint/api (private, not published)
│   ├── src/
│   │   ├── app.ts                   # Hono app: /healthz, /readyz, /trpc/*
│   │   ├── config.ts                # PORT and TS_PROJECTS_SOURCE parsing (memory default)
│   │   ├── router.ts                # tRPC router (projects.list) and the AppRouter type
│   │   ├── server.ts                # Thin process entry: config -> createCore -> serve
│   │   └── trpc.ts                  # initTRPC with a { core } context
│   ├── tests/                       # Router, app, config and e2e tests
│   ├── tsconfig.json                # Own tsconfig: isolatedDeclarations off (D-048)
│   └── tsdown.config.ts             # Build (bundler) configuration
├── apps/web/                        # @ts-launch-blueprint/web (private, not published)
│   ├── src/
│   │   ├── App.tsx                  # The page: projects.list -> loading / error / list
│   │   ├── config.ts                # API base URL (VITE_API_URL, default same origin)
│   │   ├── main.tsx                 # Thin browser entry: mount <App/> in the providers
│   │   ├── providers.tsx            # TanStack Query + the typed tRPC client
│   │   └── trpc.ts                  # createTRPCContext<AppRouter> (type-only import)
│   ├── tests/                       # Component, type, config and bundle tests
│   ├── index.html                   # Vite's HTML entry
│   ├── tsconfig.json                # Own tsconfig: browser options, isolatedDeclarations off (D-054)
│   ├── vite.config.ts               # React plugin; dev proxy /trpc -> :8080
│   └── vitest.config.ts             # Vitest project `web` (jsdom)
├── tests/
│   └── repo-hygiene.test.ts         # Meta-tests (config drift, doc/link consistency)
├── scripts/
│   └── check-links.mjs              # Dependency-free relative-link checker for docs-check
├── .oxfmtrc.json                    # Oxfmt (formatter) configuration
├── .oxlintrc.json                   # Oxlint (linter) configuration
├── .release-please-manifest.json    # release-please's tracked current version
├── .nvmrc                           # Pinned Node version for nvm/fnm users
├── AGENTS.md                        # Agent-facing repo instructions
├── CHANGELOG.md                     # Generated by release-please
├── CLAUDE.md                        # Claude Code repo instructions
├── commitlint.config.mjs            # Conventional Commits enforcement
├── commitlint.config.d.mts          # Type declarations for the commitlint config
├── CONTRIBUTORS.md                  # Generated by contributors-please
├── EXAMPLECLI.md                    # ts-projects UX specification
├── Justfile                         # Command surface (see docs/tools/justfiles.md)
├── lefthook.yml                     # Git hooks configuration
├── LICENSE
├── Makefile                         # Dependency bootstrap (see docs/tools/makefiles.md)
├── package.json                     # Private workspace root
├── pnpm-workspace.yaml              # Workspace package list
├── pnpm-lock.yaml                   # pnpm lockfile
├── README.md                        # Project overview and navigation hub
├── release-please-config.json       # release-please changelog/bump configuration
├── tsconfig.base.json               # Shared TypeScript compiler options
├── tsconfig.json                    # Root typecheck over the whole workspace
└── vitest.config.ts                 # Test runner + coverage configuration
```

## Directory Descriptions

### `packages/core/`

The shared core library, `@ts-launch-blueprint/core`. `schemas/` owns
the data shapes and domain errors, `repositories/` the data access
(behind the `ProjectsRepository` interface, with HTTP and in-memory
implementations), and `services/` the business rules. `composition.ts`
is the only place that picks an implementation. Apps import the core
only through `src/index.ts`; it imports nothing from `apps/`. It has no
build step: tsdown bundles its source into the CLI, and Vitest and `tsc`
read the TypeScript directly.

### `apps/cli/`

The `ts-projects` CLI and the published npm package
(`ts-launch-blueprint`). `cli.ts` is the thin process entry point;
`cli/router.ts` builds the Commander program and owns the exit-code
mapping; `cli/commands/projects.ts` implements the default `projects`
command. `lib.ts` re-exports the surface meant for consumers who import
the package as a library. `just build` bundles it, with the core, into
`apps/cli/dist/` (never tracked in git).

### `apps/api/`

The Hono + tRPC API (`@ts-launch-blueprint/api`, private): the second
controller over the core. `src/router.ts` holds the tRPC router
(`projects.list`, and the `AppRouter` type), `src/app.ts` the Hono app with
`/healthz`, `/readyz` and `/trpc/*`, `src/config.ts` the environment parsing,
and `src/server.ts` the thin process entry. It has its own `tsconfig.json`
with `isolatedDeclarations` off (D-048). `just api` builds and starts it; see
the [API Reference](./api-reference.md).

### `apps/web/`

The React + Vite web app (`@ts-launch-blueprint/web`, private). It calls the
API through a typed tRPC client (`src/trpc.ts`) and imports only the API's
`AppRouter` type, through the API's types-only `./router` export. Its own
`tsconfig.json` has browser options and `isolatedDeclarations` off (D-054).
`just web` starts the Vite dev server (with `just api` running); see the
[Web App reference](./web-app.md).

### `tests/` and each package's `tests/`

Vitest suites, one Vitest project per package plus `repo` for the root
`tests/`. Most files are in-process unit tests that inject fakes via the
`CliDeps` dependency-injection surface; `apps/cli/tests/e2e.test.ts` runs
the built `apps/cli/dist/cli.js` as a real subprocess; the root
`repo-hygiene.test.ts` asserts the repo's own configuration files stay
internally consistent (e.g. commit-type lists, ignore-pattern mirrors).

### `docs/`

All documentation, as plain CommonMark/GFM (no Sphinx, no MyST — see
[Docs About Docs](../docs.md)).

### `.github/`

GitHub Actions workflows (CI, CodeQL, dependency review, release-please,
publish) and community files (issue templates, PR template,
CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, dependabot, FUNDING).

### `Justfile`

The command runner surface — build, test, lint, format, typecheck,
release, and packaging recipes. See
[Using the Justfile](../tools/justfiles.md).

### `Makefile`

Dependency bootstrap only (`make check`, `make install-node`, `make
install-just`) — not a build system. See
[Using Makefiles](../tools/makefiles.md).

### `package.json` and `pnpm-workspace.yaml`

The private workspace root manifest (shared dev tooling, scripts, the
pinned pnpm version) and the workspace package list. The published
manifest is `apps/cli/package.json`. See
[Configuration Files](./configuration-files.md).

### `tsconfig.base.json`, `tsconfig.json`, `.oxlintrc.json`, `.oxfmtrc.json`, `vitest.config.ts`, `apps/cli/tsdown.config.ts`

Tool-specific configuration for the typecheck, lint, format, test, and
build gates respectively. Each is documented in
[Configuration Files](./configuration-files.md) and has a companion
page under [`docs/tools/`](../tools/).

### `lefthook.yml`, `commitlint.config.mjs`

Git-hooks and commit-message enforcement. See
[Configuration Files](./configuration-files.md) and
[Lefthook](../tools/lefthook.md).

### `release-please-config.json`, `.release-please-manifest.json`, `CHANGELOG.md`

The release pipeline's configuration and generated output. See
[Versioning and Release Management](./versioning.md).

### `EXAMPLECLI.md`

The full UX specification for the `ts-projects` example CLI: every
flag, the config-file precedence, environment variables, and the
exit-code mapping. See also [CLI Reference](./cli-reference.md).

### `README.md`

The project overview and navigation hub for the documentation tree.
