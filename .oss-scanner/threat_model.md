<!-- cspell:ignore healthz readyz traceparent tsdown rebrands exfiltration -->

# Threat Model

`ts-launch-blueprint` is a TypeScript monorepo project template. Repositories
stamped from it inherit its core library, CLI, API, web app, CI workflows, and
release pipeline, so a flaw here propagates to every stamped project. Report
flaws in this repository's own code, not in its third-party dependencies.

## What this project does and where untrusted input enters

- **API service (`apps/api/src/`):** Hono + tRPC v11 (`app.ts`, `router.ts`,
  `server.ts`, `config.ts`, `errors.ts`, `problems.ts`, `rate-limit.ts`,
  `idempotency.ts`, `request-log.ts`). Assume it may be deployed on the public
  internet to anonymous clients via the published GHCR container image. All
  HTTP input is untrusted: tRPC procedure inputs (`projects.get` `id`,
  `projects.list` `workspace`/`limit`/`cursor`), query strings (`?input=`),
  and headers including `Idempotency-Key` (`apps/api/src/idempotency.ts`),
  `x-forwarded-for`/`x-real-ip` (`apps/api/src/rate-limit.ts`), and
  `x-request-id`/`x-cloud-trace-context`/`traceparent`
  (`apps/api/src/request-log.ts`). Non-tRPC errors emit RFC 9457
  `application/problem+json`.
- **Server-held credential (`apps/api/src/config.ts`, `apps/api/src/server.ts`):**
  When `TS_PROJECTS_SOURCE=http`, the API reads `TS_PROJECTS_TOKEN` (and
  optional `TS_PROJECTS_API_URL`) from its own environment and forwards
  `Authorization: Bearer <token>` via `createCore({ source: 'http', ... })`.
  Any way a client can steer that credential, such as path manipulation reaching
  unintended upstream endpoints, is in scope.
- **Upstream HTTP client (`packages/core/src/repositories/http-projects.repository.ts`):**
  Constructs request URLs from caller-supplied IDs (`encodeURIComponent(id)`,
  rejecting `.` and `..`) against `BASE_URL` (`https://app.ts.com/api/1.0`),
  enforces a 30s `AbortSignal.timeout`, and validates JSON responses via
  `convertProjectDetailed` / `convertWorkspaceDetailed`. Treat upstream JSON
  responses as untrusted.
- **CLI (`ts-projects`, `apps/cli/src/cli/`):** Noun-verb Commander CLI
  (`router.ts`, `commands/{projects,config,doctor,completion}.ts`). Untrusted or
  user-controlled inputs: 3-layer TOML discovery (`system -> user -> project` in
  `xdg-paths.ts` and `config.ts`), `--token` or `TS_PROJECTS_TOKEN` (never read
  or written in TOML per ADR 0002), `--config`, `--output-file`, `--log-file`,
  crash log (`<state>/ts-projects/ts-projects_crash.log` in `crash-log.ts`),
  and interactive pager command resolution (`TS_PROJECTS_PAGER` / `PAGER`
  tokenized in `pager.ts`).
- **Log & diagnostics redaction (`apps/cli/src/cli/logger.ts`,
  `apps/cli/src/cli/diagnostics.ts`, `apps/api/src/request-log.ts`):**
  `redactLogFields` masks keys matching `token`, `password`, `secret`,
  `authorization`, `api_key`, `apikey`, `credential`, and `cookie`;
  `redactAppEnv` masks `TOKEN`, `SECRET`, `KEY`, `PASSWORD`, `CRED`, `PRIVATE`
  env vars and URL credentials; `request-log.ts` logs `c.req.path` only (never
  query strings). Any bypass writing credentials to logs or diagnostics bundles
  is in scope.
- **Web app (`apps/web/src/`):** React 19 + Vite SPA communicating via typed
  tRPC client (`VITE_API_URL`, URL search params in `apps/web/src/projects/`).
- **GitHub Actions workflows (`.github/workflows/`):** Workflows that hold
  credentials and act on external or semi-trusted input. Report only paths that
  get past their gates:
  - `claude.yml`: triggers on `issues`, `issue_comment`,
    `pull_request_review_comment`, and `pull_request_review` mentioning
    `@claude`; holds `CLAUDE_CODE_OAUTH_TOKEN` with actor/fork guards.
  - `claude-code-review.yml`: triggers on `pull_request`; gated to non-fork,
    non-bot PRs.
  - `audit-triage.yml`: `workflow_run` / `workflow_dispatch`, gated by
    `vars.MUSE_CI_ENABLED == 'true'`, org check, and `META_MUSE_CI_API_KEY`.
  - `difftree-pr-comment.yml`: `pull_request` (deliberately not
    `pull_request_target`), so fork PRs get a read-only `GITHUB_TOKEN`.

## Components that matter most / least

High priority:

- The API service (`apps/api/src/`), upstream HTTP client (`packages/core/src/`),
  and server-held `TS_PROJECTS_TOKEN`.
- CI workflows (`.github/workflows/`): workflow injection through untrusted
  event fields, prompt injection into Claude/Muse jobs, secret exposure, and
  over-broad `GITHUB_TOKEN` permissions.
- The release pipeline (`release-please.yml`, `publish.yml`,
  `publish-container.yml`, `scripts/publish-container.mjs`): anything that could
  tamper with npm OIDC or GHCR artifacts.

Normal priority:

- The CLI (`apps/cli/src/cli/`) and its config/path/pager handling.
- The `press/` configuration (`press/press-rules.toml`, `press/stubs/`) that
  rebrands stamped child repositories.
- Documentation sources under `docs/`.

## How to exercise it

- The `.oss-scanner/Dockerfile` image pre-installs workspace dependencies and
  builds apps into `dist/` under `/src`: run
  `pnpm exec vitest run --exclude '**/e2e.test.ts'` offline. (Note:
  `.dockerignore` omits `.git`, so git-reading tests like `repo-hygiene.test.ts`
  and `bootstrap-skill.test.ts` may fail in-image without `.git`.)
- Upstream HTTP calls are unreachable offline; tests inject fakes via
  `InMemoryProjectsRepository` (`packages/core/src/repositories/in-memory-projects.repository.ts`)
  and mock fetch in `packages/core/tests/`.
- Exercise the API in-process with Hono's `app.request(...)` as in
  `apps/api/tests/`.
- Exercise the CLI in-process via `CliDeps` DI in `apps/cli/tests/` or via
  `node apps/cli/dist/cli.js --help` after `pnpm -r --filter './apps/*' build`.
- Architecture and workflow hygiene tests live in `tests/` (`boundaries.test.ts`,
  `repo-hygiene.test.ts`, `press-config.test.ts`, `publish-container.test.ts`,
  `audit-triage.test.ts`).

## How you rate severity

- **Critical:** remote code execution; exfiltration of CI secrets or of the
  server's `TS_PROJECTS_TOKEN`; tampering with npm or GHCR releases or with
  stamped repositories.
- **High:** misuse of the server-held token through path manipulation; workflow
  injection; authentication or rate-limit/idempotency bypass.
- **Medium:** denial of service; secrets written to logs or diagnostics bundles.
- **Low:** CLI issues that require control of the user's own config files or
  environment.

## Anything to leave alone

- `docs/port/` and `projects/`: template port/tracking history, removed on
  `press rebrand` and not shipped in the published npm package or container
  image.
