# TS Existing Repo Review

Institutional memory for the py-launch-blueprint → ts-launch-blueprint port:
what technology decisions already exist across the owner's repos, so the port
reuses deliberate recent choices instead of re-deciding them. Produced in Phase
3 of `goal.md` (domain spec Phase 3); feeds `TS_PORT_RESEARCH.md`.

## Discovery method (goal.md §7)

Enumerated all repos for `smorin` and `smorinlabs` on 2026-07-06, sorted by
`pushedAt`. GraphQL quota was exhausted at discovery time, so the equivalent
REST calls were used: `gh api "user/repos?affiliation=owner&sort=pushed&per_page=100"`
and `gh api "users/smorinlabs/repos?sort=pushed&per_page=100"`. Repos selected
per D-010: every original (non-fork, non-scratch, non-generated) TypeScript/
JavaScript repo pushed within ~7 months, plus `cli-standards` (normative CLI
conventions) and `difftree` (most recent actively-released CLI; cross-platform
CI/release/justfile patterns). Review method: read-only shallow clones,
deep-research discipline (every claim verified against configs, workflows, and
lockfiles in the clone, with path+line citations).

## Reviewed (8)

| Repo | Language | Pushed | Why |
|------|----------|--------|-----|
| smorinlabs/agent2linear | TypeScript | 2026-06-28 | most substantial recent TS CLI; closest shape to the port target |
| smorinlabs/contributors-please | TypeScript | 2026-06-17 | recent TS lib+CLI; overlaps source repo's contributors automation |
| smorinlabs/contributors-please-action | TypeScript | 2026-06-17 | TS GitHub Action packaging |
| smorinlabs/difftree-action | JavaScript | 2026-07-06 | most recent JS; composite-action patterns |
| smorin/claim-npm | TypeScript | 2026-06-08 | TS CLI + npm registry tooling (private) |
| smorin/poc-typescript-bun-trpc-vite | TypeScript | 2026-01-25 | explicit TS+Bun+Turborepo POC with written decision record (private) |
| smorinlabs/cli-standards | Markdown | 2026-06-29 | normative org-wide CLI design standard v1.4.x |
| smorinlabs/difftree | Rust | 2026-07-06 | most recent actively-released CLI; CI/release/justfile process patterns |

## Skipped (with reason)

| Class | Repos | Reason |
|-------|-------|--------|
| Forks of third-party projects | flox, nixpkgs, codex, claude-code, localsend, whispo, cmux, posturr, CodexBar, bonsplit | upstream decisions, not owner decisions |
| Scratch/test/e2e repos | difftree-action-test, contributors-please-test, contributors-please-e2e, blueprint-dryrun | throwaway targets; no deliberate tooling decisions |
| Generated app exports | remix-of-ai-native-accounting-platform, stevemorin-leader-taste, thoughts-plan | app-builder output, not hand decisions; stale (2025-11) |
| Python/other-language repos | py-launch-blueprint (the port source), template-press, doxa-research, thothspinner, mockcast, identikit, worktreeflow, harness-kit, htmlgist, pkg_analysis, txsim, python-tui-bakeoff, smorin-harness, smorin-bootstrap, claim-pypi, deepresearch_replay | carry no TS-ecosystem decisions; source repo already indexed in TS_PORT_INDEX.md |
| Rust/Go/other CLIs (older or niche) | toggle, cargo-claim, envgen, substrata, agent-deck, flutter_key_flow, imgframer | difftree already covers the cross-platform CLI process patterns with the most recent activity |
| Infra/config/site/misc | gcpflowterraform_poc, cloudrun-tfplan, stevemorin.com, shelf, html-skills-prototype-, ralphus-prime, ccp, sm-plugins, sendrelay01, rpi-artifacts, bsapp, ai-advantage-demystified, homebrew-tap, claude-openrouter-launcher, smorinlabs-harness, register-gated-verification, claim-package-name-skill | not project templates or TS tooling carriers; several stale or private experiments |
| Older TS (>5 months, superseded) | agent2linear supersedes older CLI shapes; whispo/other 2025-11 TS repos are stale or forks | recency rule of domain spec Phase 3 |

---


## Repo: smorinlabs/agent2linear

**1. Repo name**: agent2linear (npm package `agent2linear`, v0.32.0; CLI binaries `agent2linear` and `a2l` — `package.json:2-8`). Note: git remote history shows `github.com/smorin/agent2linear` in `package.json:50`; the task labels it smorinlabs/agent2linear.

**2. Why it is relevant**: The most substantial recent TypeScript CLI by the same author — a Commander-based, ESM, npm-published CLI with unit + hermetic E2E + live-API test tiers, tag-driven npm release, XDG config handling, and stdout/stderr output discipline. Closest structural match to the TS port target.

**3. Recency**: Last commit 2026-06-27 21:11:50 -0500 (`git log -1 --format=%ci`). Active: 59 commits total since first commit 2025-10-26; 16 commits since 2026-05-01, including feature milestones M28–M32 merged as PRs in June 2026.

**4. Language/runtime stack**: TypeScript 5.3+ targeting Node.js >=18 (`package.json:69,82-84`), pure ESM (`"type": "module"`, `package.json:10`). Runtime deps: `commander` for CLI, `@linear/sdk` (GraphQL API), `ink` + `react` 19 for interactive terminal UI (`.tsx` command files), `picomatch` for glob matching (`package.json:72-81`). Not Bun — no Bun artifacts anywhere.

**5. Package manager**: npm — `package-lock.json` (lockfileVersion 3) is the only lockfile at repo root; no `bun.lock`/`bun.lockb`, `pnpm-lock.yaml`, or `yarn.lock` (root `ls`). No `packageManager` field in `package.json` (absent from `package.json:1-85`); engines pins only `node >=18.0.0` (`package.json:82-84`).

**6. Build system**: tsup (esbuild-based bundler) — single entry `src/index.ts`, ESM output, `dts: true`, sourcemaps, `clean: true`, `shims: true`, and a `#!/usr/bin/env node` shebang injected via `banner.js` (`tsup.config.ts:3-15`). `npm run build` = `turbo run build:task` → `tsup` (`package.json:18-19`). Typecheck is a separate `tsc --noEmit` step (`package.json:27`).

**7. Monorepo tooling**: Not a monorepo (single package), but TurboRepo v1 is used as the task runner/cache layer: every script has a `turbo run X` wrapper plus an `X:task` real script (`package.json:18-27`), with a `turbo.json` pipeline declaring `dependsOn`/`outputs` per task (`turbo.json:3-21`). `.turbo/` is gitignored (`.gitignore:9`).

**8. TypeScript configuration patterns**: `strict: true` (`tsconfig.json:9`), `target: ES2022` / `module: ESNext` / `moduleResolution: bundler` (`tsconfig.json:3-6`), `esModuleInterop`, `skipLibCheck`, `forceConsistentCasingInFileNames`, `resolveJsonModule` (`tsconfig.json:7-11`), `declaration` + `declarationMap` + `sourceMap` (`tsconfig.json:12-14`), `jsx: react-jsx` for Ink (`tsconfig.json:17`), `types: ["node"]` (`tsconfig.json:18`). ESM imports use explicit `.js` extensions in source (e.g. `src/index.ts:3`, `src/cli.ts:4-31`). Single tsconfig; no project references.

**9. Linting and formatting**: Legacy ESLint 8 with `.eslintrc.json` — `@typescript-eslint/parser`, `eslint:recommended` + `plugin:@typescript-eslint/recommended`, plus `eslint-plugin-simple-import-sort` for import ordering; `no-explicit-any` downgraded to warn, unused args ignorable via `^_` prefix (`.eslintrc.json:1-27`). Prettier for formatting: semi, single quotes, printWidth 100, trailingComma es5, arrowParens avoid (`.prettierrc.json:1-9`); `.prettierignore` covers dist/node_modules/.turbo/coverage. NOT oxc/Oxlint or Biome. Format is not enforced in CI (ci.yml runs tsc/eslint/vitest/tsup only).

**10. Testing approach**: Three tiers. (a) Unit tests: Vitest 4 with `globals: true`, node environment, colocated `*.test.ts` files in `src/lib/` (e.g. `src/lib/date-parser.test.ts`, `src/lib/config.xdg.test.ts`); V8 coverage with 100% lines/functions/branches/statements thresholds, excluding entrypoints `src/index.ts`/`src/cli.ts` (`vitest.config.ts:4-23`). (b) Hermetic offline E2E: bash script against built `dist/index.js` with HOME/XDG sandboxed and LINEAR_API_KEY unset, run in CI (`.github/workflows/ci.yml:26-28`). (c) Live integration: bash suites in `tests/scripts/` against a throwaway real Linear workspace, creating `TEST_*` entities (`CLAUDE.md` Testing section; `.github/workflows/live.yml`).

**11. CI/GitHub Actions patterns**: Three workflows. `ci.yml`: push/PR to main, Node 18.x/20.x matrix, runs on Blacksmith runners (`runs-on: blacksmith-4vcpu-ubuntu-2404`, `ci.yml:11`; migrated in commit a3f48dc "Migrate workflows to Blacksmith"), `actions/setup-node@v4` with `cache: npm` (`ci.yml:17-20`), steps: `npm ci` → `tsc --noEmit` → `eslint` → `vitest run` → `tsup` → offline E2E script. `live.yml`: trusted events only (push to main + workflow_dispatch, never `pull_request`, so the API secret is never exposed to forks — `live.yml:4-9`), `concurrency: group: live, cancel-in-progress: false` to serialize data-creating runs (`live.yml:13-15`), fast auth smoke (`whoami`) before the heavy suite (`live.yml:30-33`). `release.yml`: on `v*` tag push, `permissions: contents: read`, typecheck + test + build then `npm publish` with `NPM_TOKEN` (`release.yml:3-24`). Actions pinned to major version tags (`@v4`), not SHAs.

**12. Release/versioning approach**: SemVer + Keep a Changelog (`CHANGELOG.md:5-6`). `np` for interactive release orchestration (`"release": "np"`, `package.json:33`), which bumps/tags; the `v*` tag push then triggers `release.yml` to publish to npm. `prepublishOnly` gate runs typecheck + lint + build (`package.json:32`). No changesets/release-please/semantic-release. Version string is duplicated in `src/cli.ts:38` (`.version('0.32.0')`) and must be kept in sync with package.json manually (commit 0819797 "sync package-lock.json version" shows drift happens).

**13. Documentation approach**: Single very large `README.md` (~60K) as the user manual, `CHANGELOG.md`, a detailed `CLAUDE.md` (~24K) as AI/dev onboarding (stack, architecture, testing philosophy, icon-handling gotchas), plus milestone-driven planning docs at repo root (`MILESTONES.md` ~120K, proposals like `OUTPUT_STREAMS_PROPOSAL.md`, `CONTEXT_OVERRIDES_PROPOSAL.md`) and superpowers-style specs/plans in `docs/superpowers/specs/` and `docs/superpowers/plans/` (e.g. `2026-06-19-xdg-base-directory-design.md`). Historical docs moved to `archive/`. No docs site generator (no Docusaurus/VitePress/mkdocs observed).

**14. CLI or app structure patterns**: Commander.js `Command` with global options `-q/--quiet`, `-v/--verbose`, `--no-color`, `--workspace`, `--api-key` (with `-` = read stdin), `-C/--cwd` (git-style, does `process.chdir`) wired in a `preAction` hook that sets log level, color mode, and an invocation context singleton (`src/cli.ts:35-86`). Layout: `src/index.ts` (thin entry: parseAsync + catch → stderr + `process.exit(1)`, `src/index.ts:5-8`) → `src/cli.ts` (all registration) → `src/commands/<entity>/<action>.ts(x)` with per-entity `register.ts` functions (`src/cli.ts:92-111`; `CLAUDE.md` Architecture) → shared libs in `src/lib/` (~50 modules: config, xdg-paths, aliases, resolvers, parsers, validators) → Linear API layer in `src/lib/api/` → Ink components in `src/ui/components/` (`.tsx`). Output conventions: human/progress messages to stderr via logger, machine output on stdout; widespread `--json` flags emitting structured envelopes for agents (e.g. `{ "ok": true, ... }`, `README.md:589,594`); `silenceStdoutWhile` helper guarantees a single clean JSON object on stdout (`src/lib/output.ts:23-37`); emoji prefixes stripped under `--no-color` (`src/lib/output.ts:42-47`). Exit codes: 0 success / 1 failure; centralized error middleware `runCommand` in `src/lib/command-runner.ts` handles Linear API errors (401/403/404/429 mapped to friendly messages, `src/lib/error-handler.ts:66-75`) and exits 1. XDG Base Directory config: `$XDG_CONFIG_HOME/agent2linear` else `~/.config/agent2linear`, cache under `$XDG_CACHE_HOME` partitioned by sha256(apiKey)[:12] (`src/lib/xdg-paths.ts:19-40`), plus project-local `.agent2linear` dir (`src/lib/xdg-paths.ts:7`).

**15. Logging/configuration patterns**: Minimal hand-rolled logger, no logging library: all log output to stderr (`console.error`) with levels quiet/normal/verbose set by flags; debug only under `--verbose`, info suppressed by `--quiet`, warn/error always (`src/lib/logger.ts:8-58`). Configuration: env var `LINEAR_API_KEY` (+ `AGENT2LINEAR_CWD`), XDG user config + project-local config with context-aware `overrides[]` rules and multi-workspace profiles (`src/lib/config.ts`, `src/lib/overrides.ts`, `src/lib/workspaces.ts`; README "config override" sections). `.env` files supported via own `src/lib/env-file.ts`.

**16. Reusable decisions (for the TS port)**:
- Strict ESM TS config shape: `strict` + ES2022 target + `moduleResolution: bundler` + declaration/sourcemaps (`tsconfig.json`).
- tsup single-entry bundle with shebang banner + dts for a CLI binary (`tsup.config.ts`).
- Command layout: thin `index.ts` entry → `cli.ts` registration → `commands/<entity>/<action>.ts` with `register*` functions → shared `lib/` — scales well (`src/cli.ts`).
- Output discipline: stderr for human/progress, stdout reserved for machine output; `--json` envelopes for agents; `--quiet/--verbose/--no-color` global flags (`src/lib/logger.ts:4`, `src/lib/output.ts`).
- XDG Base Directory config/cache resolution with project-local override dir (`src/lib/xdg-paths.ts`).
- CI split: fast hermetic PR checks vs. secret-bearing live suite on trusted events only, with `concurrency` serialization (`ci.yml`, `live.yml`) — the fork-secret-safety comment at `live.yml:3-5` is a deliberate, documented decision.
- Vitest with colocated `*.test.ts` + v8 coverage; hermetic E2E of the built artifact in CI (`vitest.config.ts`, `ci.yml:28`).
- Tag-push → npm publish release workflow with `prepublishOnly` gate (`release.yml`, `package.json:32`).
- Committed `.claude/settings.json` enabling `typescript-lsp` and `ast-grep` plugins repo-wide, documented in CLAUDE.md (`.claude/settings.json:2-5`, `CLAUDE.md` "Code Intelligence Tooling").
- justfile for local dev shortcuts (build/dev/npm-link recipes, `justfile:9-19`).
- Keep a Changelog + SemVer (`CHANGELOG.md:5-6`).

