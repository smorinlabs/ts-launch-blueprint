# TS Port Research

Tool and architecture selections for the py-launch-blueprint → ts-launch-blueprint
port. Produced in Phase 4 of `goal.md` (domain spec Phase 4), AFTER and informed by
`TS_EXISTING_REPO_REVIEW.md` (existing-repo decisions consulted first, per domain
spec). All tool maturity facts verified against primary web sources on 2026-07-07 —
no choice settled from memory (D-003).

## Topic → decision map

Each topic below is one decision entry in `TS_PORT_DECISIONS.md`; individual
recommendations within a topic are citable as `D-0NN(k)` where k is the
recommendation's position in that entry.

| Topic | Subject | Decision entry |
|-------|---------|----------------|
| T01 | Package manager & runtime | D-011 |
| T02 | Build & npm packaging | D-012 |
| T03 | tsconfig & module format | D-013 |
| T04 | Lint & format | D-014 |
| T05 | Type-check strategy | D-015 |
| T06 | CLI framework & UX | D-016 |
| T07 | Config loading & env | D-017 |
| T08 | Logging & output streams | D-018 |
| T09 | Testing | D-019 |
| T10 | Git hooks & commit linting | D-020 |
| T11 | Versioning, release & changelog | D-021 |
| T12 | CI & security workflows | D-022 |
| T13 | Documentation system | D-023 |
| T14 | DevEx & repo hygiene | D-024 |

All decision statuses below are **Proposed** as written by research; acceptance is
recorded by the Phase 4 gate in `TS_PORT_LOG.md` and `TS_PORT_DECISIONS.md`.

---

# T01 fragment

## T01: Package manager and runtime target

**1. Source Python tool or pattern**

- `uv` as the single package/environment manager: CI installs with `astral-sh/setup-uv@v5` + `uv venv` + `uv sync --all-extras --dev` (TS_PORT_INDEX.md:178); the Makefile bootstrap layer checks/installs exactly two tools, `just` and `uv` (TS_PORT_INDEX.md:519-524); docs run tools via the `uvx` no-global-install pattern (TS_PORT_INDEX.md:894, 1057-1062).
- `.python-version` containing `3.10` (`/Users/stevemorin/c/py-launch-blueprint/.python-version`) pins the interpreter for pyenv/uv; `requires-python = ">=3.10"` is the published floor (`pyproject.toml:25`); mypy pins `python_version = "3.10"` (`pyproject.toml:133`); CI matrix tests 3.10 and 3.11 (TS_PORT_INDEX.md:178) — a deliberate "all version declarations consistent" discipline (TS_PORT_INDEX.md:300-309).
- Lockfile policy: `uv.lock` is deliberately **gitignored** with the comment "remove if you want to pin versions" (`/Users/stevemorin/c/py-launch-blueprint/.gitignore:9,13`); TS_PORT_INDEX.md:257 calls this "an explicit, documented template decision".

**2. Purpose in the original project**

One authoritative, fast package manager with no global-tool sprawl; one authoritative runtime-version pin consumed identically by developers, tooling, and CI (floor + next version tested); a minimal `make check` bootstrap verifying only the foundational tools; and a consciously loose (unlocked) dependency policy for a template whose downstream users re-resolve dependencies anyway.

**3. Existing repo decision, if any**

Per TS_EXISTING_REPO_REVIEW.md:

- **npm is uniform across every recent published TS repo** (May–June 2026): agent2linear (`package-lock.json` v3 only lockfile, no `packageManager` field — line 59), contributors-please (`npm ci` in every CI job — line 122), contributors-please-action (line 183), claim-npm (line 296).
- **The only Bun-adjacent repo chose pnpm over Bun for installs**: poc-typescript-bun-trpc-vite (Jan 2026) has `"packageManager": "pnpm@10.0.0"` and a 38KB written decision record arguing strict isolation, mature `--filter`, and Bun hoisting issues; Bun is only the *runtime* for its backend app (lines 362-364). The review flags this as dated, monorepo-specific, and already error-prone in practice (Dockerfile `bun install` against a nonexistent `bun.lock` — line 400).
- **The Synthesis names this explicit conflict #1 requiring a Phase-4 tie-break**: "npm (org default), pnpm (POC argument), Bun (domain-spec candidate)"; "No org repo uses Bun as package manager" (lines 605-611).
- **Node floor**: the two newest repos (June 2026) set `engines.node >=24` and `node24` action runtime (lines 120, 181); agent2linear's `>=18` floor is explicitly listed as not-to-reuse ("Node 18 is past EOL… a 2026 template should baseline 20/22 or Bun", line 102).
- **No org repo has a `packageManager` field, `.nvmrc`, or `.node-version`** — flagged as an open question/hygiene gap in three reviews (lines 107, 221, 296), so there is no precedent to reuse; TS_PORT_INDEX.md:308 leaves pin-file choice as an open research item.
- **Lockfiles are always committed** in org repos (`package-lock.json` v3 everywhere; `pnpm-lock.yaml` in the POC), and difftree documents a committed-lockfile reproducibility rationale in its .gitignore (lines 481, 519).

**4. Decision classification**

Split by sub-decision:

- Package manager = npm → **Reuse existing repo decision** (org-uniform recent default, confirmed by fresh research).
- Runtime target = Node.js (not Bun), floor `>=24` → **Reuse existing repo decision** for the floor; **Replace Python-specific tool with TypeScript equivalent** for the uv/CPython→npm/Node mapping (re-verified against the July-2026 LTS schedule).
- `.python-version` → `.nvmrc` → **Replace Python-specific tool with TypeScript equivalent** (pin-file choice itself: **Fresh research required**, resolved below).
- `packageManager` field / Corepack / `devEngines` → **Fresh research required** (resolved: no Corepack, no `packageManager`; add `devEngines`).
- Lockfile policy (commit `package-lock.json`) → **Adapt existing repo decision** — deliberate, documented divergence from the source's gitignored `uv.lock`.

**5. TypeScript/Node options considered** (facts verified 2026-07-07 against primary sources)

*Runtime landscape:*
- Node **24 "Krypton" is Active LTS** (latest v24.18.0, bundles npm 11.16.0; Maintenance from Oct 2026, EOL 2028-04-30). Node **22** is Maintenance LTS (EOL 2027-04-30) and still bundles **npm 10.9.x**. Node **20 went EOL 2026-04-30**. Node **26** is Current (released 2026-05, v26.4.0, npm 11.17.0; enters LTS Oct 2026). Sources: https://endoflife.date/nodejs ; https://nodejs.org/dist/index.json (per-release `lts`/`npm` fields).
- **Corepack no longer ships with Node 25+** per Node.js TSC vote; it remains only as an experimental opt-in in ≤24 and is otherwise a separate npm package (corepack@0.35.0 on the registry). Sources: https://github.com/nodejs/nodejs.org/issues/7555 ; https://socket.dev/blog/node-js-tsc-votes-to-stop-distributing-corepack . Any pattern depending on Corepack auto-activation of the `packageManager` field is on a deprecated path.
- npm 11 supports the **`devEngines`** field (`runtime`/`packageManager` entries with `name`/`version`/`onFail`, default `onFail: "error"`, checked before `install`/`ci`/`run`); plain `engines` stays advisory unless `engine-strict` is set. Source: https://docs.npmjs.com/cli/v11/configuring-npm/package-json .
- **npm Trusted Publishing (OIDC) requires npm CLI ≥11.5.1** — Node 24's bundled npm 11.16 satisfies it; Node 22's bundled npm 10.9 does **not**. Source: https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/ .
- `actions/setup-node`: `node-version-file` reads `.nvmrc`, `.node-version`, `.tool-versions`, or `package.json`; the `cache:` input supports **npm, yarn, pnpm only** (no bun). Source: https://github.com/actions/setup-node README.

*Option A — npm (latest 11.18.0; engines `^20.17.0 || >=22.9.0` — registry.npmjs.org/npm/latest):*
- Ships with Node: zero extra bootstrap; `npm ci` reproducible installs; org-standard `setup-node` + `cache: npm` CI pattern; `package-lock.json` fully supported by the GitHub dependency graph, dependency-review action, and Dependabot (https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/dependency-graph-supported-package-ecosystems); native OIDC Trusted Publishing — the release pattern the port already reuses from contributors-please (review Synthesis item 2, line 560).

