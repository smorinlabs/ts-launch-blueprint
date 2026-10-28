# Architecture Boundary Rules

The shared core (`packages/core`) and the apps that use it (`apps/*`) are
separated by rules that a tool checks on every change, locally and in CI
(D-042). A forbidden import fails the build. This page lists the rules, how
to read and fix a failure, and how to delete an app.

Two tools share the work:

- **oxlint** (`.oxlintrc.json`, run by `just lint`): fast per-file rules on
  each file's import specifiers (`no-restricted-imports`, `import/no-cycle`).
- **dependency-cruiser** (`.dependency-cruiser.cjs`, run by
  `just check-boundaries`): rules over the whole resolved import graph, which
  a per-file linter can't see: cycles across files, where an import really
  resolves (including `@ts-launch-blueprint/core`), and type-only edges.

dependency-cruiser runs with the **swc** parser (`@swc/core`). TypeScript 7
ships no JavaScript compiler API, and dependency-cruiser's default TypeScript
parser then sees no `.ts` files at all while still exiting 0. A sanity test in
`tests/boundaries.test.ts` fails if that ever comes back. dependency-cruiser
also prints a `missing-typescript-transpiler` warning on every run; it is
expected and doesn't affect the result.

## The Rules

Every rule's message starts with a tag. Search for the tag on this page.

