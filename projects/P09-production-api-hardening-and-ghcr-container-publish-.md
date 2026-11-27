# P09 — Production API hardening and GHCR container publish

Add secure headers, CORS, rate limit, readyz, Dockerfile cache, and GHCR deploy

### Open questions

- For rate limiting in Hono (in-memory default for single-instance demo, pluggable store for multi-replica), prefer `hono-rate-limiter` or a minimal zero-dep token-bucket middleware?
- Should `apps/api/Dockerfile` pin `node:24-slim` by digest (follow-up noted in `D-050(5)`) and let Dependabot Docker ecosystem refresh it?
- Should non-tRPC HTTP error responses (`404`, `429`, `500`, `503`) adopt RFC 9457 `application/problem+json` (matching Py WEB-01) while keeping tRPC procedures on standard tRPC JSON envelopes (`D-049`)?

### Notes

Closes the production web-service gaps between `apps/api` and Py's FastAPI service (`docs/design/0002`, ADR 0013):

- **Security & traffic middleware:**
  - Wire `hono/secure-headers` outermost (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `HSTS`).
  - Wire opt-in `hono/cors` driven by `CORS_ORIGINS` env var (unblocking cross-origin `apps/web` `VITE_API_URL` builds deferred in `D-054(4)`).
  - Wire opt-in rate limiting driven by `RATE_LIMIT` env var, returning `429` with `Retry-After` and `X-RateLimit-*` headers.
- **Operational readiness & config:**
  - Migrate `apps/api/src/config.ts` from hand-rolled parsers to Zod validation and add `HOST`, `CORS_ORIGINS`, `RATE_LIMIT`, and `SHUTDOWN_TIMEOUT_MS` (currently hardcoded 10s).
  - Enrich `/healthz` with version/runtime info and give `/readyz` a real readiness check returning `503` on failure (replacing the trivial `D-048(3)` stub).
  - Standardize non-tRPC 404/429/500/503 responses.
  - Migrate deprecated `prom-client` -> `@prometheus-io/client` (tracked follow-up `P3-4` in `D-053(10)`).
- **Dockerfile & GHCR publishing:**
  - Add `HEALTHCHECK` and lockfile-first layer caching (`COPY pnpm-lock.yaml pnpm-workspace.yaml ...` before `COPY . .`) to `apps/api/Dockerfile`.
  - Add `.github/workflows/publish-container.yml` (porting Py's immutable `:X.Y.Z` GHCR publish on GitHub Releases, anonymous pull verification, and serialized `:latest` promotion).

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P09` when ready. -->