**17. Decisions that should NOT be reused (with why)**:
- npm + package-lock.json as package manager (`package-lock.json`): the port target mandates Bun; this repo predates that choice and has no Bun usage.
- ESLint 8 legacy `.eslintrc.json` + Prettier (`.eslintrc.json`, `.prettierrc.json`): ESLint 8 and the `.eslintrc` format are EOL/deprecated; the port targets oxc/Oxlint. The import-sort and `^_` unused-arg conventions are worth carrying over as Oxlint rules.
- TurboRepo v1 with `pipeline` key (`turbo.json:3`): Turbo 2.x renamed `pipeline` → `tasks`; also, wrapping every npm script in a `turbo run` + `:task` pair in a single-package repo is boilerplate — reuse the idea (cached task runner) but on current Turbo 2.x syntax.
- `np` interactive release (`package.json:33`): fine for a solo maintainer but interactive; a template likely wants a non-interactive/changesets-style flow.
- Blacksmith runners (`ci.yml:11`): paid third-party runner tied to this org's account; a public template should default to `ubuntu-latest` (note `live.yml:19` itself still uses ubuntu-latest).
- Version string hardcoded in `src/cli.ts:38` separate from package.json — proven drift source (commit 0819797).
- 100% coverage thresholds on all four metrics (`vitest.config.ts:19-22`): sustained here only by excluding entrypoints; likely too rigid as a template default.
- Node 18 floor (`package.json:83`): Node 18 is past EOL (April 2025); a 2026 template should baseline 20/22 or Bun.
- Large planning artifacts (MILESTONES.md ~120K, 700K `linear_schema.md`, a committed `agent2linear-0.24.0.tgz` tarball at repo root): repo-hygiene anti-patterns, not template material.

**18. Open questions**:
- No git hooks manager at all (no lefthook.yml, .husky/, or .pre-commit-config.yaml found at repo root) — quality gates run only in CI and `prepublishOnly`. Deliberate or just never added? The port's lefthook decision must come from another repo.
- No `packageManager` field or `.nvmrc`/`.node-version` — Node/npm version pinning relies solely on `engines` + CI matrix.
- Whether the turbo-wrapper-script pattern (`X` → `turbo run X:task`) is a deliberate standard to carry forward or an artifact of experimenting with Turbo in a single-package repo.
- `.vscode/` is gitignored (`.gitignore:23`) — no shared editor settings; no `.cursor/` observed. Is editor config intentionally personal-only?
- The `.humanlayer/workspace.json` (Riptide) tracking convention (`.gitignore:38-41`) — org-specific tooling; unclear if relevant to the template.

## Repo: smorinlabs/contributors-please

**1. Repo name**: smorinlabs/contributors-please — "Incremental, path-aware contributor recognition engine and CLI" (package.json:4).

**2. Why it is relevant**: Recent (June 2026) TypeScript project by the same owner; it is an npm-published library + CLI whose domain (contributors automation) overlaps the Python source repo being ported. Its release-please workflow explicitly says it "Mirrors the canonical pattern from smorinlabs/py-launch-blueprint" (.github/workflows/release-please.yml:2-3), so it is a direct bridge between the owner's Python template conventions and TypeScript practice.

**3. Recency**: Last commit 2026-06-17 13:16:11 -0700 (`git log -1 --format=%ci`). First commit 2026-05-26; 48 commits total over ~3 weeks — a short, intense burst of activity, now quiet for ~3 weeks as of 2026-07-06. Latest commit is a release: `chore(release): publish v1.4.3`.

**4. Language/runtime stack**: TypeScript (typescript ^5.9.2, package.json:52) on Node.js, `"engines": { "node": ">=24" }` (package.json:55-57), ESM-only (`"type": "module"`, package.json:6). Dual-surface package: library entry `./dist/lib.js` + `bin` CLI `dist/cli.js` (package.json:11-15). NOT Bun — no bun.lock, no Bun references anywhere.

**5. Package manager**: npm. Evidence: `package-lock.json` at root (lockfileVersion 3, package-lock.json:4); CI runs `npm ci` in every job (.github/workflows/ci.yml:21 et al.); no `packageManager` field in package.json (absent — verified by reading the whole file); no bun.lock/bun.lockb, pnpm-lock.yaml, or yarn.lock present (root `ls -a`).

**6. Build system**: Custom Node build script `scripts/build.mjs` invoked by `npm run build` (package.json:27). It bundles with `@vercel/ncc` (devDependency, package.json:50): builds `src/lib.ts` -> `dist/lib.js` and `src/cli.ts` -> `dist/cli.js` (via a temp `.dist-cli` dir), strips sourceMappingURL comments (scripts/build.mjs:18-26,35-42). `dist/` is COMMITTED to git and CI enforces `git diff --exit-code -- dist` (ci.yml:155-157, publish.yml:73) — a GitHub-Action-style committed-artifact invariant. Version is single-sourced from package.json via `import pkg from "../package.json" with { type: "json" }` and ncc inlines the literal at build time (src/version.ts:1-6).

**7. Monorepo tooling, if any**: none observed. Single package; no TurboRepo, no workspaces, no nx. (release-please-config.json has a `packages` map but only ".".)

**8. TypeScript configuration patterns**: tsconfig.json: `"target": "ES2022"` (line 3), `"module": "NodeNext"` (line 4), `"moduleResolution": "NodeNext"` (line 5), `"lib": ["ES2022"]` (line 6), `"strict": true` (line 7), plus `esModuleInterop`, `resolveJsonModule`, `forceConsistentCasingInFileNames`, `skipLibCheck`, `declaration: true`, `sourceMap: true`, `rootDir: src`, `outDir: dist` (lines 8-15). Single tsconfig; no project references. Source uses explicit `.js` extensions in relative imports (NodeNext style, e.g. src/cli.ts:10-19) and JSON import attributes (`with { type: "json" }`, src/version.ts:4, src/engine/config.ts:6). No extra strictness flags beyond `strict` (no noUncheckedIndexedAccess, no exactOptionalPropertyTypes).

**9. Linting and formatting approach**: none observed. No .oxlintrc, no eslint config, no biome.json, no .prettierrc, no dprint config anywhere in the repo (root `ls -a` and file listing). No lint or format script in package.json. The only `/* eslint-disable */` is boilerplate emitted by json-schema-to-typescript in generated files (src/types/config.ts:1). This repo therefore provides NO precedent for oxc/Oxlint — that decision must come from elsewhere.

