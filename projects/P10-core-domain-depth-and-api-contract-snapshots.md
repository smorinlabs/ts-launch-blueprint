# P10 — Core domain depth and API contract snapshots

**References**

- **Trunk:** [PROJECTS.md](../PROJECTS.md)
- **Design:** [TS_PORT_DECISIONS.md](../docs/port/TS_PORT_DECISIONS.md)
- **Design:** [architecture.md](../docs/about/architecture.md)
- **Design:** [api-reference.md](../docs/reference/api-reference.md)

Add getProject, strict HTTP envelope, pagination, idempotency, and tRPC diff

### Scope

- Tighten upstream HTTP boundary validation in `packages/core/src/repositories/http-projects.repository.ts` (`unwrapList` requires `data` array and raises `ApiError` when absent; add `unwrapItem`) and separate internal upstream wire schemas (`gid`/`id` alias, numeric-to-string coercion on `id`/`gid` only excluding booleans, `{}`/`null`/missing `workspace` normalization to `null`, redacted dotted-path + `(+N more)` errors without raw payload values) from domain `ProjectSchema` (`workspace: { name: string } | null`).
- Update all `project.workspace` readers across `packages/core`, `apps/cli`, `apps/web`, and tests for nullable `Project.workspace`.
- Implement `getProject(id)` vertically across `ProjectsRepository` (`Project | null`), `HttpProjectsRepository` (`404 -> null`, malformed `200 -> ApiError`), `InMemoryProjectsRepository`, `ProjectsService` (`NotFoundError`), `GetProjectInputSchema`/`GetProjectOutputSchema` (`packages/core`), tRPC `projects.get` (`apps/api`), and `createApiClient().getProject(id)` (`apps/cli/src/api.ts`), preserving `createApiClient().getProjects(): Promise<Project[]>` and pre-`P11` CLI `--help` snapshots (`Q3.A`).
- Implement cursor-based pagination (`cursor?: string` -> `{ projects, nextCursor: string | null }`) in `ListProjectsInputSchema`/`ListProjectsOutputSchema`, `ProjectsRepository`, `ProjectsService`, and `apps/api/src/router.ts`, enforcing `MAX_API_LIMIT = 100` in `apps/api/src/router.ts` only while leaving `packages/core` and `apps/cli` uncapped (`DEFAULT_LIMIT = 200`, `Q7.A`).
- Mount standalone `Idempotency-Key` middleware (`apps/api/src/idempotency.ts`: zero-dep TTL+LRU `Map`, `POST`/`PUT`/`PATCH`, `(method, path, query, key)`, 2xx-only caching, multi-valued `Set-Cookie` preservation, `Idempotency-Replayed: true`) in `apps/api/src/app.ts` and add RFC 8594 `deprecationHeaders(sunset: Date)` helper in `apps/api/src/versioning.ts` (`Q8.A`).
- Export a deterministic Zod/tRPC contract snapshot (`docs/api/contract.snapshot.json` via `apps/api/src/contract.ts`, `scripts/export-contract.mjs`, and `just export-contract`), enforce snapshot freshness in Vitest, implement semantic breaking-change detection (`scripts/check-contract-breaking.mjs`) + `.github/workflows/api-contract.yml` (`D-043`), update `tests/repo-hygiene.test.ts` and `docs/reference/api-reference.md`, and complete `ci-fix --optimize` closeout before merging.

### Out of scope

- Write/mutation business procedures in `packages/core` (`Q8.A`: `packages/core` stays read-only with `listProjects` + `getProject`).
- CLI v4 noun-verb cutover and `--help` snapshot changes (`P11`; `Q3.A`).
- API security headers, CORS, rate limiting, `/readyz` probe, `@prometheus-io/client`, and container publish (`P09`).

### Decisions

- **Q7.A (Cursor pagination & API-only `MAX_API_LIMIT`):** Extend `D-047` additively with `cursor?: string` and `nextCursor: string | null`. Enforce `MAX_API_LIMIT = 100` (matching Py `openapi.json` `maximum: 100`) only in `apps/api/src/router.ts`, keeping `packages/core` and `apps/cli` uncapped (`DEFAULT_LIMIT = 200`).
- **Q8.A (Standalone `Idempotency-Key` middleware):** Implement `apps/api/src/idempotency.ts` (`ttlMs = 86_400_000`, `maxEntries = 1024`, `performance.now()`) and verify against fixture `POST`/`PUT`/`PATCH` routes and an injected tRPC mutation router in `apps/api` tests while keeping `packages/core` read-only.
- **D-043 (Contract snapshot & breaking-change guard):** Capture `z.toJSONSchema()` schemas alongside explicit `inputOptional: boolean` flags per sorted procedure (`version: "0.0.0"`) in `docs/api/contract.snapshot.json`, diffing base vs. head semantically in `.github/workflows/api-contract.yml`.
- **D-047 (Internal wire schemas & nullable `workspace`):** Keep upstream wire schemas and converters internal to `packages/core` (never exported from `packages/core/src/index.ts`); normalize `{}`/`null`/missing `workspace` to `null` on domain `Project`.

