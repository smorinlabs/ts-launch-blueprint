# Web App

`apps/web` is the template's browser app (D-054): [React](https://react.dev/)
19 built with [Vite](https://vite.dev/), calling the API through a **typed
tRPC client** with [TanStack Query](https://tanstack.com/query). It imports
only the API's router **type** (`AppRouter`), never its runtime code, so the
browser gets end-to-end types with none of the server in its bundle.

Today it has one plain page that lists the projects. Styling, routing and
the real projects screen come next.

## Running It

Two terminals:

```bash
just api   # terminal 1: the API on :8080 (demo data, no token)
just web   # terminal 2: the Vite dev server; open the URL it prints
```

The page shows `Loading projects…`, then the 4 demo projects as
`name (workspace)`. If the API is down or fails, it shows the API's error
message (already safe for clients, D-049).

`pnpm --filter @ts-launch-blueprint/web build` (or `just build`, which builds
every app) writes the static site to `apps/web/dist/`.

## How the Typed Client Works

- **The type, not the code.** `src/trpc.ts` has
  `import type { AppRouter } from '@ts-launch-blueprint/api/router'`. The
  API's `package.json` exposes `./router` with only a `types` condition, so
  a value import of it doesn't even resolve, and the
  `[web-types-only-from-api]` rule fails anything but `import type`
  ([Architecture Boundary Rules](./boundary-rules.md)). A test checks the
  built bundle contains no API code (Hono, pino, prom-client,
  OpenTelemetry, the procedures).
- **Types end to end.** `trpc.projects.list.queryOptions()` returns exactly
  the core's `ListProjectsOutput`; a type test (`tests/types.test.ts`)
  fails if the API router, the procedure or the shared contract drift.
- **Batching.** The client uses `httpBatchLink`, so calls made together go
  in one request (`/trpc/a,b?batch=1`); the API's metrics and traces label
  those `/trpc/batch` (D-052).
- **One origin in dev.** Vite proxies `/trpc` to `http://localhost:8080`
  (`vite.config.ts`), so the browser only talks to the Vite server and the
  API needs no CORS.

## Calling the API from Another Origin

The client calls `<VITE_API_URL>/trpc`. `VITE_API_URL` is empty by default
(same origin). Set it at build time to point the app at an API somewhere
else:

```bash
VITE_API_URL=https://api.example.com pnpm --filter @ts-launch-blueprint/web build
```

A different origin needs CORS on the API, which isn't set up yet. That's
decided with the deploy.

## Adding a Query

When the API gains a procedure (see "How to Add a Feature" in the
[Architecture](../about/architecture.md)), the web app gets its hook with no
extra code: `useQuery(trpc.<router>.<procedure>.queryOptions(input))` is
typed from `AppRouter` as soon as the procedure exists. A typo in the name,
the input or a field of the result fails `just typecheck`.

## See Also

- [API Reference](./api-reference.md): the endpoints the app calls
- [Architecture Boundary Rules](./boundary-rules.md): `[web-types-only-from-api]` and removing an app
- [Project Structure](./project-structure.md)
