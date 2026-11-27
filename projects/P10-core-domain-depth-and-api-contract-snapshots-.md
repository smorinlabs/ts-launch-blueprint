# P10 — Core domain depth and API contract snapshots

Add getProject, strict HTTP envelope, pagination, idempotency, and tRPC diff

### Notes

**Decisions (2026-11-27):**

- **Q7.A:** Use cursor-based pagination (`cursor?: string` -> `{ projects, nextCursor: string | null }`), extending `D-047` additively, with the max `limit` ceiling enforced in `apps/api` only (leaving `packages/core` and `apps/cli` uncapped).
- **Q8.A:** Mount standalone `Idempotency-Key` Hono middleware (`POST`/`PUT`/`PATCH`, TTL + LRU, `Idempotency-Replayed: true`) on `apps/api` and verify against fixture `POST` and tRPC mutation routes; keep `packages/core` read-only (`listProjects` + `getProject`).
- Finish with a `ci-fix --optimize` closeout pass.

Closes domain, validation, and contract-governance gaps across `packages/core` and `apps/api`:

- **Strict upstream boundary validation (Py `P04` parity):** Tighten `packages/core/src/repositories/http-projects.repository.ts:unwrapList` so a missing `data` key raises `ApiError` instead of silently returning `[]`; separate upstream wire schemas (`gid`/`id` alias, numeric-to-string coercion, `{}`/`null` empty workspace normalization) from domain `Project` without leaking raw payloads in errors.
- **Single-resource read (`getProject`):** Add `getProject(id)` vertically through `ProjectsRepository` (HTTP + in-memory adapters + contract test), `ProjectsService`, CLI, and API (`projects.get`), aligning with the example already sketched in `docs/about/architecture.md:178-201`.
- **Pagination, idempotency & deprecation helpers:** Add pagination support to `ListProjectsInputSchema`/`ListProjectsOutputSchema`, add reusable `Idempotency-Key` replay middleware for mutations (Py WEB-05), and add RFC 8594 `Deprecation`/`Sunset` header helpers (Py `web/versioning.py`).
- **tRPC / Zod contract snapshot & PR breaking-change guard (`D-043`):** Commit a serialized contract snapshot (e.g. JSON Schema from Zod v4 `z.toJSONSchema()` + router procedure map) and test/diff it in CI so breaking API changes are caught even when `apps/web` does not read every field.

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P10` when ready. -->