*Option B — pnpm (latest 11.10.0; engines `node >=22.13`; pure ESM — registry.npmjs.org/pnpm/latest):*
- pnpm 11 (2026) adds supply-chain-hardening defaults (`minimumReleaseAge` 1 day, `blockExoticSubdeps`), a SQLite store, and isolated global installs (https://pnpm.io/blog/releases/11.0 ; https://www.infoq.com/news/2026/04/pnpm-11-rc-release/). `pnpm-lock.yaml` is dependency-graph-supported. Mature and excellent — but its signature strengths (strict hoisting isolation, workspace `--filter`) were the POC's *monorepo* arguments; the port target is single-package. Post-Corepack it requires a standalone install, adding a third tool to the Makefile bootstrap.

*Option C — Bun (latest 1.3.14, 2026-05-12; endoflife.date notes "Bun does not have a clearly defined support policy" — https://endoflife.date/bun ; https://github.com/oven-sh/bun/releases):*
- Fastest installs, text `bun.lock`, all-in-one toolchain. Blocking gaps for this template: **`bun.lock` is not in the GitHub dependency graph's supported ecosystems**, so the source repo's `dependency-review.yml` (TS_PORT_INDEX.md:204-205) would silently stop working; Dependabot has bun *version* updates (GA) but security updates were still pending (https://github.blog/changelog/2025-02-13-dependabot-version-updates-now-support-the-bun-package-manager-ga/); `setup-node` cannot cache it; publishing still requires the npm CLI, so Bun can never be the only package tool; and no org repo uses it as PM — the one org repo that evaluated it wrote down a rejection (review lines 362-364, 609). As a *runtime*: an npm-published CLI runs on consumers' Node regardless, so Bun-as-runtime adds a second toolchain for no deliverable benefit (the POC's three-runtime prerequisite is called out as a burden — review line 413).

*Version-pin file:* `setup-node` reads both `.nvmrc` and `.node-version`. nvm itself reads **only** `.nvmrc`, while fnm, mise/asdf, and setup-node also read `.nvmrc` — making `.nvmrc` the widest-compatibility single choice (`.node-version` is ignored by nvm, the most widely used manager). This settles TS_PORT_INDEX.md:308's open question.

**6. Recommended choice**

1. **Package manager: npm** (as bundled with Node 24, i.e. npm ≥11.16). No Corepack.
2. **Runtime target: Node.js with `"engines": { "node": ">=24" }`**; CI matrix tests **24.x** (floor, Active LTS) and **26.x** (Current, LTS from 2026-10) — mirroring the source's 3.10+3.11 floor-plus-next matrix. Bun is adopted as neither runtime nor package manager.
3. **`.nvmrc` containing `24`** replaces `.python-version`, kept consistent with `engines` and CI via `setup-node node-version-file` (preserving the source's all-declarations-consistent discipline, TS_PORT_INDEX.md:305-309).
4. **No `packageManager` field; add `devEngines`** — `devEngines.runtime = { name: "node", version: ">=24", onFail: "error" }` and `devEngines.packageManager = { name: "npm", onFail: "error" }` — dev-side enforcement that does not depend on Corepack.
5. **Commit `package-lock.json`; CI installs with `npm ci`**; document the divergence from the source's gitignored `uv.lock` with an inverse comment (difftree's committed-lockfile pattern, review line 519).

**7. Rationale**

- npm is a **reuse**, not a compromise: four deliberate org repos from May–June 2026 all shipped on npm, and the discipline rule says prior deliberate recent decisions win absent strong contrary evidence. Fresh research removes both candidate reasons to deviate: the POC's pnpm-over-Bun argument was monorepo-scoped (moot for a single-package template), and Bun-as-PM has zero org precedent, one written org rejection, and two live ecosystem breaks for workflows the port must preserve (dependency graph/dependency-review; setup-node cache).
- npm couples cleanly to the already-established release decision: release-please + npm Trusted Publishing OIDC needs npm ≥11.5.1, which Node 24's bundled npm meets with no extra setup — and which Node 22's bundled npm 10.9 does not, independently reinforcing the >=24 floor.
- It preserves the source's minimal-bootstrap intent: the ported Makefile `check` needs only `just` + Node — the same two-tool surface as `just` + `uv` (TS_PORT_INDEX.md:519-524). pnpm or Bun would make it three, post-Corepack.
- Node `>=24` follows the org's newest deliberate floor (contributors-please, June 2026) and is independently correct as of 2026-07: 24 is Active LTS with runway to 2028-04, 22 is maintenance-only on old npm 10, 20 is EOL.
- Committing the lockfile diverges from the source's literal stance, but the source's own comment frames it as a toggle ("remove if you want to pin versions"); every org TS repo commits lockfiles; and Node CI (`npm ci`, setup-node caching, dependency graph) is designed around a committed lockfile. Intent preserved (documented, deliberate, user-changeable policy), ecosystem-appropriate value chosen.

**8. Tradeoffs**

- **vs pnpm**: gives up faster installs, strict node_modules isolation, and pnpm 11's `minimumReleaseAge` supply-chain default. Accepted because a single-package template with a near-zero-dep CLI target (claim-npm precedent, review line 294) makes install speed and hoisting strictness low-impact; npm `overrides`/`npm audit` cover the basics. If the template later grows a monorepo variant, the POC's pnpm record is the starting point — that is a new decision, and pnpm 11 (not 10) would be the baseline.
- **vs Bun**: gives up the fastest all-in-one toolchain (`bun test`, `bun build --compile`). Accepted: Bun would fork the template into dual-runtime territory (Node for consumers, Bun for dev) — the exact error-prone split the POC exhibited — and would break `dependency-review.yml` today. This choice **couples to the test-runner and build-tool topics**: npm/Node keeps the Synthesis's Vitest default unconditional (its "if Bun-as-runtime" contingency at review line 558 never triggers) and leaves tsup/tsc precedents unmodified.
- **Floor >=24 vs >=22**: excludes Node 22 users (maintenance until 2027-04) for ~9 months of its remaining life. Accepted to match org precedent, keep bundled npm ≥11.5.1 for Trusted Publishing, and avoid shipping a floor that goes EOL mid-template-life. `>=22.13` is the defensible relaxation if reach matters more — but then 22.x joins the CI matrix and the npm-10-vs-11 skew must be tested.
- **`devEngines` instead of `packageManager`+Corepack**: `devEngines` is newer and some external tooling does not read it yet; mitigated because `.nvmrc` carries the version for setup-node and version managers, and npm itself enforces `devEngines` on `install`/`ci`/`run`. Declaring `"packageManager": "npm@X"` would pin harder but enforces nothing post-Corepack and antagonizes pnpm-preferring template forkers.
- **Committed lockfile**: noisier dependency-bump diffs (mitigated by Dependabot grouping — CI/deps topic) in exchange for reproducible CI and installs.
- **`.nvmrc` vs `.node-version`**: `.node-version` is the more manager-neutral name, but nvm ignores it; `.nvmrc` is read by nvm, fnm, mise, and setup-node alike. Chosen for coverage; content is a bare major (`24`) so either file format would be trivially switchable.

**9. Migration implications**

- `.python-version` → `.nvmrc` (`24`). `requires-python = ">=3.10"` → `"engines": { "node": ">=24" }` + `devEngines` in `package.json` (package.json itself is owned by the pyproject/build topic).
- `.gitignore`: drop the `uv.lock` ignore lines; do **not** ignore `package-lock.json`; add a comment documenting the intentional commit (source pattern inverted, `py-launch-blueprint/.gitignore:9`; TS_PORT_INDEX.md:259-260).
- Makefile bootstrap: `install-uv`/uv rows → Node checks (`node --version` satisfies `.nvmrc`/engines; install hint via nvm/fnm), keeping the two-tool check table (`just`, `node`) (TS_PORT_INDEX.md:519-524, 989).
- Justfile: `uv`/`uvx` recipe bodies → `npm`/`npx` equivalents; `debug-info` reports node/npm versions (TS_PORT_INDEX.md:64-67, 114-115).
- CI: `astral-sh/setup-uv@v5` + `setup-python` matrix → `actions/setup-node` with `node-version-file: .nvmrc` plus a `[24.x, 26.x]` matrix, `cache: npm`, `npm ci` (workflow detail owned by the CI topic; TS_PORT_INDEX.md:178-182).
- `dependency-review.yml` and `dependabot.yml` carry over unchanged — `package-lock.json` is dependency-graph-native (TS_PORT_INDEX.md:204-205).
- Docs: uv guide → npm dependency-management guide (install/add/remove/lockfile) (TS_PORT_INDEX.md:883-887, 1057-1062); tsconfig `target`/`lib` should track Node 24 capabilities (T-tsconfig topic).

**10. Validation strategy**

- Meta-test (contributors-please pattern, review line 150) asserting package.json invariants: `engines.node` floor, `devEngines` present, `packageManager` absent, and `.nvmrc` content satisfies `engines.node` — ports the source's version-consistency discipline.
- Fresh clone with only Node 24 installed: `make check` passes; `npm ci && npm run build && npm test` succeeds with no other tooling.
- CI green on the 24.x/26.x matrix with `cache: npm` hitting; changing `.nvmrc` observably changes the base job's Node version.
- `npm ci` + `git diff --exit-code package-lock.json` proves the committed lockfile is authoritative; `npm install` on Node 22 triggers the `devEngines` failure (proves enforcement).
- GitHub dependency graph populates from `package-lock.json`; `dependency-review.yml` comments on a dep-bump PR.
- Release-verify job runs `npm publish --dry-run` on Node 24, confirming the bundled npm meets the ≥11.5.1 OIDC floor.

**11. Decision status**

Proposed — orchestrator gates acceptance. Couplings flagged, not decided here: test runner (Vitest default holds since Bun not adopted), build tool (tsup/tsc unaffected), CI workflow details (setup-node/matrix/cache), release workflow (Trusted Publishing floor satisfied), Makefile/Justfile bootstrap swap, tsconfig target. Strongest overrule path: if the orchestrator weights pnpm 11's supply-chain defaults above org uniformity, pnpm 11 is the viable alternative; Bun-as-PM remains blocked by the dependency-graph gap regardless.

# Fragment T02

## T02: Build system and npm packaging for a publishable CLI+library template

**1. Source Python tool or pattern**

- **Build backend**: hatchling + hatch-vcs (with setuptools-scm) — `py-launch-blueprint/pyproject.toml:68-69` (`build-backend = "hatchling.build"`), git-tag-derived dynamic version written to `py_launch_blueprint/_version.py` with `fallback_version = "0.0.1"` and `local_scheme = "no-local-version"` (`pyproject.toml:172-177`).
- **Build invocation**: `uv run hatch build` in the tag-triggered release workflow, followed by a tag-vs-`__version__` mismatch guard; the workflow builds and verifies but never uploads to PyPI (TS_PORT_INDEX.md:225-231).
- **Artifacts**: wheel + sdist with explicit content lists — wheel `packages = ["py_launch_blueprint"]`, sdist `include = ["py_launch_blueprint", "docs", "pyproject.toml", "README.md"]` (`pyproject.toml:179-183`).
- **Entry point**: console script `py-projects = "py_launch_blueprint.projects:main"` (`pyproject.toml:65-66`) — the package is simultaneously an importable library and an installed CLI.

**2. Purpose in the original project**

Produce installable, versioned distribution artifacts for a template that is both a library and a CLI: single-source project metadata in `pyproject.toml`; version derived from git tags (never hand-edited); explicit whitelists of what ships in the wheel/sdist; a packaged CLI entry point (`py-projects`); a tag-triggered CI job proving the artifact builds and the tag matches the package version. Publishing itself was deliberately left opt-in/commented-out (TS_PORT_INDEX.md:229-230).

**3. Existing repo decision, if any**

The review's Synthesis names this exact question as **explicit Phase-4 tie-break #3**: "Build tool: three patterns in play — tsup bundle (agent2linear), plain tsc (claim-npm), ncc committed-dist (contributors-please, action-specific). Fresh research scoped to 'publishable CLI + library template'" (TS_EXISTING_REPO_REVIEW.md:617-619). Constituent decisions:

- **agent2linear (2026-06)**: tsup single-entry ESM bundle, `dts: true`, sourcemaps, `clean: true`, `shims: true`, `#!/usr/bin/env node` shebang via banner; separate `tsc --noEmit` typecheck (TS_EXISTING_REPO_REVIEW.md:61); listed as a reusable decision (line 83).
- **claim-npm (2026-06)**: plain `tsc` to `dist/`, `bin: ./dist/cli.js`, `files: ["dist"]`, `prepublishOnly: npm run build` (TS_EXISTING_REPO_REVIEW.md:298); its own review flags the `moduleResolution: "bundler"`-without-a-bundler pairing as an anti-pattern (line 345).
- **contributors-please / contributors-please-action (2026-06)**: @vercel/ncc bundle **committed** to `dist/` with `git diff --exit-code -- dist` CI gates — explicitly called out as "right for a repo consumed at-ref by a sibling GitHub Action, wrong default for a normal npm library/CLI template" (TS_EXISTING_REPO_REVIEW.md:159-160) and "Committed dist/ … action-runtime requirement, not a general template practice" (Synthesis, lines 650-651).
- **Established defaults that bound this topic**: strict ESM TS config (`"type": "module"`, ES2022, declaration+sourceMap, explicit `.js` extensions) is Synthesis default #3 (lines 567-571); release-please manifest mode + GitHub App token + tag-triggered **npm Trusted Publishing (OIDC)** in a protected environment is Synthesis default #2 (lines 560-566); contributors-please's public-API semver contract (root export only, `.d.ts` snapshot tests) and `check` aggregate script are listed reusable (lines 144-154).

**4. Decision classification**

Split by sub-decision:

- Bundler/build tool: **Fresh research required** (the review explicitly opens tie-break #3), resolved as **Adapt existing repo decision** — keep agent2linear's "bundle the CLI with a tsup-shaped tool" intent, but on tsdown, tsup's designated successor.
- Module format (ESM-only) and declaration files: **Reuse existing repo decision**.
- `exports` map / `bin` / `files` whitelist: **Replace Python-specific tool with TypeScript equivalent** (hatchling wheel/sdist targets → package.json fields).
- Dynamic git-tag versioning (hatch-vcs/setuptools-scm): **Replace Python-specific tool with TypeScript equivalent** (release-please-managed `version` + runtime read from package.json).
- npm provenance/attestations: **Reuse existing repo decision** (contributors-please Trusted Publishing).
- ncc committed-dist: **Omit with rationale** for the main package (retain only if/where the template ships a GitHub-Action flavor — that is a separate topic's scope).

**5. TypeScript/Node options considered** (facts as of 2026-07-07)

| Option | Current fact | Source |
|---|---|---|
| **tsup** | Latest 8.5.1, published 2025-11-12 (~8 months stale). README opens with: "This project is not actively maintained anymore. Please consider using tsdown instead." | npm registry API (`registry.npmjs.org/tsup`, fetched 2026-07-07); https://github.com/egoist/tsup (README notice); maintenance-status issue https://github.com/egoist/tsup/issues/1391 |
| **tsdown** | Latest 0.22.3, published 2026-06-16; actively released (0.22.0 2026-05-07, 0.22.1 05-28, 0.22.2 06-04, 0.22.3 06-16). Lives in the `rolldown` GitHub org; positioned as tsup's successor with a near drop-in migration path (`tsdown migrate from tsup`). dts via `rolldown-plugin-dts`; uses oxc-transform (very fast) when `isolatedDeclarations` is on, falls back to tsc otherwise. Optional `exports: true` auto-generates the package.json `exports` field and recommends publint review. Still **pre-1.0**. | npm registry API (`registry.npmjs.org/tsdown`); https://github.com/rolldown/tsdown; https://tsdown.dev/guide/migrate-from-tsup; https://tsdown.dev/options/dts; https://tsdown.dev/options/package-exports |
| **rolldown** (tsdown's engine) | 1.0 stable announced May 2026 ("Announcing Rolldown 1.0", VoidZero); latest 1.1.4 published 2026-07-01; ships as the production bundler of Vite 8 (stable March 2026). The engine is stable even though tsdown's CLI wrapper is 0.x. | https://voidzero.dev/posts/announcing-rolldown-1-0; npm registry API (`registry.npmjs.org/rolldown`) |
| **plain tsc** | Always current with TypeScript; zero extra deps; per-file emit (no bundling): deep-import surface stays open, no shebang/banner handling, slower cold `npx` installs for CLIs with many files. claim-npm proves it works for a small CLI (TS_EXISTING_REPO_REVIEW.md:298). | claim-npm review; TypeScript docs (general knowledge, no version claim load-bearing) |
| **@vercel/ncc committed dist** | Purpose-built for GitHub Actions' run-a-checked-in-bundle constraint; the org's own review twice rejects it as a general template default (TS_EXISTING_REPO_REVIEW.md:159-160, 650-651). | TS_EXISTING_REPO_REVIEW.md |
| **Publish validation tooling** | publint 0.3.21 (2026-05-13), @arethetypeswrong/cli 0.18.4 (2026-06-22) — both current and maintained. | npm registry API, fetched 2026-07-07 |
| **npm Trusted Publishing / provenance** | Configuring a trusted publisher with GitHub Actions OIDC (`id-token: write`) makes provenance attestations **automatic** for public packages from public repos — no `--provenance` flag needed. Requires npm CLI ≥11.5.1 and Node ≥22.14 on the runner; GitHub-hosted runners only. | https://docs.npmjs.com/trusted-publishers |
| **ESM-only viability** | `require()` of synchronous ESM works unflagged since Node v20.19.0/v22.12.0/v23.0.0 (non-experimental as of v25.4.0), so an ESM-only package remains consumable from CJS on any supported Node ≥20.19. | https://nodejs.org/api/modules.html (Loading ECMAScript modules using `require()`) |

**6. Recommended choice**

1. **Build tool: tsdown** (pin exact 0.22.x), single config `tsdown.config.ts` with two entries — `src/cli.ts` (CLI, shebang) and `src/lib.ts` (library) — ESM output to `dist/`, `dts: true`, sourcemaps, `clean: true`. Keep `tsc --noEmit` as the separate typecheck gate (agent2linear pattern, TS_EXISTING_REPO_REVIEW.md:61). Enable `isolatedDeclarations` in tsconfig so dts uses the fast oxc path (couples to T-tsconfig; T03 now adopts `isolatedDeclarations: true` for the library entry point — D-025).
2. **Module format: ESM-only** (`"type": "module"`), no dual CJS build.
3. **package.json packaging fields, hand-authored** (not tsdown `exports: true` auto-gen):
   - `exports`: root export only — `".": { "types": "./dist/lib.d.ts", "default": "./dist/lib.js" }` plus `"./package.json": "./package.json"`; no deep-import subpaths (contributors-please semver contract: root export is the only stable API, TS_EXISTING_REPO_REVIEW.md:151).
   - `bin`: `{ "<cli-name>": "./dist/cli.js" }` with shebang emitted by the build (claim-npm/agent2linear pattern).
   - `files`: `["dist"]` (claim-npm, TS_EXISTING_REPO_REVIEW.md:298) — whitelist, the npm analog of the wheel/sdist `packages`/`include` lists (README/LICENSE/package.json are auto-included by npm).
   - `engines.node`: floor high enough for require(esm) and Trusted Publishing tooling (org precedent is `>=24` in the two newest repos; exact floor is T-runtime's call — dependency noted).
4. **Version single-sourcing**: replace hatch-vcs git-tag dynamic versioning with release-please-managed `package.json.version` (Synthesis default #2); runtime `--version` reads the packaged package.json (claim-npm `src/cli.ts:10-20` fallback-`0.0.0` pattern or contributors-please JSON-import inlining). Never hardcode the version in source (agent2linear drift bug, TS_EXISTING_REPO_REVIEW.md:100).
5. **Publishing: npm Trusted Publishing (OIDC) with automatic provenance attestations**, tag-triggered, in a protected `npm` GitHub environment, with a tag-vs-package.json version guard — reuse contributors-please `publish.yml` wholesale (TS_EXISTING_REPO_REVIEW.md:134-136). Mirror the source repo's stance by keeping the publish step clearly separable (build+verify always; publish requires the trusted-publisher setup).
6. **ncc committed-dist: omit** from the main package. It solves a GitHub-Actions-runtime constraint the npm template does not have; the org review already rejects it as a general default (TS_EXISTING_REPO_REVIEW.md:650-651).

**7. Rationale**

- The three-way tie-break dissolves on current facts: tsup is formally unmaintained and its own README points to tsdown (github.com/egoist/tsup); ncc-committed-dist was already ruled out in-org for non-Action packages; plain tsc is viable but the review itself criticizes claim-npm's bundler-resolution-without-a-bundler setup and the org's most substantial CLI (agent2linear) deliberately bundles. tsdown preserves the *intent* of the agent2linear decision (one-command bundle + dts + shebang for a CLI) on the maintained successor toolchain.
- tsdown's 0.x version is mitigated by (a) rolldown 1.0-stable underneath (VoidZero announcement, May 2026), (b) the tsup-compatible config surface making a retreat to tsup — or a hop to any future 1.0 — cheap, and (c) the template pinning an exact version.
- tsdown is oxc/VoidZero-ecosystem-native, consistent with the blueprint's stated oxc/Oxlint direction (goal-level alignment; the lint decision itself is another topic).
- ESM-only: every recent org TS repo is `"type": "module"` with no dual build (Synthesis #3); Node ≥20.19 `require(esm)` removes the last consumer-side argument for shipping CJS; dual builds reintroduce the dual-package hazard and double the artifact/test matrix for zero org demand.
- Hand-authored `exports` over tsdown's `exports: true`: a template teaches its exports map; the auto-generator writes back into package.json during builds (a moving file in a template is a diff-noise and review hazard), and tsdown's own docs say to review generated output with publint anyway. publint/attw in the check chain give the same safety with explicit code.
- Trusted Publishing with automatic provenance strictly dominates classic `NPM_TOKEN` + `--provenance`: no long-lived secret, and attestations come for free (docs.npmjs.com/trusted-publishers). It is also already the org's canonical pattern, explicitly maintained as the mirror of py-launch-blueprint's release design (TS_EXISTING_REPO_REVIEW.md:116, 146).

**8. Tradeoffs**

- **tsdown pre-1.0**: config keys may still shift between minors; a template regenerated months later may hit churn. Accepted because the alternative (tsup) is unmaintained — a worse failure mode for a template — and plain tsc sacrifices the bundle/shebang/dts-rollup ergonomics the org's flagship CLI already standardized on. Pin exact and record the fallback (tsup 8.5.1 config is ~drop-in in reverse).
- **Bundling a library** hides internal module structure (good for the semver contract, bad if consumers legitimately need subpath imports). The template's root-export-only contract makes this a feature; projects needing subpaths must add explicit exports entries.
- **ESM-only** cuts off consumers pinned to Node <20.19 CJS. The engines floor already excludes them; documented, not worked around.
- **Trusted Publishing** requires one-time manual npm-side trusted-publisher configuration and only works from GitHub-hosted runners — a template consumer on self-hosted runners must fall back to granular tokens. Document the fallback; keep the version-guard job either way.
- **release-please version vs hatch-vcs**: the TS side loses "version exists only in git tags" purity — package.json carries the version and release-please PRs bump it. This is the org-canonical flow and avoids reinventing setuptools-scm for npm; the tag-vs-package.json guard preserves the source repo's integrity check.

**9. Migration implications**

- `pyproject.toml [project]` metadata → package.json (`name`, `description`, `license: "MIT"`, `author`, `repository`, `keywords`); `[project.scripts]` → `bin`; wheel/sdist target lists → `files: ["dist"]` + npm auto-included files; dev/docs optional-dependency groups → `devDependencies` (docs tooling per T-docs).
- `uv run hatch build` → `tsdown` (plus `npm pack --dry-run` as the artifact-inspection analog of inspecting the wheel); the tag-workflow's version guard ports as tag-vs-package.json comparison (already written in contributors-please publish.yml:55-61).
- New files: `tsdown.config.ts`; new package.json fields: `exports`, `bin`, `files`, `type`, `engines`, `publishConfig` if needed.
- `py_launch_blueprint/_version.py` write-out has no analog; delete the concept. Runtime version comes from package.json.
- Justfile `build` recipe (currently broken in source with a TODO, TS_PORT_INDEX.md:508-511) becomes `just build` → tsdown; fix, don't port, the TODO.
- Couplings (stated, not decided here): package manager (tie-break #1) — tsdown is PM-agnostic; tsconfig topic must set `isolatedDeclarations` for the fast dts path and keep the strict-ESM baseline (T03 adopts `isolatedDeclarations: true` — D-025); release topic owns release-please/publish workflow details; docs topic decides whether any sdist-style docs shipping matters (npm answer: it doesn't — docs stay in the repo/site, not the tarball).

**10. Validation strategy**

- `just build` from a fresh clone produces `dist/cli.js` (executable, shebang first line), `dist/lib.js`, `dist/lib.d.ts` (+ maps); `node dist/cli.js --version` prints the package.json version.
- `npm pack --dry-run` file list contains only `dist/**`, package.json, README, LICENSE (files-whitelist check; contributors-please already runs a pack dry-run in its `check` chain, TS_EXISTING_REPO_REVIEW.md:132).
- `publint` (0.3.21) and `@arethetypeswrong/cli` (0.18.4) pass in the aggregate `check` script — catches exports/types/ESM misconfiguration mechanically.
- Built-artifact smoke test in CI (org pattern: agent2linear hermetic E2E of `dist/index.js`, contributors-please `check-dist-cli.mjs`): install the packed tarball into a temp dir, run the bin, import the library root export from both ESM and (Node ≥20.19) CJS `require`.
- Release path: push a `v*` tag on a test repo with the trusted publisher configured; confirm npm shows the provenance/attestation badge and `npm audit signatures` verifies; push a deliberately mismatched tag and confirm the guard fails (mirrors source-repo validation, TS_PORT_INDEX.md:231).

**11. Decision status**

Proposed — orchestrator gates acceptance. Key open dependency: none blocking within T02; couplings to T-runtime (Node floor), T-tsconfig (`isolatedDeclarations` — adopted by T03, D-025), T-release (release-please/publish workflow ownership) flagged above.

## T03: TypeScript compiler configuration and module format (tsconfig, module/moduleResolution, strictness, source layout)

**Source Python tool or pattern**

Dual strict type checkers: `[tool.mypy]` in `pyproject.toml` with `strict = true` plus every `disallow_*`/`warn_*` flag explicitly enabled (`warn_no_return`, `warn_unreachable`, `warn_return_any`, `warn_unused_ignores`, pretty errors with codes/columns; tests relaxed only for `disallow_untyped_defs` via an override) — `/Users/stevemorin/c/py-launch-blueprint/pyproject.toml` `[tool.mypy]` section — and `pyrightconfig.json` with `typeCheckingMode: "strict"`, `pythonVersion: "3.10"`, and a battery of `report*` diagnostics (unknown types, unnecessary isinstance/cast/comparison, unused import/variable/function/class, duplicate imports) — `/Users/stevemorin/c/py-launch-blueprint/pyrightconfig.json`. Version discipline: Python 3.10 asserted consistently in five places (`requires-python`, mypy, pyright, ruff `target-version`, `.python-version`) per `TS_PORT_INDEX.md:304`. Source layout: package dir `py_launch_blueprint/` + separate `tests/`.

**Purpose in the original project**

The strictest available static analysis in both CI (mypy) and the editor (pyright/Pylance), so developers see identical errors live while typing; dead code and unknown types are errors, not warnings (`TS_PORT_INDEX.md:377`). Single consistent language-version floor across all config surfaces.

**Existing repo decision, if any**

The review's Synthesis §3 establishes "TS config: strict ESM" as an org default to REUSE: `strict: true`, target ES2022, ESM (`"type": "module"`), declaration+sourceMap, explicit `.js` import extensions in every TS repo; "extra strictness flags in the newest (claim-npm noUncheckedIndexedAccess/noImplicitOverride; POC verbatimModuleSyntax). Reuse; consolidate the union of strictness flags" (`TS_EXISTING_REPO_REVIEW.md:567-571`).

On module/moduleResolution the org has two lineages:
- **NodeNext/NodeNext**: contributors-please (`TS_EXISTING_REPO_REVIEW.md:128` — ES2022, NodeNext/NodeNext, strict, rootDir src, outDir dist, `.js` import extensions, JSON import attributes) and contributors-please-action (`TS_EXISTING_REPO_REVIEW.md:189` — same shape, `noEmit: true` because ncc owns emit). These are the newest shipped TS repos (June 2026).
- **bundler resolution**: agent2linear (ESNext/bundler, with tsup actually bundling, `TS_EXISTING_REPO_REVIEW.md:65`) and the POC's shared `@pkg/tsconfig` base (ESNext/bundler + `isolatedModules` + `verbatimModuleSyntax` + `noEmit`, `TS_EXISTING_REPO_REVIEW.md:370`).
- claim-npm pairs `moduleResolution: "bundler"` with a plain-`tsc` no-bundler build, and its own review flags that pairing as a decision NOT to reuse: "a template should pick `NodeNext` (node runtime) or bundler-resolution *with* an actual bundler deliberately" (`TS_EXISTING_REPO_REVIEW.md:345`). claim-npm also contributes the extra-strict flags `noUncheckedIndexedAccess`/`noImplicitOverride`/`noFallthroughCasesInSwitch` (`TS_EXISTING_REPO_REVIEW.md:302,328`).

Layout precedent: `rootDir: src` / `outDir: dist` (contributors-please `TS_EXISTING_REPO_REVIEW.md:128`; claim-npm dist output `TS_EXISTING_REPO_REVIEW.md:298`). Single tsconfig everywhere (no project references); claim-npm excludes tests from the build so tests are "typechecked implicitly by vitest only" (`TS_EXISTING_REPO_REVIEW.md:302`) — a gap relative to the Python source, which mypy-checks `tests/`.

**Decision classification**

Split by sub-decision:
- Dual-checker (mypy+pyright) → single `tsc`: **Replace Python-specific tool with TypeScript equivalent** (the redundancy disappears by design — compiler and editor language service read the same `tsconfig.json`; `TS_PORT_INDEX.md:379`).
- `module`/`moduleResolution` = NodeNext: **Adapt existing repo decision** (pick the NodeNext lineage of two in-org patterns; confirmed against current official guidance).
- Strictness flag set: **Adapt existing repo decision** (consolidate the org union per Synthesis §3, plus additions needed to preserve the mypy/pyright-strict bar).
- `target`/`lib`: **Adapt existing repo decision** (ES2022 org baseline; final value coupled to the Node-floor decision in T01).
- TypeScript version pin (6.0.x) and 7.0-forward-compat constraints: **Fresh research required** (pure currency question; org repos pin 5.3–5.9, all pre-6.0).
- Source layout `src/` rootDir → `dist/` outDir, tests typechecked via a dedicated typecheck config: **Adapt existing repo decision**.

**TypeScript/Node options considered**

Current facts (verified 2026-07-07):
- **TypeScript 6.0.3 is `latest` on npm** (published 2026-04-16); `beta` = 6.0.0-beta, `rc` = **7.0.1-rc** (the Go-native rewrite is at RC) — npm registry API `https://registry.npmjs.org/typescript` dist-tags, fetched directly. TS 6.0 (announced 2026-03-23) changed defaults: `strict: true`, `module: esnext`, `target: es2025`, `types: []` (no more automatic `@types/*` discovery), `rootDir: "."`, `noUncheckedSideEffectImports: true`; and deprecated (error under 7.0, suppressible in 6.0 via `ignoreDeprecations`): `moduleResolution: node`/`classic`, `module: amd/umd/systemjs`, `target: es5`, `esModuleInterop: false`, `baseUrl`-as-resolution-root, `outFile` — https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/. TypeScript 7.0 "targeting mid-2026" is often 10x faster and makes the 6.0 deprecations removals — https://visualstudiomagazine.com/articles/2026/04/21/typescript-7-0-beta-arrives-on-go-based-foundation-with-10x-speed-claim.aspx.
- **Official module guidance** (TypeScript handbook, "Modules — Choosing Compiler Options", https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html): for a library or app that runs on Node.js, use `"module": "nodenext"` (implies `moduleResolution: nodenext` and `esModuleInterop: true`) with `verbatimModuleSyntax: true`; ESM via `"type": "module"`; `.js` extensions required on relative imports. `moduleResolution: bundler` is for code consumed only through a bundler, and the guide explicitly warns **against** combining `"type": "module"` with `bundler` resolution ("Some bundlers adopt different ESM/CJS interop behavior under these circumstances, which TypeScript cannot currently analyze"). For libraries, `nodenext` "prevents you from emitting ESM with module specifiers that only work in bundlers but will crash in Node.js" (also https://blog.andrewbran.ch/is-nodenext-right-for-libraries-that-dont-target-node-js/).
- **Community base configs** confirm the Node pairing: `@tsconfig/node22` = `target: es2022` + `lib: ["es2024", ...]`; `@tsconfig/node24` (v24.0.4 on npm) = `target: es2024`, `module: nodenext`, `strict`, `esModuleInterop`, `skipLibCheck` — https://raw.githubusercontent.com/tsconfig/bases/main/bases/node24.json (fetched), https://www.npmjs.com/package/@tsconfig/node22.

Options for module format:
1. **`module: NodeNext` / `moduleResolution: NodeNext`** — org's newest lineage; official recommendation for Node-run CLIs/libraries; emitted `.d.ts`/`.js` are valid for every consumer; requires explicit `.js` import extensions (already universal org practice, Synthesis §3).
2. **`module: ESNext` / `moduleResolution: bundler`** — org's agent2linear/POC lineage; extensionless imports; requires an actual bundler to own resolution, sits awkwardly with `"type": "module"` per official guidance, and is the pairing claim-npm's review says not to standardize with plain tsc.
3. **`module: preserve`** (TS 5.4+) — bundler-oriented superset; same caveats as (2) for a Node-published CLI.

Options for the strictness set: (a) bare `strict: true` (contributors-please shape); (b) org-union (claim-npm + POC flags); (c) org-union **plus** the flags needed to match mypy `warn_no_return`/`warn_unreachable` and pyright's strict `report*` battery (`noImplicitReturns`, `allowUnreachableCode: false`, `allowUnusedLabels: false`, `exactOptionalPropertyTypes`), with unused-code diagnostics delegated to the linter.

**Recommended choice**

Pin **TypeScript `^6.0.3`** (avoid all 6.0-deprecated options so the config is TS-7-ready). Single-package, ESM-only (`"type": "module"`), plain `src/` → `dist/` layout, two small tsconfigs:

`tsconfig.json` (typecheck surface — src **and** tests, no emit):

```jsonc
{
  "compilerOptions": {
    // Language/runtime — final target/lib value gated by T01 Node floor
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",            // implies moduleResolution NodeNext + esModuleInterop
    "types": ["node"],               // required explicitly since TS 6.0 (types defaults to [])

    // Strictness (union of org flags + mypy/pyright-parity additions)
    "strict": true,                  // explicit even though TS 6.0 defaults it
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,       // mypy warn_no_return
    "allowUnreachableCode": false,   // mypy warn_unreachable
    "allowUnusedLabels": false,
    "exactOptionalPropertyTypes": true,

    // Module hygiene
    "verbatimModuleSyntax": true,    // POC precedent + official recommendation
    "isolatedModules": true,         // implied by verbatimModuleSyntax; kept explicit (POC precedent)
    "isolatedDeclarations": true,    // ADOPTED — enables tsdown's fast oxc dts path (T02 dependency; D-025)
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,

    "noEmit": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

`tsconfig.build.json` (emit surface — src only; **exists only if T02 selects tsc-emit**; if T02 selects a bundler with dts output, drop this file and the bundler owns emit, per contributors-please-action's `noEmit` pattern):

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

**`isolatedDeclarations` — ADOPTED** for the library entry point: `isolatedDeclarations: true` joins the recommended flag set. Tradeoff documented: it requires explicit type annotations on all exported symbols — acceptable for a template with a small, deliberately-designed public API — and in exchange enables tsdown's fast oxc-based dts path that T02's build recommendation depends on. This fulfils T02's stated dependency — reconciled at the Phase 4 gate, D-025. If the annotation cost ever becomes burdensome, the documented fallback is disabling the flag and letting tsdown fall back to tsc-based dts generation.

Deliberately **not** in tsconfig: `noUnusedLocals`/`noUnusedParameters` (pyright `reportUnusedVariable`/`reportUnusedFunction` analogs) — delegated to the T04 linter, which supports the org's `^_`-prefix escape convention and autofix; and `noPropertyAccessFromIndexSignature` — omitted as noise beyond the source repo's bar (`noUncheckedIndexedAccess` already covers the safety intent).

**Rationale**

- **NodeNext over bundler resolution**: the port target is an npm-published, Node-run CLI + library. The official handbook says nodenext for exactly this case and warns against `"type": "module"` + `bundler` resolution — and the org is pure-ESM `"type": "module"` everywhere (Synthesis §3). The two newest shipped org repos (contributors-please, contributors-please-action, June 2026) already use NodeNext; the bundler-resolution repos either have an actual bundler (agent2linear/tsup, POC/Vite) or are explicitly flagged do-not-reuse (claim-npm, `TS_EXISTING_REPO_REVIEW.md:345`). NodeNext is also robust to whichever way T02 goes: tsc, tsup/tsdown, and bun build all consume NodeNext-style source with `.js` extensions, while bundler-resolution source can emit Node-invalid declaration files if T02 lands on unbundled `.d.ts` (Andrew Branch, cited above).
- **Strictness set**: Synthesis §3 mandates consolidating the union (claim-npm's three flags + POC's verbatimModuleSyntax/isolatedModules). The additions (`noImplicitReturns`, `allowUnreachableCode: false`, `allowUnusedLabels: false`, `exactOptionalPropertyTypes`) are what closes the gap to the source's "strictest available static analysis" intent (mypy `warn_no_return`/`warn_unreachable`; pyright strict), per the mapping already sketched in `TS_PORT_INDEX.md:379`.
- **Typechecking tests**: mypy checks `tests/` in the source (with one relaxed flag); claim-npm's exclude-tests-from-tsc approach loses that. The noEmit root config + build config split preserves the source behavior at the cost of one extra small file — an intent-preserving deviation from the org's single-tsconfig habit, and it matches contributors-please-action's `noEmit` root shape.
- **ES2022 target**: unanimous org baseline, including repos with Node >=24 engines (contributors-please, `TS_EXISTING_REPO_REVIEW.md:128`). Kept as the default per the "prior deliberate recent decisions win" rule. However, TS 6.0's own default is now es2025 and `@tsconfig/node22`/`node24` show es2022+lib-es2024 / es2024 are safe on those floors — so if T01 lands on Node >=22, bump `lib` to ES2024 (types only, no emit change); if Node >=24, bumping `target` to ES2024 is safe and recommended. This is a T01-gated adjustment, not decided here.
- **Dual-checker collapse**: in TS the CI checker (`tsc --noEmit` via the Justfile/CI, mirroring `uvx mypy`) and the editor checker (VS Code's TS language service / typescript-language-server) read the same tsconfig, so the mypy+pyright "identical errors in CI and editor" goal is achieved with one config by construction.

**Tradeoffs**

- **NodeNext ergonomics**: explicit `.js` extensions on relative imports are mandatory; some contributors find them unintuitive. The org already lives with this in every TS repo, and oxlint/editor tooling autocompletes them. In exchange: output valid on plain Node, no bundler lock-in, correct unbundled `.d.ts`.
- **`exactOptionalPropertyTypes`** is the strictest flag here and the most likely to cause friction with third-party `.d.ts` that treat `?: T` as `T | undefined`-assignable; `skipLibCheck: true` blunts most of it, but occasional `as`-free workarounds are needed. It exceeds even claim-npm's set — justified only by the source repo's maximal-strictness intent; if it proves too noisy in the POC build-out, dropping it is a one-line, documented retreat.
- **Two tsconfigs vs one**: one extra file and the `-p tsconfig.build.json` flag in the build script; the alternative (single config excluding tests) silently under-checks tests, which contradicts the source.
- **ES2022 target on a modern Node floor** leaves ES2023/24 syntax/library features unusable until the T01-gated bump; the cost of premature bumping (runtime errors on older Node) is worse than the cost of waiting.
- **TS 6.0 vs waiting for 7.0**: 7.0.1-rc exists but is an RC of a full native rewrite; a template should ship on stable 6.0.x. Risk is low because the recommended config avoids everything 7.0 removes.

**Migration implications**

- `pyproject.toml [tool.mypy]` + `pyrightconfig.json` collapse into `tsconfig.json` (+ optional `tsconfig.build.json`); delete both Python files from the ported tree; docs pages describing the dual-checker setup (`TS_PORT_INDEX.md:798` configuration-files doc) must be rewritten for the single-config story.
- Justfile `typecheck` recipe: `uvx mypy py_launch_blueprint/` → `tsc --noEmit` (T06/task-runner topic wires it); CI step likewise (`TS_PORT_INDEX.md:178` CI equivalence).
- The source's five-place version-consistency discipline (`TS_PORT_INDEX.md:304,307`) maps to keeping `engines.node`, `.nvmrc`/`.node-version`, CI matrix, and tsconfig `target`/`lib` in agreement — T01 owns the floor value; T03 consumes it.
- VS Code: drop `ms-python.*`/`matangover.mypy` extension recommendations; the TS language service needs no extension. `pyrightconfig.json`'s JSONC-with-comments style carries over naturally (tsconfig allows comments).
- Couplings, stated not decided: **T02** (build tool) decides whether `tsconfig.build.json` exists (tsc emit) or the root config stays `noEmit` with a bundler owning emit + dts; **T01** (runtime floor) gates the target/lib bump; **T04** (linter) must enable unused-variable/param rules with `^_` allowlist, plus unreachable/unnecessary-condition rules beyond tsc's reach (`TS_PORT_INDEX.md:380` open question resolved in T04's favor for unused-code diagnostics); **T05** (testing) determines whether `tests/**` uses globals (would add `"vitest/globals"` or similar to `types`).

**Validation strategy**

- `tsc --noEmit` passes on the ported source; then seed known-bad snippets and confirm each guard fires: unindexed access without a check (`noUncheckedIndexedAccess`), missing `override` keyword, switch fallthrough, function with a missing return path (`noImplicitReturns`), code after `return` (`allowUnreachableCode`), assigning `undefined` to an optional property (`exactOptionalPropertyTypes`), and a type-only import written as a value import (`verbatimModuleSyntax`) — mirroring the source repo's "deliberately untyped snippet fails typecheck" validation (`TS_PORT_INDEX.md:369`).
- Build with the T02-selected tool and run `node dist/cli.js --help` on a clean checkout — proves NodeNext emit is Node-valid without a bundler present.
- Publish a dry-run pack and compile a downstream consumer file against the generated `.d.ts` under strict NodeNext (contributors-please's `test:public-api` pattern, `TS_EXISTING_REPO_REVIEW.md:132`).
- Confirm no `ignoreDeprecations` is needed under TS 6.0 and, as a smoke check, that `tsc` from the 7.0 RC (`typescript@rc`) accepts the config unchanged.
- Editor parity: open a file with a seeded error in VS Code and confirm the identical diagnostic code appears in-editor and from CLI `tsc`.

**Decision status**

Proposed

# T04 fragment

## T04: Linting and formatting (ruff / taplo / yamlfmt → TS toolchain)

**1. Source Python tool or pattern**

- **ruff** as the single Rust-based tool for lint + format + import sort:
  `[tool.ruff]` in `py-launch-blueprint/pyproject.toml:75-124` — `target-version = "py310"`, `line-length = 88`,
  `lint.select = [E, F, I, B, C4, UP, N, RUF, W, YTT, S]` (S = flake8-bandit security rules), `fix = true`,
  excludes for generated/vendored paths (`py_launch_blueprint/_version.py`, `docs/source/conf.py`), and
  per-file-ignores: `"__init__.py" = ["F401"]`, `"tests/*" = ["S101", "S105", "S106"]` with explanatory comments.
- **Justfile recipes** (`py-launch-blueprint/Justfile:110-142`): `format` = `ruff format` + `ruff check --select I --fix`
  (import sort as a formatting step); `lint` = `ruff check`; `format-toml`/`check-toml` = `taplo format/check *.toml --config .taplo.toml`;
  `check-deps` requires taplo, go, yamlfmt (`Justfile:88-90`).
- **taplo** TOML formatter with `.taplo.toml` (line-width 80, indent 4, align-entries/comments, LF —
  TS_PORT_INDEX.md `.taplo.toml` entry, lines 324-333).
- **google/yamlfmt** with `.yamlfmt` (2-space indent, LF, max_width 160, retain-line-breaks, indentless arrays;
  wired into pre-commit — TS_PORT_INDEX.md `.yamlfmt` entry, lines 336-345).
- CI runs `uvx ruff check`, `taplo check '**/*.toml'`, and the pre-commit suite (TS_PORT_INDEX.md ci.yaml entry, line 178).

**2. Purpose in the original project**

One fast, autofixing tool gates code style, correctness, import order, and basic security (bandit) locally and in CI;
*every* config-file format in the repo is machine-formatted (TOML via taplo, YAML via yamlfmt) so there is no style
drift or bikeshedding; tests and `__init__.py` get documented, narrowly-scoped relaxations instead of global rule
downgrades. Intent to preserve: (a) minimal tool count / Rust-speed feedback, (b) lint + format + import-sort as one
gated surface, (c) machine-formatted config files, (d) per-context relaxations, (e) some security-rule coverage.

**3. Existing repo decision, if any**

- **POC (smorin/poc-typescript-bun-trpc-vite, Jan 2026): Biome 2 as primary linter + formatter**, deliberately upgraded
  1.9.4 → 2.3.12; formatter: 2-space, lineWidth 100, single quotes, semicolons, trailingCommas es5, organizeImports on;
  plus a narrow type-aware ESLint layer (no-floating-promises etc.) intended for CI. Its written decision record
  **explicitly rejected Oxlint** because "Oxlint does NOT have a formatter; Oxfmt is in alpha as of Jan 2026"
  (TS_EXISTING_REPO_REVIEW.md:372, 389-390, 410).
- **agent2linear**: legacy ESLint 8 + Prettier (semi, single quotes, printWidth 100, trailingComma es5) with
  `eslint-plugin-simple-import-sort` and `^_` unused-arg convention; the review marks the ESLint-8 stack as
  not-to-reuse but the import-sort and `^_` conventions as worth carrying (TS_EXISTING_REPO_REVIEW.md:67, 96).
- **contributors-please / contributors-please-action / claim-npm / difftree-action: no JS linter or formatter at all** —
  explicitly recorded as gaps, not decisions (TS_EXISTING_REPO_REVIEW.md:130, 191, 247, 304).
- **Synthesis**: lint/format is **explicit Phase-4 tie-break #2** — "no org standard … The POC rejection is 6 months
  old — re-check Oxlint/Oxfmt maturity as of mid-2026 before deciding" (TS_EXISTING_REPO_REVIEW.md:612-616). The
  review also states "the port targets oxc/Oxlint" as the domain-spec direction (TS_EXISTING_REPO_REVIEW.md:96).
- POC's warn-level rule laxity is explicitly marked not-to-reuse — "should be errors in a template"
  (TS_EXISTING_REPO_REVIEW.md:404).

**4. Decision classification**

Split:
- Primary linter + formatter (ruff replacement): **Fresh research required** (Synthesis tie-break #2; resolved below).
- Formatter style options (width/quotes/semis/trailing commas): **Adapt existing repo decision** (agent2linear Prettier + POC Biome agree).
- Import sorting: **Replace Python-specific tool with TypeScript equivalent** (ruff `I` → Oxfmt `sortImports`).
- Per-context relaxations (tests, `__init__.py`): **Adapt existing repo decision** (ruff per-file-ignores → oxlint `overrides`).
- Security rules (ruff `S`/bandit): **Adapt existing repo decision** (no 1:1 native equivalent; layered coverage below).
- taplo (TOML formatter): **Omit with rationale** (conditional on the cog.toml/release-tooling topic; Oxfmt covers TOML if any survives).
- yamlfmt (YAML formatter): **Omit with rationale** (consolidated into Oxfmt's YAML support; fallback documented).

**5. TypeScript/Node options considered** (versions verified against primary sources on 2026-07-07)

1. **Oxlint + Oxfmt (oxc project)** — domain-spec candidate.
   - Oxlint **1.73.0** on npm, published 2026-07-06/07 (`npm view oxlint version dist-tags`, 2026-07-07); 1.0 stable
     since mid-2025 (https://voidzero.dev/posts/announcing-oxlint-1-stable). **841 built-in rules**; built-in plugins:
     eslint, typescript, unicorn, oxc (default) + react, import, node, promise, jsdoc, jsx-a11y, jest, vitest, vue, etc.
     — **no dedicated security plugin** (https://oxc.rs/docs/guide/usage/linter/plugins). Seven categories
     (correctness default, suspicious, pedantic, style, restriction, perf, nursery) and an **`overrides` array with
     `files` globs + per-glob `rules`/`plugins`** — direct per-file-ignores equivalent
     (https://oxc.rs/docs/guide/usage/linter/config). **Type-aware mode** (`--type-aware`, requires
     `oxlint-tsgolint` — npm 0.24.0 — and TypeScript 7.0+/tsgo) covers **59/61 typescript-eslint type-aware rules**
     incl. `no-floating-promises`; docs caveat: "rule coverage is incomplete (but very close)", high memory on very
     large codebases (https://oxc.rs/docs/guide/usage/linter/type-aware.html). JS-plugin support (ESLint-v9-compatible
     API) is **alpha** (https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha).
   - Oxfmt **0.58.0** on npm, last published 2026-07-06 (`npm view oxfmt version time`, 2026-07-07) — **beta since
     2026-02-24, pre-1.0**. Passes **100% of Prettier's JS/TS conformance tests**; formats "JavaScript, JSX,
     TypeScript, TSX, JSON, JSONC, JSON5, **YAML, TOML**, HTML, Vue, Svelte, CSS, SCSS, Less, **Markdown**, MDX,
     GraphQL…"; adopted by Vue.js, Turborepo, Sentry; >30x faster than Prettier, 3x faster than Biome
     (https://oxc.rs/blog/2026-02-24-oxfmt-beta, https://oxc.rs/docs/guide/usage/formatter.html). Built-in
     **`sortImports`** option (eslint-plugin-perfectionist-like algorithm, off by default); Prettier-compatible options
     incl. `printWidth` (default 100), `singleQuote`, `semi`, `trailingComma`, `endOfLine: lf`
     (https://oxc.rs/docs/guide/usage/formatter/config-file-reference).
2. **Biome** — the POC's choice. **@biomejs/biome 2.5.2** latest on npm (`npm view @biomejs/biome dist-tags`,
   2026-07-07). v2.5 shipped 500 lint rules, plugin code fixes, cross-file linting
   (https://biomejs.dev/blog/biome-v2-5/). Single stable binary for lint + format + import organize, `overrides`
   support, small `security` rule group (DOM/React-oriented). **Does not format YAML, TOML, or Markdown**: YAML parser
   "almost ready" but unshipped, Markdown unimplemented and seeking contributors per the 2026 roadmap
   (https://biomejs.dev/blog/roadmap-2026/, https://biomejs.dev/internals/language-support/) — so taplo/yamlfmt (or
   Prettier) must be kept alongside it.
3. **ESLint + Prettier** — ESLint **10.6.0**, Prettier **3.9.4** (`npm view`, 2026-07-07). Maximum ecosystem
   (eslint-plugin-security 4.0.1, actively maintained — modified 2026-06-12, `npm view eslint-plugin-security`), but
   two slower JS-based tools + plugin config sprawl; org's only precedent is the EOL ESLint-8 stack explicitly marked
   not-to-reuse (TS_EXISTING_REPO_REVIEW.md:96), and still needs taplo/yamlfmt or Prettier-YAML for config files.
4. **taplo (keep)** — npm distribution `@taplo/cli` stale at **0.7.0, last modified 2024-02-01** (`npm view`,
   2026-07-07); source repo installs it via `cargo install` (Justfile:103-105), a Rust-toolchain dependency a TS
   template should not require.
5. **yamlfmt (keep)** — maintained Go binary, but requires `go`/`make install-yamlfmt` bootstrap (Justfile:89-90);
   redundant if the main formatter handles YAML.

**6. Recommended choice**

- **Oxlint (pinned 1.x, currently 1.73.0) as the linter** — categories `correctness` + `suspicious` at **error**
  severity (POC's warn-laxity explicitly not reused), plugins `typescript`, `import`, `promise`, `node`, `unicorn`,
  `vitest`; unused-vars configured with the `^_` prefix convention carried from agent2linear. Type-aware mode
  (`oxlint-tsgolint`) **documented as opt-in, not default** — it requires TypeScript 7/tsgo, which couples to the
  T-typecheck topic (dependency stated, not decided here).
- **Oxfmt (pinned exact version, currently 0.58.0) as the formatter** for TS/JS/JSON/YAML/Markdown (+TOML if any
  survives), with `sortImports` enabled and org-consistent style: `printWidth: 100`, `singleQuote: true`,
  `semi: true`, `trailingComma: "es5"`, `endOfLine: "lf"`.
- **Per-context relaxations** via `.oxlintrc.json` `overrides` for `tests/**` / `**/*.test.ts` (e.g. allow
  non-null assertions, magic numbers, `no-console`; exact rule list finalized at scaffold time) — preserving the
  documented-per-file-ignores pattern, with comments explaining each relaxation as the source does.
- **Security-rule coverage (ruff `S`) layered**: (a) enable oxlint's security-adjacent built-ins (`no-eval` and
  related restriction/suspicious rules); (b) rely on the **CodeQL workflow** already in the source repo's CI (ported
  under the CI topic — cross-topic dependency, not re-decided here) for real security scanning; (c) record
  `eslint-plugin-security` (4.0.1, active) via Oxlint's ESLint-compatible JS plugins as a **deferred follow-up** once
  that API leaves alpha.
- **Omit taplo**; **omit yamlfmt** — Oxfmt formats YAML (and TOML) directly, collapsing three source-side formatters
  (ruff format, taplo, yamlfmt) into one tool. `.taplo.toml`, `.yamlfmt`, `just install-taplo`, and the taplo/yamlfmt
  entries in `check-deps`/CI are dropped; `just format`/`just lint`/`just check-*` recipe names are kept with Oxfmt/
  Oxlint bodies (Justfile itself is a cross-platform keep per port rules).

**7. Rationale**

- The Synthesis explicitly reopened this decision and instructed a mid-2026 maturity re-check
  (TS_EXISTING_REPO_REVIEW.md:615-616). The POC's **sole stated reason** for rejecting oxc — "Oxlint does NOT have a
  formatter; Oxfmt is in alpha" (TS_EXISTING_REPO_REVIEW.md:372) — is empirically obsolete: Oxfmt is in beta with
  100% Prettier JS/TS conformance, weekly releases, and major adopters (oxc.rs beta post, npm publish dates).
- **Intent preservation is strongest with the oxc pair**: the source's defining pattern is "one fast Rust tool for
  lint+format+imports, and every config format machine-formatted". Biome still cannot format YAML/TOML/Markdown
  (Biome 2026 roadmap), so choosing it forces the template to keep yamlfmt (+ possibly taplo) — reproducing exactly
  the multi-binary sprawl ruff existed to avoid. Oxfmt formats all of them.
- The POC's second component — a type-aware ESLint CI layer for promise safety — is subsumed by Oxlint's type-aware
  mode (59/61 typescript-eslint rules incl. `no-floating-promises`), removing the need for any ESLint dependency.
- Domain spec names oxc/Oxlint as the target; the Phase-3 review already records "the port targets oxc/Oxlint"
  (TS_EXISTING_REPO_REVIEW.md:96). Import-sort (`eslint-plugin-simple-import-sort` precedent) and `^_` conventions
  carry over via Oxfmt `sortImports` + oxlint rule config.
- Style options (100-col, single quotes, semis, es5 trailing commas) are where the existing repos *agree*
  (agent2linear `.prettierrc.json`, POC `biome.json` — TS_EXISTING_REPO_REVIEW.md:67, 372), so those are reused
  rather than re-derived; the source's 88-col ruff width is a Python-community norm, not a portable intent.

**8. Tradeoffs**

- **Oxfmt is pre-1.0 (0.58.0)** — the honest version of the POC's objection still holds in the strict sense
  ("no *stable* formatter"). Mitigation: pin the exact version in package.json/lockfile and bump deliberately;
  formatter output churn across 0.x bumps is caught by the CI format-check. If the orchestrator weights binary
  stability above consolidation, **Biome 2.5.2 + yamlfmt (and no TOML formatter) is the documented fallback**, and it
  is the existing-repo default — this recommendation consciously deviates from that default for the reasons above.
- Two binaries (oxlint + oxfmt) vs Biome's one; both are zero-config npm devDependencies, so bootstrap cost is
  equivalent (and strictly better than cargo-install taplo + go-install yamlfmt).
- **No native bandit equivalent**: neither Oxlint nor Biome ships a node-security plugin; ruff-`S` intent is only
  approximated (built-in no-eval-class rules + CodeQL + deferred eslint-plugin-security). This is an ecosystem gap,
  not a tool-choice artifact — ESLint is the only stack with first-class eslint-plugin-security today, and adopting
  ESLint solely for that contradicts every other constraint.
- Oxfmt's YAML/TOML output is Prettier-style, not taplo's aligned-entries/4-space style nor yamlfmt's exact knobs —
  the *intent* (deterministic machine formatting) is preserved, the exact bytes are not.
- Oxlint type-aware mode's TS-7/tsgo requirement couples to the typechecker topic; leaving it opt-in avoids blocking
  T04 on that decision but means promise-safety rules are not on by default at scaffold time.

**9. Migration implications**

- New files: `.oxlintrc.json` (categories, plugins, `overrides` for tests, `^_` unused-var config) and `.oxfmtrc.json`
  (style options + `sortImports`). Dropped files: `.taplo.toml`, `.yamlfmt` (and their docs pages
  `docs/source/tools/taplo.md` per the INDEX cross-reference at TS_PORT_INDEX.md:332).
- Justfile: keep recipe names/aliases (`format`/`f`, `lint`/`l`) with Oxfmt/Oxlint bodies; delete `install-taplo`,
  `format-toml`/`check-toml` (or repoint to `oxfmt` if TOML files survive); remove taplo/go/yamlfmt from `check-deps`.
- CI (`ci.yaml` port): replace `uvx ruff check` with `oxlint`, replace `taplo check '**/*.toml'` with an
  `oxfmt --check`-style step covering all formatted types; hook manager (T-hooks topic) swaps the ruff/taplo/yamlfmt
  pre-commit entries for oxlint + oxfmt equivalents.
- Issue/PR templates and `just debug-info` tool lists must name oxlint/oxfmt versions (TS_PORT_INDEX.md:64-67, 151).
- **Cross-topic dependencies (stated, not decided here)**: (1) **cog.toml** — if the release-tooling topic keeps
  cocogitto, the repo retains one TOML file; Oxfmt formats it, so no taplo revival is needed either way (Synthesis
  default is release-please, whose config is JSON — TS_EXISTING_REPO_REVIEW.md:560-566). (2) **Typechecker topic** —
  Oxlint type-aware default-on is revisited if T-typecheck lands on TS7/tsgo. (3) **CI topic** owns the CodeQL
  workflow that carries the security-scanning intent.

**10. Validation strategy**

- Scaffold check: `oxlint` and `oxfmt --check` run clean on the ported repo in CI and via `just lint` / `just format`.
- **Confirm Oxfmt actually formats the repo's YAML by default** (run against `.github/workflows/*.yml`); if YAML/TOML
  requires opt-in or proves unstable in the pinned version, fall back to keeping `.yamlfmt` + yamlfmt (documented
  fallback) without changing the main lint/format choice.
- Negative tests (mirrors source pre-commit validation): introduce a lint violation, an unformatted file, an unsorted
  import block, and a test-file-only relaxation case; assert lint/format checks fail on the first three and the
  `overrides` glob permits the fourth.
- Verify import-sort output is stable/idempotent (run `oxfmt` twice, diff empty).
- Meta-check: no `*.toml` tracked (or, if cog.toml survives, `oxfmt --check` covers it) and no orphaned
  taplo/yamlfmt references remain (grep Justfile, CI, docs, issue templates).

**11. Decision status**

Proposed — orchestrator gates acceptance. Note for the gate: this resolves Synthesis tie-break #2 **against** the
existing-repo default (POC's Biome) on documented fresh evidence; if the gate prefers the stability-first reading,
the Biome 2.5.2 + yamlfmt fallback in §8 is the alternative package.

# T05 fragment

## T05: Type Checking Strategy (tsc --noEmit gate; dual-checker question; just recipe)

**Source Python tool or pattern**

The source repo runs a deliberate dual-checker setup:

- **mypy strict** as the CI/command-line gate: `[tool.mypy]` in `pyproject.toml` with `python_version = "3.10"`, `strict = true` plus additional disallow-*/warn-* flags, and a `tests.*` override relaxing `disallow_untyped_defs` (/Users/stevemorin/c/py-launch-blueprint/pyproject.toml:131-170). Invoked via a first-class Justfile recipe: `@typecheck:` runs `uvx --with-editable . mypy {{py_package_name}}/`, aliased `tc`, and composed into `@check: test lint typecheck` (/Users/stevemorin/c/py-launch-blueprint/justfile:144-165). CI runs `uvx mypy py_launch_blueprint/` directly, and mypy also runs as a pre-commit hook.
- **pyright strict** for the editor: `pyrightconfig.json` with `typeCheckingMode: "strict"`, `pythonVersion "3.10"`, and a battery of extra `report*` diagnostics (unknown types, unnecessary isinstance/cast/comparison, unused import/variable/function/class, `reportPrivateUsage` as warning) (/Users/stevemorin/c/py-launch-blueprint/pyrightconfig.json, whole file).

**Purpose in the original project**

Two independent strict type checkers so that (a) CI has a scriptable, authoritative gate (mypy), and (b) developers see equally strict errors live in VS Code via Pylance/pyright while typing — "the strictest available static analysis in both CI and the editor so developers see identical errors live" (TS_PORT_INDEX.md:377). The duplication exists because in Python the CLI checker and the editor language server are genuinely different engines with different rule sets; running both catches more and keeps the editor honest. The Justfile makes typecheck a named, aliased, composable recipe (`typecheck`/`tc`, part of `check`).

**Existing repo decision, if any**

- **`tsc --noEmit` is the uniform in-org typecheck gate.** Every recent org TS repo uses plain `tsc` as the typechecker, separate from build: agent2linear has a dedicated `tsc --noEmit` script and CI step (TS_EXISTING_REPO_REVIEW.md:61, :71); claim-npm has a separate `"typecheck": "tsc --noEmit"` script (TS_EXISTING_REPO_REVIEW.md:302); contributors-please sets `"noEmit": true` so "tsc is type-check-only" with the bundler owning emit (TS_EXISTING_REPO_REVIEW.md:185, :189); the POC monorepo runs `turbo typecheck` in CI between lint and build (TS_EXISTING_REPO_REVIEW.md:376). No org repo runs a second TS type checker of any kind.
- **Typecheck as a first-class just recipe is established org practice** (the "difftree pattern"): difftree's justfile has `just typecheck` as a distinct recipe from build/test (mapping to `cargo check` in that Rust repo — "typecheck is a first-class named task", TS_EXISTING_REPO_REVIEW.md:487) and the Synthesis names the canonical recipe vocabulary to reuse: `default` = `just --list`, `build`, `format`, `format-check`, `lint`, `typecheck`, `test`, `run *ARGS`, `all: format lint typecheck test` (TS_EXISTING_REPO_REVIEW.md:514; Synthesis item 7 at :587-590 — "Task runner: Justfile as command surface... Reuse").
- **Strictness flags**: the Synthesis (item 3, TS_EXISTING_REPO_REVIEW.md:569-571) directs consolidating the union of org strictness flags (`strict` + claim-npm's `noUncheckedIndexedAccess`/`noImplicitOverride`/`noFallthroughCasesInSwitch`, POC's `verbatimModuleSyntax`) — the flag set itself belongs to the tsconfig topic, not T05 (see Migration implications).
- The port index already anticipates the dual-checker collapse: "in TS the compiler and the editor language service read the same file, so the dual-checker redundancy disappears by design" (TS_PORT_INDEX.md:379).

**Decision classification**

Split into three sub-decisions:

1. CI/CLI typecheck gate = `tsc --noEmit` — **Reuse existing repo decision**.
2. Second-checker analogue (pyright's role) — **Replace Python-specific tool with TypeScript equivalent** (the "equivalent" is the built-in tsserver/language service reading the same tsconfig; the *second engine* is **Omit with rationale**, with tsgo/TS-native documented as a tracked upgrade path, not a parallel checker).
3. Typecheck as first-class just recipe with `tc` alias, composed into `check`/`all` — **Reuse existing repo decision** (difftree pattern; also preserves the source justfile shape).

**TypeScript/Node options considered**

Current facts, verified 2026-07-07:

- **TypeScript (stable, JS-based)**: npm `latest` = **6.0.3** (published 2026-04-16); dist-tags confirmed directly from the npm registry (https://registry.npmjs.org/typescript, fetched 2026-07-07: `latest: 6.0.3`, `rc: 7.0.1-rc`, `beta: 6.0.0-beta`). TypeScript 6.0 GA'd March 2026 and is "the last release based on the current JavaScript codebase" (https://visualstudiomagazine.com/articles/2026/03/23/typescript-6-0-ships-as-final-javascript-based-release-clears-path-for-go-native-7-0.aspx).
- **TypeScript 7.0 (Go-native, "tsgo" lineage)**: **7.0.1-rc published 2026-06-18** under the standard `typescript` package (`npm install -D typescript@rc`); the binary is `tsc`, not `tsgo` — the `tsgo` name persists only in nightlies. GA "within the next month" of the RC per Microsoft, i.e. imminent as of 2026-07-07 but **not yet on `latest`** (npm registry dist-tags, above; https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/). Parity claim: code that compiles cleanly under 6.0 (with `stableTypeOrdering`, no `ignoreDeprecations`) "should compile identically in TypeScript 7.0"; known gaps are JS/JSDoc checking patterns (`@enum`, Closure-style) and the **stable programmatic API is deferred to TS 7.1** ("several months away") (same RC announcement; differences tracked in https://github.com/microsoft/typescript-go/blob/main/CHANGES.md).
- **`@typescript/native-preview` (tsgo nightlies)**: still actively published — `latest: 7.0.0-dev.20260706.1`, published 2026-07-06 (npm registry https://registry.npmjs.org/@typescript/native-preview, fetched 2026-07-07). Ships the `tsgo` binary + an LSP consumed by the "TypeScript Native Preview" VS Code extension.
- **Editor checking**: VS Code's TypeScript language service (tsserver, and the native-preview LSP for TS 7) is **the same checker engine as `tsc`, reading the same `tsconfig.json`**. There is no independent second-engine TS checker with a different rule set the way pyright is to mypy. The one drift risk is *version* skew (VS Code's bundled tsserver vs the project's pinned `typescript`); VS Code can be pinned to the workspace-installed package via the `js/ts.tsdk.path` workspace setting (formerly `typescript.tsdk`) pointing at `./node_modules/typescript/lib`, activated by "TypeScript: Select TypeScript Version" (https://code.visualstudio.com/docs/typescript/typescript-compiling, fetched 2026-07-07). (The only ecosystem candidates for "different engine" checking — e.g. Vitest's `typecheck` mode — still shell out to `tsc`/`vue-tsc`; linters like typescript-eslint/Oxlint's type-aware rules are lint, not a type checker, and belong to the lint topic.)

Options for the gate:

| Option | Facts | Assessment |
|---|---|---|
| A. `tsc --noEmit` on `typescript@latest` (6.0.3) | Stable GA; matches all 4 org repos | Baseline; boring and correct |
| B. `tsc --noEmit` on `typescript@rc` (7.0.1-rc) | 10x faster, RC quality, GA ~weeks away | Premature for a template today; template consumers inherit RC risk |
| C. Dual: tsc 6 gate + `tsgo` (native-preview) advisory second run | Mimics mypy+pyright | Same engine lineage, not an independent checker; adds a nightly dep to a template; redundancy the port index already flags as dissolving by design |
| D. Vitest `--typecheck` for test-file type errors | Runs tsc under the hood | Not a second checker; optional test-topic detail, not T05's gate |

**Recommended choice**

1. **Gate**: `tsc --noEmit` using `typescript` at current stable (6.0.x now), run as a dedicated script/step distinct from build and lint, in CI and in `prepublishOnly`-style composite gates.
2. **Second checker**: **none**. Editor strictness parity is achieved structurally: the editor's tsserver reads the identical `tsconfig.json` the CI gate uses — single source of truth replaces the mypy/pyright duplication. Close the remaining version-skew gap by committing `.vscode/settings.json` with `"js/ts.tsdk.path": "./node_modules/typescript/lib"` so the editor engine is the same pinned `typescript` package the gate runs. Document (in the template README/decision record) that TS 7 (Go-native, the tsgo lineage) is the planned drop-in upgrade at GA — same package name, same `tsc` binary, ~10x faster — and that anyone wanting a preview of it in the editor can install the TypeScript Native Preview VS Code extension without changing the CI gate.
3. **Justfile**: first-class `typecheck` recipe with alias `tc` running `tsc --noEmit` (via the chosen package manager's exec), composed into `check`/`all` exactly per the difftree recipe vocabulary (`all: format lint typecheck test`).

**Rationale**

- Preserves intent, not tool names: the source's intent is "maximum static strictness enforced identically in CI and editor." In Python that requires two engines; in TS one engine serves both surfaces from one config file, so a single strict `tsc` **is** the faithful port of the dual-checker intent (TS_PORT_INDEX.md:379 reached the same conclusion during indexing).
- Reuses a unanimous org decision: `tsc --noEmit` as a separate typecheck step appears in every recent org TS repo (TS_EXISTING_REPO_REVIEW.md:61, :185, :302, :376) — the Synthesis treats prior deliberate decisions as defaults, and there is no reason to deviate.
- TS 7 RC is not yet `latest` on npm (verified 2026-07-07); a template should pin what `npm install -D typescript` gives consumers today. Because 7.0 ships under the same package/binary, the upgrade at GA is a version bump, not a strategy change — so the strategy is already 7-ready.
- Rejecting option C: institutionalizing a tsgo-nightly second checker would hard-code a transition-period artifact (the tsgo binary name is already being retired in favor of `tsc` at RC) and violates the "second checker must be a different engine to add value" logic that justified pyright alongside mypy.

**Tradeoffs**

- **Speed**: staying on tsc 6 forgoes the ~10x native-compiler speedup until 7.0 GA. Acceptable for a single-package CLI template where typecheck is seconds, and self-resolving within weeks.
- **Lost pyright extras**: pyright's unused-import/variable/function/class and unnecessary-cast/comparison diagnostics exceed tsc's reach (`noUnusedLocals`/`noUnusedParameters` cover part). The remainder maps to type-aware lint rules — explicitly deferred to the lint topic (see coupling below), so no coverage is silently dropped, it moves columns.
- **Single-engine monoculture**: a tsc bug/blind spot has no independent cross-check. This is the ecosystem norm; no practical alternative engine exists.
- **TS 7 JS/JSDoc gaps**: irrelevant here (TS-only source tree), but worth a line in the upgrade note since template consumers may add JS files.

**Migration implications**

- `[tool.mypy]` (pyproject.toml:131-170) + `pyrightconfig.json` collapse into the single `tsconfig.json`; the exact strictness flag set (union of `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, ...) is decided by the **tsconfig topic** per Synthesis item 3 (TS_EXISTING_REPO_REVIEW.md:569-571) — T05 depends on it but does not decide it.
- The mypy `tests.*` leniency override has a TS analogue decision: either typecheck tests under the same strict tsconfig (recommended default; org repos typecheck tests via vitest or a second tsconfig) or a `tsconfig.test.json` with relaxations — flag for the tsconfig topic.
- Justfile: port `@typecheck:` body from `uvx ... mypy py_launch_blueprint/` to `tsc --noEmit` (invoked via the chosen package manager — **couples to the package-manager topic**); keep alias `tc`, keep membership in `check`; legacy `typecheck-pip` recipe (justfile:405-410) has no TS analogue — omit.
- CI: replace the `uvx mypy py_launch_blueprint/` step (TS_PORT_INDEX.md:178) with `tsc --noEmit` (TS_PORT_INDEX.md:181 already sketches this).
- Pre-commit/git-hook mypy hook maps to a `tsc --noEmit` hook invocation — **couples to the git-hooks topic** (hook manager TBD, TS_EXISTING_REPO_REVIEW.md Synthesis conflict 5).
- VS Code: drop `ms-python.mypy`/`pylance` extension recommendations; the built-in TS language service needs no extension. Delete `pyrightconfig.json` (do not port). Commit the `js/ts.tsdk.path` workspace-version pin in `.vscode/settings.json` — this, plus `typescript` pinned once in devDependencies, preserves the source repo's version-consistency discipline (TS_PORT_INDEX.md:304,307) with a single source of truth. Optionally recommend "TypeScript Native Preview" as a commented/optional entry until 7.0 GA.
- Unused/unnecessary-code diagnostics beyond tsc — **couples to the lint topic** (typescript-eslint `no-unnecessary-condition` analogues vs Oxlint type-aware rules; TS_PORT_INDEX.md:380 raises exactly this). Current fact for that topic: Oxlint type-aware linting reached **alpha on 2026-07-02**, powered by `tsgolint` (built on typescript-go, maintained by VoidZero, 59/61 typescript-eslint type-aware rules; targets TS 7) — https://voidzero.dev/posts/announcing-oxlint-type-aware-linting-alpha, https://github.com/oxc-project/tsgolint. If the lint topic adopts it, lint partially couples to the TS 7 timeline; the T05 gate is unaffected either way.
- Post-GA follow-up task for the template: bump `typescript` to 7.x when `latest` flips, re-run the full gate, note the `stableTypeOrdering` parity precondition.

**Validation strategy**

- `just typecheck` and `tsc --noEmit` exit 0 on the clean tree and are listed by `just --list` under the dev group with alias `tc`.
- Negative tests: snippets exercising ported diagnostics (implicit any, unchecked index access, missing return, unused local) each fail `tsc --noEmit` with the expected error code — mirroring the port-index validation sketch (TS_PORT_INDEX.md:381).
- Editor parity: open the same failing snippet in VS Code; confirm the status bar shows the workspace TypeScript version (from the `js/ts.tsdk.path` pin) and identical diagnostics appear live from tsserver (proves the single-config, single-version, two-surfaces claim).
- CI: the typecheck step is present, distinct from build/lint/test, and fails the workflow on a seeded type error.
- Forward-compat probe (non-gating): `npx -p typescript@rc tsc --noEmit` passes on the template, confirming the TS 7 upgrade path.

**Decision status**

Proposed — orchestrator gates acceptance.

# Fragment T06

## T06: CLI framework and UX libraries (click / rich / questionary / pyperclip → TS)

**1. Source Python tool or pattern**

- **click** — single flat command `py-projects` with nine declarative `@click.option`s, `click.Choice(["text","json","csv"])`, `click.Path(exists=True)` for `--config`, auto `--help`, `@click.version_option`, click-native usage-error exit 2 (`py_launch_blueprint/projects.py:317-344`; `pyproject.toml:64-65`).
- **rich** — dual `Console()`/`Console(stderr=True)` split (`projects.py:48-50`), `rich.table.Table` preview (Project Name/Workspace, +ID under `--verbose`, `projects.py:302-314`), indeterminate `rich.progress.Progress` spinner around the fetch (`projects.py:358-362`), red/yellow/green color vocabulary.
- **questionary** — `questionary.checkbox` interactive multi-select with `Choice(title=f"{name} ({workspace})", value=<full project dict>)` label-for-humans/value-for-code pattern; empty selection is a graceful exit-0 no-op (`projects.py:372-385`).
- **pyperclip** — `--copy` flag copies the exact formatted result string to the clipboard (`projects.py:398`).
- Exit-code ladder as implemented: 0 success (incl. benign empty results), 1 config/no-token (`projects.py:270,353`), 3 API error (`projects.py:403`), 4 unexpected exception (`projects.py:408`); click supplies 2 for usage errors. The documented table in `EXAMPLECLI.md` (0 success / 1 config / 2 auth / 3 API / 4 I/O / 5 interrupt) does not match the implementation (TS_PORT_INDEX.md:1341).
- Known dead surface not to copy: `--no-color` declared but never read (`projects.py:331,341`; TS_PORT_INDEX.md:1415-1423); fuzzy search advertised but unimplemented (TS_PORT_INDEX.md:1425-1433 — owned by the fuzzy-search/deps topic, noted here only because some prompt libs bundle filtering).

**2. Purpose in the original project**

The demo CLI is the template's single teaching artifact: it exists to exercise the toolchain and to demonstrate the org's CLI quality bar — declarative parsing with framework-level validation, stdout=data/stderr=diagnostics, differentiated exit codes, layered config, interactive selection as a mockable pipeline stage, and orthogonal result sinks (stdout/file/clipboard) (TS_PORT_INDEX.md:1149-1151).

**3. Existing repo decision, if any**

- **cli-standards is NORMATIVE** (TS_EXISTING_REPO_REVIEW.md:416-468, Synthesis item 4 at lines 572-578): noun-verb (small-CLI verb-first profile allowed per Appendix A for ≤7-command tools), standard flags `-h/--help`, `-V/--version` (NOT `-v`), `-v/--verbose`, `-q/--quiet`, `--config`, `--debug`, `-o/--output table|json|jsonl|yaml|wide|name` with `--json` ≡ `-o json` (R4.1/R4.2); exit codes 0/1/2/3/4/5/130/143 (R6.1, sysexits rejected); stdout=result-only, stderr=diagnostics/progress/prompts (R7.1); machine error schema `{"error":{"code","message"}}` (R7.8); prompts to stderr and fully usable without TTY (R8.1/R8.2); SIGINT→130, SIGTERM→143, graceful EPIPE (R9.6); conformance fixtures (R9.14). Appendix E (informative, not org-locked) sanctions **Commander or oclif**, `env-paths`, `process.exitCode`, and a `process.stdout.on('error')` EPIPE handler (review lines 432, 464-466).
- **Tie-break #4** (Synthesis, review lines 620-623): Commander (agent2linear — the org's most substantial recent TS CLI, review line 57) vs `node:util` parseArgs + DI router (claim-npm, review lines 314-325) are both live in-org patterns; oclif has no in-org usage, only Appendix E mention.
- Color: claim-npm hand-rolls a 10-line ANSI module, "no chalk", gated on TTY + `NO_COLOR` (review line 320); agent2linear uses `--no-color` as a global flag and strips emoji under it (review line 77). cli-standards explicitly *excludes* color/theming — "governed by a separate standard" that was not found (review line 466(b)).
- Did-you-mean: claim-npm hand-rolled `src/did-you-mean.ts` for unknown commands (review line 318).
- Interactive prompts: contributors-please uses `node:readline/promises` with a `--non-interactive` escape hatch (review line 140). No org repo uses a multi-select prompt library; no org repo renders tables or uses a clipboard lib. agent2linear uses Ink+React for interactive terminal UI (review line 57) — far heavier than this template needs.
- Exit-code reconciliation is pre-ordered by the Synthesis: "the Python source's exit codes (0/1/3/4, different meanings) predate the standard — reconcile toward cli-standards and document the mapping" (review lines 576-578).

**4. Decision classification** (split by sub-decision)

| Sub-decision | Classification |
|---|---|
| CLI framework (Commander 15) | Adapt existing repo decision (agent2linear Commander + cli-standards Appendix E; adapted to v15, cli-standards exit codes, DI test harness) |
| DI/testability shape (`runCli(argv, deps)` → exit code, `process.exitCode`) | Reuse existing repo decision (claim-npm/contributors-please pattern) |
| Color (`node:util` styleText via `src/lib/colors.ts`) | Defer to T08/D-018(2) (rich color → built-in styleText; picocolors not adopted) |
| Table rendering (cli-table3) | Replace Python-specific tool with TypeScript equivalent (rich.Table) |
| Spinner/progress (yocto-spinner, stderr) | Replace Python-specific tool with TypeScript equivalent (rich.Progress) |
| Multi-select prompt (@inquirer/prompts `checkbox`) | Replace Python-specific tool with TypeScript equivalent (questionary) |
| Clipboard (clipboardy) | Replace Python-specific tool with TypeScript equivalent (pyperclip) |
| `--no-color`/`NO_COLOR` handling | Fresh research required (source is dead code; implement for real) |
| Did-you-mean | Reuse existing repo decision (Commander built-in `showSuggestionAfterError`, on by default — supersedes hand-rolling) |
| Exit-code contract | Adapt existing repo decision (cli-standards R6.1 is normative; map source codes onto it) |

**5. TypeScript/Node options considered** (facts verified against npm registry + upstream repos on 2026-07-07)

*CLI framework:*
- **Commander 15.0.0** (published 2026-05-29): zero runtime deps, engines `node >=22.12.0`; v15 migrated the implementation itself to ESM (https://registry.npmjs.org/commander; https://github.com/tj/commander.js/blob/master/CHANGELOG.md). Features: `-V/--version` + `-h/--help` defaults matching cli-standards R4.1; `.choices()` parser-level enum rejection (click.Choice parity); `exitOverride()` + `configureOutput()` for an in-process test harness; did-you-mean suggestions on unknown option/command **on by default** (https://github.com/tj/commander.js#readme). Caveat: default usage-error exit code is **1**, not cli-standards' 2 — `error()` defaults `config.exitCode || 1` (https://raw.githubusercontent.com/tj/commander.js/master/lib/command.js); must be overridden. Commander 14 (node >=20) is the fallback if the runtime topic lands on a Node 20 floor.
- **oclif / @oclif/core 4.11.14** (published 2026-07-02, very active): engines node >=18; multi-command framework with plugin system, generator, 12-dep runtime tree (ejs, minimatch, semver, ansis…) (https://registry.npmjs.org/@oclif/core). Built for large noun-verb suites (Salesforce/Heroku CLIs); imposes file-per-command project layout and its own config/plugin machinery.
- **`node:util` parseArgs**: stable since Node 20.0.0; no choices validation, no help generation, no subcommands — all hand-rolled (https://nodejs.org/api/util.html#utilparseargsconfig). Proven in-org via claim-npm's DI router (review lines 314-325).

*Color:* **picocolors 1.1.1** — zero deps, ~7 kB, CJS+ESM, `NO_COLOR`-friendly, `createColors(enabled)` for manual gating (https://github.com/alexeyraspopov/picocolors); **chalk 5.6.2** — ESM-only, larger, equally fine but org precedent is anti-chalk (claim-npm review line 320). Neither is adopted — historical options-considered context only: the color mechanism is owned by T08/D-018(2) (`node:util` styleText, built-in); picocolors survives solely as T08's documented contingency for a sub-22.13 Node floor, which D-011's ≥24 floor moots.

*Table:* **cli-table3 0.6.5** (published 2024-05-12; single dep `string-width`) — the de-facto Node table renderer; stable/low-churn rather than dead (https://registry.npmjs.org/cli-table3). Alternative: hand-rolled two-column padding (claim-npm-style minimalism) — viable but re-implements width/ANSI handling the moment cli-standards' `-o table` output grows.

*Spinner:* **yocto-spinner 1.2.1** (published 2026-07-06): writes to **stderr by default**, one tiny dep, explicitly "works well in CI" (https://github.com/sindresorhus/yocto-spinner); **ora 9.4.1** (2026-06-22): also stderr-default, auto-disables in non-TTY/CI, but pulls chalk into the tree — a color library the template otherwise avoids entirely (color is the built-in `node:util` styleText per T08) (https://github.com/sindresorhus/ora; https://registry.npmjs.org/ora). **listr2 10.2.2** — task-list orchestration, overkill for one indeterminate spinner.

*Multi-select prompt:* **@inquirer/prompts 8.5.2** (published 2026-05-31; engines `>=23.5.0 || ^22.13.0 || ^20.17.0`) — includes `checkbox` with `Choice{name,value}` separation (questionary parity), a second context arg `{ input, output, signal }` so prompts can render on **process.stderr** per cli-standards R8.2, and a maintained `@inquirer/testing` package (https://registry.npmjs.org/@inquirer/prompts; https://github.com/SBoudrias/Inquirer.js#readme; https://github.com/SBoudrias/Inquirer.js/tree/main/packages/checkbox). **@clack/prompts 1.7.0** (published 2026-07-03; node >=20.12) — `multiselect` + integrated spinner, prettier default styling, but younger API and no name/value Choice-object parity as directly documented.

*Clipboard:* **clipboardy 5.3.1** (published 2026-02-24; engines node >=20; deps: execa, is-wsl, wl-clipboard detection, bundled binaries) — macOS/Windows native, Linux via bundled `xsel` (X11) or `wl-clipboard` (Wayland); **fails on headless Linux/CI — no display server means no clipboard**, so `--copy` must degrade with a clear error (https://github.com/sindresorhus/clipboardy; https://registry.npmjs.org/clipboardy).

*XDG paths:* **env-paths 4.0.0** (2026-01-24) is Appendix-E-sanctioned but returns `~/Library/Preferences/...` on macOS, which conflicts with cli-standards R5.3 XDG paths and with agent2linear's hand-rolled `$XDG_CONFIG_HOME`-else-`~/.config` resolution (review lines 77, 458) — flagged for the config topic, not decided here.

**6. Recommended choice**

1. **CLI framework: Commander v15** (v14 if the runtime topic sets a Node 20 floor — Commander 15 requires >=22.12.0), wrapped in the claim-npm DI shape: thin shebang entry → `runCli(argv, deps): Promise<number>` → `process.exitCode`, with `program.exitOverride()` + `configureOutput()` injecting stdout/stderr writers so tests run in-process (the `CliRunner` analog demanded by TS_PORT_INDEX.md:1435-1443).
2. **Color: defer to T08 — `node:util` styleText** (built-in, zero-dep) wrapped in `src/lib/colors.ts` with semantic helpers (error=red, notice=yellow, success=green), gated on `--no-color`/`NO_COLOR`/`FORCE_COLOR`/TTY exactly as T08 specifies. Color mechanism is owned by T08/D-018(2) (node:util styleText); picocolors is not adopted (it was T08's contingency for a sub-22.13 Node floor, and D-011 sets >=24). Reconciled at the Phase 4 gate — see D-026.
3. **Table: cli-table3** for the pre-selection preview table (name/workspace, +ID under `--verbose`).
4. **Spinner: yocto-spinner**, on stderr (its default), additionally gated on `process.stderr.isTTY` and `CI` env — deliberately improving on the source, whose progress text polluted stdout and forced test regex-stripping (TS_PORT_INDEX.md:1385-1393).
5. **Multi-select: @inquirer/prompts `checkbox`** with context `{ output: process.stderr }`, `Choice{name: "Name (Workspace)", value: project}`, empty selection → exit 0; add a documented non-TTY path (`--no-input`/non-TTY → clear error, cli-standards R8.2) that the source lacked; prompt invoked behind one injectable seam.
6. **Clipboard: clipboardy** for `--copy`, wrapped in try/catch that emits a clear stderr error (headless/CI has no clipboard) instead of crashing.
7. **`--no-color`: implement for real** — flag + `NO_COLOR` env + `FORCE_COLOR` override + TTY detection wired into the `src/lib/colors.ts` styleText gate per T08 (and passed to cli-table3/spinner so they render plain).
8. **Did-you-mean: Commander's built-in `showSuggestionAfterError`** (default-on) — no extra dependency.
9. **Exit codes: adopt cli-standards R6.1** with this documented mapping from the source: success/benign-empty → 0 (unchanged); usage errors (bad flag, invalid format choice, nonexistent `--config`) → 2 (click parity; requires wiring `exitCode: 2` through Commander's `exitOverride`, since Commander defaults to 1); missing/invalid token → **4 auth** (was 1); workspace not found → **3 not-found** (was 3 via PyError — unchanged by luck); API/network failure → **1 general error** (was 3); unexpected exception → **1** (was 4), stack trace only under `--verbose`; SIGINT → 130, SIGTERM → 143 (new; the doc-only "5 = user interrupt" is dropped); EPIPE handled via `process.stdout.on('error')` per Appendix E. Machine-format failures also emit the R7.8 `{"error":{"code","message"}}` object on stderr.

**7. Rationale**

- Commander is the only option that is simultaneously (a) an in-org shipped decision (agent2linear, the closest structural match to the port target — review lines 51-57), (b) sanctioned by the normative cli-standards (Appendix E), and (c) click-parity-complete: declarative options, `.choices()` rejection, auto-help, `-V/-h` defaults that match R4.1 out of the box, plus free did-you-mean. The source CLI's contract (framework-validated enum, parser-level path/usage errors, generated help) is exactly what parseArgs does *not* give — claim-npm had to hand-roll help, choices, and did-you-mean, which is fine for a one-off tool but is boilerplate a *template* would force on every consumer.
- The claim-npm DI-router shape is retained *inside* the Commander choice because it is what makes the 95%-coverage in-process test harness possible (review lines 316, 330) and is echoed by contributors-please (`runCli(argv, io)`, `process.exitCode`, review line 140). This resolves tie-break #4 as "Commander for parsing, claim-npm architecture for testability" rather than either/or.
- oclif is rejected: zero in-org usage, 12-dependency runtime, and a multi-command/plugin architecture whose value only appears in large noun-verb suites; the demo CLI is a deliberate small-profile (Appendix A) single command. Adopting oclif would also impose its project generator/layout over the template's own structure decisions.
- UX libs: the source's rich/questionary/pyperclip trio has no single TS equivalent, so intent is preserved per concern with the smallest maintained, current mechanisms: color via the built-in `node:util` styleText per T08/D-018(2) (zero-dep, honors NO_COLOR — consistent with the org anti-chalk precedent), yocto-spinner (stderr default matches R7.1 — progress is diagnostics), @inquirer/checkbox (only candidate with documented `output: process.stderr` + name/value choices + a first-party testing package), cli-table3 (de-facto standard; only dep string-width), clipboardy (only serious cross-platform clipboard lib in Node).

**8. Tradeoffs**

- **Commander vs parseArgs**: Commander adds one (zero-dep) runtime dependency and framework lock-in vs claim-npm's zero-dep purity; in exchange the template stops maintaining hand-rolled help/choices/suggestions. If the org later standardizes on ultra-minimal CLIs, the DI seam keeps the router extractable.
- **Commander 15's Node >=22.12 floor** is stricter than @inquirer's `^20.17.0` and clipboardy's >=20; it makes the CLI framework the binding constraint on `engines.node`. Fallback documented (Commander 14, node >=20) — **explicit coupling to the runtime/package-manager topic (tie-break #1)**.
- **Commander default usage exit code is 1, not 2**: conformance to R6.1 requires deliberate `exitOverride` wiring; a naive Commander setup silently violates the standard. This is the main "gotcha" the template must encode in a conformance fixture.
- **cli-table3's last publish is 2024-05** — stable-but-slow; if it ever breaks under a future Node, hand-rolling the 2-column table is a ~30-line escape hatch.
- **yocto-spinner over ora**: gives up ora's richer API and battle-testing; yocto-spinner is the minimal spinner consistent with the zero-dep styleText color choice (ora would pull chalk into the tree — a second color mechanism alongside the built-in), stderr default, TTY-gated; both are Sindre Sorhus-maintained, so maintenance risk is comparable.
- **@inquirer/prompts over @clack/prompts**: @clack has nicer default aesthetics and an all-in-one suite (spinner+prompts); @inquirer wins on questionary-parity (Choice objects), documented stderr output stream, and testing utilities — but is a larger install (10 sub-packages).
- **Exit-code remap breaks source behavior parity**: scripts written against the Python CLI's 1=config/3=API/4=unexpected will misbehave. The Synthesis explicitly orders this break (review lines 576-578); the mapping table above is the required documentation.
- **`--format text|json|csv` vs cli-standards `-o table|json|jsonl|yaml|wide|name` (R4.2)**: byte-for-byte output parity (TS_PORT_INDEX.md:1383) argues for keeping `--format` values; full R4.2 conformance argues for the `-o` enum. Recommend keeping the source's three formats for parity but exposing them as `-o/--output-format`-compatible surface with `--json` ≡ json, and recording a SHOULD-waiver conformance note (cli-standards line 50) for the unsupported enum members — final wording belongs to the port implementation phase.

**9. Migration implications**

- Runtime deps added: `commander`, `cli-table3`, `yocto-spinner`, `@inquirer/prompts`, `clipboardy` (5 deps replacing click/rich/questionary/pyperclip; color adds no dependency — built-in `node:util` styleText per T08/D-018(2)). All ESM-compatible; clipboardy and yocto-spinner are ESM-only — consistent with the strict-ESM default (Synthesis item 3).
- Structure: `src/cli.ts` thin entry (shebang, signal handlers → 130/143, EPIPE handler) → `runCli(argv, deps)` building the Commander program with `exitOverride`/`configureOutput` → pure `formatOutput` and injectable prompt/clipboard/client seams (mirrors TS_PORT_INDEX.md:1147, 1435-1443).
- `--output` flag name collision: source `--output <file>` vs cli-standards `-o/--output <format>` (R4.1) — the port must rename the file sink (e.g. `--out-file`/`--file`; cli-standards R3.4 reserves `--file` for file *input*, so pick deliberately) and document the rename. Flagged as an implementation-phase naming decision inside this topic.
- Tests: port `tests/test_cli.py` cases one-to-one via in-process `runCli` invocation; prompt mocked at the injectable seam (or `@inquirer/testing`); clipboard mocked; spinner auto-silent under non-TTY so the JSON test needs no regex-stripping (deliberate improvement over source, TS_PORT_INDEX.md:1389).
- Conformance fixtures (R9.14): add tests asserting help shape, stdout/stderr separation, the full exit-code map (incl. usage→2 via exitOverride), `--json` error schema, `NO_COLOR`, and unknown-option suggestion output.
- Couplings: Node floor ↔ Commander 15 vs 14 (runtime topic); `env-paths`-vs-hand-rolled-XDG for `--config` default path (config topic — note env-paths' macOS non-XDG behavior); fuzzy-search implement-or-drop (deps topic) interacts with prompt choice only if "implement" is chosen; shell completion (click freebie, TS_PORT_INDEX.md:1445-1453) is NOT solved by Commander core — record as accepted gap or separate decision.

**10. Validation strategy**

- Behavior-parity suite green: `--help` (exit 0, usage text), `--version` == package.json version, format outputs byte-identical (`{"projects":[...]}` JSON, `id,name` CSV header, newline-joined ids text), file sink content, clipboard payload exact-match, workspace filter forwarding.
- Exit-code matrix test: each failure class driven through `runCli` and asserted against the R6.1 mapping table, including usage-error → 2 (proves the exitOverride wiring) and SIGINT → 130 via subprocess test.
- Stream-separation test: `--json` run captures stdout as parseable JSON with zero extra bytes while spinner/prompt/diagnostics land on stderr; run headlessly in CI (no TTY) to prove non-TTY degradation.
- `NO_COLOR=1`, `--no-color`, and `FORCE_COLOR=1` runs asserted for presence/absence of ANSI escapes in both table and error output.
- Unknown option (`--formt`) produces a did-you-mean suggestion on stderr, exit 2.
- Headless clipboard: `--copy` in a display-less container exits with the documented error class, not a crash.

**11. Decision status**

Proposed — orchestrator gates acceptance. Open couplings: Node engine floor (Commander 15 vs 14), XDG path helper (config topic), `--output` rename wording, `-o` format-enum waiver note, shell-completion scope.

# T07 fragment

## T07: Config loading and environment variables

**Source Python tool or pattern**

`py_launch_blueprint/projects.py` implements layered configuration with python-dotenv:

- `Config.from_env(env_path)` calls `load_dotenv(env_path)` (non-fatal if missing) then reads `os.getenv("PY_TOKEN")` (`projects.py:74-107`).
- Config dir: `get_config_path()` returns `~/.config/py-cli` on Unix and `%USERPROFILE%\.config\py-cli` on Windows (`projects.py:110-117`) — i.e. `~/.config/<tool>` on every platform, not platform-native dirs.
- Precedence: CLI `--token` flag > `PY_TOKEN` env var > `.env` file (`get_config`, `projects.py:120-147`; python-dotenv does not override already-set process env, which is what makes env-beats-file work — pinned by `tests/test_config.py` per TS_PORT_INDEX.md:1210-1213).
- Missing token → actionable multi-remedy stderr message (three numbered options: export env var, create `~/.config/py-cli/.env`, pass `--token`, plus token URL) then `ConfigError` → exit code 1 (`projects.py:88-105`; TS_PORT_INDEX.md:1150).
- Docs advise `chmod 600` on the `.env` secrets file (EXAMPLECLI.md precedence chain, TS_PORT_INDEX.md:496). Note a source inconsistency: docs say `~/.config/py-launch-blueprint/.env`, code uses `~/.config/py-cli/.env` — do not carry the drift forward.
- `--config` flag: path option that must exist; loaded file is still below env/flag in precedence (TS_PORT_INDEX.md:1150).

**Purpose in the original project**

The example CLI is a teaching artifact: it demonstrates the template's quality bar for layered configuration with explicit, documented, test-pinned precedence; secure secret storage outside the repo (XDG-style path, 600 perms, `.env` gitignored under a `#secrets` header — TS_PORT_INDEX.md:256); and actionable error UX when configuration is absent (TS_PORT_INDEX.md:497, 1151).

**Existing repo decision, if any**

- **cli-standards (normative, v1.4.x, org-locked)** — TS_EXISTING_REPO_REVIEW.md:455-462: config precedence R5.1 = flags → `TOOL_*` env → project `.<tool>/<tool>_config.toml` (walk-up) → user `$XDG_CONFIG_HOME/<tool>/<tool>_config.toml` → system `$XDG_CONFIG_DIRS` → defaults; maps merge recursively, scalars replace; `--config` REPLACES discovered files (R5.2). **TOML is the canonical format; "JSON/INI MUST NOT be canonical"** (R5.2). XDG Base Directory paths, no `~/.tool` dotdirs (R5.3). Uppercase `TOOL_*` env with flag/env/config name parity (R5.4, R3.8). Secrets never in argv (R5.5), masked in output (R5.6), `config view --show-origin` (R5.7). §10 networked tools: token precedence file-flag > env > stored; keychain-first storage (review line 453). Appendix E (informative, not normative — review line 466) suggests `env-paths` for XDG-style locations. Open question recorded there: "the TS port needs a TOML parser choice (e.g., smol-toml); none is prescribed" (review line 468).
- **Synthesis default #5**: "Config/paths: XDG base directories — agent2linear xdg-paths, claim-npm ~/.config/<tool>/, cli-standards R5.x. Matches the source repo's ~/.config convention. Reuse." (TS_EXISTING_REPO_REVIEW.md:579-581).
- **agent2linear** (most substantial recent org TS CLI): hand-rolled XDG resolution — `$XDG_CONFIG_HOME/agent2linear` else `~/.config/agent2linear` (`src/lib/xdg-paths.ts:19-40`), env var `LINEAR_API_KEY`, and its own `.env` parser `src/lib/env-file.ts` (review lines 77, 79). No third-party XDG or dotenv lib.
- **poc-typescript-bun-trpc-vite** (Jan 2026, written decision record): env config validated with **Zod 3** + `@t3-oss/env-core`, `emptyStringAsUndefined: true`, committed `.env.example`, `.env*` gitignored, fail-fast startup validation (review lines 362, 384, 393).
- **Synthesis #4**: the port's CLI must conform to cli-standards; where the Python source predates the standard, "reconcile toward cli-standards and document the mapping" (review lines 572-578).

**Decision classification**

Split sub-decisions:

1. Config file format + location + precedence chain: **Adapt existing repo decision** (cli-standards R5.x is normative and wins over the source's `.env`-as-config; source precedence *intent* preserved).
2. TOML parser: **Fresh research required** (cli-standards names it an open question).
3. XDG path resolution: **Reuse existing repo decision** (agent2linear hand-rolled `$XDG_CONFIG_HOME || ~/.config/<tool>` pattern, which also matches the source's `get_config_path` behavior), documented against the Appendix E `env-paths` suggestion.
4. Schema validation: **Adapt existing repo decision** (org uses Zod in the POC; adapt Zod 3 → Zod 4).
5. Runtime `.env` secrets file + dotenv library: **Omit with rationale** (token moves to `TOOL_TOKEN` env / TOML `token` key; python-dotenv gets no direct TS replacement dependency). Dev-workflow `.env` gitignore entry + `.env.example` convention: **Reuse existing repo decision** (POC precedent).
6. chmod 600 guidance incl. Windows: **Adapt existing repo decision** (POSIX behavior preserved; Windows story added).

**TypeScript/Node options considered**

*TOML parsing* (all facts from registry.npmjs.org / api.npmjs.org, fetched 2026-07-07, and the project READMEs):

- **smol-toml 1.7.0** — published 2026-06-21; ESM, zero deps, Node >= 18; TOML v1.1.0, both `parse` and `stringify`; ~20.6M weekly downloads; actively maintained (releases 2025-12, 2026-03, 2026-06) (registry.npmjs.org/smol-toml; github.com/squirrelchat/smol-toml). Known caveats: doesn't reject invalid UTF-8; some invalid dates pass; >53-bit ints need the BigInt option — none load-bearing for a config file.
- **@iarna/toml 2.2.5** — last published 2020-04-22; TOML 0.5 era; effectively unmaintained (registry.npmjs.org/@iarna/toml). Rejected: stale.
- **toml 4.1.2** — 17.3M weekly downloads but parse-only and long release gaps (registry.npmjs.org/toml). Rejected: no stringify (needed for a future `config set`), weaker spec currency.
- **@ltd/j-toml 1.38.x** — 445K weekly downloads, complex API. Rejected: niche.
- **Bun native TOML** — Bun can import `.toml` modules with its native parser (bun.com/docs/runtime/loaders), but that is an import-time loader, not a runtime parse of an arbitrary user path, and it couples the config layer to the runtime tie-break (Synthesis conflict #1). Not selected as the primary mechanism.

*XDG / path resolution*:

- **env-paths 4.0.0** — sindresorhus; published 2026-01-24, Node >= 20; ~81M weekly downloads; suggested by cli-standards Appendix E (informative). BUT: it follows XDG **only on Linux** — macOS gets `~/Library/Preferences/<name>`, Windows `%APPDATA%\<name>\Config`, and it appends a `-nodejs` suffix by default (github.com/sindresorhus/env-paths). That contradicts cli-standards R5.3's XDG prescription as practiced in-org, the source repo's `~/.config/<tool>` on all platforms, and agent2linear's shipped behavior (`~/.config/agent2linear` on macOS).
- **xdg-basedir 5.1.0** — strict XDG, but last published 2021-08-05 and returns `undefined` on Windows (registry.npmjs.org/xdg-basedir). Rejected: no Windows story.
- **Hand-rolled resolver (~30 lines)** — agent2linear precedent (`src/lib/xdg-paths.ts`): `$XDG_CONFIG_HOME/<tool>` else `~/.config/<tool>` (via `os.homedir()`, which already handles `USERPROFILE` on Windows), mirroring the source's `get_config_path`.

*Schema validation*:

- **zod 4.4.3** — published 2026-05-04; Zod 4 stable; 14.7x faster string parsing, 57% smaller core, optional `zod/mini` tree-shakable variant at 85% smaller than Zod 3 (zod.dev/v4; registry.npmjs.org/zod); ~211M weekly downloads. Org precedent: POC used Zod 3 deliberately (review line 362).
- **valibot 1.4.2** — published 2026-06-28, ~12.6M weekly downloads, smaller bundles via modular design (registry.npmjs.org/valibot). Technically fine, but no org precedent, and Zod 4 / `zod/mini` closed most of the bundle-size gap.
- **@t3-oss/env-core** (POC used it): designed for server/client env splits in web apps; wrong shape for a CLI's flag>env>file merge. Not carried over.

*dotenv handling*:

- **dotenv 17.4.2** — published 2026-04-12; since v17.0.0 (2025-06-27) it prints runtime injection messages **by default** and since v17.1.0 adds promotional/security "tips", silenced only via `quiet: true` / `DOTENV_CONFIG_QUIET` (github.com/motdotla/dotenv CHANGELOG). Noisy-by-default stderr conflicts with the org's stdout/stderr discipline (review Synthesis #6, cli-standards R7.1).
- **Node built-ins** — `--env-file` (stable as of v24.10.0/v22.21.0) and `process.loadEnvFile(path)`: both give already-set environment precedence over the file — "If the same variable is defined in the environment and in the file, the value from the environment takes precedence" (nodejs.org/api/cli.html#--env-fileconfig) — which matches python-dotenv's no-override default; `util.parseEnv` exists for pure parsing (nodejs.org/learn/command-line/how-to-read-environment-variables-from-nodejs). Note this corrects TS_PORT_INDEX.md:1213's caution that Node's `--env-file` differs from dotenv on override behavior — current Node docs say env wins, same as python-dotenv.
- **Hand-rolled parser** — agent2linear precedent (`src/lib/env-file.ts`, review line 79).
- **Bun** auto-loads `.env` from cwd into `process.env` — a runtime-coupled behavior difference the precedence tests must sandbox (coupling to the runtime tie-break topic).

*Windows secret-file permissions*:

- Node `fs.chmod` on Windows can only toggle the read-only (write) bit; "it does not support the distinction between the permissions of user, group or others" (nodejs.org/api/fs.html File modes caveat; github.com/ehmicky/cross-platform-node-guide docs/5_security/permissions.md). So `chmod 600` is unenforceable there; per-user protection comes from the profile directory's default ACLs, with `icacls <file> /inheritance:r /grant:r "%USERNAME%:F"` as the explicit hardening command.

**Recommended choice**

1. **Config file**: user config at `$XDG_CONFIG_HOME/<tool>/<tool>_config.toml` (else `~/.config/<tool>/...`), TOML canonical, with the cli-standards R5.1 precedence chain: flags > `TOOL_*` env > project config (walk-up) > user config > system > defaults; `--config <path>` replaces discovered files (R5.2). The token lives as a `token` key in the user config file (mode 0600) — this is the "stored" tier of the §10 token precedence (file-flag > env > stored).
2. **TOML parser**: `smol-toml` (runtime dep).
3. **XDG resolution**: hand-rolled ~30-line `xdg-paths` module on the agent2linear pattern (`$XDG_CONFIG_HOME` else `~/.config/<tool>` on all platforms; `os.homedir()` covers Windows). No `env-paths`, no `xdg-basedir`.
4. **Schema validation**: `zod` v4 — one schema for the merged config object, `safeParse` at resolution time, fail-fast with field-level messages. Use plain `zod` (not `zod/mini`) for readability in a teaching template.
5. **Runtime `.env` file**: dropped as a config tier; **no dotenv dependency**. The multi-remedy missing-token error is preserved and updated to name the three remedies: `--token` flag, `export TOOL_TOKEN=...`, or `token = "..."` in `~/.config/<tool>/<tool>_config.toml` (plus the token URL). Keep `.env` in `.gitignore` under a `#secrets` header and ship `.env.example` for dev-workflow parity with the POC.
6. **Permissions**: write the user config with `mode: 0o600` on POSIX and warn (stderr, non-fatal) when an existing token-bearing config is group/other-readable; on Windows, skip the mode check (document that `%USERPROFILE%`/`%APPDATA%` ACLs already scope files to the user, with the `icacls` hardening one-liner in docs).

**Rationale**

- cli-standards is the org's normative, week-old, RFC-2119 spec and the Synthesis (review lines 572-578) instructs reconciling the older Python source toward it. The source's *intent* — layered precedence flag > env > file, secret in a 600-mode file under `~/.config/<tool>`, actionable missing-token error — survives intact; only the file format changes (`.env` → TOML), which R5.2 forces ("JSON/INI MUST NOT be canonical"; a bare-KEY=VALUE `.env` is INI-shaped).
- smol-toml is the only candidate that is simultaneously current (June 2026 release), spec-complete (TOML 1.1.0), bidirectional (parse + stringify, needed if `config set`/`config view` per R5.7 lands), zero-dep ESM, and runtime-agnostic (works identically on Node and Bun, insulating this decision from the unresolved package-manager/runtime tie-break). cli-standards itself names it as the example candidate (review line 468).
- Hand-rolled XDG beats `env-paths` because env-paths' platform-native dirs (`~/Library/Preferences` on macOS, suffixed `-nodejs`) would silently break the documented `~/.config/<tool>/` UX that the source repo teaches, agent2linear ships, and cli-standards R5.3 prescribes. Appendix E's env-paths pointer is explicitly informative, not normative (review line 466), so deviating is sanctioned; the deviation is toward stronger conformance with the normative rule.
- Zod 4 reuses the org's deliberate Zod choice (POC decision record) at the current stable major; valibot has no org precedent and Zod 4 erased most of the old size argument.
- Dropping dotenv removes a runtime dependency whose current major is noisy on stderr by default (v17 tips), removes an entire config tier that R5.1 doesn't include, and avoids `process.env` mutation entirely — precedence is computed functionally in the resolver, which makes the ported precedence tests (TS_PORT_INDEX.md:1210-1215) trivially hermetic.

**Tradeoffs**

- **Format break vs source**: users of the Python template who read EXAMPLECLI.md will find `.env` replaced by `<tool>_config.toml`. Mitigation: the missing-token error and docs spell out the new file path/format; the port docs include a one-line migration note. This is a deliberate, documented divergence where the normative standard wins over source parity.
- **Hand-rolled XDG** means ~30 lines of owned code and tests instead of an 81M-download dependency — accepted because env-paths' behavior is *wrong* for the spec being implemented, not merely different.
- **smol-toml caveats** (lenient UTF-8/date edge cases) are irrelevant for trusted local config but noted; if `config set` needs comment-preserving edits later, a round-trip-preserving editor (e.g. taplo-style) would be a separate decision.
- **Zod 4 full build** is heavier than valibot/`zod/mini`; for a CLI installed via npm (not bundled for browsers) install size impact is negligible, and tsup/bundler tree-shaking (build-tool topic) further reduces it.
- **No dotenv**: developers who habitually drop a `.env` next to the repo lose auto-loading under Node (Bun would still auto-load — a runtime inconsistency to document/test around). The `TOOL_*` env tier plus `.env.example` covers the workflow.
- **Windows guidance is advisory only**: no programmatic ACL tightening (would require spawning `icacls` or a native dep); documented instead. This is honest about what `fs.chmod` can do (write-bit only).

**Migration implications**

- New runtime deps: `smol-toml`, `zod`. Removed mapping: python-dotenv → (nothing); pyproject's suggested `python-dotenv→dotenv` mapping (TS_PORT_INDEX.md:367) is consciously overridden by this decision.
- New `src/lib/` modules: `xdg-paths.ts` (resolver), `config.ts` (discovery + precedence merge + zod schema + typed `Config`), replacing `Config`/`get_config_path`/`get_config` from `projects.py`.
- Rename `PY_TOKEN` → `<TOOL>_TOKEN` with R5.4/R3.8 name parity (`--token` ↔ `<TOOL>_TOKEN` ↔ `token`); final tool/env prefix name is owned by the CLI-surface topic.
- Missing-token error: keep the numbered three-remedy shape and token URL; the exit code for missing token (source: 1 config; cli-standards R6.1: 4 auth is arguable) is an exit-code-taxonomy reconciliation owned by the CLI-surface/exit-codes topic — this fragment only requires the error *message* contract.
- `.gitignore`: keep `.env` under `#secrets` (TS_PORT_INDEX.md:256-259); add `.env.example` (POC precedent, review line 393).
- **Couplings (stated, not decided here)**: (a) shipping a TOML config file keeps TOML in the repo, which strengthens the case for keeping `.taplo.toml`/taplo — resolved in the root-configs/formatter topic (TS_PORT_INDEX.md:332); (b) runtime tie-break (Bun vs Node) — smol-toml is neutral, but Bun's automatic cwd `.env` loading must be sandboxed in precedence tests; (c) `--config` flag registration semantics belong to the CLI-framework topic; the contract here is R5.2 replace-not-merge; (d) missing-token exit code → exit-code topic.

**Validation strategy**

- Port `tests/test_config.py` to the chosen runner: flag > env > file precedence (deliberately inverting precedence in the loader must fail the test, per TS_PORT_INDEX.md:1215); missing-everything → typed ConfigError + multi-remedy message snapshot; env isolation via `vi.stubEnv`/save-restore and `fs.mkdtemp` HOME/XDG sandboxes (agent2linear's `config.xdg.test.ts` precedent, review line 69).
- New tests: TOML parse errors produce a friendly config error (not a stack trace); zod validation failure names the offending key; `--config` replaces (does not merge with) discovered files; `$XDG_CONFIG_HOME` respected, `~/.config/<tool>` fallback on all three OSes (CI matrix); POSIX-only test that config files are created 0600 and that a loose-permission warning fires (skipped on Windows, mirroring difftree's `#[cfg(unix)]` pattern, review line 491).
- Conformance fixtures per cli-standards R9.14 should include a config-precedence fixture (review line 464, item i).

**Decision status**

Proposed — orchestrator gates acceptance. Highest-leverage gate items: (1) confirming the `.env`-tier omission (source-parity break in favor of cli-standards), (2) the missing-token exit-code reconciliation deferred to the exit-code topic.

# T08 fragment

## T08: Logging and output streams (logger pattern, color, verbosity, machine envelope)

**Source Python tool or pattern**

The Python source uses **rich** for all terminal output, via two module-scope consoles: `console = Console()` (stdout, data + success/benign notices) and `error_console = Console(stderr=True)` (all errors, warnings, config guidance) — `py_launch_blueprint/projects.py:49-50`; routing split documented in `TS_PORT_INDEX.md` ("stdout/stderr stream separation via dual consoles", index lines 1345-1353). Network fetch is wrapped in a rich `Progress()` spinner created **without a console argument**, so progress text renders on stdout and contaminates piped `--format json` output — the tests regex-strip the "Fetching projects..." line (`projects.py:358-362`; `tests/test_cli.py:125`; INDEX lines 1385-1393, 1872-1889 document this as a known wart the port should fix, not preserve). Color vocabulary is consistent: yellow = benign notice, green = success, red = error prefix (`projects.py:364-366, 383-385, 393-399, 402-405`). `--verbose` gates full tracebacks for unexpected exceptions only (`error_console.print_exception()`, `projects.py:405-407`). `--no-color` is accepted but is a **no-op** — a latent bug (INDEX line 1419). There is no logging library and no log levels beyond the verbose flag.

**Purpose in the original project**

Unix composability: machine-readable stdout that survives piping (`py-projects --format json | jq`) while all human-facing diagnostics, remediation guidance (the missing-token tutorial), progress, and errors go to stderr; a small color vocabulary for scanability; verbose mode for debugging without noisy defaults. The intent is a hard template convention, not an accident (INDEX line 1351: "Machine-readable stdout / human-diagnostic stderr is a hard convention of the template").

**Existing repo decision, if any**

Yes — this is one of the strongest established defaults in the review:

- **Synthesis #6** (`TS_EXISTING_REPO_REVIEW.md:582-585`): "Logging in CLIs: no logging library — hand-rolled leveled stderr logger (agent2linear logger.ts; claim-npm injected writers; difftree stderr notices). Pino appears only in the POC's HTTP server. For a CLI template: reuse the stderr-logger pattern; treat Pino as server-side option only."
- **agent2linear**: minimal hand-rolled logger, all log output to stderr via `console.error`, levels quiet/normal/verbose set by flags in a Commander `preAction` hook; debug only under `--verbose`, info suppressed by `--quiet`, warn/error always (review lines 77, 79); human/progress to stderr, stdout reserved for machine output, `--json` envelopes like `{ "ok": true, ... }`, `silenceStdoutWhile` helper guarantees one clean JSON object on stdout (review line 77).
- **claim-npm**: no logging library; output goes through **injected** `stdout`/`stderr` writer functions in a `CliDeps` interface, which is what makes 95% coverage attainable (review lines 316, 325, 330); color is a **hand-rolled 10-line ANSI module — "no chalk"** — enabled only when TTY and `NO_COLOR` unset, plus a `colorEnabled` dep (review line 320).
- **cli-standards (normative, org-locked, v1.4.x)**: R7.1 stdout = requested result only, stderr = diagnostics/progress/prompts/errors; R7.8 machine error schema `{"error":{"code","message"}}` as a single JSON object on stderr under any machine format (review line 449); R4.1 standard options `-v/--verbose` **repeatable**, `-q/--quiet`, `--debug`, and `-V` (not `-v`) for version (review line 447); R4.4 verbosity ladder: repeatable `-v`, `--quiet` wins over `--verbose`, `--debug` overrides `--quiet`, optional `--log-level` (review line 460). Note: cli-standards **deliberately excludes color/theming/NO_COLOR** ("governed by a separate standard" that was not found in any repo — review line 466, open question 18a), so the color-library decision has no org lock.

**Decision classification**

Split into four sub-decisions:

1. **Logger pattern** — *Reuse existing repo decision* (hand-rolled leveled stderr logger + injected writers; also *Replace Python-specific tool (rich) with TypeScript equivalent* pattern rather than a rich-alike library).
2. **Color library** — *Fresh research required* (cli-standards explicitly defers color; org precedent is "no chalk / hand-rolled" but the platform has since shipped a built-in).
3. **Verbosity levels mapping** — *Adapt existing repo decision* (agent2linear's 3-state quiet/normal/verbose adapted to cli-standards R4.4's repeatable `-v` ladder, which is normative and newer).
4. **Machine-output envelope** — *Adapt existing repo decision* (agent2linear's ad-hoc `{ok:true}` envelope predates cli-standards; adopt the normative R7.1/R7.8 contract; preserve the source's `{"projects": [...]}` data shape).

The progress-on-stdout wart is classified *Omit with rationale* (deliberate improvement over source, already mandated by INDEX lines 1389-1393 and 1885-1889: route progress to stderr, gate on TTY/CI, so the JSON tests need no regex-strip).

**TypeScript/Node options considered**

*Logger:*
- **No library, hand-rolled `logger.ts` + injected writers** — org-unanimous for CLIs (Synthesis #6). Zero deps, trivially testable.
- **pino** — org precedent only for the POC's Hono HTTP server (review lines 384, 393); Synthesis #6 explicitly scopes it server-side only. Rejected for the CLI.
- **consola / winston / debug** — no org precedent anywhere in the review; adding one would silently diverge from a deliberate org default. Rejected without further research (the existing decision is recent and explicit).

*Color (current facts, verified 2026-07-07):*
- **`node:util` `styleText` (built-in, no dependency)** — available since Node 20.12.0, **stable since Node 22.13.0** (stability bumped 1.1 → 2 in the v22.13.0 release, nodejs/node commit f6d0c01, "doc: stabilize util.styleText"); honors `NO_COLOR`, `NODE_DISABLE_COLORS`, `FORCE_COLOR`; Node's official migration guide recommends replacing chalk with it (with a codemod): https://nodejs.org/en/blog/migrations/chalk-to-styletext. API: `styleText(format, text[, options])` with `options.stream` (writable stream checked for color support, **default `process.stdout`**) and `validateStream` — https://nodejs.org/api/util.html#utilstyletextformat-text-options. Limitations vs chalk: no rgb/hex/256-color or template-literal syntax (migration guide) — irrelevant to the port's 3-color vocabulary. Under T01's proposed Node `>=24` floor, `styleText` is stable with no caveats.
- **picocolors 1.1.1** (published 2024-10-16, npm registry `https://registry.npmjs.org/picocolors/latest`) — tiny, `NO_COLOR`-friendly, exports `createColors(enabled)` for manual control (https://github.com/alexeyraspopov/picocolors); used by PostCSS/Stylelint/Browserslist. Caveat: its automatic detection is a single global answer (stdout-oriented), so per-stream correctness (stderr is a TTY while stdout is piped — the exact `--format json | jq` case) requires wiring `createColors` manually anyway.
- **chalk 5.6.2** (npm registry `https://registry.npmjs.org/chalk/latest`) — ESM, has a separate `chalk.stderr` instance with independent detection. Heavier; claim-npm's spec explicitly rejected it ("no chalk", review line 320); Node's own guidance now steers chalk users to `styleText`.
- **Hand-rolled ANSI module** (claim-npm `src/colors.ts` precedent) — zero deps, but re-implements what `styleText` now provides in the platform.

*Progress/spinner:* INDEX line 1393 names ora / @clack spinner as candidates "tied to framework choice" — **not decided here**; see couplings below. T08 decides only the stream (stderr) and gating (TTY + `CI`).

**Recommended choice**

1. **Logger pattern**: hand-rolled `src/lib/logger.ts` — no logging library. All diagnostics/progress/prompts to **stderr**; stdout reserved exclusively for the requested result. Writers (`stdout`, `stderr`) are **injected** via the CLI's deps interface (claim-npm `CliDeps` pattern, review line 316) so unit tests capture streams in-process. Levels: `error`, `warn`, `info` (default), `debug`, `trace`.
2. **Color**: **`node:util` `styleText`** wrapped in a small `src/lib/colors.ts` (claim-npm-shaped wrapper, platform-backed implementation). Color enablement computed **per stream** and honoring, in precedence order: `--no-color` flag (must actually work — fixes the source's dead flag, INDEX line 1419) > `NO_COLOR` > `FORCE_COLOR` > `stream.isTTY`. Pass `{ stream: process.stderr }` when styling stderr output, since `styleText` defaults to checking stdout. Zero runtime dependencies. The runtime coupling is resolved: T08's companion fragment T01 recommends **Node `>=24`**, above styleText's 22.13.0 stability threshold. **Contingency documented**: if the orchestrator relaxes the floor below 22.13, substitute picocolors 1.1.1 with `createColors(enabled)` wired to the same per-stream gate — the wrapper module keeps this a one-file swap.
3. **Verbosity mapping** (per cli-standards R4.1/R4.4, normative): `-q/--quiet` → errors (and warns) only; default → info+; `-v/--verbose` (repeatable) → `-v` adds debug, `-vv` adds trace; `--debug` ≡ at least `-v` and overrides `--quiet`; `--quiet` beats `--verbose` when both given (R4.4). `-V` is version, never `-v` (R4.1). **Traceback gating preserved from source**: full `err.stack` printed to stderr only at verbose ≥ 1 (mirrors `projects.py:405-407` and agent2linear's debug-under-verbose).
4. **Machine-output envelope**: stdout in machine mode carries **exactly one JSON document = the requested result** (R7.1); the example CLI preserves the source's `{"projects": [...]}` shape (INDEX line 1379). Machine-mode **errors** are a single JSON object on **stderr** in the normative schema `{"error":{"code","message"}}` (R7.8). `--json` is an alias of `-o json` (R4.2). Do **not** carry agent2linear's `{ "ok": true, ... }` wrapper — it predates cli-standards, which is org-locked and newer; document the supersession.
5. **Progress**: emitted to **stderr only**, suppressed when `!process.stderr.isTTY` or `CI` is set — a deliberate, INDEX-mandated improvement over the source; the JSON-format tests then assert stdout purity with no regex-strip.

**Rationale**

- The logger pattern is the review's clearest unanimous default (Synthesis #6, three independent repos) and maps one-to-one onto the source's intent (dual consoles → dual injected writers); nothing in fresh research argues against it — CLIs do not need structured log files, and the injected-writer variant is what enabled claim-npm's 95% coverage.
- For color, the org's own precedent (hand-rolled, "no chalk", near-zero deps) now has a platform-native realization: `styleText` is stable, honors the same env vars the org gates on, works in Bun, and Node officially recommends it over chalk. Choosing it *is* following the existing decision's intent (zero-dep ANSI) with less bespoke code. picocolors remains the best dependency-shaped alternative but its global detection would still need manual per-stream wiring, erasing its advantage over the built-in.
- Verbosity and envelope follow the rule "cli-standards is normative" (Synthesis #4): where agent2linear (single `-v` tri-state, `{ok:true}`) and cli-standards (repeatable `-v`, R7.8 schema) disagree, **cli-standards wins** — it is newer (2026-06), org-locked, RFC-2119, and the review itself designates it the CLI-surface contract.

**Tradeoffs**

- `styleText` vs picocolors: the built-in requires Node ≥ 20.12 (stable ≥ 22.13) — satisfied by T01's proposed `>=24` floor, but if the orchestrator overrides T01 downward the picocolors contingency activates; picocolors has no floor concern but adds a dependency and stdout-biased auto-detection. The wrapper module confines the blast radius of either choice to one file.
- `styleText` cannot do rgb/hex/256-color; the template's yellow/green/red/dim vocabulary doesn't need them, but a consumer wanting themed output would add a library.
- Repeatable `-v` is slightly more parser work than a boolean (the CLI-framework topic must support count options — Commander does via a custom accumulator; `node:util parseArgs` needs `multiple: true` + length).
- Dropping agent2linear's `{ok:true}` envelope diverges from the owner's most substantial CLI; justified because cli-standards R7.8 is explicitly org-locked and later, but agents consuming both tools will see two envelope styles until agent2linear catches up (documented, not silent).
- Routing progress to stderr changes observable behavior vs the Python source (stdout no longer contains the progress line) — this is intent-preserving but byte-diverging; parity tests must assert the *improved* contract, per INDEX lines 1885-1889.

**Migration implications**

- New files: `src/lib/logger.ts` (leveled stderr logger, level resolved from `-q/-v.../--debug` once at startup — agent2linear's preAction-hook pattern), `src/lib/colors.ts` (styleText wrapper + per-stream enablement), both consuming injected writers from the CLI deps interface.
- `rich.Console`/`error_console` dual-console code maps to `deps.stdout` (result only) and `logger.*` (everything else). `rich.Table` (text-mode preview) and spinner rendering belong to the UX/prompts topic; whatever renders them must target stderr.
- Fix two source bugs during port, per INDEX: make `--no-color` functional (line 1419) and move progress off stdout (lines 1389-1393).
- Exit-code/error-class ladder (`ConfigError`→1, API→3, unexpected→4 vs cli-standards R6.1) is **owned by the error-handling/exit-code topic**; T08 only requires that machine-mode errors serialize as R7.8 on stderr with whatever `code` that topic defines.
- Spinner library selection (ora vs @clack) is **deferred to the interactive-prompts/UX topic** (questionary replacement); T08 constrains it: stderr-only, TTY/CI-gated, honors the color gate.
- Runtime floor coupling: **resolved by T01** (fragment T01-package-manager-runtime.md recommends Node `>=24`, npm, no Bun) — `styleText` is stable at that floor. If the orchestrator relaxes the floor below 22.13, take the documented picocolors contingency.

**Validation strategy**

- Port the source's CLI tests and strengthen them: `--format json` output must `JSON.parse` **with no stripping** (stdout purity — the improved contract); capture stdout/stderr separately in-process via injected writers.
- Add cli-standards **R9.14 conformance fixtures** (review line 436): stdout/stderr separation, `--json` single-document guarantee, R7.8 error object on stderr in machine mode, `-q`/`-v`/`-vv`/`--debug` level matrix including "quiet beats verbose" and "debug beats quiet".
- Color tests: `NO_COLOR=1`, `--no-color`, `FORCE_COLOR=1`, and non-TTY each produce/suppress ANSI as specified (asserts the dead-flag fix); verify stderr styling uses `{ stream: process.stderr }` by testing the piped-stdout + TTY-stderr case with a fake stream exposing `isTTY`.
- Traceback gating test: unexpected error prints `err.stack` to stderr only when verbose ≥ 1 (parity with `projects.py:405-407`).
- CI runs the suite non-TTY, which exercises the progress-suppression path by default; one subprocess E2E asserts a clean single JSON object on stdout end-to-end.

**Decision status**

Proposed — orchestrator gates acceptance. Couplings flagged: runtime floor (resolved by T01's proposed Node `>=24`; picocolors contingency if relaxed below 22.13), CLI framework (repeatable `-v` parsing), prompts/UX topic (spinner/table library), error-handling topic (exit codes + R7.8 `code` values), output-format topic (`-o/--output` enum vs source `--format`).

# T09 fragment

## T09: Testing — runner, structure, coverage, CLI harness, mock seams

**1. Source Python tool or pattern**

- **Runner/discovery**: pytest with pinned discovery — `[tool.pytest.ini_options]` `testpaths = ["tests"]`, `python_files = ["test_*.py"]`, `addopts = "-v"` deliberately commented out (`py-launch-blueprint/pyproject.toml:126-129`; TS_PORT_INDEX.md:1770-1778). Three concern-split test modules (`tests/test_config.py`, `tests/test_api.py`, `tests/test_cli.py`) plus a packaging-only `tests/__init__.py` (INDEX:1170-1216).
- **CLI tests**: click's in-process `CliRunner` — `runner.invoke(main, [...])`, asserting `result.exit_code` and `result.output`; version test imports `__version__` from the same module the CLI reads, never hardcoding (INDEX:1786-1800).
- **Mocking**: `unittest.mock` boundary patches at import sites — `patch("py_launch_blueprint.projects.PyClient")` with `Mock(spec=PyClient)`, `patch(...get_config)`, `patch("questionary.checkbox")`, `@patch("pyperclip.copy")`; API client tests patch exactly one seam, `requests.Session.request` (INDEX:1802-1836). **Latent mis-mock bug**: three tests set `mock_checkbox.ask.return_value` instead of `mock_checkbox.return_value.ask.return_value`, so they silently exercise the empty-selection path, not what they appear to pin (`tests/test_cli.py:82,100,155`; INDEX:1812 — verified against source, `tests/test_cli.py:80-84`).
- **Fixtures**: small function-scoped fixtures per file, no `conftest.py`, pytest built-in `tmp_path` for real temp files; env isolation via `patch.dict(os.environ)`/`monkeypatch.delenv` (INDEX:1891-1905, 1838-1854).
- **Coverage**: `pytest-cov>=4.1.0` installed in the `dev` extra (`pyproject.toml:42`) but **not enforced** — no `[tool.coverage]` section, no `--cov` in any default command, codecov CI upload present but commented out (INDEX:1907-1922).
- **Relaxed rules for tests**: ruff per-file-ignores `"tests/*" = ["S101","S105","S106"]` with explanatory comments; mypy override `disallow_untyped_defs = false` for `tests.*` (`pyproject.toml:119-124,167-170`; INDEX:1943-1956).
- **Exit-code contract in tests**: every CLI test asserts exit code; exits 3 (API error) and 4 (unexpected exception) are defined in source but untested — a known gap (INDEX:1856-1870).
- **Output-format tolerance wart**: JSON test regex-strips the `Fetching projects...` progress line because progress shares stdout with data in the source (INDEX:1872-1889).

**2. Purpose in the original project**

Fast, deterministic, hermetic test suite that pins the template's user-facing contracts (config precedence, HTTP client error mapping, CLI exit codes, output formats) without network/TTY/clipboard access, so it runs identically on dev machines, in the pre-commit hook, and in CI. Coverage capability is shipped but the gate is left opt-in — the template's recurring "scaffold present, enforcement opt-in" stance. Test-file readability is template pedagogy: each test file is self-contained with local fixtures.

**3. Existing repo decision, if any**

TS_EXISTING_REPO_REVIEW.md Synthesis, Established default #1: "**Testing: Vitest** — unanimous across recent TS repos (agent2linear Vitest 4 with 100% coverage thresholds; claim-npm Vitest 1.6 with 95/95/90/95; contributors-please Vitest 3), with a second tier of subprocess/E2E tests against the built CLI ... Reuse — contingent on the package-manager/runtime tie-break" (REVIEW:553-559). Supporting per-repo evidence:

- **agent2linear**: Vitest 4, v8 coverage, colocated `src/lib/*.test.ts`, 100% thresholds sustained only by excluding entrypoints; hermetic bash E2E of built `dist/index.js` in CI (REVIEW:69,88). Its 100% thresholds are explicitly listed under "Decisions NOT to reuse": "claim-npm's 95/95/90/95 with excluded thin I/O adapters is the more transferable default for a template" (REVIEW:652-653).
- **claim-npm**: Vitest 1.6, `tests/` tree mirroring `src/`, `tests/integration/` spawning the built CLI as a subprocess against a mock registry server, `globalSetup` staleness-aware rebuild, v8 thresholds lines 95 / functions 95 / branches 90 / statements 95 with thin I/O adapters excluded and `excludeAfterRemap: true` (REVIEW:306,330-334; clone `repo-clones/claim-npm/vitest.config.ts`). DI-router architecture (`runCli(argv, deps) -> exit code`) is called out as "what makes the 95% coverage thresholds attainable" (REVIEW:330).
- **contributors-please**: Vitest 3, top-level `test/**/*.test.ts`, DI `CliIo` for a unit-testable CLI, built-artifact smoke via script, meta-tests of workflow YAML (REVIEW:132,148-150).
- **poc-typescript-bun-trpc-vite**: Vitest 4 for portable code, `bun:test` only inside the Bun-runtime app (REVIEW:374).
- **difftree** (Rust): end-to-end tests of the actual binary (assert_cmd) — the cross-language argument for a subprocess tier (REVIEW:491,521).
- **cli-standards** R9.14: conformance fixtures exercising help shape, stdout/stderr separation, exit codes, `--json`, `--version`, unknown-command handling SHOULD exist (REVIEW:436,464 item i).

**4. Decision classification**

Split:
- Test runner (pytest → Vitest): **Replace Python-specific tool with TypeScript equivalent**, selecting the tool by **Reuse existing repo decision** (org-unanimous Vitest), version refreshed to current major.
- Test structure (`tests/` tree, concern-split files): **Adapt existing repo decision** (claim-npm `tests/` layout, which also matches the source's `testpaths=["tests"]` intent).
- Coverage provider + thresholds/exclusions: **Adapt existing repo decision** (claim-npm 95/95/90/95 v8 pattern), with a documented deviation from the source's installed-not-enforced stance.
- CLI smoke-test approach (CliRunner → DI in-process harness + subprocess E2E tier): **Replace Python-specific tool with TypeScript equivalent** following org precedent (claim-npm/contributors-please DI pattern; claim-npm/agent2linear built-CLI tier).
- Mock seams (unittest.mock patches → DI + vi spies): **Adapt existing repo decision**; also fixes the source's latent mis-mock bug rather than porting it.
- Test lint/type relaxations: **Keep source Python repo cross-platform tool** in spirit (per-glob overrides carry over); exact rule IDs are owned by the lint topic.

**5. TypeScript/Node options considered** (facts verified 2026-07-07)

| Option | Current facts | Source |
|---|---|---|
| **Vitest 4** | `latest` = **4.1.10**, published 2026-07-06; dist-tags also show `5.0.0-beta.6` (beta, not stable) and `V3` = 3.2.7. Engines `node ^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0`. v8 coverage via peer `@vitest/coverage-v8` (same 4.1.10). Vitest 4 made AST-aware remapping the only v8 mode (accuracy of istanbul at v8 speed); `coverage.all` removed. Thresholds config: `coverage.thresholds.{lines,functions,branches,statements}` + per-glob thresholds + `thresholds.autoUpdate`; `coverage.exclude` filters; default reporters `['text','html','clover','json']`. | registry.npmjs.org/vitest and /@vitest/coverage-v8 (dist-tags + time, fetched 2026-07-07); https://vitest.dev/guide/coverage; https://vitest.dev/config/coverage; https://github.com/vitest-dev/vitest/issues/7928 (AST remapping default + old mode removed) |
| **bun test** | Jest-compatible-ish runner built into Bun; coverage via `--coverage` with `text`/`lcov` reporters; `coverageThreshold` in bunfig.toml supports **lines/functions/statements only — no branches threshold**; docs state "Bun aims for compatibility with Jest, but not everything is implemented" (tracking issue #1825). | https://bun.com/docs/cli/test; https://bun.com/docs/test/coverage |
| **node:test** (built-in) | Runner stable, but **code coverage is Stability 1 - Experimental** (`--experimental-test-coverage`); thresholds exist (line/branch/function); `mock.module()` exists for module mocking. Zero-dependency appeal; used by difftree-action's tiny Phase-0 scripts only (REVIEW:249). | https://nodejs.org/api/test.html |
| **Jest** | Not considered seriously: zero org precedent in any reviewed repo; ESM support still second-class vs Vitest; no counter-evidence justifying divergence from the unanimous org default. | REVIEW Synthesis #1 (no Jest anywhere) |

**6. Recommended choice**

1. **Runner**: **Vitest 4** (`vitest` + `@vitest/coverage-v8`, both `^4.1.10`) as the single test runner for unit and integration tiers. Do not adopt the 5.0 beta. `environment: 'node'`, **no `globals: true`** — explicit `import { describe, it, expect, vi } from 'vitest'` (claim-npm/contributors-please style; keeps lint/type setup simpler than ambient globals).
2. **Structure**: top-level **`tests/` directory** (not colocated), pinned in config with `include: ['tests/**/*.test.ts']`; concern-split files `tests/config.test.ts`, `tests/api.test.ts`, `tests/cli.test.ts` (matching INDEX target paths, INDEX:1183,1195,1207) plus `tests/integration/` for the subprocess tier. No package-marker file (`tests/__init__.py` omitted per INDEX:1170-1180). Script split à la claim-npm: `test` (unit only, excludes `tests/integration/**`), `test:integration`, `test:coverage`.
3. **Coverage**: v8 provider, `include: ['src/**/*.ts']`, thresholds **lines 95 / functions 95 / branches 90 / statements 95**, `excludeAfterRemap: true`, reporters `['text', 'html', 'lcov']` (lcov feeds the commented-out coverage-upload CI step ported from the source). Exclusions: only thin I/O adapter/entry files where DI wiring meets the real world — the bin entry (`src/index.ts` or `src/cli.ts` shim), clipboard adapter, prompt adapter — each exclusion carrying an explanatory comment (source's documented-exemption convention, INDEX:1950-1953). Enforced in CI via `vitest run --coverage`; local default `just test` stays coverage-free for speed.
4. **CLI smoke tests**: two tiers. (a) **In-process** (CliRunner equivalent): the CLI is architected as `runCli(argv, deps) -> Promise<exitCode>` with an injected deps object (stdout/stderr writers, env, fetchImpl, prompt, clipboard); tests invoke it with an argv array, capture streams separately, and assert exit code + output — including `--help` exits 0 with the description text and `--version` contains the version imported from the same module the CLI reads. (b) **Subprocess E2E** in `tests/integration/`: spawn the **built** CLI (`node dist/cli.js`) via `child_process`/execa against a local mock HTTP server, with a `globalSetup` that rebuilds `dist/` only when sources are newer (claim-npm `tests/integration/build-setup.ts` pattern). Seed this tier with cli-standards R9.14 conformance fixtures (help shape, stream separation, exit codes, `--version`, unknown-flag handling).
5. **Mock seams and fixtures**: **DI-first, not module patching.** Boundary replacement happens by passing fakes through the deps object (`vi.fn()` spies for clipboard/prompt); the HTTP client is tested by mocking only the transport seam (injected `fetchImpl`), driving header construction, error translation, and workspace-name resolution through real code — the TS equivalent of patching `requests.Session.request` only. `vi.stubEnv`/`vi.unstubAllEnvs` for env isolation; real temp `.env` files via `fs.mkdtemp` so dotenv parsing is exercised for real. Function-scoped factory helpers (`makeDeps()`, `makeClient()`) local to each test file; no global setup file (preserves the no-conftest readability intent, INDEX:1899-1905). Reserve `vi.mock` for cases DI cannot reach; prefer none in the template.
6. **Mis-mock bug**: do **not** port it. DI makes the wrong-seam mistake structurally impossible (the fake prompt IS the function called). Port the three affected tests to pin the behavior they *appear* to pin (a real selection flowing through format/output), and keep one explicit empty-selection test (exit 0, "No projects selected") — per INDEX:1818's instruction to decide per test which path each is meant to pin. Also close the source's known gap by pinning exit 3 (API error) and exit 4 (unexpected error) as a flagged improvement (INDEX:1870).
7. **Test lint/type relaxations**: carry the pattern — per-glob overrides for `tests/**` in the chosen linter config with explanatory comments; tests remain under strict tsconfig (TS test typing is low-friction) but are excluded from the build output. Exact rule IDs → lint topic.

**7. Rationale**

- Vitest is the **org-unanimous, deliberate, recent** decision (three shipped repos, June 2026; REVIEW Synthesis #1); Phase-4 discipline says reuse it. Version 4 is the current stable major, verified against the npm registry on 2026-07-07 (4.1.10 published 2026-07-06); agent2linear already runs Vitest 4 in production. Vitest 4's AST-aware v8 remapping gives istanbul-accurate reports at v8 speed, which matters when thresholds gate CI.
- `tests/` (not colocated) wins the structure question because it is simultaneously (a) the source repo's pinned intent (`testpaths=["tests"]`, INDEX:1780-1781 "test layout follows the architecture's logical layers"), (b) the claim-npm precedent — the org repo closest in shape to this port, and (c) what the INDEX already names as target paths. agent2linear's colocated style is the minority (one repo) and couples tests to a `src/lib` layout this template doesn't have.
- 95/95/90/95 over 100%: the review's own Synthesis pre-decides this ("the more transferable default for a template", REVIEW:652-653). 100% is only sustainable by excluding entrypoints wholesale and punishes template adopters on day one.
- Enforcing thresholds in CI deviates from the source's installed-not-enforced stance — see Tradeoffs for the explicit tie-break.
- DI over `vi.mock` module patching preserves the source's *intent* (hermetic boundary replacement, `spec=`-constrained fakes) with a mechanism the org has twice standardized (claim-npm `CliDeps`, contributors-please `CliIo`), that typed languages support better than string-keyed patching, and that eliminates the exact bug class the source shipped (mis-mocked seam passing silently).
- Subprocess E2E tier: three independent org precedents (claim-npm integration spawn, agent2linear hermetic bash E2E, difftree assert_cmd) plus cli-standards R9.14 make "test the built artifact" an established org requirement the Python source lacks; adding it is preservation of org DNA, not scope creep.

**8. Tradeoffs**

- **Coverage enforcement vs source opt-in intent (the one real conflict)**: the source deliberately ships coverage capability without a gate (INDEX:1916-1919), and the INDEX's TS representation even suggests "Threshold config intentionally absent" (INDEX:1922). The org's TS practice disagrees: both coverage-configured repos (agent2linear, claim-npm) enforce thresholds. **Org precedent wins**: the port's testing DNA follows the owner's current TS practice (Phase-4 rule: prior deliberate recent decisions are defaults), and a template whose coverage gate has never run tends to rot. The source's opt-in spirit is preserved at the edges: thresholds live in one obvious `vitest.config.ts` block adopters can edit or delete, the codecov *upload* step stays commented out exactly as in the source, and the local `just test` loop stays coverage-free. Documented as a deliberate deviation for TS_PORT_DECISIONS.md.
- **Vitest vs bun test coupling**: if the pending package-manager/runtime topic picks Bun, bun test would remove a devDependency — but bun test cannot express the org's threshold precedent (no **branches** threshold; Jest-compat explicitly incomplete), and the org's own Bun-adjacent repo (POC) still chose Vitest for portable code. Vitest runs fine under a Bun-managed repo (`bunx vitest`), so the runner decision is robust to either tie-break. Stated as a soft dependency, not a blocker.
- **Vitest 4 vs 1.6/3 pins in org repos**: picking the current major means the claim-npm config can't be copied verbatim (`coverage.all` removed in v4; remapping semantics changed) — small one-time adaptation cost, already validated by agent2linear on v4.
- **`tests/` vs colocated**: colocated tests make per-module coverage locality obvious and are agent2linear precedent; `tests/` keeps the published-package `files`/tsconfig excludes trivial and mirrors the source. Cost accepted: contributors must look one directory over.
- **DI everywhere** adds a deps-object parameter to the CLI's architecture — a design constraint on the CLI topic (T-CLI), not free. It is, however, exactly what two org repos already do and what made their coverage thresholds attainable.
- **Subprocess tier is slower** (~seconds for build + spawns); mitigated by the staleness-aware `globalSetup` rebuild and the `test`/`test:integration` script split so the fast loop stays fast.
- **node:test rejected** despite zero-dep appeal: coverage is still experimental (Stability 1), and adopting it would diverge from three org repos for no capability gain.

**9. Migration implications**

- `pyproject.toml [tool.pytest.ini_options]` → `vitest.config.ts` (`include`, `environment: 'node'`, coverage block); `pytest-cov` → `@vitest/coverage-v8`; `tests/__init__.py` → omitted.
- `tests/test_{config,api,cli}.py` → `tests/{config,api,cli}.test.ts` — same test inventory, with: env isolation via `vi.stubEnv`; `tmp_path` → `fs.mkdtemp` + `afterEach` cleanup; `CliRunner` → in-process `runCli(argv, deps)`; `Mock(spec=...)` → typed fakes satisfying the real interface (compile-time enforced).
- New: `tests/integration/` subprocess tier + `tests/integration/build-setup.ts` globalSetup (claim-npm pattern), including cli-standards R9.14 conformance fixtures.
- The JSON-test regex-strip of the progress line disappears: the TS port routes progress to stderr (deliberate improvement per INDEX:1889), so stdout is asserted as pure parseable data with streams captured separately.
- Justfile: `just test` → unit suite; `just test-cov` / `test:coverage` runs with thresholds; coverage artifacts (`coverage/`) added to clean recipe and `.gitignore` (INDEX:1922). CI runs the same scripts the hooks run (one-source-of-truth intent, INDEX:1934-1938) — wiring owned by the CI and hooks topics.
- Record in TS_PORT_DECISIONS.md: (a) coverage thresholds enforced (deviation from source opt-in), (b) mis-mock bug fixed not ported, (c) exit-3/exit-4 tests added (gap closure), (d) progress-to-stderr improvement enabling clean stdout assertions.
- **Cross-topic dependencies (stated, not decided here)**: CLI framework topic must deliver the DI `runCli(argv, deps)` shape; HTTP-client topic determines the exact transport fake (injected `fetchImpl` assumed); lint topic owns tests/** rule relaxations; package-manager/runtime topic may revisit `bunx vitest` invocation but not the runner itself; CI topic owns where `--coverage` runs.

**10. Validation strategy**

- `vitest run` green on a fresh clone with network disabled (hermeticity check) and in CI on the chosen Node matrix (Vitest 4 requires Node ≥20 — compatible with any plausible floor).
- `vitest run --coverage` fails the build when a threshold is deliberately broken (delete a test, confirm non-zero exit) and passes at ported-suite coverage; confirm exclusions list stays ≤ a handful of thin-adapter files.
- Mutation spot-checks from the INDEX validation strategies: breaking header setup or error translation in the API client fails `api.test.ts` (INDEX:1191); inverting config precedence fails the precedence test (INDEX:1215); changing any exit code fails a CLI test.
- Subprocess tier: run `test:integration` from a clean checkout — globalSetup builds `dist/`, spawned CLI passes conformance fixtures headlessly (no TTY).
- Prompt-seam regression guard: assert the fake prompt's canned selection actually appears in stdout (proves the seam is live — the check the Python suite lacked).

**11. Decision status**

Proposed — orchestrator gates acceptance. Sub-decisions couple to pending topics: CLI framework (DI shape), package manager/runtime (invocation only), lint (tests/** overrides), CI (where coverage gate runs).

# Fragment T10

## T10: Git hooks and commit-message linting (hook manager, commitlint, .gitmessage, cog hooks)

**1. Source Python tool or pattern**

Four coupled source artifacts (all read from `/Users/stevemorin/c/py-launch-blueprint`, read-only):

- `.pre-commit-config.yaml` — the pre-commit framework (Python) drives a heavy per-commit suite: mypy (v1.15.0 with type-stub additional_dependencies), pre-commit-hooks v5.0.0 (`check-yaml`, `end-of-file-fixer` excluding generated `_version.py`, `trailing-whitespace`, `check-toml`, `check-added-large-files`), ruff check `--fix` + ruff format (v0.11.11), google/yamlfmt v0.13.0 (`-conf .yamlfmt`), a local `taplo format` hook for TOML, and a local **pytest hook running the full test suite on every commit** (`pass_filenames: false`, `stages: [pre-commit]`) (`.pre-commit-config.yaml:22-72`). Installed/run via `just pre-commit-setup` / `pre-commit-run` (`Justfile:181-192`) and re-run in CI (`.github/workflows/*` per TS_PORT_INDEX.md:178).
- `.gitlint` — gitlint config: `contrib-title-conventional-commits` rule, title max 50, body line max 72, allowed types `feat,fix,docs,style,refactor,test,chore,ci,build,perf` (`.gitlint:1-12`). **Dormant in practice**: grep of the whole source repo finds no invocation of gitlint anywhere — it is not in `.pre-commit-config.yaml`, not in the Justfile, not in CI. It is a config-only aspiration.
- `.gitmessage` — commit-message template (50-char subject ruler, imperative-mood guidance, 72-char body wrap); lists only 7 types (`feat, fix, docs, style, refactor, test, chore` — omits `ci`, `build`, `perf` vs `.gitlint`) (`.gitmessage:1-15`). Also dormant: no `git config commit.template` wiring found anywhere in the repo.
- Cocogitto commit-msg hook — the actually-wired commit-message gate is opt-in via `just setup-cog-hooks` → `cog install-hook commit-msg` (`Justfile:365-369`), plus `just verify-commits` running `cog verify --from --to` over a range (`Justfile:313-318`). `cog.toml` itself configures changelog/contributors, not hooks (`cog.toml:20-58`).

**2. Purpose in the original project**

- Local quality gate: nothing lands in history that fails type check, lint, format, file hygiene, or tests — the full gate runs at commit time, with CI re-running the identical hooks for local/CI parity (TS_PORT_INDEX.md:291-297, 177-181).
- Commit-message hygiene: machine-enforceable Conventional Commits with classic 50/72 discipline (`.gitlint`), a human-facing template mirroring the rules (`.gitmessage`), and cog-driven verification/changelog generation — commits are the single source of truth for release history (TS_PORT_INDEX.md:264-285, 348-357).

**3. Existing repo decision, if any**

- **POC precedent (smorin/poc-typescript-bun-trpc-vite, Jan 2026)**: "**lefthook git hooks**: parallel pre-commit running `biome check --write --staged` with `stage_fixed: true` + `turbo typecheck`; commit-msg commitlint (lefthook.yml); installed via package.json `prepare` script" and "**Conventional commits enforced by commitlint** with repo-specific scope-enum (commitlint.config.cjs extends `@commitlint/config-conventional`)" (TS_EXISTING_REPO_REVIEW.md:390-391, 378). Listed under "Reusable decisions (for the TS port)".
- **The review's Phase-4 tie-break #5** (TS_EXISTING_REPO_REVIEW.md:624-631): the POC has lefthook + commitlint; contributors-please-action carries a single-purpose Python pre-commit hook ("used only for the domain-specific engine-sync check; not an endorsement over lefthook", TS_EXISTING_REPO_REVIEW.md:218); published CLIs otherwise have **no** hook manager (agent2linear: "The port's lefthook decision must come from another repo", line 106; claim-npm line 343: "the blueprint wants lefthook"; difftree line 532: "absence, not a decision record; do not treat it as precedent against lefthook"). "Domain spec: preserve lefthook if used. Phase 4 must weigh pre-commit continuity vs lefthook explicitly; extent of hook duties needs research."
- Conventional Commits themselves are an org-wide established default (release-please manifest mode consumes them — Established default #2, TS_EXISTING_REPO_REVIEW.md:560-566; custom changelog-sections in contributors-please/difftree-action).
- **Additional owner precedent outside the reviewed set**: `/Users/stevemorin/c/smorin-bootstrap/lefthook.yml` opens with the comment "Replaces .pre-commit-config.yaml" (lefthook.yml:3) and re-implements the pre-commit-hooks hygiene checks (trailing-whitespace, end-of-file-fixer, check-yaml, check-added-large-files, actionlint) as lefthook shell commands with `stage_fixed: true` — the owner has already performed a pre-commit → lefthook migration once, and that file is a ready-made pattern for the hygiene-hook ports in §6.

**4. Decision classification**

Split sub-decisions:

- Hook manager → **Reuse existing repo decision** (lefthook, per POC + domain spec).
- Commit-message linter → **Replace Python-specific tool with TypeScript equivalent** (gitlint → commitlint + `@commitlint/config-conventional`; also matches POC precedent, so simultaneously a reuse).
- Hook duties (which checks run per commit) → **Adapt existing repo decision** (POC's staged-lint + typecheck shape, mapped onto the source suite's intent).
- Full test suite on every commit → **Omit with rationale** (moved to pre-push opt-in + CI).
- `.gitmessage` → **Keep source Python repo cross-platform tool** (plain git feature; port with type-list reconciliation and actual wiring).
- Cocogitto `commit-msg` hook (`setup-cog-hooks`) → **Omit with rationale** (superseded by lefthook commit-msg + commitlint; cocogitto's *changelog/contributors* fate is a T-release/changelog topic, not decided here).

**5. TypeScript/Node options considered**

Versions verified 2026-07-07 via `npm view` against the npm registry and official release pages:

| Option | Latest | Last publish | Notes |
|---|---|---|---|
| **lefthook** | 2.1.9 | 2026-05-29 (npm `time.modified`; GitHub release v2.1.9 May 29, 2026 — https://github.com/evilmartians/lefthook/releases) | Single Go binary, no runtime dependency; npm-installable; parallel jobs, `{staged_files}`, `stage_fixed` (auto-add linter fixes), commit-msg/pre-push hooks (https://lefthook.dev/configuration/). Actively maintained (7 releases Mar–May 2026). Install mechanics: the `lefthook` npm package fetches "one executable for your system" via a **postinstall script** (https://lefthook.dev/installation/node/) — runs by default under npm (T01's choice); under pnpm it needs `pnpm.onlyBuiltDependencies` (same page), and under Bun a `trustedDependencies` entry since Bun blocks dependency lifecycle scripts (https://bun.com/docs/guides/install/trusted); the `"prepare": "lefthook install"` script covers hook activation in all cases. |
| **pre-commit** (keep source tool) | 4.x line | active | Cross-platform *tool* but **Python-runtime-hosted**: a TS template requiring `pip/uv` to commit is a real onboarding smell; mypy/ruff/pytest hook contents don't transfer anyway. The one org TS usage was a single-purpose `language: system` hook, explicitly "not an endorsement over lefthook" (TS_EXISTING_REPO_REVIEW.md:218). |
| **husky + lint-staged** | husky 9.1.7; lint-staged 17.0.8 | husky **2025-01-11** (npm `time.modified` — no release in ~18 months); lint-staged 2026-06-20 | Most popular pair, but two tools to configure vs lefthook's one; husky's release cadence has gone quiet; zero org precedent. |
| **commitlint + @commitlint/config-conventional** | 21.2.0 | 2026-06-30 (npm `time.modified`) | Node-native, very active. Rules needed to replicate `.gitlint`: `type-enum`, `header-max-length`, `body-max-line-length` (https://commitlint.js.org/reference/rules.html). config-conventional defaults: header 100, body-line 100, types incl. `revert` (https://github.com/conventional-changelog/commitlint/tree/master/%40commitlint/config-conventional) — so 50/72 and the source type list require explicit overrides. |
| **gitlint** (keep source tool) | 0.19.1 | **2024-03-10** (https://github.com/jorisroovers/gitlint/releases) | Python package, slow cadence, and dormant even in the source repo. No reason to import a Python runtime for a check commitlint does natively. |
| **cocogitto `cog verify` / `cog install-hook`** | (Rust binary) | — | Language-agnostic, but duplicates commitlint's job locally, requires cargo/homebrew install (`Justfile:335-363`), and its type rules can't encode 50/72 line discipline. Retention for changelog/contributors is the release-topic's call. |

**6. Recommended choice**

- **Hook manager: lefthook 2.x**, installed as a devDependency and activated via the package.json `prepare` script (POC pattern).
- **Commit-message lint: commitlint 21.x + `@commitlint/config-conventional`**, run from a lefthook `commit-msg` hook, with overrides preserving the source contract: `type-enum: [feat,fix,docs,style,refactor,test,chore,ci,build,perf]` (source list; decide explicitly whether to also admit `revert` — recommend adding it, since release-please understands it and the org's changelog-sections configs handle it), `header-max-length: 50`, `body-max-line-length: 72`.
- **Hook duties (`lefthook.yml`)**: `pre-commit` = parallel jobs: (a) formatter/linter on `{staged_files}` with `stage_fixed: true` (exact command comes from the T-lint/format topic — Biome vs Oxlint tie-break #2; do not decide here), (b) typecheck (`tsc --noEmit`, cached via the task-runner topic's choice), (c) file-hygiene equivalents of check-yaml/check-toml/eof/trailing-whitespace/large-files to the extent the chosen formatter doesn't already subsume them; TOML/YAML formatting hooks only if the T-config-formatters topic keeps taplo/yamlfmt. `commit-msg` = commitlint. `pre-push` = test suite (fast unit tier).
- **No full test suite on `pre-commit`** — moved to pre-push + CI (see 7/8).
- **`.gitmessage`: port as-is** with the type list reconciled to the commitlint `type-enum` (source file omits `ci`, `build`, `perf` — an internal inconsistency to fix, per TS_PORT_INDEX.md:283), and actually wire it: a `just` setup recipe running `git config commit.template .gitmessage` (fixing the source's dormancy).
- **Drop `cog install-hook commit-msg` / `setup-cog-hooks`** from the hooks story; keep-or-drop of cocogitto overall (changelog, `CONTRIBUTORS.md`, `cog verify` range checks) is deferred to the release/changelog topic — if that topic keeps cog, `just verify-commits` can stay as a CI/range tool without owning the local hook.

**7. Rationale**

- Lefthook is the only hook manager with *positive* org precedent ("Reusable decisions", TS_EXISTING_REPO_REVIEW.md:390), and the domain spec says preserve it. Fresh research confirms it's still the right call as of 2026-07: active (v2.1.9, 2026-05-29), dependency-free Go binary, first-class `stage_fixed`/parallel/staged-file support. Existing-repo decision and fresh research **agree** — no conflict to adjudicate on the manager itself.
- Against pre-commit continuity: the source's hook *contents* (mypy, ruff, pytest) don't survive the port anyway, so "continuity" would preserve only the framework — at the cost of a Python runtime in a TypeScript template. Preserve intent (commit-time quality gate), not the tool.
- Against husky+lint-staged: two packages vs one, husky publish cadence stalled since 2025-01-11 (npm registry), and no org repo uses it.
- commitlint over gitlint: gitlint is Python, near-dormant upstream (0.19.1, 2024-03), and dormant *in the source repo itself*; commitlint is the POC precedent, Node-native, and current (21.2.0, 2026-06-30). The `.gitlint` 50/72 + type-list contract transfers losslessly as three rule overrides.
- Dropping full-suite-per-commit: the source's local pytest hook (`pass_filenames: false`) makes every commit O(test suite); the review shows no org TS repo does this — POC pre-commit runs only staged lint + typecheck, tests run in CI. A template optimizing contributor DX should keep commits fast and push the suite to pre-push/CI. This is a deliberate, documented divergence from source behavior (fresh judgment wins over source continuity; the *gate* intent is preserved at pre-push + CI).

**8. Tradeoffs**

- **Lost**: pre-commit's ecosystem of ready-made hooks (check-added-large-files etc.) — lefthook makes you write the command lines yourself; and CI's "run the exact same pre-commit suite" one-liner becomes "run the same underlying commands" (mitigate by routing both hooks and CI through the same `just` recipes, the source's own parity mechanism).
- **Weaker guarantee per commit**: a broken test can now be committed (caught at pre-push/CI instead). That is the industry norm and the org norm, but it *is* a behavior change from source.
- **Two Conventional-Commits enforcers if cog stays** (commitlint locally, `cog verify`/release tooling in CI): slight duplication; acceptable because they check the same spec, but the release topic should confirm one source of truth for the type list.
- commitlint's `header-max-length: 50` is stricter than config-conventional's 100 — occasional friction on long scoped subjects; it's the source's explicit 50/72 contract, so preserved.
- husky+lint-staged would be more familiar to drive-by contributors; lefthook's YAML is arguably clearer and the org already has a working `lefthook.yml` to copy.

**9. Migration implications**

- Delete `.pre-commit-config.yaml`, `.gitlint`; add `lefthook.yml`, `commitlint.config.mjs` (or `.cjs` per the ESM decision), devDeps `lefthook`, `@commitlint/cli`, `@commitlint/config-conventional`; add `"prepare": "lefthook install"` to package.json.
- Port `.gitmessage` verbatim plus the three missing types; add a setup recipe (`just hooks-setup` or similar) doing `git config commit.template .gitmessage` alongside `lefthook install` (replacing `just pre-commit-setup`/`pre-commit-uninstall`/`pre-commit-run` — keep equivalent recipe names or aliases so the Justfile surface stays familiar: e.g. `hooks-setup`, `hooks-run`).
- Remove `setup-cog-hooks` from the Justfile port; keep/adjust `verify-commits` per the release-topic decision. CI's `just pre-commit-setup && just pre-commit-run` step becomes `lefthook run pre-commit --all-files`-style or direct `just check` invocations (couple with the CI topic).
- Hook-content placeholders depend on: T-lint/format (linter+formatter command), T-typecheck/build (`tsc --noEmit`), T-test (runner for pre-push), T-config-formatters (taplo/yamlfmt survival), T-release/changelog (cocogitto fate). The generated-file exclusion (`_version.py`) maps to whatever generated artifacts the TS versioning story produces — likely none, since release-please owns version bumps.
- Docs to update: CONTRIBUTING.md, PR template (`just pre-commit-*` references, TS_PORT_INDEX.md:148), README feature list, issue-form acceptance-criteria wording ("testing added to pre-commit hook").

**10. Validation strategy**

- Fresh clone → `bun/npm install` → verify `prepare` installed hooks (`.git/hooks/pre-commit` managed by lefthook).
- Attempt commits with: a lint violation, an unformatted file, a type error → each blocked by pre-commit; a clean commit passes and auto-staged fixes (`stage_fixed`) are included.
- Commit-message matrix mirroring the source contract (TS_PORT_INDEX.md:273): known-good (`feat: add x`), bad type (`feet: ...`), >50-char subject, >72-char body line, each of the 10 allowed types → assert pass/fail matches `.gitlint` semantics.
- `git config commit.template` set → `git commit` shows the template.
- Pre-push with a failing unit test → push blocked.
- CI runs the same underlying `just` recipes and stays green on a clean tree.

**11. Decision status**

Proposed — the orchestrator gates acceptance.

# T11 Fragment

## T11: Versioning, release automation, and changelog

**1. Source Python tool or pattern**

Four coupled mechanisms in py-launch-blueprint:

- **hatch-vcs / setuptools-scm git-tag-derived versioning**: `[tool.hatch] version.source = "vcs"`, version file written to `py_launch_blueprint/_version.py`, `fallback_version = "0.0.1"`, `local_scheme = "no-local-version"` (`/Users/stevemorin/c/py-launch-blueprint/pyproject.toml:67-73,172-177`). The generated `_version.py` says "don't track in version control" in its own header yet is committed (`py_launch_blueprint/_version.py:1-2`, currently `0.1.dev338`) — the tracked-despite-header inconsistency documented in TS_PORT_INDEX.md (pyproject entry, and the pre-commit entry that special-cases `_version.py` exclusions, TS_PORT_INDEX.md:292-294).
- **cocogitto (`cog.toml`)**: Conventional-Commits changelog generation to `CHANGELOG.md` with a `[changelog.sections]` mapping (feat/fix/perf/docs/test → sections; chore+refactor → maintenance), `filter_unconventional = true`, skip rule for `^chore\(release\): prepare for` commits, plus a `[contributors]` block (markdown, sort by commits, exclude `noreply.github.com`) (`/Users/stevemorin/c/py-launch-blueprint/cog.toml:20-57`). Driven by justfile recipes `verify-commits`, `bump`, `commit`, `install-cog`, `setup-cog-hooks` (TS_PORT_INDEX.md:508).
- **`release.yml`**: tag-push (`v*`) triggered; builds with hatch, then a guard comparing `TAG_VERSION` (tag minus `refs/tags/v`) against `py_launch_blueprint.__version__`, exiting 1 on mismatch. Despite the job name `publish`, there is **no publish step** — actual PyPI publish exists only as a commented-out twine block in ci.yml (`/Users/stevemorin/c/py-launch-blueprint/.github/workflows/release.yml`; TS_PORT_INDEX.md:222-231).
- **`changelog.yml`**: a stub — full-history checkout with `contents: write`, but no changelog-generation step was ever wired in (`/Users/stevemorin/c/py-launch-blueprint/.github/workflows/changelog.yml`; TS_PORT_INDEX.md:162-171).

**2. Purpose in the original project**

- Versions are **never hand-edited**: git tags are the single source of truth; the build derives the version, and a clean `no-local-version` scheme keeps PyPI-compatible version strings (TS_PORT_INDEX.md:365 "git-tag-derived versions (never hand-edited)").
- Releases are **immutable tag-driven events** with a hard consistency gate: the tag must equal the package's declared version or the pipeline fails (TS_PORT_INDEX.md:227).
- CHANGELOG and contributor lists are **generated from Conventional-Commit history**, not maintained by hand (cog.toml intent, TS_PORT_INDEX.md:353).
- Publishing to a registry is **deliberately opt-in/disabled** in the template itself (commented-out PyPI block).

**3. Existing repo decision, if any**

Strong, explicit, and recent org NORM — the Synthesis section lists it as established default #2: "**Release: release-please manifest mode + GitHub App token + tag-triggered OIDC trusted publishing in a protected environment** … contributors-please implements it against npm (its workflow comments at release-please.yml:2 explicitly say the pattern mirrors py-launch-blueprint's release design), and difftree repeats the same shape against crates.io … Reuse the release-please + npm Trusted Publishing pattern" (TS_EXISTING_REPO_REVIEW.md:560-566). Details:

- **contributors-please** (TS, 2026-06): release-please v5.0.0 manifest mode (`release-type: node`, `bump-minor-pre-major`, `include-v-in-tag`, custom `changelog-sections`, PR title `chore(release): publish v${version}`); GitHub App token minted via `actions/create-github-app-token@v3` (client-id preferred; GITHUB_TOKEN deliberately avoided because it can't trigger downstream workflows); tag-triggered publish.yml verifies tag == package.json version, then publishes via **npm Trusted Publishing OIDC** (`id-token: write`, GitHub environment `npm`, no NPM_TOKEN) (TS_EXISTING_REPO_REVIEW.md:134-137,146).
- **Single-sourced version constant**: `src/version.ts` imports package.json via `import pkg from "../package.json" with { type: "json" }` and the bundler inlines the literal (TS_EXISTING_REPO_REVIEW.md:124,149), with a `test/version.test.ts` meta-test (TS_EXISTING_REPO_REVIEW.md:132).
- **difftree** (Rust, 2026-07): identical pipeline shape against crates.io — verify job (tag reachable from main via `git merge-base --is-ancestor`, tag matches manifest version, dry-run publish) gating a publish job in a protected environment with OIDC trusted publishing (TS_EXISTING_REPO_REVIEW.md:501-505,516).
- **difftree-action** (JS, 2026-07): release-please v5 manifest mode, `release-type: simple`, tag verified against `.release-please-manifest.json`, changelog-sections showing ci/test/refactor and hiding chore (TS_EXISTING_REPO_REVIEW.md:253).
- **Anti-precedent**: agent2linear's `np` interactive release + hardcoded version string in `src/cli.ts` is called out as NOT-to-reuse ("superseded org-wide by release-please + Trusted Publishing; also duplicates the version string in source (drift bug…)", TS_EXISTING_REPO_REVIEW.md:645-647).
- No org repo uses cocogitto; Conventional Commits enforcement precedent is commitlint via lefthook in the POC (TS_EXISTING_REPO_REVIEW.md:624-625).

**4. Decision classification**

Split into five sub-decisions:

| Sub-decision | Classification |
|---|---|
| (a) Version source of truth → package.json bumped by release-please Release PR | Replace Python-specific tool with TypeScript equivalent (implemented by reusing the org's existing release-please decision) |
| (b) `version.ts` single-sourcing from package.json | Reuse existing repo decision (contributors-please `src/version.ts` pattern) |
| (c) Changelog → release-please-generated CHANGELOG.md with ported section mapping | Adapt existing repo decision (port cog.toml's section semantics into release-please-config.json) |
| (d) cocogitto / `cog.toml` | Omit with rationale (duties redistributed; couples to T04 taplo and to the git-hooks topic) |
| (e) release.yml / changelog.yml workflows → release-please.yml + publish.yml pair | Adapt existing repo decision (changelog.yml stub: Omit with rationale — subsumed) |

**5. TypeScript/Node options considered**

*Version source of truth:*
1. **release-please v5 manifest mode** (org norm): `googleapis/release-please-action` **v5.0.0, released 2026-04-22**, breaking change "upgrade to node24" — the exact version the org already pins (`release-please.yml:82` in contributors-please) is current ([releases page](https://github.com/googleapis/release-please-action/releases)). Bumps package.json via a Release PR; merging tags `vX.Y.Z`.
2. **Git-tag-derived at build time** (literal hatch-vcs port): no first-class Node equivalent — `git describe`-based scripts or `semantic-release` (which computes the version from commits at publish time and does not keep package.json as reviewable source of truth). semantic-release also conflicts with the org's Release-PR-review model.
3. **Changesets**: healthy tool, but designed around human-authored changeset files, not Conventional Commits — would discard the source repo's commit-driven model and has zero org precedent.

*version.ts generation:*
1. **JSON import of package.json inlined at build** (org precedent, contributors-please `src/version.ts:1-6`) — `import pkg from "../package.json" with { type: "json" }`.
2. **release-please `extra-files` Generic updater** — annotate a line in `version.ts` with `// x-release-please-version` and release-please rewrites it in the Release PR ([customizing.md](https://github.com/googleapis/release-please/blob/main/docs/customizing.md)). Works, but makes `version.ts` a machine-rewritten tracked file — a milder re-run of the `_version.py` tracked-generated-file smell.
3. Runtime `readFile` of package.json from `dist/../package.json` — fragile path resolution across install layouts; rejected.

*Changelog tool:*
1. **release-please-generated CHANGELOG.md** — comes free with option 1 above; `changelog-sections` config reproduces cog.toml's mapping; org repos already do exactly this (TS_EXISTING_REPO_REVIEW.md:136,253).
2. **git-cliff** — active (v2.13.1, 2026-04-26, [releases](https://github.com/orhun/git-cliff/releases); also distributed [on npm](https://www.npmjs.com/package/git-cliff)); excellent tool, but a second changelog writer would fight release-please's Release-PR-managed CHANGELOG.md.
3. **Keep cocogitto** — still maintained (latest release v7.0.0 per [cocogitto/cocogitto/releases](https://github.com/cocogitto/cocogitto/releases) and [docs.rs/crate/cocogitto](https://docs.rs/crate/cocogitto/latest), verified 2026-07; added monorepo workspace support and pre-release auto-increment); rejection is not on maturity grounds (see 7).

*npm publish mechanics (verified as of 2026-07):* npm Trusted Publishing requires **npm CLI >= 11.5.1 and Node >= 22.14.0**; GitHub Actions **GitHub-hosted runners only** (self-hosted unsupported); workflow needs `permissions: id-token: write`; the trusted publisher is configured in npmjs.com package settings (org/user, repo, workflow filename, **optional environment name**); provenance attestations are generated automatically for public repos; **only one trusted publisher per package**; OIDC works only with `npm publish` ([docs.npmjs.com/trusted-publishers](https://docs.npmjs.com/trusted-publishers/)). Node 24 bundles npm v11 meeting the floor — Node 22 (npm 10) fails with a misleading 404 ([philna.sh 2026-01-28](https://philna.sh/blog/2026/01/28/trusted-publishing-npm/)). **`bun publish` does not support OIDC trusted publishing** (open issues [oven-sh/bun#22423](https://github.com/oven-sh/bun/issues/22423), [#24855](https://github.com/oven-sh/bun/issues/24855)) — so the publish job must run `npm publish` on Node 24 regardless of the T-package-manager outcome.

**6. Recommended choice**

- **(a)** Version source of truth = **package.json, bumped only by release-please v5.0.0 manifest-mode Release PRs** (`release-type: node`, `bump-minor-pre-major: true`, `include-v-in-tag: true`, PR title `chore(release): publish v${version}`), authenticated with the org GitHub App token (`actions/create-github-app-token@v3`, `RELEASE_PLEASE_CLIENT_ID`/`RELEASE_PLEASE_PRIVATE_KEY`), `concurrency` group with `cancel-in-progress: false`, `workflow_dispatch` fallback. Git tags remain the release trigger, preserving the source's tag-driven-release intent.
- **(b)** `src/version.ts` = hand-written two-liner importing package.json with `with { type: "json" }`, exporting `VERSION`; the build inlines it. Plus a `test/version.test.ts` meta-test asserting it equals package.json (contributors-please pattern). No generated version file exists at all.
- **(c)** CHANGELOG.md = release-please-generated, with `changelog-sections` porting cog.toml's mapping: feat→Features, fix→Bug Fixes, perf→Performance, docs→Documentation, test→Testing, refactor→visible (per difftree-action's newest precedent), chore→hidden. Release commits (`chore(release): publish…`) are excluded by release-please by design, matching cog.toml's skip rule.
- **(d)** **Drop cocogitto and `cog.toml`.**
- **(e)** Workflows: `release-please.yml` (push to main → Release PR) + `publish.yml` (tag `v*.*.*` → cheap `verify` job: tag == package.json version, tag reachable from main, `npm pack --dry-run`; gating a `publish` job in a protected `npm` GitHub environment using Trusted Publishing OIDC on **Node 24**). Delete the `changelog.yml` stub. The publish job stays inert-but-ready until the template consumer configures a trusted publisher on npmjs.com — documented in a `docs/RELEASE.md` runbook (difftree precedent, TS_EXISTING_REPO_REVIEW.md:501). This upgrades the source's commented-out-publish posture to "wired, gated by a protected environment + registry-side config" rather than commented-out YAML.

**7. Rationale**

- The org norm is not merely analogous — contributors-please's release workflow **states it mirrors py-launch-blueprint's own release design** (TS_EXISTING_REPO_REVIEW.md:116,146). The port is rejoining the source repo's own canonical pattern as already translated to npm by the same owner. Fresh research confirms every pinned component is current (release-please-action v5.0.0 is the latest release; npm Trusted Publishing requirements verified above). Existing-repo decision and fresh research agree; no tie-break needed.
- Fact vs judgment on (a): *fact* — no Node tool replicates hatch-vcs's build-time tag derivation cleanly, and npm requires a concrete `version` in the published package.json anyway; *judgment* — a reviewable Release PR that bumps package.json is a better template default than build-time derivation, and it eliminates the `_version.py` class of generated-tracked files entirely. The hatch-vcs *intent* (version never hand-edited; tag consistency machine-enforced) is preserved: humans still never edit the version (the bot PR does), and the publish `verify` job is the direct descendant of release.yml's tag-vs-`__version__` gate.
- (b) beats the `extra-files` annotation approach because it has zero drift surface (the value is read from package.json, not copied into a second file by a bot) and is the owner's shipped pattern; it also fixes agent2linear's documented hardcoded-version drift bug (TS_EXISTING_REPO_REVIEW.md:100).
- (d) cocogitto is alive (v7.0.0) — the drop is judgment, on redundancy: release-please already owns bump + changelog + release tagging, so keeping cog would create two competing bump/changelog authorities and retain an extra non-npm Rust binary dependency in a TS template. Its three duties redistribute cleanly: bump/changelog → release-please; commit-message enforcement (`verify-commits`, commit-msg hook) → the git-hooks topic, where the POC's lefthook + commitlint is the in-org precedent (TS_EXISTING_REPO_REVIEW.md:624-625) — **dependency stated, not decided here**; `[contributors]` generation → the update-contributors script/workflow (TS_PORT_INDEX.md:234-240; source justfile already has a cog-free `git shortlog -sne` path, TS_PORT_INDEX.md:508) plus the CONTRIBUTORS.md marker-comment pattern (TS_PORT_INDEX.md:484-488) — handled in the scripts/contributors topic.

**8. Tradeoffs**

- **Lost**: dev-build versions like `0.1.dev338` — every build between releases carries the last released version instead of a commit-distance version. Acceptable for a CLI/library template; anyone needing build fingerprints can add a git-SHA at bundle time later.
- **Lost**: cocogitto's local interactive `cog commit` / `cog bump` UX. commitlint (hooks topic) covers verification but not the interactive authoring aid.
- **Gained-but-coupled**: release automation now depends on org-level GitHub App provisioning (`RELEASE_PLEASE_CLIENT_ID`/`RELEASE_PLEASE_PRIVATE_KEY` secrets); template consumers without the App fall back to a PAT (the workflow's documented fallback chain, TS_EXISTING_REPO_REVIEW.md:134). This is more setup than cocogitto's zero-server model — the price of Release-PR review and downstream-workflow triggering.
- **Trusted Publishing constraints**: GitHub-hosted runners only; one trusted publisher per package; publish must use npm CLI (not bun/pnpm publish) on Node ≥ 24 — a hard edge if T-package-manager picks Bun (dev-time Bun is fine; the publish job is npm regardless).
- Release cadence becomes merge-gated (a human merges the Release PR) rather than tag-on-demand — matches difftree's deliberate "review and merge to ship" gate (TS_EXISTING_REPO_REVIEW.md:503), and `bump-minor-pre-major` protects pre-1.0 semver.

**9. Migration implications**

- Delete: `cog.toml`, `changelog.yml`, hatch-vcs/setuptools-scm build config, `_version.py` handling (pre-commit exclusions for it, sdist/wheel version-file hooks), justfile cog recipes (`verify-commits`/`bump`/`commit`/`install-cog`/`setup-cog-hooks` — replacement recipes belong to the hooks topic) and `install-cog` from `check-deps`.
- Add: `release-please-config.json` + `.release-please-manifest.json` (start `{".": "0.1.0"}` or current), `.github/workflows/release-please.yml` and `publish.yml` (copy contributors-please/difftree shape; least-privilege `permissions`, concurrency, App-token step), `src/version.ts` + `test/version.test.ts`, `docs/RELEASE.md` runbook, protected `npm` environment note.
- CHANGELOG.md becomes release-please-managed; seed it empty or with a Keep-a-Changelog-style header.
- **T04 coupling**: dropping cog.toml removes one TOML file from the repo; cog.toml can no longer be cited as a reason to keep taplo (T04 decides taplo on the remaining TOML population, e.g. a possible oxlint/lefthook TOML).
- **Hooks/CI coupling**: Conventional-Commit enforcement (source: `.commit-template` + cog verify) must be re-homed to commitlint (or equivalent) in the hooks topic; release-please silently ignores unconventional commits, so without enforcement they simply vanish from the changelog.
- **Build-tool coupling**: `version.ts`'s JSON import requires the chosen bundler to inline package.json (ncc/tsup/tsdown/esbuild all do; plain `tsc` emit would need `resolveJsonModule` and ship package.json relative to dist — flag to the build topic).
- CI/docs references to `just bump`/cog must be rewritten (CONTRIBUTING.md, docs tool pages for cocogitto if any exist under `docs/source/tools/`).

**10. Validation strategy**

- On a scratch repo (org has `blueprint-dryrun` precedent, TS_EXISTING_REPO_REVIEW.md:39): push `feat:`, `fix:`, `chore:`, and one unconventional commit → release-please opens a Release PR; assert CHANGELOG sections match the ported cog.toml mapping (feat/fix visible, chore hidden, unconventional absent) — this is the INDEX's own validation recipe for cog.toml (TS_PORT_INDEX.md:357).
- Merge the Release PR → assert `v0.x.y` tag pushed and publish.yml `verify` passes; push a manually mismatched tag → assert verify fails with the version-mismatch error (ports release.yml's test, TS_PORT_INDEX.md:231).
- `test/version.test.ts` asserts `VERSION === package.json version`; a dist smoke test runs `<cli> --version` and compares (contributors-please meta-test pattern, TS_EXISTING_REPO_REVIEW.md:132,150).
- Workflow-YAML meta-tests asserting `id-token: write`, environment `npm`, Node 24, and no `NPM_TOKEN` usage in publish.yml (org pattern, TS_EXISTING_REPO_REVIEW.md:193).
- One real Trusted-Publishing publish from the scratch repo (or `npm publish --dry-run` if registry config is deferred); `actionlint` over all new workflows.

**11. Decision status**

Proposed — orchestrator gates acceptance.

## T12: CI and security workflows (ci.yaml, codeql.yml, dependency-review.yml, manual-pr-security-scan.yml, release.yml, update-contributors.yml, changelog.yml, dependabot gap)

**1. Source Python tool or pattern**

Seven workflows in `py-launch-blueprint/.github/workflows/` (source SHA 4828f85, per TS_PORT_INDEX.md "Feature area: ci-security"):

- `ci.yaml` — push/PR→main; ubuntu-latest; Python matrix `["3.10","3.11"]` (floor + one newer); bootstrap `checkout@v4` → `astral-sh/setup-uv@v5` → `setup-python@v5` → `extractions/setup-just@v2` → `uv venv` + `uv sync --all-extras --dev` + venv bin appended to `GITHUB_PATH`; named direct steps (mypy, ruff, taplo) AND a full pre-commit re-run (`just pre-commit-setup` + `just pre-commit-run`); commented scaffolding blocks for codecov upload, a `pyupio/safety-action` security job with a same-repo fork guard, and a twine PyPI publish job with `needs: [test, security]` (TS_PORT_INDEX.md, ci-security entries 1–3 and "Disabled-but-documented automation").
- `codeql.yml` — push/PR→main + weekly cron `44 21 * * 4`; job-level least-privilege permissions; `fail-fast: false` include-matrix with single entry `{language: python, build-mode: none}`; `github/codeql-action/init|analyze@v3` with `category: /language:${{matrix.language}}` (TS_PORT_INDEX.md "CodeQL advanced setup").
- `dependency-review.yml` — PR-only; `contents: read` + `pull-requests: write`; `actions/dependency-review-action@v4` with `comment-summary-in-pr: always`; stricter knobs (`fail-on-severity`, `deny-licenses`) present but commented (TS_PORT_INDEX.md "Dependency Review gate").
- `manual-pr-security-scan.yml` — `workflow_dispatch` with required `pr_number` + `reviewer` inputs; `environment: security-review` (protected environment holding `SAFETY_API_KEY`); checks out `refs/pull/<n>/head`; `pyupio/safety-action@v1`; `actions/github-script@v7` posts an attributed "Security Review Results" PR comment. Documented latent bug: the Safety step has no `id: safety`, so `steps.safety.outputs.*` resolve empty; scanner output is also interpolated directly into a JS template literal (script-injection risk) (TS_PORT_INDEX.md "Manual, environment-gated PR security scan", verified against `manual-pr-security-scan.yml:39-55` in the source tree).
- `release.yml` — on `v*` tag push: build, then assert tag version == package `__version__`; publishes nothing (TS_PORT_INDEX.md "Release supply-chain guard").
- `update-contributors.yml` — bot-PR pattern: regenerate CONTRIBUTORS.md, sync a long-lived branch idempotently, commit as `github-actions[bot]`, open/update PR via `peter-evans/create-pull-request@v5`; stale pins (`checkout@v3`, `setup-python@v4`) (TS_PORT_INDEX.md "Automated contributors-list bot PR").
- `changelog.yml` — permission-bearing stub: `contents: write`, `fetch-depth: 0` checkout, no generation step (TS_PORT_INDEX.md "Changelog workflow is a stub").
- Absent: no `.github/dependabot.yml` or `renovate.json`, though `.github/SECURITY.md` claims "Dependabot alerts and updates" — a documented mismatch (TS_PORT_INDEX.md "No dependabot/renovate config despite SECURITY.md claiming Dependabot").
- Pinning: all actions pinned to floating major tags, never SHAs, with version skew across workflows (TS_PORT_INDEX.md "Action pinning policy").
- Permissions hygiene: explicit least-privilege blocks on some workflows; `ci.yaml`/`release.yml` declare nothing (TS_PORT_INDEX.md "Explicit-but-inconsistent workflow permissions hygiene").

**2. Purpose in the original project**

Layered, free-tier-friendly security and quality automation for a template repo: fast compatibility signal (2-version matrix), CI/local parity (CI runs the same `just` recipes and the full hook suite developers use), SAST on every change plus weekly rescan (CodeQL), supply-chain gate on every PR (dependency-review), a human-initiated, environment-gated, audit-trailed deep scan for untrusted fork PRs (manual safety scan), release-integrity gating (tag/version consistency), bot changes via reviewed PRs (contributors), and executable documentation of the hard-won guard conditions (commented codecov/security/publish jobs).

**3. Existing repo decision, if any**

From TS_EXISTING_REPO_REVIEW.md, Synthesis:

- Established default #8: "CI shape: GitHub Actions, push/PR→main, Node version matrix, setup-node with cache, major-tag action pinning, least-privilege/deny-all permissions on release workflows — agent2linear, contributors-please, difftree. Reuse (runner choice — Blacksmith vs ubuntu-latest — needs a decision; the template's public consumers argue for ubuntu-latest)" (review lines 590-594).
- "Decisions NOT to reuse": Blacksmith runners — "a public template should default to ubuntu-latest" (review lines 654-655).
- Tie-break #7 (explicit Phase 4 item): "most workflows pin actions by major tag, but difftree-action deliberately SHA-pins the security-sensitive token-minting action with a version comment (`actions/create-github-app-token@bcd2ba49… # v3.2.0`) — the newest precedent. Phase 4 must decide: major tags everywhere vs SHA-pinning security-sensitive third-party actions" (review lines 636-641).
- Established default #2: release-please manifest mode + GitHub App token + tag-triggered OIDC trusted publishing (review lines 560-566) — owns the release/changelog surface this topic borders.
- Newest org repos already use `actions/checkout@v6` / `actions/setup-node@v6` with `cache: npm` (contributors-please ci.yml:16-20, review line 134) and `concurrency` groups + `permissions: {}` deny-all with per-job escalation (review lines 134, 195, 251).
- difftree-action adds actionlint (+shellcheck of embedded bash) as a CI lint layer (review lines 247, 265) and documented per-workflow concurrency policy (review line 264).
- agent2linear's fork-secret-safety split (secret-bearing suite only on trusted events, never `pull_request`) is a deliberate documented decision (review lines 71, 87).
- No org repo has a dependabot.yml or renovate config observed in the review; no precedent either way on update bots.

**4. Decision classification**

Split by sub-decision:

| Sub-decision | Classification |
|---|---|
| CI workflow shape (triggers, ubuntu-latest, named just-recipe steps + hook-suite parity, commented scaffolding) | Adapt existing repo decision (org CI shape #8 applied to the source workflow's structure) |
| Node version matrix | Adapt existing repo decision (source's floor+1 intent; exact versions fresh-verified) |
| Dependency caching | Reuse existing repo decision (`setup-node` built-in cache), coupled to PM tie-break |
| CodeQL workflow | Keep source cross-platform tool (language swap + action major bump) |
| dependency-review.yml | Keep source cross-platform tool (major bump v4→v5) |
| Safety scanner replacement (manual scan + commented CI security job) | Replace Python-specific tool with TypeScript equivalent |
| Dependabot vs Renovate (close SECURITY.md gap) | Fresh research required |
| Action pinning policy (tie-break #7) | Adapt existing repo decision (difftree-action newest precedent) |
| Permissions normalization | Reuse existing repo decision (deny-all/least-privilege) |
| update-contributors.yml bot-PR pattern | Keep source cross-platform pattern (version bumps; coupling noted) |
| changelog.yml stub | Omit with rationale |
| release.yml tag/version gate | Adapt existing repo decision (fold into release-please publish flow — release topic owns it) |

**5. TypeScript/Node options considered**

*CodeQL*: `github/codeql-action` current major is **v4** (latest 4.36.3, released 2026-07-01); **v3 will be deprecated in December 2026** and logs upgrade warnings; v4 runs on Node 24 and requires CodeQL bundle ≥2.19.4 (https://github.com/github/codeql-action/blob/main/CHANGELOG.md). TS analysis uses the JavaScript extractor with `language: javascript-typescript`, `build-mode: none` — the GitHub starter workflow uses exactly this pair (https://raw.githubusercontent.com/main/starter-workflows — code-scanning/codeql.yml; https://codeql.github.com/docs/codeql-overview/supported-languages-and-frameworks/). No alternative considered — CodeQL is GitHub-native, free for public repos, and org-established.

*Dependency review*: `actions/dependency-review-action` current major is **v5** (v5.0.0, May 2026; Node 24 runtime, requires runner ≥v2.327.1); README recommends `@v5`; `comment-summary-in-pr: always|on-failure|never`, `fail-on-severity`, `license-check`, `allow-licenses` all current; `deny-licenses` is marked deprecated in the current README (https://github.com/actions/dependency-review-action; https://github.com/actions/dependency-review-action/releases). It natively supports npm/pnpm/yarn lockfiles (GitHub dependency graph does the parsing).

*Safety (pyupio) replacement candidates*:
- **PM-native audit** (`npm audit` / `pnpm audit` / `bun audit`): `npm audit` queries the registry's bulk advisory endpoint, needs **no API key**, has `--audit-level=<severity>` failure threshold and `--omit=dev`, and exits non-zero when vulnerabilities meet the threshold (https://docs.npmjs.com/cli/v11/commands/npm-audit). Zero-install in CI. Known weakness: no dedup/reachability ranking; noisy on transitive advisories.
- **osv-scanner v2** (Google): stable v2 line, actively maintained through 2026 (v2.3.x releases in Mar–May 2026, v2.4.0 after; https://github.com/google/osv-scanner/releases); scans lockfiles across ecosystems via OSV.dev, no API key; official action `google/osv-scanner-action` plus reusable workflows for PR-diff scanning and scheduled full scans (https://google.github.io/osv-scanner/github-action/).
- Snyk / Socket.dev: require accounts/API keys — reintroduces exactly the secret-management problem the source workflow existed to contain; rejected for a public template default.

*Update bot*:
- **Dependabot**: GitHub-native, zero infrastructure, configured per-repo via `.github/dependabot.yml`; supports `npm`, `github-actions`, and `bun` (text `bun.lock`, Bun ≥1.1.39) ecosystems; grouped updates GA, including grouping by name across directories (2026-02 changelog) (https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories; https://github.blog/changelog/2026-02-24-dependabot-can-group-updates-by-dependency-name-across-multiple-directories/). Updates SHA-pinned actions and maintains the version comment.
- **Renovate**: broader ecosystem coverage, shared org presets, built-in automerge, `helpers:pinGitHubActionDigests` for automatic digest pinning (https://docs.renovatebot.com/modules/manager/github-actions/; https://docs.renovatebot.com/bot-comparison/) — but requires installing the Mend app (or self-hosting), which a template consumer must do out-of-band; per-repo config alone is not sufficient.

*Node matrix facts (as of 2026-07)*: Node 20 reached EOL 2026-04-30; Node 22 is Maintenance LTS (EOL 2027-04-30); Node 24 is Active LTS (EOL 2028-04-30); Node 26 is Current, scheduled for LTS Oct 2026 — and the release model changes to one major/year from Node 27 (https://nodejs.org/en/about/previous-releases; https://endoflife.date/nodejs; https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule).

*Caching*: `actions/setup-node@v6` built-in `cache:` (npm/pnpm/yarn) — org precedent (contributors-please ci.yml:17-20; agent2linear ci.yml:17-20, review lines 71, 134) — vs hand-rolled `actions/cache`. If the PM tie-break selects Bun: `oven-sh/setup-bun` has no built-in dependency cache; option is `actions/cache` on `~/.bun/install/cache` or no cache (bun installs are fast).

*Bot-PR action*: `peter-evans/create-pull-request` — source pins v5 (stale); current major is v7+ (search results are ambiguous between v7 and a newer v8) — pin whatever the releases page shows current at implementation time (https://github.com/peter-evans/create-pull-request/releases).

**6. Recommended choice**

1. **ci.yml (TS)**: push/PR→main on `ubuntu-latest`; explicit top-level `permissions: contents: read`; `actions/checkout@v6` → `actions/setup-node@v6` (matrix version, `cache:` per chosen PM) → `extractions/setup-just@v2` → frozen-lockfile install; named steps calling `just` recipes (typecheck / lint / format-check / test), plus one hook-manager run-all step preserving the "CI runs the exact hook suite" invariant (hook manager choice belongs to the git-hooks topic); keep the commented scaffolding blocks: coverage upload, an automated SCA job guarded by `if: github.event.pull_request.head.repo.full_name == github.repository`, and a publish job stub pointing at the release-please/Trusted-Publishing flow (release topic owns the real one).
2. **Node matrix**: two-entry matrix = `["24.x", "26.x"]` (Active-LTS floor + Current) — the engines floor (Node ≥24, per D-011) plus the next line, preserving the source repo's floor-plus-next compatibility-signal intent. Matrix values are owned by T01/D-011(2); this topic adopts them (reconciled at the Phase 4 gate — see D-027). Never include EOL Node 20.
3. **codeql.yml**: port near-verbatim; matrix entry `{language: javascript-typescript, build-mode: none}`; bump `github/codeql-action/*` **v3 → v4**; keep the weekly off-hour cron, `fail-fast: false` include-matrix shape, job-level least-privilege permissions, and `category` parameter.
4. **dependency-review.yml**: keep as-is; bump **v4 → v5**; keep `comment-summary-in-pr: always` and the commented policy knobs, replacing the deprecated `deny-licenses` example with `allow-licenses`/license-check examples relevant to JS deps.
5. **manual-pr-security-scan.yml**: keep the dispatch-inputs + `environment: security-review` + attributed-comment skeleton; replace `pyupio/safety-action` with **osv-scanner** (`google/osv-scanner-action`, or the pinned CLI) — no API key, so the environment secret disappears but the environment gate stays for approval/audit semantics; fix the latent bug by giving the scan step `id: scan` and passing its output to github-script **via `env:`**, never template-literal interpolation.
6. **Commented CI security job**: use the PM-native audit command (`npm audit --audit-level=high` or `bun audit` per PM tie-break) — zero-install, no third-party action, ideal as uncomment-to-enable scaffolding.
7. **Update bot**: **Dependabot** (`.github/dependabot.yml`) with two ecosystems — `github-actions` and the JS package ecosystem matching the PM tie-break (`npm` covers npm/pnpm/yarn lockfiles; `bun` if Bun wins) — weekly schedule, grouped minor/patch updates. This also closes the documented SECURITY.md mismatch. Renovate documented as an alternative in comments, not default.
8. **Pinning policy (tie-break #7)**: adopt difftree-action's newest precedent — **major-tag pinning for official `actions/*` and `github/*` actions; full-SHA pin + version comment for security-sensitive or third-party actions** (token-minting, third-party scanners, create-pull-request), with Dependabot's `github-actions` ecosystem keeping the SHAs fresh.
9. **Permissions**: every workflow gets an explicit top-level `permissions:` block (`contents: read` baseline; `permissions: {}` + per-job grants on release/token-bearing workflows), with the source's explanatory-comment style.
10. **update-contributors.yml**: port the bot-PR pattern (branch-sync idempotency, bot commit, PR-not-push) with `checkout@v6` and current-major `peter-evans/create-pull-request`; note the coupling — the community topic may swap the bespoke script for the owner's own `smorinlabs/contributors-please-action`.
11. **changelog.yml**: **omit** — do not port a `contents: write` no-op; release-please (established default #2) generates CHANGELOG.md.
12. **release.yml tag/version gate**: preserve the gate (tag == `package.json` version via `node -p`), but folded into the release topic's release-please publish workflow, matching contributors-please `publish.yml:55-61`.

**7. Rationale**

- CodeQL and dependency-review are cross-platform by design; only the language matrix entry and action majors change. Staying on codeql-action v3 would hit the December 2026 deprecation almost immediately after launch.
- osv-scanner over npm audit for the *manual deep scan*: it is PM/lockfile-agnostic (insulates the workflow from the still-open PM tie-break), Google-maintained with an official action and no API key, and produces ranked, deduplicated results — closer to what pyupio/safety provided than raw `npm audit`. PM-native audit is still the right choice for the *commented always-on job* because it is a one-liner requiring no third-party action — matching the source's "uncomment to enable" spirit.
- Dependabot over Renovate: the template's consumers get working automation from a single committed file with zero app installation — the property a template must optimize for; it covers both ecosystems needed (including Bun lockfiles) and grouped updates since 2023/2026. Renovate's advantages (org presets, automerge, digest pinning helper) mostly pay off at org scale, which is not the template's job. This also makes SECURITY.md truthful.
- Pinning: the hybrid policy is the org's own newest deliberate precedent (difftree-action, 2026-07) and the index explicitly says SHA-pinning "only makes sense if paired with dependabot/renovate" — which this bundle provides.
- ubuntu-latest: review's explicit not-reuse of Blacksmith for a public template.
- Matrix floor+next: `["24.x", "26.x"]` preserves the source's "minimum + one newer" intent with currently-supported Node lines (Active-LTS floor from D-011 plus Current, which becomes LTS Oct 2026); Node 20 is EOL so the index's example `["20","22"]` guess must not be used. A single-version matrix would be cheaper but abandons the compatibility signal the source's two-version matrix deliberately provides.
- Omitting changelog.yml: the index itself warns "`contents: write` on a stub is unnecessary attack surface", and the org default (release-please) already owns changelog generation.

**8. Tradeoffs**

- **osv-scanner vs npm audit in the manual scan**: osv-scanner adds a third-party action/binary (SHA-pin it per the pinning policy) and its Bun `bun.lock` extraction support should be verified at implementation time; npm audit would be simpler but couples the workflow to the PM choice and is noisier. If the PM tie-break lands on npm and simplicity is prized, PM-native audit everywhere is a defensible fallback — documented here so the orchestrator can flip it.
- **Dependabot vs Renovate**: Dependabot cannot auto-pin unpinned actions to digests (it only updates existing pins) and has no shared-preset story; consumers wanting org-scale policy will outgrow it. Renovate would auto-maintain digest pins but requires app installation the template cannot perform for its consumers.
- **Hybrid pinning vs SHA-everything**: SHA-pinning everything (OpenSSF hard line) maximizes supply-chain integrity but makes every workflow diff noisy and depends entirely on the bot; the hybrid keeps official-action readability while SHA-pinning where compromise impact is highest. This deviates from "major tags everywhere" seen in most org repos, but follows the org's *newest* deliberate precedent — fresh research (2025 tj-actions/changed-files compromise class) supports tightening, not loosening.
- **Keeping the manual-scan workflow at all**: dependency-review + CodeQL + Dependabot alerts overlap much of its ground (an open question the index raises). It is retained because the *pattern* (environment-gated, human-attributed scan of untrusted PR code) is template pedagogy the source deliberately built; cost is one more workflow to maintain. The `security-review` environment must be created in repo settings — a documented manual setup step, not a file.
- **Two-version matrix** doubles CI minutes vs the org's newest single-version practice (Node 24 only); kept because the source's compatibility-signal intent is template-specific.
- **Dual enforcement** (direct steps + hook-suite re-run) runs checks twice; kept deliberately for per-tool PR-check granularity + local/CI parity, same as source.

**9. Migration implications**

- New files: `.github/workflows/ci.yml`, `codeql.yml`, `dependency-review.yml`, `manual-pr-security-scan.yml`, `update-contributors.yml`, `.github/dependabot.yml`. Dropped: `changelog.yml`. `release.yml`'s gate migrates into the release topic's publish workflow.
- SECURITY.md edits (docs topic): keep the Dependabot claim (now true); CodeQL claim stays true with the language swap.
- Repo-settings actions (not files, must be documented in setup docs): enable Dependabot alerts, create the `security-review` environment with required reviewers, enable private vulnerability reporting, mark dependency-review/CI as required checks.
- Couplings: PM tie-break → `setup-node cache:` value, dependabot ecosystem key, audit command, and whether setup-node is replaced by setup-bun; runtime-floor topic → matrix values; git-hooks topic → the run-all parity step; release topic → publish scaffolding, tag gate, release-please; community topic → contributors script vs contributors-please-action.
- The port must unify action versions across all workflows (source had checkout v3/v4 skew) — Dependabot then holds them uniform.

**10. Validation strategy**

- `actionlint` (and shellcheck of embedded bash, per difftree-action precedent) over all workflows locally and as a CI step.
- Push to the new repo: confirm CodeQL run completes with `javascript-typescript` and results appear under Security → Code scanning; open a test PR adding a known-vulnerable dev dependency and confirm dependency-review comments; run `workflow_dispatch` of the manual scan against that PR and confirm the comment contains real scanner output (regression test for the fixed `id:` bug).
- Merge a Dependabot config and confirm PRs appear for both ecosystems (can force with an intentionally stale action pin).
- Adopt the org's workflow-YAML meta-test pattern (contributors-please test/ci-workflow.test.ts, review line 150): Vitest tests parsing the workflows and asserting permissions blocks exist, the scan step has `id: scan`, no EOL Node versions in the matrix, and pinning policy conformance (SHA for third-party).
- CI matrix run must be green on both Node versions before first tag.

**11. Decision status**

Proposed — orchestrator gates acceptance. Flagged for explicit orchestrator attention: (a) pinning tie-break #7 resolution (hybrid policy), (b) osv-scanner vs PM-native audit in the manual scan, (c) omission of changelog.yml, (d) matrix values adopted from T01/D-011(2) as `["24.x", "26.x"]` (reconciled at the Phase 4 gate, D-027).

# Fragment T13

## T13: Documentation system and API docs (Sphinx/MyST/Furo/RTD → TS-appropriate docs conventions)

**1. Source Python tool or pattern**

Sphinx documentation site built from MyST markdown with the Furo theme, hosted on Read the Docs with multi-format output (`pdf`, `epub`, `htmlzip`):

- `docs/source/conf.py`: extensions `sphinx.ext.autodoc`, `viewcode`, `napoleon`, `intersphinx`, `sphinx_autodoc_typehints`, `myst_parser`, `sphinx_copybutton` (`conf.py:21-29`); MyST `colon_fence` + `deflist` enabled (`conf.py:31-34`); `html_theme = 'furo'` with custom footer icons and `html_logo` (`conf.py:55-85`).
- Content: 39 markdown files under `docs/source/` in a Diátaxis-ish information architecture — `tutorials/`, `tasks/` (how-to), `reference/`, `about/` (explanation), plus `tools/` (per-tool explainers, 13 pages) and `contributing/` (incl. `cla/`) (verified by `find docs -type f`). Plus `conf.py`, `docs/Makefile`, `_templates/base.html`, `_static/` logo — ~44 files total.
- `docs/Makefile`: wraps `uv run --extra docs sphinx-build` / `sphinx-autobuild` (`html`, `hotreloadhtml`, `docs` targets) — one-command build + hot-reload authoring (TS_PORT_INDEX.md:582-591).
- `.readthedocs.yaml`: RTD v2 config, ubuntu-22.04 + Python 3.10, installs the `docs` pip extra, builds `pdf`/`epub`/`htmlzip` (TS_PORT_INDEX.md:312-321).
- `pyproject.toml` `docs` extra: sphinx>=7, furo **and** an unused `sphinx-rtd-theme`, myst-parser, sphinx-autodoc-typehints, sphinx-copybutton, sphinx-autobuild, sphinxext-opengraph, cogapp (`pyproject.toml`, docs extra block).
- `docs/source/index.md` landing page substantially duplicates `README.md` (same tagline, "Why Choose", Features TLDR — verified by side-by-side head comparison of both files).
- `autodoc`/`napoleon`/`typehints` are configured but **latent** — no API-reference pages are generated from docstrings anywhere in `docs/source/` (no autodoc directives in any `.md`; the `reference/` section is hand-written CLI/config/structure/versioning pages).
- Justfile recipes `install-docs`, `docs`, `docs-dev`, `docs-clean` delegate to `docs/Makefile` (TS_PORT_INDEX.md:508).

**2. Purpose in the original project**

The docs site is a headline feature of the template product itself — the README advertises "Sphinx+MyST docs with Read the Docs" in its feature manifest (TS_PORT_INDEX.md:531-533). It serves three purposes: (a) user manual for the template's tool choices ("curated, explained defaults" — every tool gets a `tools/*.md` explainer); (b) contributor onboarding (tutorials/tasks/contributing incl. CLA texts); (c) a demonstration that a docs pipeline (build, hot reload, hosting, multi-format) comes pre-wired for downstream projects created from the template. The Diátaxis-ish IA (tutorials = learning, tasks = how-to, reference = information, about = explanation) is the deliberate content architecture; a Cursor rule (`doc-template`) even enforces a standard page structure for `docs/**/*.md` (TS_PORT_INDEX.md:393-399).

**3. Existing repo decision, if any**

Yes — an explicit, unanimous org practice that **conflicts** with the source:

- Synthesis #10: "**Docs: README-centric + docs/ decision records** — NO docs-site generator in any recent repo (agent2linear 60K README; difftree README+runbooks). The source repo's full Sphinx/RTD site conflicts with this org practice — Phase 4 must decide site-vs-README with an explicit tradeoff" (TS_EXISTING_REPO_REVIEW.md:598-601).
- Per-repo evidence: agent2linear — large README as user manual, CLAUDE.md, specs/plans under `docs/superpowers/`, "No docs site generator" (review line 75); contributors-please — "Single README.md only... No docs site, no docs/ directory" (line 138); contributors-please-action — README + `docs/RUNBOOK.md` + skills, "No docs site generator" (line 199); difftree — README canonical + `docs/RELEASE.md` runbook + `docs/specs/` locked decision records, "No docs site generator" (line 507); claim-npm — spec+README+superpowers docs, "No docs site generator" (line 312).
- No org repo uses Read the Docs, GitHub Pages, TypeDoc, VitePress, Docusaurus, or Starlight (absent from all eight repo reviews).

**4. Decision classification**

Split sub-decisions:

- **Docs delivery model (site generator + RTD hosting → README-centric markdown)**: **Adapt existing repo decision** — org practice wins over 1:1 tool substitution, but adapted: the full Diátaxis `docs/` content tree is kept (org repos keep `docs/` for records; this template's docs volume justifies a structured tree), and the tree is kept generator-ready for a later opt-in site.
- **Diátaxis information architecture (tutorials/tasks/reference/about/tools/contributing)**: **Keep source pattern (cross-platform)** — pure content architecture, language- and tool-agnostic; preserved verbatim.
- **MyST markdown content**: **Replace Python-specific tool with TypeScript-equivalent-compatible format** — normalize to plain CommonMark/GFM (already ~90% there).
- **API docs (`autodoc`, latent)**: **Replace Python-specific tool with TypeScript equivalent** — TypeDoc, wired the same way the source wired autodoc: present and configured, not load-bearing.
- **RTD multi-format outputs (pdf/epub/htmlzip), Furo theme, `_templates/base.html`, `sphinx-rtd-theme` dep, `docs/Makefile`, `.readthedocs.yaml`, index.md↔README duplication**: **Omit with rationale** (below).

**5. TypeScript/Node options considered** (facts as of 2026-07-07; versions from registry.npmjs.org dist-tags)

| Option | Current version | Maturity facts |
|---|---|---|
| **No generator (GitHub-rendered markdown)** | n/a | Org-unanimous pattern (review Synthesis #10). GitHub renders GFM natively with code-block copy buttons, relative-link navigation, and anchor links; zero dependencies; zero build. No search beyond GitHub's, no theming, no offline site. |
| **Astro Starlight** | `@astrojs/starlight` 0.41.3, published 2026-07-03 (registry.npmjs.org); requires Astro 7 (astro 7.0.6, 2026-07-02) | Very active (0.39 May 2026, 0.41 June 2026 — astro.build/blog/whats-new-june-2026). **Pre-1.0**: breaking changes land in minor releases (0.41 dropped Astro 6 support). Built-in Pagefind search, i18n, MD/MDX, dark mode, zero-JS islands. Community consensus favors it for new docs sites in 2026 (pkgpulse.com/guides/best-documentation-frameworks-2026; docsio.co/blog/starlight-docs). 498,365 weekly downloads (api.npmjs.org, 2026-07-07). |
| **VitePress** | latest 1.6.4, published **2025-08-05** (~11 months without a stable release); `next` 2.0.0-alpha.18, published 2026-07-06 | Stable line effectively frozen while v2 sits in alpha since mid-2025 with **no announced stable timeline and no maintainer response** in the timeline discussion (github.com/vuejs/vitepress/discussions/5072, opened 2025-12-31, maintainers silent through at least 2026-04 — re-verified 2026-07-07). Built-in MiniSearch local search; 601,969 weekly downloads (api.npmjs.org, 2026-07-07); used by Vue/Vite/Vitest. Awkward adoption moment: pin a dormant 1.x or ride an alpha. |
| **Docusaurus** | `@docusaurus/core` 3.10.1, published 2026-04-30 | Most mature/battle-tested (1,173,022 weekly downloads for @docusaurus/core — api.npmjs.org, 2026-07-07; Meta-backed, versioned-docs support built in). React-based, heaviest dependency tree and most boilerplate of the three; overkill for a lean single-package CLI template (pkgpulse comparison). |
| **TypeDoc** (API docs) | 0.28.20, published 2026-07-05; `typedoc-plugin-markdown` 4.12.0, published 2026-06-02 | Actively maintained (patch released 2 days before this research); 3,876,608 weekly downloads (api.npmjs.org, 2026-07-07); supports TypeScript 5.0.x–6.0.x (peerDependencies, TypeStrong/typedoc master package.json). De-facto standard TSDoc→docs generator; markdown plugin emits plain `.md` that fits a README-centric tree. |
| **Read the Docs hosting for a Node tool** | n/a | Supported via `build.commands`/`build.jobs` ("Read the Docs supports any tool that generates HTML"), but pdf/epub generation becomes your responsibility ("It is your responsibility to generate HTML and other formats... when overriding the steps") — docs.readthedocs.com/platform/stable/build-customization.html. No org precedent; Python-ecosystem-centric value props. |
| **GitHub Pages** (if a site is ever added) | n/a | Native `actions/deploy-pages` flow matches the org's GitHub-Actions-everywhere CI practice (review Synthesis #8); no extra vendor account. |

Content-portability facts (measured in the source repo): MyST-specific syntax is confined to ~10 of 39 files — `{toctree}` blocks in the 8 section `index.md` files, one `{figure}` in the landing page, and `docs.md` (a meta-page teaching Sphinx/MyST authoring, which must be rewritten no matter what tool is chosen). Spot-checked content pages (`tutorials/full_project_setup.md`, `tools/ruff.md`, `tasks/setting_up_development.md`, `reference/cli_reference.md`, `about/philosophy.md`) contain **zero** MyST roles/directives and use plain relative `.md` links (grep across `docs/source/`). So the corpus is already ~90% generator-agnostic CommonMark.

**6. Recommended choice**

1. **Drop the docs-site generator and RTD hosting. Go README-centric + a plain-markdown `docs/` tree that preserves the Diátaxis IA**, GitHub-rendered:
   - `README.md` = the single landing page/manifest (feature list, quick start, links into `docs/`) — eliminating the source's index.md↔README duplication.
   - `docs/tutorials/`, `docs/tasks/`, `docs/reference/`, `docs/about/`, `docs/tools/`, `docs/contributing/` — same sections, same page inventory (per-page keep/adapt/omit is owned by each page's index entry), flattened from `docs/source/` to `docs/`.
   - Section `index.md` files keep their prose and replace `{toctree}` with plain markdown link lists (GitHub-navigable; also exactly what Starlight/VitePress sidebars can be generated from later).
   - Content normalized to CommonMark/GFM: `{figure}` → standard image markdown; admonitions → GFM alerts (`> [!NOTE]`) or plain blockquotes; `docs.md` rewritten as "how to write docs in this repo" for the markdown-first system.
2. **API docs: TypeDoc 0.28.x + typedoc-plugin-markdown 4.x as the declared, optional API-docs path** — a `typedoc.json` and a `just docs-api` recipe emitting markdown into `docs/reference/api/` (gitignored or committed at implementer's choice), **not** wired into CI gates. This mirrors the source's latent autodoc exactly: capability present, pipeline optional.
3. **Docs quality gate replaces docs build gate**: a markdown link-checker (e.g. `lychee` or `markdown-link-check` — exact tool couples to T-lint/CI topics) run via `just docs-check`, replacing "does Sphinx build" as the docs CI signal.
4. **Documented upgrade path, not shipped**: record in `docs/about/` (or the port research record) that if/when a hosted site is wanted, **Starlight is the designated generator and GitHub Pages the designated host** — chosen over VitePress (stable line dormant since 2025-08, v2 in open-ended alpha — discussions/5072) and Docusaurus (React-heavy, boilerplate-heavy for a lean template). The tree layout above is deliberately Starlight/VitePress-consumable (plain CommonMark, relative links, one H1/page).
5. **Omit**: `.readthedocs.yaml`, `docs/Makefile`, `conf.py`, `_templates/base.html`, Furo theming, `sphinx-rtd-theme` (unused even in source), `sphinxext-opengraph`, pdf/epub/htmlzip outputs, the `docs` dependency extra as a concept (TypeDoc + link checker land in `devDependencies`). `sphinx-copybutton`'s intent (copy-paste-able code blocks) is preserved for free by GitHub's built-in code-block copy button (and by Starlight/VitePress if the site path is later exercised).

**7. Rationale**

- **The existing-repo review explicitly flags this as the tie-break, and org practice is unanimous and recent**: five of five recent shipped repos are README-centric with `docs/` records and no generator (review lines 75, 138, 199, 312, 507; Synthesis #10). Per the port discipline, deliberate recent decisions are defaults; deviating requires a strong reason. The strongest counter-reason — "the docs site is part of the template's product" — is real but is satisfied by preserving the *information architecture and content*, which is what actually carries the "curated, explained defaults" value. The Sphinx/RTD *machinery* is the Python-specific part; the Diátaxis tree is the intent.
- **The TS generator field is at an awkward maturity moment (verified 2026-07-07)**: VitePress's stable line hasn't shipped since 2025-08-05 with v2 alpha open-ended (registry dist-tags; discussions/5072); Starlight is excellent but pre-1.0 with breaking minors (0.41 dropped Astro 6 — whats-new-june-2026); Docusaurus is stable but the heaviest fit. A template must hand users a docs stack that stays current with `npm update` — shipping a pre-1.0 or dormant-stable generator as a *template default* transfers churn to every downstream project. README-centric has zero churn.
- **Cost asymmetry**: porting content to plain CommonMark is cheap (~10 of 39 files contain any MyST syntax, mostly `{toctree}` lists); porting to a generator costs that *plus* generator config, theme/logo/opengraph re-implementation, hosting setup, CI deploy workflow, and a new maintenance surface — for a site whose content is 100% rewritten for the TS toolchain anyway (every `tools/*.md` page changes tool).
- **TypeDoc for API docs preserves intent at matched investment**: the source configured autodoc but never used it; wiring TypeDoc as configured-but-optional is the faithful port, and TypeDoc 0.28.20/plugin-markdown 4.12.0 are current and actively maintained (registry publish dates 2026-07-05 / 2026-06-02).
- **Hosting**: with no site, RTD has no role; if a site is later added, GitHub Pages matches the org's GitHub-native CI (Synthesis #8) and avoids a second vendor. RTD's residual advantages (free pdf/epub, PR previews, versioned hosting) are exactly the features being dropped, and its non-Python path pushes format generation onto the project anyway (docs.readthedocs.com build-customization).

**8. Tradeoffs**

What is given up by dropping the site (stated honestly):

- **No full-text search** over docs (RTD/Sphinx gave server+client search; VitePress/Starlight give local search). Mitigation: GitHub repo search covers the tree; loss is real for non-GitHub readers.
- **No branded, themed docs experience** (Furo dark mode, logo sidebar, footer links, opengraph cards) and **no docs URL** (`*.readthedocs.io`) to put in the README badge/marketing. For a template whose pitch includes "quality documentation," a polished site has genuine marketing value — this is the strongest argument against the recommendation, and the documented Starlight upgrade path is the hedge.
- **No pdf/epub/htmlzip outputs**. No evidence of demand in the source repo (no issue templates or docs reference them beyond RTD config); omitted knowingly.
- **No hot-reload authoring loop** (`sphinx-autobuild`); plain markdown barely needs one, and any editor previews GFM.
- **Version-pinned docs per release** (RTD's version switcher) is lost; a template repo realistically documents only `main`.
- Conversely, if the orchestrator overrides toward a site: **Starlight** is the recommended pick, accepting (a) pre-1.0 breaking minors must be absorbed by template maintenance, (b) an Astro dependency tree lands in a repo that otherwise needs no front-end toolchain, (c) org-first precedent is created. VitePress should *not* be picked until v2 stabilizes; Docusaurus only if React docs-versioning becomes a requirement.

**9. Migration implications**

- Move `docs/source/**` → `docs/**` (drop the Sphinx `source/` nesting): ~39 md files; per-file dispositions stay with their TS_PORT_INDEX entries (e.g., `tools/mypy.md` → typechecker page per T-typecheck; `tools/taplo.md` keep/omit couples to the `.taplo.toml` decision — TS_PORT_INDEX.md:332).
- Convert `{toctree}` (8 index pages) → markdown link lists; `{figure}` (landing) → `<img>`/markdown image; rewrite `docs.md`; delete `conf.py`, `docs/Makefile`, `_templates/base.html`, `.readthedocs.yaml`; logo lives once under `assets/` (no `_static/` duplicate needed).
- Merge `docs/source/index.md` into `README.md` (dedupe); README's "Full documentation on ReadTheDocs" links → relative `docs/` links.
- Add `typedoc.json` + TypeDoc devDependencies + `just docs-api`; add `just docs-check` (link check) replacing `just docs`/`docs-dev`/`install-docs`/`docs-clean` (couples to T-justfile).
- **Cross-topic reference fixes** (dependencies, not decided here): CONTRIBUTING.md's `docs/source/tools/cla-assistant.md` path (TS_PORT_INDEX.md:64-66); issue/PR templates' "docs added in Sphinx" checklist wording (TS_PORT_INDEX.md:88-92, 147-152); `.windsurfrules`/Cursor `doc-template` rule globs `docs/**/*.md` — glob survives, examples need rewriting (TS_PORT_INDEX.md:393-399, 453-457); `pyproject.toml` `docs` extra → devDependencies (T-package-manifest); docs-request issue template stays as-is (language-agnostic).
- CLA pages under `docs/contributing/cla/` move mechanically but their existence couples to the CLA-workflow topic.

**10. Validation strategy**

- Fresh clone: every relative link in `README.md` and `docs/**` resolves — `just docs-check` (link checker) exits 0 locally and in CI.
- GitHub rendering spot-check: section `index.md` pages navigate to all children; images render; GFM alerts render as admonitions; code blocks show copy buttons.
- `just docs-api` produces TypeDoc markdown under `docs/reference/api/` from the template's example CLI source with zero warnings.
- No dangling Sphinx artifacts: `grep -r "toctree\|{ref}\|readthedocs\|sphinx" docs/ README.md CONTRIBUTING.md .github/` returns only intentional mentions (e.g., port-history notes).
- Optional forward-compat probe (non-gating): `npx create-astro --template starlight` against a copy of `docs/` confirms the tree is consumable with only frontmatter additions — validates the documented upgrade path.

**11. Decision status**

Proposed — orchestrator gates acceptance. Flag for the gate: this is the topic's mandated big tradeoff (site-vs-README); the recommendation follows org practice over the domain spec's tool-mapping instinct, with the Diátaxis IA preserved and a named, validated upgrade path (Starlight + GitHub Pages) if a hosted site is later required.

# T14 fragment

## T14: Developer experience and repo hygiene (Justfile/Makefile surface, editor+AI configs, LICENSE/CLA/contributors/funding, EXAMPLECLI)

**Source Python tool or pattern**

A two-layer command surface plus a repo-hygiene bundle in `py-launch-blueprint`:

- **A. Justfile** (693 lines) — canonical dev command surface: name variables (`py_package_name`/`repo_name`/`command_name`, Justfile:2-4), `[group(...)]` taxonomy + single-letter aliases + self-listing default, `check-deps` with per-tool colored remediation (Justfile:81-93), `uvx --with-editable .` no-activation workflow with a `legacy` pip group, `debug-info` markdown bug-report bundle (Justfile:201-249), cog/contributors recipes, GitHub-Actions-testing recipe trio (`pr-to-testrepo`/`create-test-pr`/`clean-pr-to-testrepo`, Justfile:418-619) with `[confirm]` guards, per-OS `install-*` recipes (TS_PORT_INDEX.md:504-514, 1511-1594).
- **B. Makefile** (182 lines) — bootstrap-only layer: `make check` status table for just+uv, print-first `install-*` and opt-in `install-*-force` targets, `SHELL := /bin/zsh` + `~/.zshenv` PATH writes (TS_PORT_INDEX.md:516-526).
- **C/D. `.vscode/launch.json`** (two `type: "python"` F5 configs, bare + args) and **`.vscode/extensions.json`** (12 recommendations, 4 Python-bound); deliberately no `.vscode/settings.json` (TS_PORT_INDEX.md:414-436, 1547-1551).
- **E. AI-config mesh** — `CLAUDE.md` terse command card; `.windsurfrules` deep charter (hub); `.cursor/rules/projectenv.mdc` pointer + `doc-template.mdc` glob rule; `.windsurf/rules/justfile-rules.md` glob rule on the Justfile (TS_PORT_INDEX.md:1541-1545).
- **G. Licensing** — MIT declared in pyproject + README badge + 18-line MIT headers stamped on config files, but **no root LICENSE file** (documented defect, TS_PORT_INDEX.md:1571-1575).
- **H. CLA program** — Individual/Corporate CLA texts in docs, CONTRIBUTING.md front-loads the CLA, cla-assistant.io bot, maintainer setup guide + FAQ (TS_PORT_INDEX.md:1565-1569).
- **I. Contributors automation** — `scripts/update_contributors.py` regenerating CONTRIBUTORS.md between `<!-- COG-CONTRIBUTORS-LIST:START/END -->` markers, bot PR workflow (`update-contributors.yml`), plus a *divergent* `just update-contributors` recipe doing a cruder `git shortlog -sne` overwrite and a malformed orphan recipe — a documented latent bug (TS_PORT_INDEX.md:1559-1563).
- **K. `EXAMPLECLI.md`** — end-user doc for the example CLI: token precedence chain, output formats, exit-code table 0-5 (TS_PORT_INDEX.md:492-502).
- **M. `.github/FUNDING.yml`** — `github: smorin` sponsor button (TS_PORT_INDEX.md:72-82).

**Purpose in the original project**

One discoverable entry point for every dev task with zero-assumption onboarding (`make check` → `just install-dev` → `just check`); toolchain drift converted to one-command diagnosis; F5 debugging and one-click editor setup; every AI assistant landing with correct commands on first prompt; community-standards/legal readiness (CLA, funding, contributor recognition) from day one; the example CLI documented as a teaching artifact (TS_PORT_INDEX.md:1514, 1526, 1544, 1550, 1568).

**Existing repo decision, if any**

- **Justfile + minimal Makefile bootstrap is Synthesis established default #7**: "Task runner: Justfile as command surface (+ minimal Makefile bootstrap) … difftree's canonical recipe set (default=list, format/lint/typecheck/test, `all`), POC's 612-line Justfile + Makefile check/bootstrap … Reuse" (TS_EXISTING_REPO_REVIEW.md:586-589). difftree's recipe vocabulary is the org canon (TS_EXISTING_REPO_REVIEW.md:514).
- **AI/editor config is Synthesis default #9**: committed `.claude/settings.json` with `companyAnnouncements` (difftree) and plugin enables (`typescript-lsp`, `ast-grep` — agent2linear, TS_EXISTING_REPO_REVIEW.md:90, 595-597); claude-code-review workflow (difftree, TS_EXISTING_REPO_REVIEW.md:498, 523). The user's global CLAUDE.md independently mandates a `companyAnnouncements` welcome string for owned repos.
- **Turbo**: explicit Phase-4 tie-break #6 — agent2linear wraps every script in Turbo v1 in a single package (flagged as boilerplate not to copy, TS_EXISTING_REPO_REVIEW.md:97, 108); POC uses Turborepo 2 with a real workspace graph (TS_EXISTING_REPO_REVIEW.md:368). "The port target is a single-package template → decide turbo-as-cache vs plain scripts" (TS_EXISTING_REPO_REVIEW.md:632-635).
- **Contributors automation**: the org owns `smorinlabs/contributors-please` v1.4.3 (npm-published TS engine+CLI, "Incremental, path-aware contributor recognition engine and CLI") and its GitHub Action wrapper `contributors-please-action`, whose release workflow "mirrors the canonical pattern from smorinlabs/py-launch-blueprint" (TS_EXISTING_REPO_REVIEW.md:112-124, 173-177).
- **`.vscode/` in org repos**: agent2linear gitignores `.vscode/` (TS_EXISTING_REPO_REVIEW.md:109); the POC un-gitignores only `extensions.json` (TS_EXISTING_REPO_REVIEW.md:397). Neither is a template — the source template's shipped editor configs are the deliberate template-grade decision.
- **CLA/FUNDING/LICENSE**: no org TS repo carries a CLA program; difftree has a root MIT LICENSE (TS_EXISTING_REPO_REVIEW.md:418). The source repo's missing root LICENSE is indexed as "a defect to correct, not a behavior to replicate" (TS_PORT_INDEX.md:1573).

**Decision classification**

Split by sub-decision:

- A. Justfile port — **Reuse existing repo decision** (also Keep source Python repo cross-platform tool)
- B. Makefile bootstrap — **Adapt existing repo decision** (bootstrap-dep swap; keep make, cross-platform)
- C. VS Code debug configs — **Replace Python-specific tool with TypeScript equivalent**
- D. VS Code extensions — **Adapt existing repo decision** (swap the Python four; final list coupled to the lint/format topic)
- E. AI-config mesh — **Adapt existing repo decision** + fresh research on the hub file (AGENTS.md)
- F. `.claude/settings.json` + claude-code-review — **Reuse existing repo decision**
- G. LICENSE — **Adapt existing repo decision** (documented gap fix; header simplification is fresh judgment)
- H. CLA program — **Keep source Python repo cross-platform tool** (cla-assistant is language-agnostic)
- I. Contributors automation — **Replace Python-specific tool with TypeScript equivalent** (org's own contributors-please)
- J. Turbo tie-break #6 — **Omit with rationale**
- K. EXAMPLECLI.md — **Adapt existing repo decision** (copy then modify; exit codes reconciled to cli-standards)
- M. FUNDING.yml — **Keep source Python repo cross-platform tool** (cross-platform source file copied as-is; the existing-repo review contains no funding decision)

**TypeScript/Node options considered**

- **Task runner (A/J)**: (1) `just` — current release **1.55.1, 2026-06-30** (https://github.com/casey/just/releases); `[group]`/`[confirm]` attributes used by the source are long-stable, and 1.54/1.55 added cached recipes and `set minimum-version`. (2) plain npm/package.json scripts. (3) **Turborepo — `turbo` latest 2.10.4** (registry.npmjs.org/turbo/latest, checked 2026-07-07) as a cache layer over scripts.
- **Debugger (C)**: (1) built-in **vscode-js-debug** — VS Code's default JS/TS debugger; `type: "node"` resolves source maps automatically and "you can even specify a source file (for example, app.ts) with the `program` attribute"; documented tsx pattern is `"runtimeExecutable": "tsx"` (https://code.visualstudio.com/docs/nodejs/nodejs-debugging). (2) manual `node --inspect` + attach config — supported by the same docs but two-step. (3) `oven.bun-vscode` `type: "bun"` — only if the runtime topic picks Bun for dev execution.
- **AI hub file (E)**: (1) keep `.windsurfrules` as hub — but Windsurf docs now redirect to docs.devin.ai (Cognition), which states "`.devin/` directory is the preferred location … with `.windsurf/` kept as a fallback for backward compatibility", i.e. `.windsurfrules` is legacy on its own platform, and Windsurf/Devin reads **AGENTS.md natively as always-on rules** (https://docs.devin.ai/desktop/cascade/memories). (2) **AGENTS.md as hub** — Linux Foundation-stewarded open format, 25+ supporting tools (Codex, Jules, Devin/Windsurf, Copilot, Cursor, Zed, Aider), 60k+ projects (https://agents.md/). Cursor supports AGENTS.md alongside `.cursor/rules` `.mdc` (which remains the mechanism for glob/metadata rules) (https://cursor.com/docs/context/rules).
- **CLA (H)**: (1) hosted **cla-assistant.io** — free SAP-hosted service, still operating; main repo's latest release v2.13.1 (2023-08), aging but functional (https://github.com/cla-assistant/cla-assistant). (2) **contributor-assistant/github-action** ("lite"; redirect from cla-assistant/github-action) — **archived/read-only**: GitHub API reports `archived: true`, `pushed_at: 2026-03-23` (the 2026-03 push was the archival, not activity; checked 2026-07-07); its README states "This repository is no longer actively maintained… archived and is now read-only" and that forking is the supported continuation path ("You are welcome to fork this repository… All existing releases remain functional"). Latest tag v2.6.1 is frozen but functional; self-contained Actions-based signature flow supporting both CLA and DCO (https://github.com/contributor-assistant/github-action).
- **Contributors (I)**: (1) **contributors-please 1.4.3** on npm — MIT, ESM, bin CLI (`validate`/`render`/`init`), engines node>=24 (registry.npmjs.org/contributors-please/latest, checked 2026-07-07; TS_EXISTING_REPO_REVIEW.md:120) + `contributors-please-action`. (2) port `update_contributors.py` as a ~40-line TS script (same git-log + marker replace). (3) all-contributors bot (different recognition model — emoji-keyed, not git-history-driven).
- **debug-info (A)**: (1) dependency-free shell recipe (source pattern). (2) **envinfo 7.21.0**, last published 2025-11-27, "Info about your dev environment for debugging purposes" (registry.npmjs.org/envinfo, checked 2026-07-07) via `npx envinfo`.

**Recommended choice**

- **A. Justfile — port near-1:1** as the canonical command surface: keep name variables (renamed `package_name`/`repo_name`/`command_name`), groups taxonomy (adding the undocumented `clean` group to the taxonomy comment — drift fix per TS_PORT_INDEX.md:1519), aliases, `check-deps` with per-tool remediation (list shrinks to just/node/package-manager/git + any surviving out-of-ecosystem binaries — final list assembled from other topics' choices), `debug-info` as a dependency-free recipe (node/PM/tsc/git/just versions, `os_family()` OS report, project version from package.json; mention `npx envinfo` in the recipe comment as optional), the GitHub-Actions-testing trio verbatim with `[confirm]` + marker-file guards, `dev`/`cycle` and `check` composites verbatim, and difftree's canonical recipe names (`default`=list, `format`, `format-check`, `lint`, `typecheck`, `test`, `run`, `all`). **Drop** the `legacy` pip group (activation-free tooling is native in Node — recipes call the package manager's exec form) and the malformed orphan `contributors` recipe; **fix** rather than port the broken `build` TODO. Recipe *bodies* are owned by the lint/format, test, build, and package-manager topics — explicit coupling.
- **B. Makefile — keep the bootstrap-only pattern**: `make check` table verifying `just` + the Node-side bootstrap tool chosen by the package-manager topic (coupling stated, not decided here); print-first `install-*`, opt-in `-force`. Generalize the zsh hardcoding: detect `$SHELL` for PATH-append target (bash/zsh) instead of `SHELL := /bin/zsh`-only.
- **C. `.vscode/launch.json` — two `type: "node"` configs** (bare + realistic-args, `console: integratedTerminal`) using the built-in vscode-js-debug; primary config `"runtimeExecutable": "tsx", "program": "${workspaceFolder}/src/cli.ts"` if tsx is in devDeps, plus a third config against the built `dist/` entry with `sourceMaps`/`outFiles` so debugging matches the published artifact. No `node --inspect`+attach as the default (keep attach as optional documentation). If the runtime topic selects Bun-for-dev, substitute `type: "bun"` — flagged as a dependent override.
- **D. `.vscode/extensions.json`** — keep the 8 cross-platform entries; drop the Python four; add the lint/format extension chosen by the lint topic (e.g. `oxc.oxc-vscode` or `biomejs.biome` — that topic decides) and nothing for type checking (built-in TS language features replace Pylance). Preserve the no-`settings.json` principle.
- **E. AI-config mesh — keep hub-and-spoke, promote AGENTS.md to hub**: `AGENTS.md` carries the deep project charter (the `.windsurfrules` content, rewritten for the TS stack, including the "Justfile is command surface / Makefile is bootstrap-only" rule verbatim); `CLAUDE.md` stays the terse command card (commands incl. single-test invocation, style, environment) and points to AGENTS.md for the charter; `.cursor/rules/projectenv.mdc` re-points its `@`-reference from `.windsurfrules` to `AGENTS.md`; `doc-template.mdc` and the Justfile-conventions glob rule port as-is (keep the Justfile rule at `.windsurf/rules/justfile-rules.md` and mirror it as a `.cursor/rules` `.mdc` glob rule, since AGENTS.md has no glob scoping). Do not ship a `.windsurfrules` file.
- **F. `.claude/settings.json`** — reuse difftree's `companyAnnouncements` welcome string (project one-liner + relevant slash commands) and agent2linear's plugin enables (`typescript-lsp`, `ast-grep`). The claude-code-review workflow itself is owned by the CI topic; noted here as an org default to carry.
- **G. LICENSE — add a root `LICENSE` file (MIT, © Steve Morin)** and `"license": "MIT"` in package.json; correct the documented gap. Replace the 18-line embedded MIT headers with one-line `# SPDX-License-Identifier: MIT` comments (SPDX/REUSE convention, https://reuse.software/spec/) where per-file provenance is kept at all; do not add header-insertion automation (a root LICENSE makes GitHub/licensee detection and npm metadata authoritative).
- **H. CLA — keep the full program as-is**: CLA texts, FAQ, setup guide, CONTRIBUTING.md front-loading, hosted cla-assistant.io as the documented default (zero-infra, matches source; service verified operating, no shutdown notice); add one paragraph to the setup guide noting the `contributor-assistant/github-action` lite variant — archived but functional (v2.6.1); forking is the supported continuation path per its README — as a self-contained alternative for template adopters who prefer Actions-only.
- **I. Contributors automation — replace the Python script with the org's own `contributors-please`**: `.contributors.yml` config, `npx contributors-please render` in a `just update-contributors` recipe (single implementation — eliminates the documented script-vs-recipe divergence), and `contributors-please-action` in the bot workflow replacing setup-python + `update_contributors.py`. Reset CONTRIBUTORS.md content; fix its header (it falsely credits cog as the generator, TS_PORT_INDEX.md:1561). Fallback if the action's node>=24 floor conflicts with the runtime topic's matrix: port the script as a small TS script, same markers.
- **J. Turbo — omit.** Plain Justfile recipes calling the toolchain directly (package.json scripts only for npm-lifecycle needs like `prepublishOnly`). No `turbo.json`.
- **K. EXAMPLECLI.md — copy then modify**: rename binary/package/env-var per the CLI topic's naming; rewrite installs for the npm registry (`npm install -g`/`npx` or Bun equivalents per the package-manager topic); preserve the documented contracts (token precedence flag > env > `~/.config/<name>/.env`, output formats, `--copy`/`--output` sinks) as the spec the TS CLI implements; the exit-code table must be reconciled to cli-standards R6.1 (0/1/2/3/4/5/130/143) rather than copied from the source's 0-5 taxonomy (Synthesis #4, TS_EXISTING_REPO_REVIEW.md:572-578) — final table owned by the CLI-surface topic.
- **M. FUNDING.yml — copy as-is** (`github: smorin`), header reduced per G.

**Rationale**

- Justfile/Makefile two-layer is a triple-confirmed deliberate pattern: source template + Synthesis default #7 + the owner's global `make check` → `just all` workflow convention. just is cross-platform, actively maintained (1.55.1, 2026-06-30), and the domain-spec rule says don't re-select cross-platform tools that still fit.
- Turbo omission follows the review's own verdict that agent2linear's single-package turbo wrapping is boilerplate (TS_EXISTING_REPO_REVIEW.md:97); a single-package template gains almost nothing from task caching but inherits a config file, a `.turbo/` dir, and a third command vocabulary alongside Justfile and npm scripts. POC's Turbo 2 usage is monorepo-specific and doesn't transfer.
- vscode-js-debug is the zero-install answer (ships with VS Code) and preserves the source's F5 intent exactly; `node --inspect`+attach adds a manual step for no benefit in a template.
- AGENTS.md-as-hub is the fresh-research call the index explicitly requested (TS_PORT_INDEX.md:410, 1545): since the port began, Windsurf's own docs demoted `.windsurfrules` (platform now Devin-branded, `.devin/` preferred) while AGENTS.md gained Linux Foundation stewardship and native support in Windsurf *and* Cursor — keeping `.windsurfrules` as hub would couple the template's canonical charter to a legacy filename on an acquired product.
- contributors-please is the rare case where the org built the exact replacement tool after the source repo; dogfooding it removes a Python runtime step from a TS template's workflow, fixes the documented recipe divergence, and its action mirrors py-launch-blueprint's own release pattern by design.
- Root LICENSE is a straight defect fix the index mandates; SPDX one-liners keep the per-file-provenance habit without 18-line headers or bespoke automation.
- CLA and FUNDING are language-agnostic and template-differentiating features; the hosted bot still operates, so simplification would remove a working feature for no cost saving.

**Tradeoffs**

- **Turbo omission**: no local/remote task caching — full `just check` always reruns everything. Acceptable at single-package scale (seconds, not minutes); adopters converting to monorepos add Turbo themselves. Where existing-repo pattern (agent2linear wraps everything in turbo) and fresh judgment disagree, fresh judgment wins because agent2linear's own review already disowned the pattern.
- **AGENTS.md hub**: diverges from the source's literal file layout (`.windsurfrules` dropped) — preserves intent (single machine-readable charter, cross-referenced) over file name. Risk: some older tools read only proprietary files; mitigated by keeping CLAUDE.md, `.cursor/rules`, and the `.windsurf/rules` glob rule as thin spokes. Claude Code does not auto-read AGENTS.md, so CLAUDE.md must keep its command card rather than becoming a bare pointer.
- **contributors-please**: adds an org-external-repo dependency and a node>=24 engines floor inside the workflow (workflow-local node version can exceed the library floor, but it's a coupling to track); the source's 40-line script had zero deps. The fallback (TS script port) is cheap if this bites.
- **tsx-based launch config**: assumes tsx (or equivalent loader) lands in devDeps — owned by the build/test topics; the dist-based third config hedges this.
- **cla-assistant hosted**: SAP's hosted service shows slow maintenance (last release 2023), and the lite github-action is itself archived; if the hosted service sunsets, the contingencies are (a) fork the archived `contributor-assistant/github-action` (v2.6.1 frozen but functional; forking is its README's supported continuation path) or (b) drop the CLA in favor of DCO (Developer Certificate of Origin) sign-offs — the lighter-weight industry alternative to a CLA program.
- **SPDX headers**: less self-contained than full-text headers when a single file is copied out of the repo; standard practice accepts the identifier + root LICENSE pair.

**Migration implications**

- Justfile recipe bodies are placeholders until lint/format (T-lint), test (T-test), build (T-build), package-manager/runtime (T-pkg) topics land; T14 owns the *skeleton* (groups, aliases, guards, name variables, check-deps/debug-info shape). `check-deps` tool list and Makefile's second bootstrap dependency are assembled last.
- `.github/workflows/update-contributors.yml` is rewritten around contributors-please-action; `scripts/update_contributors.py` is not ported; CONTRIBUTORS.md is reset with corrected header text and marker comments per contributors-please's format.
- Root LICENSE added in the first hygiene slice; README badge and package.json `license` must agree; per-file headers across all ported configs shrink to SPDX lines during each file's port.
- `.windsurfrules` content migrates into AGENTS.md at final-polish (it documents the finished toolchain, so it's written last — same sequencing note as TS_PORT_INDEX.md:458); `projectenv.mdc` reference updated in the same slice.
- EXAMPLECLI.md rewritten alongside the example CLI implementation slice; its exit-code table waits for the CLI-surface topic's cli-standards reconciliation.
- launch.json/extensions.json land with the toolchain slice; if runtime topic later flips dev execution to Bun, launch configs swap `type` in a follow-up (isolated file, low blast radius).

**Validation strategy**

- Fresh clone: `make check` fails listing missing tools with remediation; after installs, `just --list` shows grouped/aliased recipes; `just check-deps`, `just install-dev`, `just check`, `just dev` all green; `just debug-info` emits a pasteable markdown report.
- VS Code: open repo → extension prompt lists only marketplace-real, toolchain-matching extensions; F5 on each launch config binds a breakpoint in `src/cli.ts` (source maps) and the args config passes its flags.
- AI mesh: every command in CLAUDE.md and AGENTS.md executes verbatim; diff their command lists against the Justfile (the source's own validation idea, TS_PORT_INDEX.md:471); edit the Justfile in Cursor/Windsurf and confirm the glob rule fires.
- LICENSE: GitHub repo page shows detected MIT license; `npm pack --dry-run` includes LICENSE.
- Contributors: `workflow_dispatch` the bot workflow after a commit from a new author → CONTRIBUTORS.md regenerates between markers, PR opens on `update-contributors`; `just update-contributors` produces the identical diff locally (divergence eliminated).
- CLA: link check on all CLA doc URLs; if enabled on the repo, a test PR from a non-signed account gets the sign-link comment.
- EXAMPLECLI.md: every command in the doc executed against the built CLI; exit codes asserted by the conformance test suite (cli-standards R9.14).
- Turbo omission: assert no `turbo.json`/`.turbo` anywhere; `just check` wall-time recorded in port log as the baseline justifying no cache layer.

**Decision status**

Proposed
