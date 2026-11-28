# P09 — Production API hardening and GHCR container publish

**References**

- **Trunk:** [PROJECTS.md](../PROJECTS.md)
- **Design:** [TS_PORT_DECISIONS.md](../docs/port/TS_PORT_DECISIONS.md)
- **Design:** [api-reference.md](../docs/reference/api-reference.md)
- **Design:** [observability.md](../docs/reference/observability.md)

Add secure headers, CORS, rate limit, readyz, Dockerfile cache, and GHCR deploy

### Scope

- Migrate `apps/api/src/config.ts` from hand-rolled parsers to `zod` (`^4.6.6` in `apps/api/package.json`) while preserving `ConfigError` contracts and empty-string unset semantics, and add `HOST` (default `'127.0.0.1'`), `CORS_ORIGINS` (default `[]`, JSON array or comma-separated `http:`/`https:` origins or `'*'`), `RATE_LIMIT` (default `undefined`, `<count>/<second|minute|hour|day>`), and `SHUTDOWN_TIMEOUT_MS` (default `10_000`); wire `hostname`, `corsOrigins`, `rateLimit`, and `timeoutMs` through `apps/api/src/server.ts` and `apps/api/src/shutdown.ts`.
- Wire `hono/secure-headers` outermost (`X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `crossOriginResourcePolicy` adjusted when CORS is enabled), opt-in `hono/cors` via `CORS_ORIGINS` (unblocking cross-origin `apps/web` `VITE_API_URL` per `D-054(4)`), and opt-in zero-dep fixed-window rate limiting (`apps/api/src/rate-limit.ts`) returning RFC 9457 `429 application/problem+json` with `Retry-After` and `X-RateLimit-*` headers.
- Add `apps/api/src/version.ts` (static import of root `package.json` preserving `D-048(7)` and `dist/`-only execution) and `apps/api/src/problems.ts`; enrich `GET /healthz` (`{ status: 'ok', version, runtime }`), implement real injectable `GET /readyz` (`200` `{ status: 'ready', checks }` or `503 application/problem+json`), and return `application/problem+json` on non-tRPC `404`/`429`/`500`/`503` responses while preserving `D-049` JSON envelopes on `/trpc/*`.
- Migrate deprecated `prom-client` to `@prometheus-io/client` (`^0.16.1`) across `apps/api/package.json`, `apps/api/src/metrics.ts`, `.github/dependabot.yml`, `apps/web/tests/bundle.test.ts`, `apps/api/tests/e2e.test.ts`, `AGENTS.md`, `docs/reference/observability.md`, and `docs/about/architecture.md` (`D-053(10)`).
- Harden `apps/api/Dockerfile` with digest-pinned `node:24-slim`, lockfile-first BuildKit layer caching, `ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0`, and Node `fetch` `HEALTHCHECK`; add the `docker` ecosystem (`/apps/api`) to `.github/dependabot.yml`.
- Add `.github/workflows/publish-container.yml`, `scripts/publish-container.mjs`, and `tests/publish-container.test.ts` porting Py's immutable `:X.Y.Z` GHCR publish, anonymous pull check, serialized `:latest` promotion, and PR `container-check` job, updating `tests/repo-hygiene.test.ts`.
- Complete mandatory `ci-fix --optimize` closeout pass on the measured green PR CI run (Docker layer caching and job runtime).

### Out of scope

- Multi-replica / Redis-backed distributed rate limiting (`rate-limit.ts` is an in-memory fixed-window limiter for single-instance deployments).
- Core domain depth (`getProject`, cursor pagination, `Idempotency-Key` middleware, RFC 8594 deprecation headers, and contract snapshots — tracked in `P10`).
- CLI v4 noun-verb cutover (`P11`).

### Decisions

- **RFC 9457 Problem Details:** Return `application/problem+json` on non-tRPC HTTP errors (`404`, `429`, `500`, `503`) while keeping `/trpc/*` procedures on `D-049` JSON envelopes.
- **Zero-dependency rate limiter:** Use an in-memory fixed-window `Map` with bounded sweep in `apps/api/src/rate-limit.ts` rather than adding external rate-limit packages.
- **Version sourcing (`D-048(7)`):** Statically import `../../../package.json` in `apps/api/src/version.ts` so `apps/api/package.json` stays versionless while `tsdown` bundles the version into `dist/server.js`.
- **Container pinning & publishing:** Pin `apps/api/Dockerfile` `node:24-slim` by SHA-256 digest, add Dependabot `docker` coverage, and publish immutable `:X.Y.Z` GHCR images via zero-dep `scripts/publish-container.mjs`.
- **Closeout:** Run `ci-fix --optimize` on green PR CI before resolving review threads and merging via `--merge`.

### Tests & Tasks

- [x] [P09-TS01] Update `apps/api/tests/config.test.ts` for new `ApiConfig` fields (`host`, `corsOrigins`, `rateLimit`, `shutdownTimeoutMs`) and add unit tests covering valid/invalid `HOST`, `CORS_ORIGINS` (JSON array, comma-separated, wildcard, malformed), `RATE_LIMIT` (`second`/`minute`/`hour`/`day`, plural, invalid), and `SHUTDOWN_TIMEOUT_MS`.
- [x] [P09-TS02] Update `apps/api/tests/app.test.ts`, `apps/api/tests/request-log.test.ts`, and `apps/api/tests/e2e.test.ts`, and add tests for `hono/secure-headers` (including on `404`/`429`/`OPTIONS`/`500`/`503`), opt-in `hono/cors` (off by default, allowed/disallowed origins, preflight), opt-in rate limiting (`X-RateLimit-*`, `429`, `Retry-After`, window reset, disabled by default), enriched `/healthz`, `/readyz` (`200` and `503` on error/throw), and RFC 9457 `application/problem+json` vs `/trpc/*` `D-049` JSON envelopes.
- [x] [P09-TS03] Add `shutdown.test.ts` coverage for custom `timeoutMs` in `ShutdownDeps` and update `apps/web/tests/bundle.test.ts` to check `@prometheus-io/client`.
- [x] [P09-TS04] Add `tests/publish-container.test.ts` porting Py's behavioral guards for `scripts/publish-container.mjs` (immutable `:X.Y.Z` publish, manifest/config digest verification, containerd `image save` tar fallback, OCI label checks, anonymous pull check, serialized `:latest` promotion, and release event validation).
- [x] [P09-TS05] Update `tests/repo-hygiene.test.ts` `spdxRequired` for `.github/workflows/publish-container.yml` and verify Dependabot `docker` ecosystem hygiene rules.
- [x] [P09-T01] Migrate `prom-client` to `@prometheus-io/client` (`^0.16.1`) and add `zod` (`^4.6.6`) in `apps/api/package.json` and `pnpm-lock.yaml`; update `apps/api/src/metrics.ts`, `.github/dependabot.yml`, `AGENTS.md`, `docs/reference/observability.md`, and `docs/about/architecture.md`.
- [x] [P09-T02] Migrate `apps/api/src/config.ts` to Zod validation with `HOST`, `CORS_ORIGINS`, `RATE_LIMIT`, and `SHUTDOWN_TIMEOUT_MS`; wire `hostname`, `corsOrigins`, `rateLimit`, and `timeoutMs` into `apps/api/src/server.ts` and `apps/api/src/shutdown.ts`.
- [x] [P09-T03] Implement `apps/api/src/version.ts`, `apps/api/src/problems.ts`, and `apps/api/src/rate-limit.ts`; update `apps/api/src/app.ts` with the hardened middleware stack, `/healthz`, `/readyz`, and RFC 9457 error handlers; update `docs/reference/api-reference.md` and `docs/reference/observability.md`.
- [x] [P09-T04] Harden `apps/api/Dockerfile` (digest-pinned `node:24-slim`, lockfile-first BuildKit cache mount, `ENV HOST=0.0.0.0`, Node `HEALTHCHECK`) and add `docker` ecosystem to `.github/dependabot.yml`.
- [x] [P09-T05] Add `.github/workflows/publish-container.yml`, `scripts/publish-container.mjs`, and `scripts/publish-container.d.mts`.
- [x] [P09-T06] Run all local verification gates (`just all`, `just coverage`, `just pack-check`, `just docs-check`, `just press-verify`, `just check-removable`, `just test-web-e2e`, `project-audit P09`), open PR, verify green CI (`api-image`, `container-check`, `web-e2e`), run `ci-fix --optimize`, resolve review threads via `pr-merge-flow`, mark `P09` `[x]`, and merge via `--merge`.