**10. Testing approach**: Vitest ^3.2.4 (package.json:53), config in vitest.config.ts: `environment: "node"`, `include: ["test/**/*.test.ts"]` (lines 4-7). Tests live in a top-level `test/` tree mirroring `src/engine/` (test/engine/*.test.ts). Distinctive patterns: (a) meta-tests that parse and assert on the repo's own CI/publish workflow YAML (test/ci-workflow.test.ts:5-51 asserts the exact CI job list and that CI does not depend on the sibling action repo; test/publish-workflow.test.ts), package metadata (test/package-metadata.test.ts), and version (test/version.test.ts); (b) public-API contract tests: a committed `.d.ts` snapshot fixture (test/fixtures/public-api.d.ts) checked by scripts/check-public-api.mjs, plus a standalone tsc compile of test/public-api-types.ts under strict NodeNext (`test:public-api`, package.json:34); (c) an end-to-end smoke of the bundled CLI in a temp dir (scripts/check-dist-cli.mjs). Aggregate gate: `npm run check` chains test + codegen-drift check + build + dist checks + pack dry-run + API snapshot (package.json:35).

**11. CI/GitHub Actions patterns**: Three workflows (.github/workflows/): ci.yml, release-please.yml, publish.yml. ci.yml triggers on `pull_request` and `push` to main (ci.yml:3-6), top-level `permissions: contents: read` (ci.yml:8-9). Twelve small jobs, one per requirement ID ("CP-LIB-001 schema" ... "CP-LIB-012 run result contract", ci.yml:12-169), each repeating checkout + setup-node + `npm ci` + a targeted `vitest run` file subset — requirement-traceable CI rather than one big test job. Actions pinned to major version tags, not SHAs: `actions/checkout@v6`, `actions/setup-node@v6` (ci.yml:16-17), `actions/create-github-app-token@v3` (release-please.yml:64); release-please-action pinned to exact `@v5.0.0` (release-please.yml:82). Caching via `setup-node` `cache: npm` (ci.yml:20). Node pinned to 24 in all jobs. Release workflow uses `concurrency: group: release-please, cancel-in-progress: false` (release-please.yml:39-41), `permissions: {}` at top with per-job escalation (release-please.yml:37,47-49), and `workflow_dispatch` as manual fallback for `[skip ci]`-suppressed pushes (release-please.yml:33-35). publish.yml verifies the tag matches package.json version before publishing (publish.yml:55-61) and retries a cross-repo `repository_dispatch` notification 3x with backoff and a printed manual-replay command (publish.yml:86-121).

**12. Release/versioning approach**: release-please (googleapis/release-please-action@v5.0.0) in manifest mode: release-please-config.json (`release-type: node`, `bump-minor-pre-major: true`, `include-v-in-tag: true`, custom `changelog-sections` mapping Conventional Commit types, PR title `chore(release): publish v${version}`) + .release-please-manifest.json. Push to main opens a release PR; merging tags `v*.*.*`, which fires publish.yml. Publishing uses npm Trusted Publishing (OIDC): `id-token: write`, GitHub environment `npm`, no NPM_TOKEN (publish.yml:8-14, README.md:126-128). Auth for the release PR is a GitHub App token minted via actions/create-github-app-token@v3 (client-id preferred, deprecated app-id fallback, then a PAT; GITHUB_TOKEN deliberately NOT used because it cannot trigger downstream workflows — release-please.yml:9-26). A `sync-dist` job rebuilds and commits dist/ + generated types onto the release PR branch, explicitly mirroring py-launch-blueprint's sync-uv-lock pattern (release-please.yml:92-170). Commit messages follow Conventional Commits throughout (git log). CHANGELOG.md is generated.

**13. Documentation approach**: Single README.md only (Install, CLI usage, Library API with code examples, an explicit Semver Contract section stating deep imports are not stable API — README.md:113-122, Release Setup documenting required secrets, GitHub Enterprise notes). CHANGELOG.md generated by release-please. No docs site, no docs/ directory, no CONTRIBUTING.md; none observed beyond README.

**14. CLI or app structure patterns**: Hand-rolled argv parsing — NO framework in use: `runCli(argv, io)` inspects `argv[0]` as subcommand (`validate`, `render`, `init`) and a `valueAfter(argv, "--flag")` helper reads flag values (src/cli.ts:32-145, 274-280). Note: `yargs` ^18 and `@types/yargs` are declared in dependencies (package.json:45,49) but never imported anywhere in src/ (grep across src/scripts/test found zero imports) — a stale/unused dependency. Patterns worth noting: CLI returns an exit code instead of calling process.exit — the entrypoint sets `process.exitCode = code` (src/cli.ts:307-311); dependency-injected `CliIo` (cwd, env, fetch, stdout, stderr, prompt) makes the whole CLI unit-testable (src/cli.ts:23-30); `isCliEntrypoint(import.meta.url, process.argv[1])` with realpath comparison distinguishes bin execution from library import so cli.ts is also importable (src/cli.ts:291-305); errors are caught at the top level, message printed to stderr, exit code 1 (src/cli.ts:141-144); `--version`/`-v` prints the single-sourced VERSION (src/cli.ts:39-42); usage line to stderr + exit 1 on unknown command (src/cli.ts:137-140); interactive prompts via node:readline/promises with a `--non-interactive` escape hatch (src/cli.ts:80-122, 198-210).

**15. Logging/configuration patterns**: No logging library — plain `console.log`/`console.error` behind injectable stdout/stderr callbacks; warnings emitted as `warning: ...` lines on stderr (src/cli.ts:33-34,69-71). Configuration: user config is a YAML file (`.contributors.yml`) parsed with `yaml`, validated against a committed JSON Schema (schemas/config.schema.json, draft 2020-12, `additionalProperties: false`) using Ajv2020 + ajv-formats (src/engine/config.ts:1-6, package.json:40-44), then normalized from snake_case file keys into a camelCase typed `ContributorsConfig` (src/engine/config.ts:37-60). TypeScript types for config/state are GENERATED from the schemas via json-schema-to-typescript (`schema:codegen` script, package.json:29) and CI fails on codegen drift (`git diff --exit-code -- src/types`, ci.yml:23-24).

**16. Reusable decisions (for the TS port)**:
- tsconfig baseline: ES2022 + NodeNext/NodeNext + strict + declaration + ESM-only `"type": "module"` with explicit `.js` import extensions (tsconfig.json:3-13, package.json:6).
- release-please manifest mode with the exact config shape (release-please-config.json), GitHub App token minting (client-id path), tag-triggered publish, npm Trusted Publishing via OIDC with GitHub environment `npm`, tag-vs-package-version verification, and the "sync generated files onto the release PR branch" job — the owner explicitly maintains this as the canonical pattern parallel to py-launch-blueprint (release-please.yml:2-3).
- Conventional Commits + custom changelog-sections mapping (release-please-config.json).
- Vitest with plain node environment and `test/**/*.test.ts` layout (vitest.config.ts).
- CLI architecture: `runCli(argv, io) -> Promise<number>`, injectable CliIo, `process.exitCode` instead of process.exit, isCliEntrypoint guard, single-sourced VERSION from package.json (src/cli.ts, src/version.ts).
- Meta-tests asserting workflow YAML and package metadata invariants (test/ci-workflow.test.ts, test/package-metadata.test.ts) — cheap regression net for CI/release plumbing.
- Public-API semver contract: root-export-only stability, `.d.ts` snapshot + strict downstream-compile test (README.md:113-122, scripts/check-public-api.mjs, package.json:33-34).
- Schema-first config: JSON Schema as source of truth, json2ts codegen with CI drift gate (package.json:29, ci.yml:22-24).
- Single `check` aggregate script chaining every gate (package.json:35).
- CI hygiene: least-privilege `permissions:` blocks, concurrency group on release, workflow_dispatch fallback.

**17. Decisions that should NOT be reused (with why)**:
- npm as package manager and Node >=24 runtime: contradicts the port's stated Bun direction; this repo simply predates/ignores Bun and offers no counter-argument, but do not cite it as pro-npm precedent for the template — it is an npm-published GitHub-Action-adjacent library where npm was the path of least resistance.
- No linter, no formatter, no git hooks (no lefthook/husky/pre-commit — none observed), no Justfile/Makefile, no CLAUDE.md/.vscode/.cursor: absence, not a decision to copy; the template should add oxc/Oxlint + hooks from other sources.
- Committed `dist/` with `git diff --exit-code -- dist` gates and the sync-dist release job: right for a repo consumed at-ref by a sibling GitHub Action, wrong default for a normal npm library/CLI template (noisy diffs, race-condition workarounds already visible in ci.yml:150-157 and commit c095cc4 "stop release-PR dist gate race-fail").
- @vercel/ncc single-file bundling with post-hoc sourcemap-comment stripping and the lib/cli rename dance (scripts/build.mjs): bespoke; a template should prefer tsc/tsdown/bun build.
- Twelve near-identical CI jobs each doing full `npm ci` + targeted test files: requirement-traceability tactic for this project's spec IDs; wasteful as a template default (12x install).
- Unused `yargs` + `@types/yargs` in dependencies (package.json:45,49, zero imports): dependency hygiene bug, not a decision; also means this repo gives no working precedent for an arg-parsing library.
- Hand-rolled flag parsing (`valueAfter`) has no `--flag=value` support and silently returns undefined for missing values (src/cli.ts:274-280) — fine at this size, not a pattern to standardize.

**18. Open questions**:
- Was yargs intended for a planned CLI upgrade or is it leftover? (Declared dep, never imported.)
- Is the absence of lint/format tooling deliberate for this repo or an accepted gap? No commit ever adds/removes a linter (git log has no lint-related commits), so no evidence either way.
- The release-please workflow references "smorinlabs/py-launch-blueprint's RELEASE.md" (release-please.yml:25-26) for App setup — that doc is the fuller decision record for the release auth pattern and should be pulled from that repo.
- Sibling repo smorinlabs/contributors-please-action is referenced throughout (publish.yml:44, release-please.yml:102-103) and applies "the same pattern without the schema:codegen step" — worth inspecting if the port needs the GitHub-Action packaging flavor.
- Node `>=24` engines: whether this reflects a real language-feature need (JSON import attributes work from Node 20.10+) or just "latest LTS at creation" is not documented anywhere.


## Repo: smorinlabs/contributors-please-action

**1. Repo name**: smorinlabs/contributors-please-action (local clone at `scratchpad/repo-clones/contributors-please-action`).

**2. Why it is relevant**: The owner's most recent TypeScript project (June 2026). It is a TypeScript GitHub Action wrapper around the `contributors-please` npm engine (`package.json:5`, `README.md:1-6`), so it records the owner's current decisions for TS strictness, ESM, testing (Vitest), release automation (release-please + GitHub App tokens), CI hygiene, and GitHub Action packaging — all directly transferable to a TS template port.

**3. Recency**: Last commit 2026-06-17 13:19:33 -0700 (`git log -1 --format=%ci`). 50 commits total, all between 2026-05-28 and 2026-06-17 (`git log --format=%ci | tail -1`, `git rev-list --count HEAD`) — a dense ~3-week burst; the repo is young but very recently and deliberately built.

**4. Language/runtime stack**: TypeScript 5.9 on Node.js >= 24, pure ESM. `package.json:7` `"type": "module"`, `package.json:29` `"typescript": "^5.9.2"`, `package.json:33-35` `"engines": { "node": ">=24" }`. The Action itself declares `runs.using: node24` (`action.yml:174-176`). Ops scripts are plain-Node `.mjs` files in `scripts/` (11 files, e.g. `scripts/check-engine-sync.mjs`). No Bun anywhere in this repo.

**5. Package manager**: npm. Evidence: `package-lock.json` is the only lockfile present (65 KB, repo root listing; no bun.lock/bun.lockb, pnpm-lock.yaml, or yarn.lock). No `packageManager` field in `package.json` (absent from `package.json:1-36`). CI runs `npm ci` and `actions/setup-node` with `cache: npm` (`.github/workflows/ci.yml:20,28`).

**6. Build system**: `@vercel/ncc` single-file bundling for GitHub Action distribution, with the bundle **committed** to `dist/` and CI enforcing reproducibility. `package.json:11` — `"build": "rm -rf dist && ncc build src/index.ts -o dist && node scripts/copy-library.mjs && node scripts/normalize-dist.mjs"`. `scripts/copy-library.mjs` copies the sibling engine's `dist/lib.js` into `dist/contributors-please-lib.js`; `scripts/normalize-dist.mjs` fails the build if ncc accidentally inlined the engine library (checks for `CONCATENATED MODULE:` markers). CI/release both end with `git diff --exit-code -- dist` (`.github/workflows/ci.yml:32`, `.github/workflows/release.yml:39`). `dist/package.json` contains only `{"type": "module"}` so the bundle runs as ESM. tsconfig has `"noEmit": true` (`tsconfig.json:11`) — tsc is type-check-only; ncc does the compile. Composite gate: `"check": "npm test && npm run build && npm run check:sync:local && git diff --exit-code -- dist"` (`package.json:13`). No Justfile or Makefile (root listing).

**7. Monorepo tooling, if any**: None observed — single package, no workspaces, no TurboRepo/Nx. It is however one node of a hand-rolled **three-repo system** (engine → action → test harness, `skills/README.md:3-6`) wired together via a tracked engine ref file (`.contributors-please-engine-ref` containing `v1.4.3`), a `file:../contributors-please` dependency (`package.json:23`), and cross-repo `repository_dispatch` (`.github/workflows/engine-sync.yml:9-11`, `sync-engine-release.yml:4-6`).

**8. TypeScript configuration patterns**: `tsconfig.json` (whole file, lines 1-14): `"target": "ES2022"` (line 3), `"module": "NodeNext"` + `"moduleResolution": "NodeNext"` (lines 4-5), `"lib": ["ES2022"]` (line 6), `"strict": true` (line 7), `"esModuleInterop": true` (line 8), `"forceConsistentCasingInFileNames": true` (line 9), `"skipLibCheck": true` (line 10), `"noEmit": true` (line 11), `include: ["src/**/*.ts"]` (line 13). Source imports use explicit `.js` extensions per NodeNext (`src/index.ts:17` `from "./app-token.js"`). Minimal but modern-strict; no extra strictness flags (no `noUncheckedIndexedAccess`, no `verbatimModuleSyntax`).

**9. Linting and formatting approach**: None observed for code style — no ESLint, Prettier, Biome, Oxlint, or dprint config anywhere (ls/grep of repo root and `.github/` found none), and no lint script in `package.json:9-18`. The only "lint" present is **actionlint** configuration for workflows (`.github/actionlint.yaml`, declaring the `contributors-please-ghe` self-hosted runner label). Formatting is by-convention (2-space, double quotes) with no enforcement. This is a gap in this repo, not a decision to copy.

**10. Testing approach**: Vitest 3 (`package.json:30` `"vitest": "^3.2.4"`), node environment, tests under `test/**/*.test.ts` (`vitest.config.ts:4-7`), run via `vitest run` (`package.json:12`). 21 test files covering unusual surfaces: (a) unit tests of the action with a hand-rolled dependency-injected fake `core` (`test/index.test.ts:8-40` builds `fakeCore` capturing outputs/failures/secrets); (b) **workflow-as-code tests** that parse the actual `.github/workflows/*.yml` with the `yaml` package and assert step ordering/pinning (`test/ci-workflow.test.ts:5-30`, plus release-workflow, release-please-workflow, e2e-workflow, engine-sync tests); (c) a **dist smoke test** that executes the committed bundle with `node dist/index.js` and checks it reaches input validation (`test/dist-entrypoint.test.ts:8-20`); (d) tests for every ops script (`test/setup-engine-dep.test.ts`, etc.). No coverage thresholds observed in `vitest.config.ts`.

**11. CI/GitHub Actions patterns**: Seven workflows. `ci.yml`: triggers `pull_request` + `push: branches [main]` (lines 3-6), top-level `permissions: contents: read` (lines 8-9), single job: checkout → setup-node@v6 (node 24, `cache: npm`) → materialize engine dep via script → `npm ci` → sync check → test → build → `git diff --exit-code -- dist` (lines 15-32). Pinning style: official actions pinned to **major tags** (`actions/checkout@v6` x10, `actions/setup-node@v6` x6, `actions/create-github-app-token@v3` x7); third-party pinned to **exact version** (`googleapis/release-please-action@v5.0.0`, `release-please.yml:75`) — no SHA pinning. Least-privilege permissions: `permissions: {}` at workflow level with job-level elevation (`release-please.yml:30,40-42`). `concurrency` groups with `cancel-in-progress: false` for release flows (`release-please.yml:32-34`) and `cancel-in-progress: true` for downstream E2E (`downstream-e2e.yml:34-37`). Scheduled crons for drift detection (`engine-sync.yml:8` daily `23 9 * * *`; `e2e.yml:14` nightly `17 8 * * *`). `workflow_run` chaining (Downstream E2E runs after CI completes on main, `downstream-e2e.yml:5-12`). Extensive explanatory comments inside workflow YAML (`release-please.yml:1-22`).

**12. Release/versioning approach**: release-please v5 in manifest mode + conventional commits + tag-triggered verify/publish. `release-please-config.json`: `release-type: node`, `include-v-in-tag`, `bump-minor-pre-major`, custom `changelog-sections` mapping feat/fix/perf/refactor/docs/ci/test (chore hidden) (lines 3-24); `.release-please-manifest.json` tracks `{".": "1.3.9"}`. `release-please.yml` runs on push to main and mints a **GitHub App installation token** (client-id preferred, deprecated app-id fallback, PAT last resort — explicitly avoiding GITHUB_TOKEN because it can't trigger downstream workflows, lines 6-22, 54-81); a `sync-dist` job rebuilds and commits `dist/` back onto the release PR branch so the reproducibility gate can't fail it (lines 85-168). `release.yml` fires on `v*.*.*` tags: verifies tag == package.json version (lines 27-33), re-runs test/build/dist-diff, then force-moves the **floating major tag** (`v1`) for Action consumers, skipping prereleases (lines 41-52). Comments reference `smorinlabs/py-launch-blueprint`'s RELEASE.md as the canonical App-setup doc (`release-please.yml:21,80`).

**13. Documentation approach**: `README.md` is usage-first (full copy-paste workflow YAML, `README.md:8-40`). `docs/RUNBOOK.md` is an operational acceptance runbook (prerequisites, secrets inventory, cutover procedure). CHANGELOG.md is release-please-generated. `skills/` ships three **Claude Code skills** (`install-contributors-please-action`, `monitor-multi-repo-ci`, `update-multi-repo-ci`) with a README explaining composition and a curl-based install recipe (`skills/README.md:8-31`) — docs-as-agent-skills is a distinctive pattern here. Three long design/analysis markdown docs sit at repo root (`contributors-please-action-resilience-analysis.md` etc.). No docs site generator, no CLAUDE.md, no .vscode/.cursor (ls grep found none).

**14. CLI or app structure patterns**: Not a CLI — a GitHub Action. Entry contract is `action.yml` (32 typed inputs with defaults and detailed descriptions, 11 declared outputs, `action.yml:8-172`). Arg parsing is `@actions/core` `getInput`/`getBooleanInput`; a deliberate convention: inputs default to `''` so unset inputs **inherit from config file / core defaults** instead of clobbering them (`action.yml:41-45,62-67`). Failure = `core.setFailed(message)` and return (no raw exit codes) (`src/index.ts:114,183`). Outputs set via `core.setOutput`, JSON-encoding arrays (`src/index.ts:500-510`). Structure: thin `src/` (index.ts 660 lines + app-token.ts + proxy.ts) delegating to the engine library, loaded at runtime via a `new Function("specifier", "return import(specifier)")` dynamic import so ncc can't inline it (`src/index.ts:28-38`). Testability via an options object injecting `core`, `env`, `fetch`, and factory functions (`src/index.ts:51-60`).

**15. Logging/configuration patterns**: Logging is `@actions/core` levels only — `core.info`, `core.warning` (engine warnings forwarded one per line, `src/index.ts:170-171`), `core.setFailed`; dry-run paths log with a `[dry-run]` prefix (`src/index.ts:558`). Secrets are masked immediately with `core.setSecret(credentials.token)` (`src/index.ts:117`). Configuration is layered: action inputs → env (`GITHUB_REPOSITORY`, `GITHUB_SERVER_URL` fallbacks, `src/index.ts:94-104`) → repo config file (`.contributors.yml`, `action.yml:72-75`) → engine defaults. Proxy support honors standard env via a fetch wrapper (`src/proxy.ts`, wired at `src/index.ts:91`). Version pinning of the sibling engine lives in a plain-text ref file `.contributors-please-engine-ref` guarded by `scripts/check-engine-sync.mjs` in four modes (local/trusted/release, `package.json:14-17`).

**16. Reusable decisions (for the TS port)**:
- tsconfig baseline: ES2022 / NodeNext / NodeNext / strict / esModuleInterop / skipLibCheck / forceConsistentCasingInFileNames, `noEmit` when a bundler owns emit (`tsconfig.json:3-11`), plus pure ESM (`package.json:7`) with explicit `.js` import extensions.
- Node >= 24 as the engine floor (`package.json:34`) and `node24` action runtime (`action.yml:175`).
- Vitest as the test runner with node environment and `test/**/*.test.ts` layout (`vitest.config.ts`), including the meta-testing patterns: workflow-YAML assertion tests (`test/ci-workflow.test.ts`) and built-artifact smoke tests (`test/dist-entrypoint.test.ts`).
- release-please v5 manifest mode + conventional commits + custom changelog sections + tag-verify release workflow + floating major tag maintenance (`release-please-config.json`, `release.yml:27-52`) — and the GitHub App token pattern (client-id) so release PRs trigger CI (`release-please.yml:6-22`).
- CI hygiene: least-privilege `permissions`, major-tag pinning for official actions / exact pin for third-party, concurrency groups, scheduled drift checks, `actionlint` config, composite `check` npm script mirroring CI locally (`package.json:13`).
- For any GitHub Action packaging in the template: ncc bundle to committed `dist/` + `git diff --exit-code -- dist` reproducibility gate + sync-dist job on release PRs (`package.json:11`, `ci.yml:32`, `release-please.yml:85-168`).
- Docs patterns: usage-first README with paste-ready workflow, ops RUNBOOK, and shipping Claude Code skills in-repo (`skills/README.md`).
- Injectable-dependencies design for testable entry points (`src/index.ts:51-60`).

**17. Decisions that should NOT be reused (with why)**:
- npm + package-lock.json (`package-lock.json`, `ci.yml:20,28`): predates/conflicts with the blueprint's Bun direction; nothing here argues npm was chosen over Bun for template-worthy reasons (GitHub Actions node runtime constraints made npm the path of least resistance).
- No linter/formatter at all (section 9): a gap, not a standard — the port should add oxc/Oxlint+formatter rather than copy this absence.
- pre-commit (Python tool) with a single local hook (`.pre-commit-config.yaml:1-10`): used only for the domain-specific engine-sync check; not an endorsement over lefthook, and the hook itself is not portable.
- `file:../contributors-please` sibling dependency and the whole engine-ref/sync machinery (`package.json:23`, `.contributors-please-engine-ref`, `scripts/check-engine-sync.mjs`, `engine-sync.yml`, `sync-engine-release.yml`): bespoke three-repo plumbing, not template material.
- Committing analysis/plan markdown at repo root (`contributors-please-action-resilience-*.md`): working artifacts, not a docs convention.
- No `packageManager` field and no SHA-pinned actions: weaker supply-chain hygiene than a template should prescribe.

**18. Open questions**:
- Whether the npm choice was forced by the GitHub Actions toolchain (ncc, setup-node cache) or simply predates the owner's Bun adoption — this repo contains no Bun evidence either way.
- Where the linting/formatting standard actually lives — comments point to `smorinlabs/py-launch-blueprint` as the canonical release/App-setup reference (`release-please.yml:21`), so cross-check that repo (and any newer TS repos) for the intended lint stack.
- Whether the workflow-YAML assertion tests (`test/ci-workflow.test.ts` et al.) are a one-off resilience response (see root analysis docs) or a standing standard the owner wants in every repo.
- Whether major-tag pinning (vs SHA pinning) of actions is a deliberate policy or default habit.

## Repo: smorinlabs/difftree-action

**1. Repo name**: smorinlabs/difftree-action — "A GitHub Action that posts an ASCII diff-tree of a pull request's changes as a single, self-updating PR comment", a thin wrapper over the `difftree` Rust CLI's `--pr` mode (README.md:6-10).

**2. Why it is relevant**: Most recently pushed JavaScript repo by this owner (pushed 2026-07-06). It shows the owner's current conventions for GitHub Actions, CI hygiene, release automation (release-please + moving major tag), sticky-PR-comment patterns, and testing style for small Node code — and its planning docs (GOAL.md/PRD.md/PLAN.md) record explicit forward-looking tooling decisions for a TypeScript "Phase 1" rewrite.

**3. Recency**: Last commit 2026-07-06 16:29:31 -0700 (`git log -1 --format=%ci`). 22 commits total spanning 2026-06-27 to 2026-07-06 (`git log --format=%ci | wc -l`; first commit 2026-06-27 09:45:10 -0700). Highly active: v0.1.0 shipped ~June 29, v0.2.0 released 2026-07-06 (CHANGELOG.md:3), release-please adopted and hardened in the final week's commits.

**4. Language/runtime stack**: Phase 0 (current, shipped) is a **composite GitHub Action** (`runs: using: composite`, action.yml:60): orchestration in bash steps inside action.yml, plus two zero-dependency CommonJS Node scripts (`"use strict"` + `module.exports`, scripts/comment.js:1,125; scripts/files-changed.js:1,17) executed via `node` and `actions/github-script@v7` (action.yml:146,173). CI and release run on Node 20 (`node-version: "20"`, .github/workflows/ci.yml:19, release.yml:26). The Rust `difftree` binary is installed at action time via `cargo install` and cached (action.yml:71-85). **No TypeScript exists yet**; Phase 1 is planned as a node24 TypeScript action (GOAL.md:38-39, PLAN.md:16).

**5. Package manager**: **None observed** — there is no package.json and no lockfile of any kind (bun.lock/bun.lockb, package-lock.json, pnpm-lock.yaml, yarn.lock all absent; verified with a full file listing). The scripts use only Node built-ins (`node:test`, `node:assert/strict`, `fs`, `path`). For Phase 1 the planning docs prescribe **npm**: "`npm ci && npm run build` yields a byte-identical `dist/`" (GOAL.md:98-99), "CI runs `npm ci && npm test && npm run build && git diff --exit-code -- dist`" (PLAN.md:283-284). No packageManager field exists anywhere (no package.json).

**6. Build system**: None for Phase 0 (no build step; scripts run as-is). Planned Phase 1: **@vercel/ncc bundling to a committed, byte-reproducible `dist/index.js`** with a CI drift gate ("ncc for the committed bundle", PLAN.md:21; "ncc `build` + committed `dist/` + `git diff --exit-code -- dist`", PLAN.md:76; GOAL.md:157).

**7. Monorepo tooling, if any**: none observed. Single-package repo; no TurboRepo/Nx/workspaces.

**8. TypeScript configuration patterns**: none observed — no tsconfig*.json exists. Planned Phase 1 artifacts are listed as "`package.json`, `tsconfig.json`, `vitest.config.ts`" (PLAN.md:96, PLAN.md:224) with entrypoint `src/index.ts` and `using: node24, main: dist/index.js` (PRD.md:293-295), but no strictness/module/target/moduleResolution settings are recorded anywhere.

**9. Linting and formatting approach**: No JS linter or formatter configs (no .oxlintrc, eslint, biome, prettier, dprint files). Linting is **workflow-focused**: `raven-actions/actionlint@v2` lints workflow/action YAML (ci.yml:24-25), and a custom CI step extracts each embedded `shell: bash` step from action.yml with `yq`, neutralizes `${{ }}` expressions with sed, and runs `shellcheck -S warning` over it (ci.yml:27-44). Commit messages follow Conventional Commits (enforced socially + consumed by release-please; e.g. `feat:`, `fix:`, `ci:`, `docs:` throughout `git log`).

**10. Testing approach**: **Node's built-in test runner with zero dependencies**: `node --test` in CI (ci.yml:22) and in the release gate (release.yml:46); tests use `require("node:test")` + `node:assert/strict` (test/comment.test.js:3-4). Pure functions are unit-tested directly; the GitHub API side is tested by **injecting a hand-rolled fake github-script client** (`fakeGithub()` with call-recording, test/comment.test.js:96-124) rather than a mocking library. CI adds an **end-to-end smoke job** that runs the action against its own PR with `comment: false` and asserts real outputs (`test "${FILES:-0}" -gt 0`, ci.yml:46-71), plus a dogfood workflow that runs the action on the repo's own PRs (difftree.yml:1-28). Manual acceptance is codified in docs/RUNBOOK.md. Phase 1 plans **vitest** for unit/integration (GOAL.md:170-171, PLAN.md:21).

**11. CI/GitHub Actions patterns**: Triggers: `pull_request` + `push: branches: [main]` for CI (ci.yml:3-6); `push: branches: [main]` for release-please (release-please.yml:9-11); `push: tags: v*.*.*` for release verify (release.yml:9-12). **Least-privilege permissions everywhere**: top-level `permissions: contents: read` (ci.yml:8-9), `permissions: {}` deny-all at workflow level with per-job grants (release-please.yml:15, release.yml:14). **Pinning style**: major-version tags for well-known actions (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/cache@v4`, `actions/github-script@v7`, `googleapis/release-please-action@v5`), and **full SHA pin with a version comment for the security-sensitive token minting action**: `actions/create-github-app-token@bcd2ba49...  # v3.2.0` (release-please.yml:40). **Caching**: `actions/cache@v4` keyed on `runner.os`-`runner.arch`-version for the compiled binary (action.yml:68-74). **Concurrency**: per-PR group with `cancel-in-progress: true` for the comment-posting workflow (difftree.yml:11-13) and per-ref group with `cancel-in-progress: false` for release-please with an explanatory comment (release-please.yml:17-23). Job dependency chaining (`needs: lint-and-test`, ci.yml:50). Heavily commented workflows explaining *why* (e.g. the GITHUB_TOKEN anti-loop rationale, release-please.yml:31-39).

