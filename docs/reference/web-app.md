# Web App

`apps/web` is the template's browser app (D-054): [React](https://react.dev/)
19 built with [Vite](https://vite.dev/), calling the API through a **typed
tRPC client** with [TanStack Query](https://tanstack.com/query). It imports
only the API's router **type** (`AppRouter`), never its runtime code, so the
browser gets end-to-end types with none of the server in its bundle.

Its one page is the projects screen: a workspace filter kept in the URL,
every loading and error state, plain accessible styling (D-055). There's no
router, UI library or state library yet; add your own as the app grows.

## Running It

Two terminals:

```bash
just api   # terminal 1: the API on :8080 (demo data, no token)
just web   # terminal 2: the Vite dev server; open the URL it prints
```

The page shows `Loading projects…`, then a table of the 4 demo projects and
`4 projects`. Type `engineering` and press Enter for 2 rows, or `nope` for
`Workspace not found: nope`.

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

## The Projects Screen

The source is in `src/projects/`: `ProjectsPage.tsx` holds the state and
the query, `WorkspaceFilter.tsx` the form, `ProjectsTable.tsx` the table and
count, and `QueryStatus.tsx` the loading, empty and error views.

| State              | What the user sees                                                              |
| ------------------ | ------------------------------------------------------------------------------- |
| Loading            | `Loading projects…` (a `status` region; the results area is `aria-busy`)        |
| Success            | A table (Project, Workspace) and the count (`4 projects`, `1 project`)          |
| Empty              | `No projects found.`, plus `in workspace "X"` when filtered                     |
| Not found (404)    | The API's message (`Workspace not found: X`) and **Clear filter**               |
| Bad input (400)    | The API's validation message; no button (the same input would fail again)       |
| Server error (5xx) | The API's message (for example `Upstream projects API error`) and **Try again** |

Messages are the API's own `error.message`, already safe for clients
(D-049). With the demo data you can see success, the filter and the 404 by
hand; empty and 400 can't happen there (every demo workspace has projects,
and the screen only sends a workspace name), so they're covered by tests.

**The filter.** Enter or **Apply** applies it, **Clear** removes it; it
doesn't query on every keystroke. The text is trimmed (blank means no
filter), and matching is the API's job (case-insensitive), so the screen
never filters on its own. No filter sends no input at all.

**The URL.** The filter is `?workspace=<name>`: open or reload
`/?workspace=marketing` and the filtered list loads. Changes use
`history.replaceState`, so they don't add history entries
(`src/projects/workspace-param.ts`).

**Retries.** `createQueryClient()` (`src/query-client.ts`) never retries a
4xx, which can't succeed, and retries other failures at most twice. So a
404 shows its message at once, and a 5xx takes up to 3 requests before
**Try again** appears.

**Accessibility.** A visible `Workspace` label, a table caption and column
headers, `status` and `alert` regions, a politely announced count, visible
focus outlines, and keyboard-only use (Tab, type, Enter; focus stays in the
form). The `jsx-a11y` lint rules check the markup.

**Styling.** Plain CSS in `src/styles.css`: variables for colors and
spacing, light and dark mode (`prefers-color-scheme`), a system font, a
centered column. The table scrolls inside its wrapper on narrow screens; the
page doesn't. Swap in CSS modules, Tailwind or a component library if you
prefer.

## Adding a Screen

Copy the projects screen's pattern:

1. **Query:** `useQuery(trpc.<router>.<procedure>.queryOptions(input))`,
   typed from `AppRouter`. Need the output type for a prop? Infer it from
   the router as `src/trpc.ts` does (`ProjectsListOutput`); don't redefine
   it.
2. **States:** `isPending` → `<QueryMessage>`, `isError` → `<QueryError>`
   (it picks Try again or Clear filter from `errorKind`), empty →
   `<QueryMessage>`, then your view.
3. **Errors:** `errorKind(error)` (`src/projects/errors.ts`) sorts any
   failure into `not-found`, `bad-request` or `server`; the retry policy
   uses the same mapping.
4. **URL state:** for a value worth linking to, follow `useWorkspaceParam()`
   (read with `URLSearchParams`, write with `replaceState`). A second page
   is when to add a router.

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
