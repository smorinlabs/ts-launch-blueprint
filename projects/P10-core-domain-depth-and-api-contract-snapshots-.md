# P10 — Core domain depth and API contract snapshots

Add getProject, strict HTTP envelope, pagination, idempotency, and tRPC diff

### Open questions

- Should pagination use cursor-based pagination (anticipated by `D-047`'s `{ projects }` wrapper) or page/size pagination (matching Py's `fastapi-pagination`)?
- Should a max `limit` cap live in `ListProjectsInputSchema` (shared with CLI) or only in an API input wrapper (`D-047` / `D-048(5)`)?
- Should `Idempotency-Key` middleware ship alongside a first example mutation procedure (e.g. `projects.create`) or as a standalone reusable middleware tested against a fixture route?

### Notes

Closes domain, validation, and contract-governance gaps across `packages/core` and `apps/api`:

- **Strict upstream boundary validation (Py `P04` parity):** Tighten `packages/core/src/repositories/http-projects.repository.ts:unwrapList` so a missing `data` key raises `ApiError` instead of silently returning `[]`; separate upstream wire schemas (`gid`/`id` alias, numeric-to-string coercion, `{}`/`null` empty workspace normalization) from domain `Project` without leaking raw payloads in errors.
- **Single-resource read (`getProject`):** Add `getProject(id)` vertically through `ProjectsRepository` (HTTP + in-memory adapters + contract test), `ProjectsService`, CLI, and API (`projects.get`), aligning with the example already sketched in `docs/about/architecture.md:178-201`.
- **Pagination, idempotency & deprecation helpers:** Add pagination support to `ListProjectsInputSchema`/`ListProjectsOutputSchema`, add reusable `Idempotency-Key` replay middleware for mutations (Py WEB-05), and add RFC 8594 `Deprecation`/`Sunset` header helpers (Py `web/versioning.py`).
- **tRPC / Zod contract snapshot & PR breaking-change guard (`D-043`):** Commit a serialized contract snapshot (e.g. JSON Schema from Zod v4 `z.toJSONSchema()` + router procedure map) and test/diff it in CI so breaking API changes are caught even when `apps/web` does not read every field.

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P10` when ready. -->