**12. Release/versioning approach**: **release-please v5 in manifest mode** with `release-type: simple` (release-please-config.json:3, .release-please-manifest.json), Conventional-Commit-driven Release PRs titled `chore(release): publish v${version}` (release-please-config.json:4), custom changelog-sections including normally-hidden types (ci, test, refactor visible; chore hidden — release-please-config.json:15-24). Auth via a **GitHub App installation token** (not GITHUB_TOKEN) so the pushed tag can trigger downstream workflows, with shared App secrets `RELEASE_PLEASE_CLIENT_ID`/`RELEASE_PLEASE_PRIVATE_KEY` reused across smorinlabs repos (release-please.yml:31-44). The tag-triggered release.yml then: verifies the tag against `.release-please-manifest.json` (chosen over version.txt after empirical verification — release.yml:28-43), re-runs tests, and **force-moves a floating major tag** (`v0`/`v1`) to the release commit, skipping prereleases (release.yml:48-59). Versioning is SemVer with `bump-minor-pre-major: true` (release-please-config.json:10).

**13. Documentation approach**: README with badges, copy-pasteable usage YAML, Inputs/Outputs markdown tables, "How it works", and an explicit failure-mode section (fork PRs) (README.md). A **planning-doc suite**: PROMPT.md (entry-point ask) → GOAL.md (working-backwards goal, acceptance matrix, deliverables D1-D8) → PRD.md (requirements) → PLAN.md (task-level implementation plan with checkboxes), cross-referencing each other (PROMPT.md:3-5). docs/RUNBOOK.md is a manual acceptance runbook tied to GOAL/PRD sections. CHANGELOG.md is release-please-generated. `.claude/settings.json` carries a `companyAnnouncements` welcome string describing the project and relevant slash commands (.claude/settings.json:2-4).

**14. CLI or app structure patterns**: Not a CLI; a composite action. Notable structural conventions: (a) **pure-logic/I-O split** — testable pure helpers (`composeBody`, `truncateTree`, `pickExisting`) separated from the I/O function (`upsertComment`) which takes an injected client (scripts/comment.js:3-8); (b) **dual module/CLI files** via `if (require.main === module)` reading stdin (scripts/files-changed.js:20-27); (c) fail-fast bash with `set -euo pipefail` and `exit 1` plus actionable stderr messages prefixed `difftree-action:` (action.yml:98,103-105,134); (d) "unknown is not zero" sentinel convention — parse failures return null/empty, never 0 (scripts/files-changed.js:4-6, action.yml:148-154); (e) multiline `GITHUB_OUTPUT` written with a random heredoc delimiter to prevent output injection (action.yml:156-168); (f) sticky comment with hidden HTML marker and strict leading-line ownership matching so user comments quoting the marker are never deleted (scripts/comment.js:9,56-62); (g) graceful degradation — 403 on fork PRs warns instead of failing (action.yml:206-211). No arg-parsing library (none observed; none needed).

**15. Logging/configuration patterns**: In github-script: `core.info` / `core.warning` / `core.setOutput` (action.yml:204-208). In bash: `::error::` workflow annotations (release.yml:35,40), plain echo to stderr with a `difftree-action:` prefix (action.yml:103,134-135), and a human-readable job summary appended to `$GITHUB_STEP_SUMMARY` (action.yml:214-228). Configuration is exclusively via declared action inputs with defaults in action.yml (action.yml:10-46); no env-var config, no config files, no logging library.

**16. Reusable decisions (for the TS port)**:
- **release-please v5 (manifest mode) + Conventional Commits + moving major tag + GitHub App token for tag pushes** — a complete, hardened release pipeline including the tag-vs-manifest verification gate (release-please.yml, release.yml, release-please-config.json).
- **Least-privilege CI**: `permissions: {}`/`contents: read` at top level, per-job grants; SHA-pin security-sensitive actions with a version comment (release-please.yml:15,40).
- **Deliberate concurrency policy per workflow**, with cancel-in-progress chosen (and documented) per semantics (difftree.yml:11-13 vs release-please.yml:17-23).
- **actionlint + shellcheck of embedded action bash** as a CI lint layer for any repo shipping GitHub Actions (ci.yml:24-44).
- **Layered testing**: pure-function unit tests with injected fakes + a real end-to-end smoke job in CI + a dogfood workflow + a written acceptance runbook (ci.yml:46-71, docs/RUNBOOK.md).
- **Pure/IO code split and "unknown ≠ zero" error semantics** (scripts/comment.js:3-8, scripts/files-changed.js:4-6).
- **Docs suite pattern** (PROMPT→GOAL→PRD→PLAN + RUNBOOK) and the `.claude/settings.json` companyAnnouncements welcome string.
- **README conventions**: usage snippet first, Inputs/Outputs tables, explicit failure modes.

**17. Decisions that should NOT be reused (with why)**:
- **npm + ncc + vitest (the Phase 1 plan)**: this is a *planned*, not-yet-implemented stack chosen explicitly to "model the repo's structure and conventions on smorinlabs/contributors-please-action" (PROMPT.md:15-16), i.e. mirroring an older sibling repo — not a fresh evaluation. It conflicts with the blueprint's stated Bun/oxc direction; the committed-`dist/` ncc requirement is specific to the GitHub Actions node runtime (which must run a checked-in bundle) and does not generalize to a library/CLI template.
- **Zero-dependency no-package.json layout**: appropriate for a tiny composite action, not for a full TS project template.
- **Composite-action bash orchestration** (action.yml): action-specific architecture.
- **Node 20 in CI** (ci.yml:19) while the repo's own plan targets node24 (GOAL.md:38) — internally transitional, don't copy either as a considered runtime decision.
- **Git hooks**: none observed (no lefthook.yml, .husky, .pre-commit-config.yaml) — absence of evidence, not a decision against hooks.
- **JS lint/format**: none observed for the JS files themselves — do not read this as "no linter preferred"; the repo simply has ~160 lines of JS.

**18. Open questions**:
- Is the Phase 1 npm/ncc/vitest choice a standing owner preference or purely inherited from contributors-please-action (worth checking that repo — it is named as the structural template, PLAN.md:52-54)?
- No TS config exists yet; what strictness/module settings does the owner actually use in shipped TS (needs a repo that has tsconfig.json)?
- Are the release-please GitHub App secrets (`RELEASE_PLEASE_CLIENT_ID`/`RELEASE_PLEASE_PRIVATE_KEY`, release-please.yml:36-37) an org-wide standard the TS blueprint should assume?
- The `.claude/settings.json` announcement references external slash commands (/code-review, /ci-audit, /version-check) — where /ci-audit and /version-check live was not determinable from this repo.


## Repo: smorin/claim-npm

**1. Repo name**: smorin/claim-npm (local clone: `/private/tmp/claude-501/-Users-stevemorin-c-ts-launch-blueprint/6c035215-02f1-45fe-af93-2b43ccb31eef/scratchpad/repo-clones/claim-npm`). Package name `claim-npm` (`package.json:2`).

**2. Why it is relevant**: A recent (May-June 2026), complete TypeScript CLI published to npm — "Check npm package name availability and reserve names by publishing a placeholder" (`package.json:4`). It is the closest prior art for the TS port's CLI conventions: arg parsing, command routing, exit-code contract, output/color conventions, dependency-injection testability, and a spec-first + superpowers-plan workflow (`claim-npm-spec.md`, `docs/superpowers/`).