### Tests & Tasks

- [ ] [P10-TS01] Add TDD tests for internal wire schema coercion (`gid`/`id` alias, numeric ID coercion excluding booleans, numeric `name` rejection), `{}`/`null`/missing `workspace` normalization, strict `unwrapList`/`unwrapItem` missing `data` -> `ApiError`, redacted error paths (`(+N more)` without payload values), and nullable `Project.workspace` properties (`packages/core/tests/`, `apps/cli/tests/api.test.ts`).
- [ ] [P10-TS02] Add TDD tests for the `getProject(id)` vertical slice across `HttpProjectsRepository`, `InMemoryProjectsRepository`, `ProjectsRepository` contract suite, `ProjectsService`, `packages/core` public-API surface, `apps/api` (`projects.get`, `KNOWN_PROCEDURES`), and `apps/cli` `createApiClient().getProject(id)`.
- [ ] [P10-TS03] Add TDD tests for cursor-based pagination (`cursor`, `nextCursor`), `MAX_API_LIMIT = 100` enforcement in `apps/api` only vs. uncapped `packages/core`/`apps/cli`, and `contract-fuzz` + `apps/web` end-to-end type checks (`Q7.A`).
- [ ] [P10-TS04] Add TDD tests in `apps/api/tests/idempotency.test.ts` (replay, `POST`/`PUT`/`PATCH`, query-string separation, empty/whitespace key bypass, 2xx-only caching, multi-valued `Set-Cookie`, TTL expiry, LRU eviction, non-stacking `Idempotency-Replayed: true`, and injected tRPC mutation replay) and `apps/api/tests/versioning.test.ts` (`deprecationHeaders` IMF-fixdate & invalid-Date rejection) (`Q8.A`).
- [ ] [P10-TS05] Add TDD tests in `apps/api/tests/contract-snapshot.test.ts` (freshness vs. `docs/api/contract.snapshot.json`) and `apps/api/tests/contract-diff.test.ts` (breaking vs. non-breaking semantic diff cases) (`D-043`).
- [ ] [P10-TS06] Add hygiene assertions in `tests/repo-hygiene.test.ts` registering `.github/workflows/api-contract.yml` in `spdxRequired` and verifying its workflow contract.
- [ ] [P10-T01] Update `packages/core/src/schemas/project.schema.ts`, `project.converter.ts`, and `repositories/http-projects.repository.ts` for nullable `workspace`, internal wire schemas, redacted error formatting, strict `unwrapList`, and `unwrapItem`.
- [ ] [P10-T02] Implement `getProject(id)`, cursor pagination, and API-only `MAX_API_LIMIT = 100` across `packages/core`, `apps/api/src/router.ts`, `apps/cli/src/{api.ts,cli/commands/projects.ts}`, and `apps/web/src/projects/ProjectsTable.tsx` (preserving `getProjects()` and CLI `--help` snapshots).
- [ ] [P10-T03] Implement `apps/api/src/idempotency.ts` and `apps/api/src/versioning.ts`, and wire `idempotency()` plus optional `router` injection into `apps/api/src/app.ts`.
- [ ] [P10-T04] Add `"zod": "^4.6.6"` to `apps/api/package.json`, implement `apps/api/src/contract.ts`, `scripts/export-contract.mjs`, `scripts/check-contract-breaking.mjs`, `Justfile` `export-contract` recipe, `docs/api/contract.snapshot.json`, and `.github/workflows/api-contract.yml`.
- [ ] [P10-T05] Update `docs/reference/api-reference.md` (and `AGENTS.md` / `cspell.json` if needed) so `just docs-check` and `just check-spelling` pass cleanly.
- [ ] [P10-T06] Run all local verification gates (`just all`, `just coverage`, `just pack-check`, `just docs-check`, `just press-verify`, `just test-web-e2e`, `just check-removable`, `project-audit P10`), rebase onto `main` after P09 merges, re-export snapshot, open PR, run `ci-fix --optimize`, resolve review threads via `pr-merge-flow`, mark `P10` `[x]`, and merge via `--merge`.