| Tag                                         | Rule                                                                                                                                                                                                                                                                                                                                    | Tool                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `[core-no-app-import]`                      | `packages/core/**` imports nothing from `apps/**` or the `ts-launch-blueprint` package.                                                                                                                                                                                                                                                 | oxlint + dependency-cruiser |
| `[core-no-framework-import]`                | `packages/core/src/**` imports no CLI/web/API framework or observability library: `commander`, `@inquirer/*`, `cli-table3`, `yocto-spinner`, `clipboardy`, `picocolors`, `smol-toml`, `hono`, `@hono/*`, `@trpc/*`, `react`; `pino`, `pino-pretty`, `prom-client`, `@prometheus-io/*`, `@opentelemetry/*`.                              | oxlint + dependency-cruiser |
| `[schema-is-leaf]`                          | `schemas/**` imports only other `schemas/**` files and `zod`.                                                                                                                                                                                                                                                                           | oxlint + dependency-cruiser |
| `[repository-no-service]`                   | `repositories/**` doesn't import `services/**` or `composition.ts`.                                                                                                                                                                                                                                                                     | oxlint + dependency-cruiser |
| `[service-no-concrete-repository]`          | `services/**` doesn't import `http-*.repository.ts`, `in-memory-*.repository.ts` or `composition.ts`.                                                                                                                                                                                                                                   | oxlint + dependency-cruiser |
| `[service-type-only-repository]`            | `services/**` → `repositories/**` imports are `import type` only; the repository is injected.                                                                                                                                                                                                                                           | dependency-cruiser          |
| `[concrete-repository-in-composition-only]` | Inside `packages/core/src`, only `composition.ts` and the `index.ts` entry import a concrete repository.                                                                                                                                                                                                                                | dependency-cruiser          |
| `[app-core-entry-only]`                     | `apps/**` imports the core only as `@ts-launch-blueprint/core`: no relative path into `packages/`, no `@ts-launch-blueprint/core/<subpath>`.                                                                                                                                                                                            | oxlint + dependency-cruiser |
| `[app-no-cross-app-import]`                 | One app never imports another app, except the web app's one type-only edge below.                                                                                                                                                                                                                                                       | dependency-cruiser          |
| `[web-types-only-from-api]`                 | `apps/web/**` imports nothing from another app but `import type { AppRouter } from '@ts-launch-blueprint/api/router'`: no value import of it, no other API file, no other app.                                                                                                                                                          | dependency-cruiser          |
| `[api-core-via-create-core]`                | `apps/api/src/**` doesn't import `createHttpProjectsRepository`, `createInMemoryProjectsRepository` or `createProjectsService`; the API builds its core with `createCore` (in `server.ts`). The CLI is deliberately not covered: its public `createApiClient` wrapper (`apps/cli/src/api.ts`) builds a repository and service directly. | oxlint                      |
| `[no-cycle]`                                | No import cycles anywhere, type-only cycles included. oxlint's `import/no-cycle` also fails, but its message is fixed and carries no tag.                                                                                                                                                                                               | dependency-cruiser + oxlint |
| `[not-to-unresolvable]`                     | Every import resolves (a typo'd path fails here, not only in `tsc`).                                                                                                                                                                                                                                                                    | dependency-cruiser          |
| `[reexport-entry-only]`                     | Only package entry files re-export (`export … from`): `packages/core/src/index.ts`, `apps/cli/src/lib.ts`, `apps/cli/src/api.ts`. No folder barrels, so a forbidden import can't hide behind a re-export.                                                                                                                               | boundary test (source scan) |
| `[no-path-alias]`                           | No `tsconfig*.json` sets `compilerOptions.paths`: relative imports inside a package, the package name across packages.                                                                                                                                                                                                                  | repo-hygiene test           |

The rules apply to `src/` files only. Tests (`**/tests/**`) may import their
own package's `src/` directly.

The API's `package.json` exposes `./router` with only a `types` condition,
so dependency-cruiser resolves it with the `types` condition name (D-054).

## Reading a Failure

oxlint prints the tag in the `help:` part of the message:

```
packages/core/src/services/foo.ts:1:1: error eslint(no-restricted-imports): '../repositories/http-projects.repository.js' import is restricted from being used by a pattern. help: [service-no-concrete-repository] Services get a ProjectsRepository injected; wire concrete repositories in composition.ts.
```

dependency-cruiser prints the rule name, the edge, and the tagged comment:

```
  error service-no-concrete-repository: packages/core/src/services/foo.ts → packages/core/src/repositories/http-projects.repository.ts
    [service-no-concrete-repository] Services get a ProjectsRepository injected; wire concrete repositories in composition.ts.
```

Search this page for the tag, then fix the import. **Never silence a
boundary rule; fix the import.**

## Fixing the Usual Ones

- **`[service-no-concrete-repository]` / `[service-type-only-repository]`**:
  take the `ProjectsRepository` as a parameter (`import type` it), and build
  the concrete repository in `packages/core/src/composition.ts`.
- **`[core-no-framework-import]`**: the code belongs in an app. Move it to
  `apps/<app>/src/`, or pass the value into the core as a plain argument.
- **`[app-core-entry-only]`**: import from `@ts-launch-blueprint/core`. If the
  thing you need isn't exported, add it to `packages/core/src/index.ts` and to
  `packages/core/tests/public-api.test.ts`.
- **`[schema-is-leaf]` / `[repository-no-service]`**: the dependency points
  the wrong way. Move the shared part down a layer (into `schemas/`).
- **`[no-cycle]`**: extract the part both files need into a third module.
- **`[reexport-entry-only]`**: import from the defining file instead of a
  barrel, or export it from the package entry.

## Where Each Check Runs

| Check                                                          | Local                               | Git hook                              | CI                                              |
| -------------------------------------------------------------- | ----------------------------------- | ------------------------------------- | ----------------------------------------------- |
| oxlint rules                                                   | `just lint`, `just all`             | pre-commit `lint` (staged files)      | `Lint` step, hook-suite step                    |
| dependency-cruiser rules                                       | `just check-boundaries`, `just all` | pre-commit `boundaries` (whole graph) | `Architecture boundaries` step, hook-suite step |
| Proof tests (`tests/boundaries.test.ts`)                       | `just test`, `just all`             | pre-push (opt-in)                     | `Test` step                                     |
| `[no-path-alias]`                                              | `just test`, `just all`             | pre-push (opt-in)                     | `Test` step                                     |
| Removable app (`just check-removable cli` / `api web` / `web`) | on demand                           | —                                     | `Removable app check` step                      |

`just check-removable` is not part of `just all`: it reinstalls dependencies
in a temp copy, so it needs the network and takes a while.

## Removing an App

`just check-removable <app>...` takes one or more apps, positionally, and
removes them together. `apps/web` uses the API's router type, so:

- **The CLI** or **the web app** can be removed on its own:
  `just check-removable cli`, `just check-removable web`.
- **The API** goes together with the web app (`just check-removable api
web`), or you replace the web app's client first.

CI runs all three.

## Removing the CLI

`just check-removable cli` proves the core and the root tooling work without
`apps/cli`: it copies the repo, deletes `apps/cli`, reinstalls, and runs the
core's typecheck, tests and boundary check, plus the root `just lint`,
`just typecheck` and `just check-boundaries`.

A real delete then needs these edits to tooling that is meant to name the
CLI:

1. `rm -rf apps/cli`, then `pnpm install` (updates `pnpm-lock.yaml`).
2. `release-please-config.json`: remove the `extra-files` entry for
   `apps/cli/package.json`.
3. `vitest.config.ts`: remove the two `apps/cli/src/...` coverage exclusions.
4. `Justfile`: `run`, `version`, `docs-api`, `pack-check` (`cd apps/cli`), `clean` and
   `debug-info` name the CLI; remove or repoint them.
5. `.github/workflows/publish.yml`: the version check
   (`apps/cli/package.json`) and the three `working-directory: apps/cli`
   steps, or the whole workflow if nothing else is published.
6. `.github/workflows/ci.yml`: the `Build` and `Removable app check
(apps/cli)` steps, and the Bun lane's e2e exclude.
7. `.gitignore`: the `apps/cli/README.md` and `apps/cli/LICENSE` lines.
8. `.vscode/launch.json`: the three CLI launch configurations.
9. `tests/repo-hygiene.test.ts`: the version-sync test skips itself when
   `apps/cli` is gone; remove it if no app is published.
10. `tests/boundaries.test.ts`: the `apps/cli` probe cases and the
    `apps/cli/src/lib.ts` / `api.ts` entries in `ENTRY_FILES`.
11. Docs that describe the CLI (`EXAMPLECLI.md`, `docs/reference/cli-reference.md`).

No core file names the CLI: `grep -rn "apps/" packages/core/src` returns
nothing, and `[core-no-app-import]` keeps it that way.

## Removing the API

`just check-removable api web` proves the same for `apps/api`, together with
`apps/web`, which needs the API's router type. A real delete then needs:

1. Remove the web app first (below), or give it another client.
2. `rm -rf apps/api`, then `pnpm install` (updates `pnpm-lock.yaml`).
3. `tsconfig.json`: remove `apps/api/**` from `"exclude"`.
   `scripts/typecheck.sh` finds app tsconfigs by glob, so it needs no edit.
4. `vitest.config.ts`: remove the `apps/api/src/server.ts` coverage exclusion.
5. `Justfile`: remove the `api` recipe. `build` builds whatever apps exist.
6. `.github/workflows/ci.yml`: remove the `Removable app check (apps/api +
apps/web)` step.
7. Docs that describe the API (`docs/reference/api-reference.md`, the README's
   "Run the API" lines).

## Removing the Web App

`just check-removable web` proves the core, the CLI and the API work without
`apps/web`. A real delete then needs:

1. `rm -rf apps/web`, then `pnpm install` (updates `pnpm-lock.yaml`).
2. `tsconfig.json`: remove `apps/web/**` from `"exclude"`.
3. `vitest.config.ts`: remove the `apps/web/src/main.tsx` coverage exclusion.
4. `.oxlintrc.json`: remove the `apps/web/src/**` override.
   `.dependency-cruiser.cjs`: the two web rules and the `pathNot` on
   `app-no-cross-app-import` can go (they no longer match anything).
5. `apps/api/package.json`: the `./router` types-only export can stay or go.
6. `Justfile`: remove the `web` recipe.
7. `.github/workflows/ci.yml`: remove the `Removable app check (apps/web)`
   step.
8. `tests/boundaries.test.ts`: the `apps/web` probe cases.
9. Docs that describe the web app (`docs/reference/web-app.md`, the README's
   "Run the web app" lines).

## See Also

- [Architecture](../about/architecture.md): the layers, the request flow, and how to add a feature
- [Project Structure](./project-structure.md)
- [Configuration Files](./configuration-files.md)
- [Oxlint](../tools/oxlint.md)