**3. Recency**: Last commit 2026-06-07 19:50:24 -1000 (`git log -1 --format=%ci`). 30 commits total, all between 2026-05-25 and 2026-06-07 (`git log --format=%ci`) — a short, intense burst; project reached "done" state (spec §15: "No open questions — ready for implementation", then implemented). Latest work merged via PR #1 (`feat/scoped-reserve`).

**4. Language/runtime stack**: TypeScript (`typescript ^5.4.0`, `package.json:32`) compiled to JS with `tsc`, ESM (`"type": "module"`, `package.json:5`), targeting Node >=18 (`engines.node ">=18"`, `package.json:13`). Spec says "Bun fine for local dev" but the shipped runtime is Node (`claim-npm-spec.md` §12: "Authored in TypeScript, compiled to JS... Targets Node 18+. (Bun fine for local dev.)"). Deliberately near-zero dependencies: one runtime dep, `validate-npm-package-name ^5.0.1` (`package.json:26`; spec §12 "Dependency target: **one** runtime dependency").

**5. Package manager**: npm — `package-lock.json` is the only lockfile present (repo root listing; no bun.lock/bun.lockb, pnpm-lock.yaml, or yarn.lock). No `packageManager` field in `package.json` (absent from `package.json:1-36`). README installs with `npm install` (`README.md:88`).

**6. Build system**: Plain `tsc` — `"build": "tsc"` (`package.json:16`), output to `./dist` (`tsconfig.json:7`), `bin` points at `./dist/cli.js` (`package.json:6-8`), `files: ["dist"]` (`package.json:9-11`), `prepublishOnly: npm run build` (`package.json:23`). No bundler, no esbuild/tsup/Bun build. No Justfile or Makefile (root listing).

**7. Monorepo tooling, if any**: none observed. Single package, no workspaces, no TurboRepo/Nx.

**8. TypeScript configuration patterns**: Strict ESM, NodeNext-era-but-bundler-resolution config (`tsconfig.json`): `target: "ES2022"` (line 3), `module: "ES2022"` (line 4), `moduleResolution: "bundler"` (line 5), `strict: true` (line 9), plus extra-strict flags `noUncheckedIndexedAccess: true` (line 17), `noImplicitOverride: true` (line 18), `noFallthroughCasesInSwitch: true` (line 19); `declaration: true`, `sourceMap: true` (lines 13-14); `allowImportingTsExtensions: false` (line 16) — source imports use explicit `.js` extensions (e.g. `src/cli.ts:2` `from './router.js'`). Tests are excluded from the compiled build (`tsconfig.json:22`) but typechecked implicitly by vitest only. Separate `typecheck` script: `tsc --noEmit` (`package.json:22`).

**9. Linting and formatting approach**: none observed — no .oxlintrc, eslint, biome, prettier, or dprint config anywhere in the repo (root listing; only configs present are `tsconfig.json` and `vitest.config.ts`). Formatting is by convention only.

**10. Testing approach**: Vitest 1.x (`vitest ^1.6.0`, `package.json:33`) with v8 coverage (`@vitest/coverage-v8`, `package.json:31`). Heavy unit coverage: 30 unit test files in `tests/` mirroring `src/` modules one-to-one, plus an `tests/integration/` directory that spawns the built CLI as a real subprocess (`tests/integration/helpers.ts:22` `spawn('node', [CLI_PATH, ...args])`) against an in-process mock npm registry HTTP server (`tests/integration/cli.integration.test.ts:18-23` `startMockRegistry(...)`, registry URL injected via `CLAIM_NPM_REGISTRY_URL` env var, line 13). Vitest config (`vitest.config.ts`): `globalSetup: ['tests/integration/build-setup.ts']` rebuilds `dist/` only when sources are newer (staleness check, `tests/integration/build-setup.ts:12-18`); strict coverage thresholds — lines 95 / functions 95 / branches 90 / statements 95 (`vitest.config.ts:19-24`) with thin I/O adapters (`src/cli.ts`, `src/exec-adapter.ts`, `src/prompt-adapter.ts`, `src/npmrc.ts`) explicitly excluded from coverage (`vitest.config.ts:11-16`). Script split: `test:unit` excludes `tests/integration/**`, `test:integration` runs only it (`package.json:18-19`).

**11. CI/GitHub Actions patterns**: none observed — no `.github/` directory exists (`ls -a .github` returns nothing). Work landed via a GitHub PR (merge commit 81cf252 "Merge pull request #1"), but with no CI workflows.

**12. Release/versioning approach**: Manual npm publish. Version `0.1.0` in `package.json:3`; `prepublishOnly` builds (`package.json:23`); no changesets, release-please, semantic-release, cog.toml, or tags observed (no config files; `git log` shows no release commits). Spec §12: "published publicly to npm; runnable via `npx claim-npm`... Source lives in a private GitHub repo."

**13. Documentation approach**: (a) A single, extensive PRD-style spec at repo root, `claim-npm-spec.md` (20.9 KB, "PRD: claim-npm... Draft v0.5", includes goals/non-goals, user flows, FR list, technical design §12, edge cases §13, milestones §14, and a decision log §15). (b) A long tutorial-style `README.md` (30.6 KB) with a Table of Contents, three install options (npx / global / local clone), an uninstall table, and a first-run walkthrough (`README.md:11-151`). (c) Feature-level design docs under `docs/superpowers/specs/` and implementation plans under `docs/superpowers/plans/`, dated and status-tagged (`docs/superpowers/specs/2026-06-07-scoped-reserve-design.md:1-5` "Status: Approved (design)"; the plan file instructs agents to use `superpowers:subagent-driven-development` or `superpowers:executing-plans`, `docs/superpowers/plans/2026-06-07-scoped-reserve.md:3`). No docs site generator. No CLAUDE.md, .claude/, .vscode, or .cursor in the repo (root listing).

**14. CLI or app structure patterns**: This repo IS the CLI-standards decision record for a small TS CLI:
- **Arg parsing**: Node native `node:util` `parseArgs` — explicitly "no commander/yargs dependency" (spec §12; `src/router.ts:1`).
- **Entry/router split**: `src/cli.ts` is a thin shebang entry (`#!/usr/bin/env node`, `src/cli.ts:1`) that wires real I/O and calls `runCli(argv, deps)`; all routing/logic lives in `src/router.ts` behind an injected `CliDeps` interface (stdout/stderr writers, stdin, fetchImpl, execFile, prompt, processEnv, version, colorEnabled, registerCleanup — `src/router.ts:41-55`). `runCli` returns a numeric exit code; the entry sets `process.exitCode = code` (`src/cli.ts:43-58`).
- **Exit-code contract** (spec §7.5/§FR, `claim-npm-spec.md:191`): `0` success/available · `1` name taken (domain negative) · `2` invalid input/usage error · `3` auth/readiness failure · `4` network/registry error; `130` on SIGINT/SIGTERM after cleanup (`src/cli.ts:30-41`).
- **Commands**: `check`, `reserve`, `doctor`, `init` (+ `init --interactive`), `guide/help`; one module per command in `src/` (src listing). No-args and `--help` print a getting-started guide and exit 0 (`src/router.ts:63-67`; spec FR12). Per-command `--help` via a shared `help.ts` (`src/router.ts:14-18,76-78`). Unknown command gets a "did you mean" suggestion (`src/did-you-mean.ts`, imported `src/router.ts:19`).
- **Output conventions**: human text by default, `--json` flag for machine output (`src/router.ts:125,135`); ✔/✖/⚠ glyph prefixes; readiness banner on the guide (`src/router.ts:30-39`).
- **Color**: hand-rolled 10-line ANSI module (`src/colors.ts`) — no chalk; enabled only when TTY and `NO_COLOR` unset (`src/colors.ts:11-15`, wired in `src/cli.ts:25-28`).
- **Version**: `--version`/`-v` reads version from packaged `package.json` with a `0.0.0` fallback (`src/cli.ts:10-20`, `src/router.ts:68-70`).
- **Errors**: typed error classes (`UsageError` in `src/errors.ts:1-6`, `RegistryError` in `src/registry.ts`) mapped to exit codes in the router.
- **External processes**: shell out to `npm` via an injected `execFile` adapter (`src/exec-adapter.ts`; spec §12 publishing via `node:child_process`).

**15. Logging/configuration patterns**: No logging library — output goes through injected `stdout`/`stderr` writer functions (`src/router.ts:42-43,57-59`). Configuration: env vars (`NPM_TOKEN`, `NO_COLOR`, test-only `CLAIM_NPM_REGISTRY_URL` — `tests/integration/cli.integration.test.ts:13`), the user's `~/.npmrc` (read-only, `src/npmrc.ts`), and a single JSON config file at `~/.config/claim-npm/config.json` holding only a 1Password `op://` reference, never the token itself (spec §15 decision log; `src/op-config.ts`). Credential cascade order: env → npmrc → 1Password (spec §15).

**16. Reusable decisions (for the TS port)**:
- Strict tsconfig baseline beyond `strict: true`: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, ES2022 target/module, declarations + sourcemaps (`tsconfig.json:3-19`).
- ESM-first with explicit `.js` import extensions and `"type": "module"` (`package.json:5`, `src/cli.ts:2`).
- CLI architecture: thin entry + pure `runCli(argv, deps) -> exit code` router with full dependency injection — this is what makes the 95% coverage thresholds attainable (`src/router.ts:41-60`, `vitest.config.ts:19-24`).
- Documented multi-value exit-code contract (0/1/2/3/4, 130 on signal) printed in `--help` (`claim-npm-spec.md:191`).
- `node:util` `parseArgs` for zero-dep arg parsing on small CLIs; near-zero runtime deps as an explicit target (spec §12).
- `--json` on every data-producing command; `NO_COLOR` + TTY-detection color gating; hand-rolled ANSI helpers instead of chalk (`src/colors.ts`).
- Testing pattern: unit tests against the injected router + subprocess integration tests against a mock registry HTTP server, with a global-setup staleness-aware build (`tests/integration/build-setup.ts`); coverage thresholds with explicit adapter exclusions (`vitest.config.ts`).
- Docs workflow: PRD spec with a decision log at repo root; dated design specs and agent-executable implementation plans under `docs/superpowers/{specs,plans}` referencing superpowers skills (`docs/superpowers/plans/2026-06-07-scoped-reserve.md:3`).
- `doctor`/`init` readiness-check pattern for CLIs with external prerequisites (shared readiness module, ✔/✖ per-check output, exit 3 when not ready — spec FR13/FR14).

**17. Decisions that should NOT be reused (with why)**:
- **npm + package-lock.json as package manager**: predates/ignores the blueprint's Bun direction; nothing in this repo argues for npm beyond default inertia (no `packageManager` field even pins it).
- **No linter/formatter at all**: absence, not a decision to copy — the blueprint mandates oxc/Oxlint; this repo has zero lint config (field 9).
- **No CI**: no `.github/workflows`; a template must have CI, so nothing to reuse here.
- **No release automation**: manual `npm publish` with `prepublishOnly` only; fine for a one-off tool, wrong for a template.
- **No git hooks** (no lefthook/husky/pre-commit config observed) — the blueprint wants lefthook.
- **Vitest 1.6 specifically**: the testing *patterns* are reusable, but pin choice is stale (Vitest 1.x, `@types/node ^20`) relative to a 2026 template; also if the port standardizes on Bun, `bun test` vs vitest is an open re-decision.
- **`moduleResolution: "bundler"` with a pure-`tsc`, no-bundler build** (`tsconfig.json:5-6`): works here but is an odd pairing; a template should pick `NodeNext` (node runtime) or bundler-resolution *with* an actual bundler deliberately.

**18. Open questions**:
- Whether the "Bun fine for local dev" note (spec §12) reflects a real preference for Bun elsewhere in the owner's stack, or was aspirational — no Bun artifacts exist in this repo.
- Whether the absence of lint/CI/hooks/release tooling was a deliberate minimal-tool decision for a tiny private-source CLI or simply deferred (spec milestones M4 "Polish" mention README and publish but not lint/CI — `claim-npm-spec.md` §14).
- Whether the `docs/superpowers/{specs,plans}` layout is the owner's standing convention (it also names superpowers skills explicitly) and should be adopted verbatim in the template, or is plugin-generated structure.
- The exit-code palette (0/1/2/3/4) is domain-specific to claim-npm; how much of it should generalize into a template standard beyond 0/1/2 needs a decision.


## Repo: smorin/poc-typescript-bun-trpc-vite

**1. Repo name**: smorin/poc-typescript-bun-trpc-vite (local clone inspected read-only).

**2. Why it is relevant**: Explicit, very recent TypeScript+Bun monorepo proof-of-concept by the same owner. It is the closest prior art for the TS port's stack decisions, and it contains a 38KB written decision record (`app_architecture_typescript_monorepo.md`) that explicitly weighs Biome vs Oxlint vs ESLint, pnpm vs Bun-as-package-manager, Vitest vs bun:test — i.e., these were deliberate, argued decisions, not defaults.

**3. Recency**: Last commit 2026-01-24 22:47:25 -0800 (`git log -1 --format=%ci`); 32 commits total, all within Jan 2026 (first commit 2026-01-23). Short, intense burst of activity ~5 months before today (2026-07-06); developed heavily via Claude PR branches (`claude/*` branch names in merge commits, e.g. PR #1–#8).

**4. Language/runtime stack**: TypeScript 5.9 (`typescript: ^5.9.3`, root package.json:49), ESM everywhere (`"type": "module"`, package.json:5). Split runtime model: **Bun runtime for backend apps** (apps/api/package.json scripts: `dev: bun --hot src/index.ts`, `build: bun build ./src/index.ts --compile --outfile dist/server`), **Node.js for tooling**, Vite 6 + React 18 for frontend (apps/web/package.json). Backend: Hono 4 + tRPC 11 + `@hono/zod-openapi` + Scalar docs UI (apps/api/package.json). Validation: Zod 3 + `@t3-oss/env-core` (root package.json:30-35). README.md:430-431: "Runtime: Bun (backend), Node.js (tooling); Package Manager: pnpm with workspaces".

**5. Package manager**: **pnpm 10 — NOT Bun**. Evidence: `"packageManager": "pnpm@10.0.0"` (package.json:6); `pnpm-lock.yaml` is the only lockfile in the repo root (no bun.lock/bun.lockb/package-lock/yarn.lock); `pnpm-workspace.yaml` defines workspaces (`apps/*`, `packages/*`, `shared/*`). The architecture doc explicitly argues "Why pnpm over Bun as package manager": strict dependency isolation, mature `--filter`, Bun's hoisting issues (`app_architecture_typescript_monorepo.md`, "pnpm manages dependencies" section). Caveat: the API Dockerfile uses `bun install --frozen-lockfile` and copies `bun.lock*` (apps/api/Dockerfile:5,13) — an internal inconsistency, since no bun.lock exists.

**6. Build system**: Per-app builds orchestrated by Turborepo. API compiles to a native single-file binary via `bun build --compile --outfile dist/server` (apps/api/package.json); web via `tsc && vite build` (apps/web/package.json). Docker multi-stage build from `oven/bun:1` to `gcr.io/distroless/base` for the API (apps/api/Dockerfile:1,26).

**7. Monorepo tooling**: **Turborepo 2** (`turbo: ^2.7.5`, package.json:48) + pnpm workspaces (pnpm-workspace.yaml). turbo.json defines `build` (dependsOn `^build`, outputs `dist/**`), `dev` (cache:false, persistent), `lint`/`test`/`typecheck` (dependsOn `^build`), `clean` (cache:false). Root scripts are thin echo+turbo wrappers teaching turbo syntax (package.json:8-21, README.md:356-358). Remote caching wired via `TURBO_TOKEN`/`TURBO_TEAM` env in CI (.github/workflows/ci.yml:9-11). Affected-only pattern: `turbo build test typecheck --filter=[origin/main]` (package.json:20).

**8. TypeScript configuration patterns**: Shared config package `@pkg/tsconfig` (packages/tsconfig/) with four presets extended by every workspace package (e.g. apps/api/tsconfig.json `"extends": "@pkg/tsconfig/app.json"`). base.json: `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `esModuleInterop`, `skipLibCheck`, `forceConsistentCasingInFileNames`, `resolveJsonModule`, `isolatedModules: true`, `verbatimModuleSyntax: true`, `noEmit: true`, `declaration`/`declarationMap`, `incremental` (packages/tsconfig/base.json:4-18). Variants: app.json (noEmit), library.json (composite + declarations), vite.json (DOM libs + `jsx: react-jsx`). Shared code consumed via tsconfig `paths` aliases `@shared/*` plus `include` of shared source dirs rather than build-time packages (apps/api/tsconfig.json:5-8, docs/onboarding.md "Shared Code").

**9. Linting and formatting approach**: **Biome 2 as primary linter + formatter** (`biome.json`; `lint: biome check .`, `lint:fix: biome check --write .`, package.json:22-23), with a **narrow type-aware ESLint layer intended for CI per the architecture doc** (`lint:types: eslint --max-warnings 0 .`, package.json:24 — though ci.yml never actually invokes it, so no enforced ESLint CI gate existed; eslint.config.js enables `no-floating-promises`, `no-misused-promises`, `await-thenable` as errors and turns off rules that conflict with Biome, eslint.config.js:59-74). Biome formatter settings: 2-space indent, lineWidth 100, single quotes, semicolons always, trailingCommas es5, organizeImports on (biome.json:17-28,3). Biome was deliberately upgraded 1.9.4 → 2.3.12 (commit a7dfad3). The architecture doc explicitly evaluated **Oxlint and rejected it as primary** ("Oxlint does NOT have a formatter; Oxfmt is in alpha as of Jan 2026"; recommendation is "Biome 2.0 ... with ESLint reserved for CI type-aware rules", app_architecture_typescript_monorepo.md "Linting with Biome" section). No Prettier, no dprint, no .oxlintrc anywhere.

**10. Testing approach**: Three-tier: **Vitest 4** for unit tests of shared/web code (root vitest.config.ts: globals true, node environment, v8 coverage with text/json/html reporters); **bun:test for the Bun-runtime API app** (apps/api/package.json `test: bun test`; vitest.config.ts:9 explicitly excludes `apps/api/**` with a comment "apps/api uses bun:test instead of vitest"); **Playwright for E2E** across chromium/firefox/webkit with CI retries=2, workers=1 in CI, trace on-first-retry, and `webServer` blocks that boot web+api (e2e/playwright.config.ts). Tests co-located with source (shared/utils/index.test.ts). A dedicated `testing.md` guide exists at repo root.

**11. CI/GitHub Actions patterns**: `.github/workflows/ci.yml`: triggers push+PR on main; single "Build and Test" job on ubuntu-latest; actions pinned by **major version tag only** (actions/checkout@v4, pnpm/action-setup@v2, actions/setup-node@v4 with `cache: 'pnpm'`, oven-sh/setup-bun@v1 with `bun-version: latest`); `pnpm install --frozen-lockfile`; then sequential `pnpm lint` → `turbo typecheck` → `turbo build` → `turbo test`; Turbo remote cache env at workflow level (ci.yml:9-11); `fetch-depth: 2` for checkout. Four separate path-filtered deploy workflows (`deploy-api.yml`, `deploy-web.yml`, `deploy-static.yml`, `deploy-webhooks.yml`) deploying to GCP Cloud Run via Workload Identity Federation (`google-github-actions/auth@v2` with `workload_identity_provider`, deploy-api.yml:31-35), Docker images tagged with `${{ github.sha }}`.

**12. Release/versioning approach**: none observed for automated release tooling — no changesets, release-please, semantic-release, cog.toml, or version-bump scripts (checked root listing and grepped Justfile/Makefile for release/changeset/version). All packages pinned at `0.0.1` and `private: true`. Versioning discipline exists only at the commit level: **commitlint with conventional commits** enforced via lefthook commit-msg hook (commitlint.config.cjs extends `@commitlint/config-conventional` with explicit type-enum and per-app scope-enum; lefthook.yml:16-19).

**13. Documentation approach**: Markdown in-repo, no site generator observed. Extensive README.md (tool-responsibility tables, turbo filter cheatsheet, per-app reference); `docs/onboarding.md`; `docs/architecture/overview.md` + `docs/architecture/makefile-justfile-implementation-plan.md`; `docs/api/README.md`; root-level `testing.md` and the 38KB decision-record `app_architecture_typescript_monorepo.md`; `docs/TOOL_DISCREPANCY_ANALYSIS.md` (a self-audit of doc/config inconsistencies). API docs are generated at runtime: OpenAPI 3.1 spec at `/openapi.json` + Scalar UI at `/docs` (apps/api/src/index.ts app.doc/Scalar blocks; README.md:270-273).

**14. CLI or app structure patterns**: No CLI tool in this repo (no arg-parsing library, no bin entries) — none observed for CLI standards. App structure pattern: `apps/*` deployable services, `shared/*` path-alias-shared TS source (api-client, env, schemas, types, utils), `packages/*` "true packages" (only `@pkg/tsconfig`), `e2e/`, `infra/` (terraform+docker), `scripts/` (docs/onboarding.md "Project Structure"). Bun server apps export `{ port, fetch }` default (apps/api/src/index.ts tail). Future-app placeholders (`apps/mcp-server`, `chrome-extension`, `google-addon`) are stub packages whose scripts echo "not yet implemented" but still typecheck (apps/mcp-server/package.json).

**15. Logging/configuration patterns**: **Pino** logging: dev = level debug + pino-pretty colorized transport, prod = level info JSON (apps/api/src/index.ts:13-23); HTTP request logging via `hono-pino` middleware (apps/api/src/index.ts:28-33). **Config via t3-env + Zod**: `shared/env/index.ts` defines `serverEnv` (NODE_ENV enum development/staging/production, PORT, ALLOWED_ORIGINS) and `clientEnv` (VITE_-prefixed) with `emptyStringAsUndefined: true`; `.env.example` at root committed, `.env*` gitignored. Fail-fast validation of PORT at startup (apps/api/src/index.ts:110-114). CORS with explicit origin whitelist from env in prod, localhost allowlist in dev (apps/api/src/index.ts:36-61).

**16. Reusable decisions (for the TS port)**:
- **Turborepo 2 for task orchestration** with `dependsOn: ^build`, affected-only `--filter=[origin/main]`, and remote-cache env in CI (turbo.json, ci.yml).
- **Shared tsconfig package** (`@pkg/tsconfig`) with strict base: ES2022 target, ESNext module, `moduleResolution: bundler`, `isolatedModules` + `verbatimModuleSyntax` (packages/tsconfig/base.json).
- **Biome 2 for lint+format** (single fast tool) **plus a minimal type-aware ESLint pass in CI** for promise-safety rules Biome can't do — with conflicting rules explicitly disabled (eslint.config.js:72-73). This was argued against Oxlint in writing.
- **lefthook git hooks**: parallel pre-commit running `biome check --write --staged` with `stage_fixed: true` + `turbo typecheck`; commit-msg commitlint (lefthook.yml); installed via package.json `prepare` script.
- **Conventional commits enforced by commitlint** with repo-specific scope-enum (commitlint.config.cjs).
- **Makefile for dependency checking/bootstrap, Justfile as the primary dev interface** (612-line Justfile with `set dotenv-load`, colored output, `check-deps`; Makefile `check`/`check-core`/`check-optional`/`bootstrap` targets) — matches the owner's `make check` → `just all` convention.
- **Pino logging with env-switched pretty/JSON transport**; **t3-env + Zod for validated env config** with server/client split and committed `.env.example`.
- **Testing split**: Vitest (v8 coverage) for portable code, bun:test only inside Bun-runtime apps, Playwright (3 browsers, webServer bootstrapping) for E2E.
- **CI shape**: pnpm frozen-lockfile install, lint → typecheck → build → test, plus path-filtered per-app deploy workflows using GCP Workload Identity Federation.
- **Bun as backend runtime with `bun build --compile` single-binary output** and distroless Docker images (apps/api/package.json, apps/api/Dockerfile).
- `.vscode/extensions.json` recommending oven.bun-vscode + biomejs.biome (only extensions.json is un-gitignored, .gitignore:23-24).

**17. Decisions that should NOT be reused (with why)**:
- **pnpm-as-package-manager should not be copied blindly if the blueprint has since standardized on Bun**: this repo deliberately chose pnpm over Bun for installs (package.json:6, architecture doc), but the decision was dated Jan 2026 and its stated blockers (Bun hoisting/`--filter` maturity) may be resolved; it also left an inconsistency where the Dockerfile installs with `bun install --frozen-lockfile` against a nonexistent `bun.lock` (apps/api/Dockerfile:5,13) — evidence the dual-tool setup is error-prone. Flag as a conflict to re-verify rather than silently reuse either side.
- **Loose CI pinning**: `bun-version: latest` (ci.yml:38) and major-tag-only action pins are not reproducible; a template should pin exact versions or SHAs.
- **No release/versioning automation**: everything is `0.0.1` private; a template repo needs a release story (changesets or release-please) that this POC never built.
- **Echo-wrapper npm scripts** (`"dev:api": "echo ... && turbo dev --filter=..."`, package.json:8-21): a pedagogical POC device, noisy for a real template.
- **Warn-level laxity in lint rules** (`no-unsafe-*` at warn, `require-await` warn "for POC hello world handlers", eslint.config.js:64-69; Biome `noUnusedVariables: warn`): acceptable for a POC, should be errors in a template.
- **`shared/*` consumed via tsconfig paths + include of sibling source dirs** instead of built workspace packages (apps/api/tsconfig.json:5-13): fast for a POC but bypasses package boundaries and breaks `dependsOn: ^build` semantics (nothing forces shared code to build first because it isn't a dependency edge for web/api shared/types imports).
- **GCP Cloud Run deploy workflows**: infra-specific; reuse the path-filter + WIF pattern only if the port also targets GCP.

**18. Open questions**:
- The repo name says "bun" but the package manager is pnpm — was the intent to migrate installs to Bun later, or is pnpm+Bun-runtime the settled position? The architecture doc says settled (pnpm for installs), which **conflicts with a blueprint assumption of Bun-for-everything**; needs an explicit tie-break decision.
- Same for linting: this repo's written record picks **Biome 2 over Oxlint** (Oxfmt alpha as of Jan 2026) — if the blueprint assumes oxc/Oxlint, that's a second explicit conflict to resolve, not a reuse.
- No CLI exists here, so this repo contributes nothing on arg-parsing/exit-code standards — those must come from another source repo (e.g. a cli-standards repo).
- Is the `TURBO_TOKEN` remote cache actually provisioned (Vercel remote cache) or aspirational? CI references secrets that may not exist.
- README requires Node 20+, Bun 1.3+, and pnpm 10+ simultaneously (README.md:5-9) — is the port willing to carry a three-runtime prerequisite, or should it collapse to Bun-only?


## Repo: smorinlabs/cli-standards

**1. Repo name**: smorinlabs/cli-standards. Local clone contains exactly three files: `cli-design-standard.md` (773 lines), `LICENSE` (MIT, copyright 2026 smorinlabs), `README.md` (single line "# cli-standards"). It is a documentation-only standards repo — no code, no tooling files whatsoever.

**2. Why it is relevant**: It is the organization's canonical, normative CLI design standard — "The CLI Design Standard", Version 1.4.14, Status "Active — canonical", "Applies to: All new CLIs, any language" (cli-design-standard.md:1-10). Its stated purpose: "future CLI work starts from settled decisions instead of re-deriving conventions per project" (cli-design-standard.md:24). For the TS port, this is the institutional decision record for CLI surface design (commands, flags, exit codes, output, config), with explicit RFC-2119 conformance language and stable rule IDs (R1.1–R10.7).

**3. Recency**: Last commit 2026-06-28 16:52:34 -0500 (`git log -1 --format=%ci`), i.e. ~1 week before today (2026-07-06). Short, intense history: 6 commits between 2026-06-27 and 2026-06-28 (initial commit, first version, an ecosystem-gap patch, and two review-fix PRs merged). Actively maintained via PR review (commits reference "PR #1 review findings" and a Codex review branch).

**4. Language/runtime stack**: None — pure Markdown documentation. The standard itself is deliberately language-agnostic ("This does not mandate an implementation language", cli-design-standard.md:34) with informative framework mappings for Rust (Clap), Python (argparse/Click/Typer), and TypeScript (oclif/Commander) in Appendix E (cli-design-standard.md:754-769).

**5. Package manager**: none observed. No package.json, no lockfile of any kind (verified via `find . -type f -not -path './.git/*'` → only the three files above).

**6. Build system**: none observed.

**7. Monorepo tooling**: none observed.

**8. TypeScript configuration patterns**: none observed (no tsconfig*.json). The only TS-related content is Appendix E's informative framework mapping (cli-design-standard.md:767-769): Commander's `-V`/`--version` + `-h`/`--help` defaults "matches the standard"; oclif's topic/command structure "maps naturally to noun-verb"; use `env-paths` for XDG-style locations, `process.exitCode` with the §6 codes, and a `process.stdout.on('error')` handler for EPIPE (R9.6).

**9. Linting and formatting approach**: none observed (no lint/format configs, no editor configs, no .gitignore even).

**10. Testing approach**: No test tooling in the repo. However the standard PRESCRIBES a testing pattern: R9.14 "Conformance fixtures" (cli-design-standard.md:534-536) — a mature CLI SHOULD include automated conformance tests exercising help shape, stdout/stderr separation, exit codes, `--json`, `--version`, and unknown-command handling; Appendix C is the reviewable conformance checklist (cli-design-standard.md:627-653).

**11. CI/GitHub Actions patterns**: none observed (no .github/ directory). Process signal: changes land via reviewed PRs (merge commits for PR #1 and #2 in git log), including an AI-review branch (`codex/review-cli-standards-md-for-inconsistencies`).

**12. Release/versioning approach**: No release tooling. The document versions ITSELF with SemVer (v1.4.14) plus a Decision Log row per change (Part II, cli-design-standard.md:57-116) and an explicit evolution rule: "To evolve it, bump the version (SemVer), add a Decision Log row, and update the affected rule and the conformance checklist together" (cli-design-standard.md:773). For CLIs, it PRESCRIBES: SemVer with the interface (command names, flag names, exit codes, env vars, machine output shape) as the public contract — breaking any is a major bump (R9.3, cli-design-standard.md:491-492); deprecation policy with stderr warnings, hidden aliases, and documented removal timeline (R9.2, cli-design-standard.md:486-489); release integrity — checksums/signatures for binaries, verified self-update (R9.9, cli-design-standard.md:514-516).

**13. Documentation approach**: Single normative Markdown spec with a strict internal structure: PRD (Part I) → Decision Log with 54 numbered, sourced decisions marked "org-locked" vs "derived" (Part II) → normative rules with stable IDs, RFC-2119 keywords, and ✅/❌ examples (Part III §1–§10) → appendices: A small-CLI profile, B cheat sheet, C conformance checklist, D worked example, E framework mapping. SHOULD-waivers must be documented in a "stable repository conformance note" with rule ID, rationale, owner/date (cli-design-standard.md:50, 629).

**14. CLI or app structure patterns**: This is the core payload — the repo IS the CLI structure decision record. Key prescriptions (all normative):
- **Command ordering**: noun-verb (`acme project create`), gh/kubectl style; verb-first only for small (≤7 command) single-resource tools per Appendix A (R1.1 line 124; Appendix A lines 574-588). Nesting ≤3 path elements (R1.2). Singular nouns, kebab-case everywhere (R1.3, R1.4).
- **Verb vocabulary**: `list`(ls)/`view`/`describe`/`create`/`delete`(rm)/`update`/`apply`/`run`/`edit`; `get`/`set` reserved for `config get/set` only (R2.1, lines 155-174).
- **Standard options** (R4.1 table, lines 237-253): required global core `-h/--help`, `-V/--version` (NOT `-v`), `-v/--verbose` (repeatable), `-q/--quiet`, `--config`, `--debug`; result-output `-o/--output` enum `table|json|jsonl|yaml|wide|name` with `--json` ≡ `-o json` (R4.2); safety `--dry-run`, `-f/--force`, `-y/--yes`, `--no-input`. `-f` is force; file input is `--file` long-only (R3.4).
- **Exit codes** (R6.1, lines 351-365): `0` success, `1` error, `2` usage, `3` not-found, `4` auth, `5` conflict, `130` SIGINT, `143` SIGTERM; sysexits.h explicitly rejected.
- **Streams** (R7.1): stdout = requested result only; stderr = diagnostics/progress/prompts/errors. Machine error schema `{"error":{"code","message"}}` single JSON object on stderr under any machine format (R7.8, lines 431-433). Bare top-level → help/stdout/0; incomplete group → usage/stderr/2 (R7.9).
- **Flags**: `--` terminates parsing (R3.1); `-` = stdin/stdout (R3.2); `--no-<foo>` negation (R3.6); no prefix abbreviation — exact match required (R3.10); flag/env/config name parity `--log-level` ↔ `TOOL_LOG_LEVEL` ↔ `log-level` (R3.8).
- **Safety**: destructive ops confirm on TTY, `--yes` = consent vs `--force` = guard override, prompts to stderr, fully usable without TTY (R8.1, R8.2).
- **Signals**: SIGINT→130, SIGTERM→143, graceful SIGPIPE/EPIPE (R9.6, lines 502-504).
- **Networked tools** (§10): `auth login/logout/status`, token precedence file-flag > env > stored, keychain-first storage; bounded pagination with `--paginate`; wait-by-default with `--no-wait`; TLS verified by default.

**15. Logging/configuration patterns**: Prescribed, not implemented:
- **Config precedence** (R5.1, lines 287-300): flags → `TOOL_*` env → project `.<tool>/<tool>_config.toml` (walk-up discovery, stop at repo boundary) → user `$XDG_CONFIG_HOME/<tool>/<tool>_config.toml` → system `$XDG_CONFIG_DIRS` → defaults. Maps merge recursively; scalars/arrays replace; `--config` REPLACES discovered files (R5.2).
- **Format**: TOML canonical; YAML only for cloud-native tools; JSON/INI MUST NOT be canonical (R5.2, line 303). Canonical filename `<tool>_config.toml`.
- **Paths**: XDG Base Directory spec, namespaced per tool (R5.3 table, lines 310-316); no `~/.tool` dotdirs.
- **Env vars**: uppercase `TOOL_*`, deterministic mapping, curated subset only (R5.4).
- **Verbosity ladder** (R4.4): repeatable `-v`, `--quiet` wins over `--verbose`, `--debug` overrides `--quiet`; optional `--log-level`.
- **Secrets**: never in argv (R5.5); masked in all output including debug logs, `--show-secrets` to reveal (R5.6). `config view --show-origin` for effective-config debugging (R5.7).
- **Telemetry** (R9.7): must support `TOOL_TELEMETRY=0`, should honor `DO_NOT_TRACK`, no telemetry/update checks in CI/non-interactive by default.

**16. Reusable decisions (for the TS port)**: Adopt the standard wholesale as the CLI-surface contract for any CLI the template produces; it is versioned, org-locked, and one week old. Concretely reusable: (a) noun-verb command structure with the R2.1 verb core; (b) the R4.1 standard-option tiers including `-o/--output` enum + `--json`; (c) the R6.1 exit-code scheme 0/1/2/3/4/5/130/143; (d) stdout/stderr stream contract + R7.8 JSON error schema; (e) TOML config with XDG paths and the R5.1 precedence chain; (f) `TOOL_*` env prefix with flag/env/config name parity; (g) SemVer interface contract + deprecation policy (R9.2/R9.3); (h) signal handling incl. SIGTERM→143 and EPIPE; (i) R9.14 conformance fixtures as a test-suite requirement — the template should ship these as reusable test helpers; (j) Appendix E's TS guidance: oclif or Commander both sanctioned, `env-paths` for XDG, `process.exitCode` + EPIPE handler. Also reusable as process: the Decision Log format (org-locked vs derived, stable rule IDs) is a strong pattern for the blueprint's own decision records.

**17. Decisions that should NOT be reused (with why)**: (a) This repo's own lack of tooling (no CI, no lint, no package manager) is not a decision to copy — it is a docs-only repo, so its absence of Bun/oxc/TurboRepo/lefthook evidence is neutral, not a vote against them. (b) The standard deliberately excludes color/theming/NO_COLOR/accessibility ("governed by a separate standard", cli-design-standard.md:32) — do not treat this doc as the styling decision record; that separate standard was not found in this repo. (c) §10 networked-tool rules (auth, pagination, TLS, idempotency keys) apply only to CLIs talking to remote APIs (line 542) — do not bake them into a template for local-only tools unconditionally. (d) Appendix E is explicitly informative, not normative (line 756) — the oclif/Commander mention is guidance, not an org lock on a specific TS arg-parsing library; the port may choose another parser if it satisfies the normative rules (e.g., R3.10 no prefix abbreviation, R3.5 cluster rules).

**18. Open questions**: (a) Where is the companion color/theming/accessibility standard referenced at cli-design-standard.md:32? Not in this repo. (b) Which TS arg-parsing library does the org actually prefer — Appendix E names oclif and Commander only; no mention of clipanion/citty/yargs; does the ts-launch-blueprint stack decision override or refine this? (c) The standard requires a "repository conformance note" for SHOULD waivers (line 50) — no template/example of that note exists here; the blueprint may need to define one. (d) The standard demands conformance fixtures (R9.14) but no reference test suite exists anywhere yet — greenfield opportunity for the TS template. (e) TOML-canonical config (R5.2) is unusual in the Node ecosystem — the TS port needs a TOML parser choice (e.g., smol-toml); none is prescribed.


## Repo: smorinlabs/difftree

**1. Repo name**: smorinlabs/difftree — "A blazingly fast, minimalist, git-aware directory tree viewer, written in Rust. An early fork of lstr." (Cargo.toml `description`, lines 6-7).

**2. Why it is relevant**: Most recent actively-released CLI by this owner. It is Rust, not TypeScript, so its value to the TS port is not language tooling but the cross-cutting patterns: justfile task-runner conventions, cross-platform CI matrix, release-please + Conventional Commits release automation, tag-integrity guards, prebuilt-binary release pipeline, Claude Code GitHub automation, and CLI output/flag conventions (color handling, JSON schema versioning, exit behavior).

**3. Recency**: Last commit 2026-07-06 16:19:43 -0700 (`git log -1 --format=%ci`) — the day of this review. First commit 2026-06-21; 93 commits in ~2 weeks (`git log --oneline | wc -l`). Very active: three releases shipped (v0.3.1 current per `.release-please-manifest.json`), release automation and binary pipeline landed in the last week of commits.

**4. Language/runtime stack**: Rust 2021 edition binary crate (Cargo.toml line 5 `edition = "2021"`). Key deps: clap 4.5 (derive), anyhow, git2, ignore, colored, lscolors, ratatui (TUI), serde/serde_json (Cargo.toml `[dependencies]`). Nix flake dev shell with fenix stable toolchain + rust-analyzer (flake.nix). No Node/TS anywhere at root (the only package.json is a test fixture at examples/sample-directory/package.json).

**5. Package manager**: Cargo. Evidence: Cargo.toml + committed Cargo.lock at repo root; .gitignore explicitly documents that Cargo.lock "is intentionally NOT ignored... guaranteeing reproducible builds" (.gitignore lines 9-12). No bun.lock/bun.lockb, package-lock.json, pnpm-lock.yaml, or yarn.lock exist. No `packageManager` field (no root package.json).

**6. Build system**: `cargo build` / `cargo build --release`, wrapped by justfile recipes `build` and `build-release` (justfile lines 13-19). Release profile is size/speed optimized: `strip = true`, `lto = true`, `codegen-units = 1`, `panic = "abort"` (Cargo.toml `[profile.release]`). Release binaries built `--release --locked --target <triple>` in CI (release-binaries.yml `Build` step).

**7. Monorepo tooling**: none observed. Single crate; `[workspace] exclude = ["examples/sample-directory"]` in Cargo.toml exists only to keep the example fixture out of the workspace. No TurboRepo/Nx/pnpm workspaces.

**8. TypeScript configuration patterns**: none observed — no tsconfig*.json anywhere (Rust project). Closest analogue: `just typecheck` maps to `cargo check` and is a distinct recipe from build/test (justfile lines 33-35), i.e., typecheck is a first-class named task.

**9. Linting and formatting approach**: rustfmt + clippy, warnings-as-errors. rustfmt.toml sets `max_width = 100`, `use_small_heuristics = "Max"`, `reorder_imports = true` (rustfmt.toml). justfile: `format` (cargo fmt), `format-check` (cargo fmt --check, "(CI)"), `lint` (`cargo clippy -- -D warnings`) (justfile lines 21-31). CI enforces both: `cargo fmt -- --check` and `cargo clippy -- -D warnings` steps (.github/workflows/ci.yml steps 3-4). No eslint/oxlint/biome/prettier/dprint configs (Rust repo).

**10. Testing approach**: cargo test with a substantial CLI integration test suite: tests/cli.rs has 59 `fn`s using assert_cmd + predicates + tempfile (tests/cli.rs lines 1-5; Cargo.toml `[dev-dependencies]`). Tests exercise the binary end-to-end: `--help` content assertions, error paths ("is not a directory" on nonexistent path asserts `.failure()` + stderr), tree output assertions, with `#[cfg(unix)]` guards for platform-specific permission tests (tests/cli.rs). A curated `examples/sample-directory/` fixture tree ships in-repo for realistic runs. Run via `just test` → `cargo test`.

**11. CI/GitHub Actions patterns**:
- **ci.yml**: triggers on push to main + pull_request to main; single job matrixed over 3 OSes using Blacksmith runners — `blacksmith-4vcpu-ubuntu-2404`, `blacksmith-6vcpu-macos-latest`, `blacksmith-4vcpu-windows-2025` (ci.yml `matrix.os`). Steps: checkout → actions/cache@v4 keyed on `hashFiles('**/Cargo.lock')` → fmt check → clippy -D warnings → test --verbose → release build.
- **Pinning style**: major-version tags only (`actions/checkout@v4`/`@v6`, `actions/cache@v4`, `googleapis/release-please-action@v5`, `dtolnay/rust-toolchain@stable`, `anthropics/claude-code-action@v1`) — no SHA pinning observed.
- **Security posture**: release workflows use `permissions: {}` deny-all at top level with per-job re-grants (publish.yml, release-please.yml, release-binaries.yml comments: "Deny-all at the top level; each job re-grants only what it needs").
- **Concurrency**: every release workflow sets a `concurrency` group with `cancel-in-progress: false` and an explanatory comment (e.g. publish.yml: "Never cancel an in-flight publish"); the PR-comment workflow uses `cancel-in-progress: true` (difftree.yml).
- **Claude automation**: claude.yml (@claude mention-triggered agent via anthropics/claude-code-action@v1 with `CLAUDE_CODE_OAUTH_TOKEN`) and claude-code-review.yml (automatic PR review running `/code-review:code-review ... --comment` via the code-review plugin, skipping fork PRs because secrets are absent).
- **Dogfooding**: difftree.yml posts a difftree-rendered diff tree comment on every PR via the companion `smorinlabs/difftree-action@v0.1.0`, with `fetch-depth: 0` for merge-base computation.

**12. Release/versioning approach**: release-please manifest mode + Conventional Commits + trusted publishing, fully documented in docs/RELEASE.md.
- release-please.yml runs on push to main, opens/updates a Release PR (version bump, CHANGELOG.md, manifest); merging pushes a `vX.Y.Z` tag. It mints a **GitHub App installation token** (actions/create-github-app-token@v3 with `RELEASE_PLEASE_CLIENT_ID`/`RELEASE_PLEASE_PRIVATE_KEY` secrets) because the default GITHUB_TOKEN's tag push cannot trigger downstream workflows (release-please.yml comments).
- release-please-config.json: `release-type: rust`, `include-v-in-tag: true`, `bump-minor-pre-major: true` (pre-1.0 breaking changes bump minor only), explicit changelog-sections mapping with docs/ci/test/chore hidden, custom PR title `chore(release): publish v${version} — review and merge to ship to crates.io`.
- publish.yml (on tag `v*`): a cheap unguarded `verify` job (tag reachable from main via `git merge-base --is-ancestor`; tag version matches Cargo.toml; `cargo publish --dry-run --locked`) gates a `publish` job that uses the protected `crates-io` GitHub environment (optional required reviewer = single human gate) and **OIDC Trusted Publishing** (`rust-lang/crates-io-auth-action@v1`, `id-token: write`, no long-lived registry token; `persist-credentials: false` on checkout).
- release-binaries.yml (on `release: published` + `workflow_dispatch` tag backfill): same verify guards, then a 5-target matrix (linux gnu x64/arm64, macOS x64/arm64, windows msvc x64) with `fail-fast: false`, packaging binary+LICENSE+README as .tar.gz/.zip plus `.sha256` checksums under a documented **stable asset-naming contract** (`difftree-<tag>-<target>.<ext>`), uploaded via `gh release upload --clobber`.

**13. Documentation approach**: README.md (~15KB) is the primary doc: badges, philosophy, features, install (crates.io / source / GitHub Action), usage, flag semantics, JSON schema notes, credits/attribution to the upstream fork with a NOTICE file. docs/ holds operational and design records: docs/RELEASE.md (release runbook incl. one-time setup tables and troubleshooting), docs/PRD/difftree-prd-v0.2.md, docs/goals/difftree-goal-v0.2.md, docs/specs/difftree-decisions-v0.2.md (a "locked decisions" record: flag table, marks table, comparison-mode precedence, header/summary formats, JSON contract), plus docs/superpowers/plans/ and docs/superpowers/specs/ (dated design docs from the superpowers plugin workflow, e.g. docs/superpowers/plans/2026-06-28-json-all-commands.md). No docs site generator (no mkdocs/docusaurus/astro config observed).

**14. CLI or app structure patterns**: clap v4 derive. Root `Args` struct with `#[command(author, version, about)]`, `propagate_version = true`, `override_usage`, and `after_help = STATUS_KEY_HELP` for a rich status-key help footer (src/app.rs lines 43-47). One hidden subcommand `interactive` with `visible_alias = "i"` (src/app.rs line 57); default invocation is the flat flag-driven view. Flags use aliases for compatibility (`--cached` for `--staged`, `--tree` for `--all`, `--no-git` for `--plain`), `requires = "pr"` for dependent flags, and value-name documentation (src/app.rs lines 63-107). `main() -> anyhow::Result<()>` so errors exit nonzero with an anyhow message; tests assert `.failure()` + stderr for bad input (tests/cli.rs `test_nonexistent_path`). Output conventions: honors `NO_COLOR`, `--color=auto|always|never`, `--force-color`, auto-disables color when piped (src/main.rs run_cli; README "Honors `--color=<when>` ... `NO_COLOR`, and auto-disables when piped"); warnings/fallback notices go to stderr while tree output goes to stdout (src/main.rs `eprintln!` fallback messages); `--json` everywhere with an explicit versioned schema field `schema_version: "difftree.v2"` (README line 323); graceful degradation outside a git repo (falls back to plain tree with a stderr notice rather than erroring). Windows VT enable at startup (`control::set_virtual_terminal(true)`, src/main.rs).

**15. Logging/configuration patterns**: No logging framework — user-facing messages via `eprintln!` prefixed `difftree:` (src/main.rs), data on stdout. Configuration is entirely flags + environment (`LS_COLORS`, `NO_COLOR`); no config file support observed. Dev-environment config via Nix flake (flake.nix) as an optional reproducible shell.

**16. Reusable decisions (for the TS port)**:
- **justfile as the task runner** with the exact recipe vocabulary: `default` = `just --list`, `build`, `format`, `format-check`, `lint`, `typecheck`, `test`, `run *ARGS`, `all: format lint typecheck test`, `install`/`uninstall`, `install-symlink` (justfile).
- **release-please manifest mode** with Conventional Commits, `bump-minor-pre-major`, custom human-readable Release-PR title, hidden chore/docs/ci changelog sections (release-please-config.json), and the **GitHub App token pattern** so the tag push triggers publish (release-please.yml).
- **Publish pipeline shape**: tag-triggered publish with a cheap `verify` job (tag-on-main ancestor check + tag-matches-manifest-version + dry-run pack) gating a human-approvable protected environment, and **OIDC trusted publishing** (npm has the direct equivalent) instead of long-lived tokens (publish.yml).
- **Deny-all `permissions: {}` at workflow top level** with per-job re-grants, and `concurrency` groups with deliberate `cancel-in-progress` choices per workflow (all release workflows).
- **3-OS CI matrix** (Linux/macOS/Windows, Blacksmith runners) running format-check, lint-as-error, tests, and a release build; dependency cache keyed on the lockfile hash (ci.yml).
- **Committed lockfile with a documented rationale** in .gitignore (.gitignore lines 9-12).
- **CLI conventions**: `NO_COLOR` + `--color=<when>` + pipe detection; stderr for notices, stdout for data; versioned `schema_version` in JSON output; alias flags for ecosystem compatibility; rich `after_help` status key; graceful non-git fallback (src/main.rs, src/app.rs, README).
- **End-to-end CLI testing** of the built binary (help text, error exits, output content) — TS equivalent: spawn the CLI in tests the way assert_cmd does (tests/cli.rs).
- **Docs layout**: README as canonical user doc; docs/RELEASE.md runbook; docs/specs/ as locked decision records; dated plans/specs under docs/superpowers/ (docs/ tree).
- **Claude Code automation**: .claude/settings.json `companyAnnouncements` welcome string; claude.yml @claude responder; claude-code-review.yml auto-review with fork-PR skip (.claude/settings.json, .github/workflows/claude*.yml).
- **Dogfood-your-own-action PR workflow** pattern (difftree.yml) where applicable.
- **Prebuilt-binary release** with 5-target matrix, `fail-fast: false`, sha256 checksums, and a documented stable asset-naming contract (release-binaries.yml) — directly relevant if the TS CLI ships compiled Bun binaries.

**17. Decisions that should NOT be reused (with why)**:
- Rust toolchain specifics (cargo/clippy/rustfmt/rustfmt.toml, `[profile.release]` codegen settings, dtolnay/rust-toolchain, crates.io publishing) — language-specific; the TS port replaces these with the Bun/oxc-era equivalents while keeping the pipeline *shape*.
- Nix flake dev shell (flake.nix) — optional environment nicety not part of the mandated stack; adopt only if the blueprint wants Nix.
- `release-type: rust` and Cargo.toml version-check greps in publish/release-binaries verify steps — must be re-targeted to `release-type: node` and package.json.
- Blacksmith-hosted runner labels (ci.yml, claude*.yml) — these are paid third-party runners tied to this org's setup; a template should default to `ubuntu-latest`-style GitHub-hosted runners or make the runner label configurable.
- Absence of git hooks: no lefthook.yml, .husky/, or .pre-commit-config.yaml exists anywhere — this repo relies on CI + Claude review instead. This is an absence, not a decision record; do not treat it as precedent against lefthook.
- Mutable major-version action pinning (`@v4`, `@v1`) — acceptable but note it conflicts with SHA-pinning if other blueprint repos mandate that; not a strong precedent either way.
- The hidden `interactive` subcommand + TUI (ratatui) — app-specific feature, not a template pattern.

**18. Open questions**:
- No git hook config exists (none observed) — was hook-less-by-design, or just not yet added? The ts-launch-blueprint should decide (lefthook) independently.
- Action pinning policy: this repo uses mutable major tags; whether the TS template should SHA-pin is undecided by this evidence.
- Blacksmith runners appear in ci.yml and claude workflows but release workflows use GitHub-hosted runners (`ubuntu-latest`, `macos-latest`, etc. in publish.yml/release-binaries.yml) — mixed; unclear if intentional cost/security split or drift.
- docs/RELEASE.md references a "repo-secrets skill" and a shared `*-release-please` GitHub App — org-level infrastructure the TS repo would need provisioned; availability not verifiable from this clone.
- `--heat` flag is accepted but "not yet wired to rendering" (README line ~336) — app-level, no impact on template decisions.

---

# Synthesis — prior decisions the port must respect (Fable, Phase 3 output)

Classification hints for `TS_PORT_RESEARCH.md` (per domain spec: reuse / adapt /
fresh research / keep cross-platform / replace / omit). Evidence lives in the
per-repo sections above.

## Established defaults (reuse unless strong reason to deviate)

1. **Testing: Vitest** — unanimous across recent TS repos (agent2linear Vitest 4
   with 100% coverage thresholds; claim-npm Vitest 1.6 with 95/95/90/95;
   contributors-please Vitest 3), with a second tier of subprocess/E2E tests
   against the built CLI (claim-npm integration spawn, agent2linear hermetic
   bash E2E, difftree assert_cmd). Reuse — contingent on the package-manager/
   runtime tie-break: if Bun-as-runtime is chosen, re-check the POC's split
   (Vitest for Node packages, bun:test for the Bun-runtime app).
2. **Release: release-please manifest mode + GitHub App token + tag-triggered
   OIDC trusted publishing in a protected environment** — contributors-please
   implements it against npm (its workflow comments at release-please.yml:2
   explicitly say the pattern mirrors py-launch-blueprint's release design),
   and difftree repeats the same shape against crates.io (publish.yml:86-114);
   agent2linear's older np-based flow is the outlier. Reuse the
   release-please + npm Trusted Publishing pattern.
3. **TS config: strict ESM** — strict:true, target ES2022, ESM (`type:
   module`), declaration+sourceMap, explicit `.js` import extensions in every
   TS repo; extra strictness flags in the newest (claim-npm
   noUncheckedIndexedAccess/noImplicitOverride; POC verbatimModuleSyntax).
   Reuse; consolidate the union of strictness flags.
4. **CLI surface: smorinlabs/cli-standards is normative** (RFC-2119 spec,
   v1.4.x, 2026-06): noun-verb structure, standard global flags, exit codes
   0/1/2/3/4/5/130/143, stdout=data/stderr=diagnostics, JSON error schema,
   TOML+XDG config precedence, TOOL_* env vars, conformance test fixtures.
   The port's CLI must conform. Note: the Python source's exit codes (0/1/3/4,
   different meanings) predate the standard — reconcile toward cli-standards
   and document the mapping.
5. **Config/paths: XDG base directories** — agent2linear xdg-paths, claim-npm
   ~/.config/<tool>/, cli-standards R5.x. Matches the source repo's ~/.config
   convention. Reuse.
6. **Logging in CLIs: no logging library** — hand-rolled leveled stderr logger
   (agent2linear logger.ts; claim-npm injected writers; difftree stderr
   notices). Pino appears only in the POC's HTTP server. For a CLI template:
   reuse the stderr-logger pattern; treat Pino as server-side option only.
7. **Task runner: Justfile as command surface (+ minimal Makefile bootstrap)** —
   difftree's canonical recipe set (default=list, format/lint/typecheck/test,
   `all`), POC's 612-line Justfile + Makefile check/bootstrap, agent2linear's
   shortcuts. Mirrors the source repo's two-layer pattern. Reuse.
8. **CI shape: GitHub Actions, push/PR→main, Node version matrix, setup-node
   with cache, major-tag action pinning, least-privilege/deny-all permissions
   on release workflows** — agent2linear, contributors-please, difftree.
   Reuse (runner choice — Blacksmith vs ubuntu-latest — needs a decision; the
   template's public consumers argue for ubuntu-latest).
9. **AI/editor config: committed .claude/settings.json** (difftree
   companyAnnouncements; agent2linear plugin enables) and claude-code-review
   workflows (difftree). Reuse as template features.
10. **Docs: README-centric + docs/ decision records** — NO docs-site generator
    in any recent repo (agent2linear 60K README; difftree README+runbooks).
    The source repo's full Sphinx/RTD site conflicts with this org practice —
    Phase 4 must decide site-vs-README with an explicit tradeoff.

## Explicit conflicts requiring Phase 4 tie-breaks (fresh research)

1. **Package manager**: recent published TS repos are uniformly **npm**
   (agent2linear, contributors-please, contributors-please-action, claim-npm:
   package-lock v3, npm ci in CI). The only Bun-adjacent repo (POC, 2026-01)
   documented **pnpm-over-Bun for installs** (Bun as runtime only). The domain
   spec names Bun as a candidate. No org repo uses Bun as package manager →
   fresh research with tie-break among npm (org default), pnpm (POC argument),
   Bun (domain-spec candidate).
2. **Lint/format**: no org standard. agent2linear: legacy ESLint 8 + Prettier
   (not CI-enforced); claim-npm and contributors-please: none; POC (2026-01):
   **Biome 2 chosen, Oxlint explicitly rejected** ("no formatter, Oxfmt alpha").
   Domain spec names oxc/Oxlint. The POC rejection is 6 months old — re-check
   Oxlint/Oxfmt maturity as of mid-2026 before deciding.
3. **Build tool**: three patterns in play — tsup bundle (agent2linear), plain
   tsc (claim-npm), ncc committed-dist (contributors-please, action-specific).
   Fresh research scoped to "publishable CLI + library template".
4. **CLI framework**: Commander (agent2linear; cli-standards Appendix E
   sanctions Commander or oclif) vs node:util parseArgs + DI router
   (claim-npm). Both are live in-org patterns; source repo is a flat
   single-command click CLI. Needs research.
5. **Git hooks**: the POC has lefthook + commitlint (conventional commits),
   and contributors-please-action carries a single-purpose pre-commit hook
   (.pre-commit-config.yaml, local engine-sync hook, language: system) — so
   both lefthook and pre-commit have June-2026-adjacent TS precedent;
   published CLIs otherwise rely on CI + prepublishOnly. Source repo has a
   heavy pre-commit suite. Domain spec: preserve lefthook if used. Phase 4
   must weigh pre-commit continuity vs lefthook explicitly; extent of hook
   duties needs research.
6. **Monorepo/TurboRepo**: agent2linear wraps every script in turbo (v1,
   single package, caching); POC uses Turborepo 2 with a real workspace graph.
   The port target is a single-package template → decide turbo-as-cache vs
   plain scripts.
7. **Action pinning policy**: most workflows pin actions by major tag, but
   difftree-action deliberately SHA-pins the security-sensitive token-minting
   action with a version comment (release-please.yml:40,
   `actions/create-github-app-token@bcd2ba49… # v3.2.0`) — the newest
   precedent. Phase 4 must decide: major tags everywhere vs SHA-pinning
   security-sensitive third-party actions.

## Decisions NOT to reuse (with why)

- **np-based release** (agent2linear): superseded org-wide by release-please +
  Trusted Publishing; also duplicates the version string in source (drift bug
  noted in its own review).
- **ESLint 8 legacy config** (agent2linear): ESLint 8 is EOL; org has no
  attachment to it (two newer repos ship no linter at all).
- **Committed dist/** (contributors-please): action-runtime requirement, not a
  general template practice; the port publishes to npm instead.
- **100% coverage thresholds** (agent2linear): claim-npm's 95/95/90/95 with
  excluded thin I/O adapters is the more transferable default for a template.
- **Blacksmith runners** (agent2linear, difftree): org-internal performance
  choice; a public template should default to ubuntu-latest.
- **bun-version: latest in CI** (POC): unpinned toolchain in CI contradicts
  the template's reproducibility bar.
