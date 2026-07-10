# TS Port Plan

Implementation sequence for the py-launch-blueprint → ts-launch-blueprint port.
Authored by Fable in Phase 5 (goal.md §7; planning not delegable, D-001) from
`TS_PORT_INDEX.md` (what exists), `TS_EXISTING_REPO_REVIEW.md` (prior
decisions), and `TS_PORT_RESEARCH.md` (what was chosen, D-011–D-028). Naming
per D-029; slice structure per D-030; branch-per-slice per D-004.

**Vertical slices, not horizontal layers**: every slice ends with the repo in a
working, tested state (`just all` green for everything that exists so far).
Each slice runs the §3 loop (PLAN→EXECUTE→CHECK→VALIDATE→GATE) with sub-agent
executors (D-002), independent validators re-running build/lint/typecheck/tests
(2 validators on "passes" claims, §4.4), and merges to `main` only after its
gate passes (D-004). Escalations per §6 only.

Conventions used below:
- **Naming** (D-029): package `ts-launch-blueprint`, bin `ts-projects`, env
  `TS_PROJECTS_*`, config `$XDG_CONFIG_HOME/ts-projects/ts-projects_config.toml`.
- Runtime deps end-state (D-016 as amended by D-026): `commander`, `cli-table3`,
  `yocto-spinner`, `@inquirer/prompts`, `clipboardy`, plus `smol-toml`, `zod`
  (D-017). Color via `node:util` styleText (D-026) — no color dependency.
  (D-026's styleText choice superseded by D-038: `picocolors` runtime dep.)
- "Source parity check" = behavior compared against the Python source at pinned
  SHA `4828f8596b2332d74fbcff932ebab6f0030febd5`.

---

## Slice S1 — Project skeleton + toolchain (branch `slice/s1-skeleton`)

1. **Goal**: installable, buildable, type-checked, minimally tested TypeScript
   package skeleton with the two-layer Makefile/Justfile command surface.
2. **Source files/features involved**: `pyproject.toml` (identity/deps/config
   split), `pyrightconfig.json` (merged), `.python-version`, `.gitignore`,
   `Makefile`, `Justfile` (core recipes), `py_launch_blueprint/__init__.py`,
   `py_launch_blueprint/_version.py` (stub; release wiring in S5), missing root
   LICENSE (documented source gap).
3. **Target files**: `package.json` (name/bin/exports/files/engines>=24/
   devEngines/scripts, D-011/D-012), `package-lock.json` (committed, D-011(5)),
   `.nvmrc`=24 (D-011(3)), `tsconfig.json` (NodeNext, strict union incl.
   isolatedDeclarations, noEmit root, D-013/D-025), `tsdown.config.ts` (two
   entries cli+lib, dts, shebang, D-012), `src/lib.ts`, `src/version.ts`
   (package.json import, D-021(2)), `src/cli.ts` (stub printing version),
   `tests/version.test.ts`, `vitest.config.ts` (v8, 95/95/90/95 thresholds,
   D-019), `.gitignore` (adapted: dist/, coverage/, node_modules/; inverse
   lockfile comment), `LICENSE` (MIT root, D-024(7)), `Makefile`
   (bootstrap-only: check/install-just/install-node, D-024(2)), `Justfile`
   (name variables seam D-029; groups taxonomy incl. clean+legacy fix; recipes:
   default list, install, build, typecheck/tc, test, clean, check-deps with
   per-tool remediation, debug-info; D-024(1)/D-015(4)), minimal `README.md`
   stub (full port in S6b).
4. **Research decisions applied**: D-011 (all 5), D-012(1,2,3), D-013 (all),
   D-025, D-015(1,4), D-019(1,3), D-024(1,2,7), D-029.
5. **Existing repo decisions reused/adapted**: npm+lockfile (all recent TS
   repos), strict-ESM tsconfig (Synthesis #3), Justfile canonical recipes
   (difftree), Makefile bootstrap (POC), claim-npm strictness flags.
6. **Implementation tasks**: scaffold files above; `npm install` to generate
   lockfile; wire Justfile recipes to npm scripts; verify Node 24 floor.
7. **Tests**: `tests/version.test.ts` (version string matches package.json,
   semver shape); `just test` runs Vitest with coverage config active.
8. **Documentation updates**: README stub (name, one-para pitch, install
   placeholder); LICENSE.
9. **CI validation**: none yet (workflows land in S4); local `just all`
   equivalent = `just typecheck && just test && just build`.
10. **Risks**: tsdown 0.22.x pin behavior with isolatedDeclarations (fallback
    documented in D-025); npm engines enforcement variance.
11. **Definition of done**: fresh-clone flow works: `make check` →
    `npm install` → `just build && just typecheck && just test` all green;
    `node dist/cli.js --version` prints the package version; package.json
    passes `npm pkg fix` cleanly; all files above exist and committed on the
    slice branch.

## Slice S2 — Quality gates + editor/AI configs (branch `slice/s2-quality`)

1. **Goal**: the full lint/format/hook discipline of the source, in TS idiom —
   every quality gate runnable via one Justfile verb and enforced pre-commit.
2. **Source files/features involved**: `.pre-commit-config.yaml`, `.gitlint`,
   `.gitmessage`, `.taplo.toml` (omit), `.yamlfmt` (omit), `pyproject.toml`
   ruff sections (per-context relaxations), `.cursor/rules/*` (2),
   `.vscode/extensions.json`, `.vscode/launch.json`, `.windsurf/rules/
   justfile-rules.md`, `.windsurfrules`, `CLAUDE.md`.
3. **Target files**: `.oxlintrc.json` (Oxlint 1.x, security-adjacent rules,
   overrides for tests/**, D-014), Oxfmt config (exact-pinned beta; printWidth
   100/singleQuote/semi/trailingComma es5, sortImports, YAML formatting,
   D-014), `lefthook.yml` (parallel staged lint+format with stage_fixed, tsc
   gate; commit-msg commitlint; opt-in pre-push test, D-020), `commitlint.
   config.mjs` (@commitlint/config-conventional; type list reconciled with
   .gitmessage, D-020(2,4)), `.gitmessage` (copied, types reconciled),
   `package.json` prepare script (lefthook install), `.vscode/extensions.json`
   (8 cross-platform + oxc extension), `.vscode/launch.json` (vscode-js-debug
   tsx configs, D-024(3)), `AGENTS.md` (hub, replacing .windsurfrules,
   D-024(5)), `CLAUDE.md` (terse command card), `.cursor/rules/*.mdc`
   (re-pointed to AGENTS.md), `.claude/settings.json` (companyAnnouncements
   welcome string naming the project and relevant commands + plugin enables,
   D-024(6)), `.vscode/settings.json` containing ONLY `typescript.tsdk`
   pinning the editor to the workspace TypeScript (the editor≡CI compensating
   control from D-015(2), reconciled with the no-settings.json principle via
   D-032), Justfile recipes: format, format-check, lint, lint-fix,
   pre-commit-run (hook suite runner), all (format lint typecheck test),
   setup-hooks.
4. **Research decisions applied**: D-014 (all 7), D-020 (all 6), D-024(3,4,5,6),
   D-015(2) via D-032 (tsdk pin), D-018 partially (logger file lands in S3a).
5. **Existing repo decisions**: lefthook+commitlint (POC), difftree `all`
   recipe, .claude/settings.json announcements (difftree), plugins
   (agent2linear); documented Biome→Oxlint reversal (D-014 tie-break).
6. **Implementation tasks**: add devDeps (oxlint, oxfmt, lefthook, commitlint);
   author configs; wire recipes; run hooks end-to-end on a scratch commit.
7. **Tests**: meta-test `tests/repo-hygiene.test.ts`: commitlint type list ==
   .gitmessage types; lefthook config parses; a deliberately misformatted
   fixture string is caught by `just format-check` (executed in test via
   spawn); .nvmrc major == engines floor (D-011(3) meta-test).
8. **Documentation updates**: AGENTS.md + CLAUDE.md content; README stub gains
   dev-setup section (hooks install).
9. **CI validation**: none yet; `just all` green locally is the gate input.
10. **Risks**: Oxfmt beta churn (exact pin per D-014); oxlint/oxfmt rule
    overlap with tsc.
11. **Definition of done**: `just all` passes; `git commit` with a bad message
    is rejected by commitlint and a good conventional message passes; staged
    misformatted file is auto-fixed via stage_fixed; `just pre-commit-run`
    (all-files hook suite) green; editor/AI config files present and
    cross-referenced.

## Slice S3a — CLI foundation: entry, config, logging (branch `slice/s3a-cli-core`)

1. **Goal**: running `ts-projects` binary with cli-standards-conformant global
   surface (help/version/verbosity/color), layered config loading, and the
   stderr logger — the vertical path from argv to configured, logged execution.
2. **Source files/features involved**: `py_launch_blueprint/projects.py`
   (lines: consoles 49-50, error taxonomy 53-63, remediation block 88-105,
   config discovery/precedence 110-147, get_config, setup_config 251-270,
   token precedence 345-353), `EXAMPLECLI.md` (config/env/precedence sections),
   INDEX config-env + logging features, `tests/test_config.py`.
3. **Target files**: `src/cli.ts` (shebang entry, EPIPE handler, SIGINT/
   SIGTERM→130/143), `src/router.ts` (Commander v15 program factory wrapped in
   DI `runCli(argv, deps) → Promise<number>`, exitOverride mapping usage→2,
   showSuggestionAfterError, D-016), `src/lib/logger.ts` (leveled stderr
   logger, -v repeatable/-q per cli-standards R4, D-018), `src/lib/colors.ts`
   (styleText wrapper gated on --no-color/NO_COLOR/FORCE_COLOR/TTY, D-026;
   superseded by D-038's picocolors wrapper, same gate),
   `src/lib/xdg-paths.ts` (D-017(3)), `src/lib/config.ts` (TOML via smol-toml,
   zod v4 schema, precedence flag > TS_PROJECTS_TOKEN > config file; 0600
   write + POSIX loose-permissions warning; actionable multi-remedy
   missing-token error, D-017), `src/lib/errors.ts` (ConfigError/ApiError
   taxonomy mapped to the cli-standards R6.1 contract adopted in D-016(2):
   generic/config error→1, usage→2, not-found→3, auth incl. missing/invalid
   token→4, conflict→5, SIGINT→130, SIGTERM→143),
   `tests/config.test.ts` (ports test_config.py intent: precedence, isolation
   via injected env/fs, error messages), `tests/cli-core.test.ts` (in-process
   runCli: --version, --help shape, unknown command → exit 2 + did-you-mean,
   -v/-q levels).
4. **Research decisions applied**: D-016(1,2,8 + D-026), D-017 (all 6), D-018
   (all 5), D-029.
5. **Existing repo decisions**: claim-npm DI router + injected writers;
   agent2linear stderr logger; cli-standards normative surface (Synthesis #4).
6. **Implementation tasks**: add runtime deps (commander, smol-toml, zod);
   implement modules; port the remediation error text; document the .env→TOML
   migration divergence in code comment + EXAMPLECLI (finished in S3b).
7. **Tests**: as above; coverage thresholds enforced (95/95/90/95 with
   thin-adapter exclusions per D-019(3)).
8. **Documentation updates**: EXAMPLECLI.md partial rewrite (config +
   precedence + env sections, exit-code table per cli-standards R6.1 with
   source-mapping note, D-024(11)).
9. **CI validation**: none yet; local `just all`.
10. **Risks**: Commander v15 exitOverride edge cases (usage exit 2 vs source's
    click behavior); zod v4 error-message shaping for the multi-remedy text.
11. **Definition of done**: `just all` green; `node dist/cli.js --version`,
    `--help`, bad-flag→exit 2, missing-token→exit 4 (auth, per D-016(2)) with
    the three-remedy
    message, `TS_PROJECTS_TOKEN=x node dist/cli.js config --show` (or
    equivalent flag surface) works; config tests port every test_config.py
    behavior (or document intentional divergence inline).

## Slice S3b — CLI feature parity: fetch, select, output, clipboard (branch `slice/s3b-cli-parity`)

1. **Goal**: full user-facing parity with the source `py-projects` command —
   fetch projects, interactive multi-select, three output formats, sinks
   (stdout/file/clipboard), spinner — under the corrected stream contract.
2. **Source files/features involved**: `py_launch_blueprint/projects.py`
   (API client 150-249, workspace filter/limit, questionary checkbox 378-385,
   format_output json/csv/text, --copy/--output, Progress 358, exit paths
   383-408), `EXAMPLECLI.md` (flags, formats, examples), `tests/test_api.py`,
   `tests/test_cli.py` (incl. the documented mis-mock seams — port the INTENT
   with correct seams, D-019/INDEX note), `tests/__init__.py` (omitted — Vitest
   needs no package marker; INDEX Omit).
3. **Target files**: `src/lib/api.ts` (injected fetchImpl, page-size/limit
   semantics, workspace filter, typed Project), `src/commands/projects.ts`
   (default command: options --workspace --limit --format --output --copy
   --token --config --no-input; spinner on stderr via yocto-spinner TTY-gated,
   D-016(5)+D-018(5); @inquirer/prompts checkbox with output:stderr,
   D-016(6); cli-table3 preview table, D-016(4); clipboardy with headless
   degradation, D-016(7)), `src/lib/format.ts` (json/csv/text emitters;
   stdout carries exactly one result document, D-018(4)), `tests/api.test.ts`,
   `tests/cli.test.ts` (in-process tier: canned prompt via injected prompter,
   format outputs, exit codes incl. empty-selection→0), `tests/e2e.test.ts`
   (subprocess tier against dist/cli.js with mock HTTP server + TS_PROJECTS_*
   env, piped-stdout JSON parses cleanly WITHOUT regex-stripping — the
   progress-on-stdout wart is deliberately not preserved, D-018(5)).
4. **Research decisions applied**: D-016 (all, as amended by D-026), D-018(4,5),
   D-019 (all 6), D-012(3) (bin smoke via packed tarball deferred to S5),
   D-031 (fuzzy-search claim dropped).
5. **Existing repo decisions**: claim-npm mock-registry subprocess tier;
   agent2linear --json envelope conventions.
6. **Implementation tasks**: implement modules; port all EXAMPLECLI flag
   semantics; correct the two source quirks documented in INDEX (token-alone
   still requires config? — preserve source precedence behavior exactly;
   mis-mocked prompt tests — port with correct seams and pin BOTH paths:
   empty selection→exit 0 early return AND populated selection→format path);
   resolve the advertised-but-unimplemented fuzzy search per D-031: ship NO
   fuzzy dependency and remove the fuzzy claim from EXAMPLECLI/README/module
   docs (parity with actual source behavior; @inquirer checkbox's built-in
   list navigation is the selection aid).
7. **Tests**: as above; parity assertions comparing against source behavior
   table derived from INDEX cli fragment (exit codes, format shapes, default
   limit 200).
8. **Documentation updates**: EXAMPLECLI.md completed (all flags/examples with
   ts-projects naming); README usage section.
9. **CI validation**: none yet; local `just all`.
10. **Risks**: @inquirer/prompts stderr-output nuances in non-TTY; CSV shape
    fidelity; clipboard in CI (must skip/degrade cleanly).
11. **Definition of done**: `just all` green (coverage ≥ thresholds); e2e
    subprocess tests pass with clean piped stdout; behavior parity table fully
    checked off (each row: source behavior → TS behavior → same/deviation+D-ref);
    EXAMPLECLI.md accurate against the implementation (validator re-runs the
    examples).

## Slice S4 — CI + security workflows (branch `slice/s4-ci`)

1. **Goal**: the source's CI quality gates and security posture on GitHub
   Actions, TS-idiomatic, with the documented permissions/pinning hygiene.
2. **Source files/features involved**: `.github/workflows/ci.yaml`,
   `codeql.yml`, `dependency-review.yml`, `manual-pr-security-scan.yml`,
   `changelog.yml` (omit, D-022(12)), SECURITY.md dependabot mismatch
   (dependabot.yml new, D-022(8)).
3. **Target files**: `.github/workflows/ci.yml` (push/PR→main; ubuntu-latest;
   Node matrix ["24.x","26.x"] per D-027; checkout+setup-node cache:npm;
   steps as named just recipes: install→format-check→lint→typecheck→test→
   build + full hook-suite re-run mirroring the source's dual enforcement;
   commented codecov + npm-audit scaffolding preserved-as-scaffolding),
   `codeql.yml` (javascript-typescript matrix, weekly cron, least-privilege,
   D-022(4)), `dependency-review.yml` (v5, comment always, D-022(5)),
   `manual-pr-security-scan.yml` (osv-scanner SHA-pinned, environment-gated,
   attributed PR comment, WITH the id: fix for the source's latent output bug,
   D-022(6)), `.github/dependabot.yml` (github-actions + npm ecosystems,
   D-022(8)), workflow permissions per D-022(10), pinning per D-022(9) hybrid
   policy.
4. **Research decisions applied**: D-022 (all except release pieces), D-027.
5. **Existing repo decisions**: deny-all permissions + per-job re-grants
   (difftree), setup-node cache (all repos), hybrid pinning (difftree-action
   SHA-pin precedent).
6. **Implementation tasks**: author workflows; add `just ci` recipe; actionlint
   + zizmor (or actionlint alone if zizmor unavailable) locally.
7. **Tests**: meta-tests extend repo-hygiene.test.ts: workflow YAML parses;
   ci.yml matrix == D-027 values; every workflow has explicit permissions;
   third-party non-official actions are SHA-pinned (regex over uses:).
8. **Documentation updates**: SECURITY.md adapted (S6a owns the file; note
   cross-slice: the dependabot claim becomes true once this slice lands),
   docs/tools/github_actions content updated in S6b.
9. **CI validation**: actionlint clean; meta-tests green. (Live Actions runs
   occur when the repo is pushed; not required for the slice gate — validators
   re-run actionlint + meta-tests locally.)
10. **Risks**: actionlint availability (install via just check-deps); osv-scanner
    action pin drift.
11. **Definition of done**: all five workflow files + dependabot.yml authored;
    actionlint exits 0; meta-tests green; `just all` still green; hygiene
    assertions (permissions/pinning) pass.

## Slice S5 — Release, versioning, packaging (branch `slice/s5-release`)

1. **Goal**: the source's release discipline — conventional-commit-driven
   version bump, changelog, tag/version integrity gate, publish pipeline —
   via release-please + npm Trusted Publishing, with local packaging
   validation.
2. **Source files/features involved**: `cog.toml` (dropped; its
   conventional-commit sections/bump rules port into release-please config,
   D-021(3,4)), `py_launch_blueprint/_version.py` (superseded by version.ts +
   release-please, D-021(2)), `.github/workflows/release.yml` (tag/version
   gate + commented publish → verify+publish jobs, D-021(5)),
   `.github/workflows/changelog.yml` (omitted, D-021(6)), Justfile cog/release
   recipes (replaced).
3. **Target files**: `release-please-config.json` + `.release-please-manifest.
   json` (manifest mode, changelog-sections from cog.toml taxonomy),
   `.github/workflows/release-please.yml` (App-token pattern documented with
   GITHUB_TOKEN fallback comment), `.github/workflows/publish.yml` (v* tag →
   verify job: tag-on-main ancestry + tag==package.json version + npm pack
   dry-run → publish job: OIDC id-token, protected `npm` environment,
   provenance; no NPM_TOKEN, D-012(5)/D-021), `CHANGELOG.md` (bootstrap),
   Justfile recipes: release-status, pack-check (publint + attw + npm pack
   --dry-run file-list assertion + packed-tarball smoke test, D-012(7)).
4. **Research decisions applied**: D-021 (all 6), D-012(4,5,6,7), D-022(13).
5. **Existing repo decisions**: contributors-please release-please+OIDC
   pattern (which itself mirrors the source repo's design); difftree verify
   gates.
6. **Implementation tasks**: author configs/workflows; wire pack-check; ensure
   version.ts reads package.json (single source of truth); document the
   protected-environment setup step for maintainers (docs/tasks in S6b).
7. **Tests**: meta-tests: release-please config parses + section taxonomy
   matches commitlint types; publish.yml has id-token:write and environment;
   pack-check assertions run in CI job and locally (publint clean, attw clean,
   file list == dist + docs whitelist, bin executes from packed tarball).
8. **Documentation updates**: README versioning/release section pointer;
   maintainer runbook stub (full docs S6b).
9. **CI validation**: actionlint; `just pack-check` green locally. **No
   registry-touching operation of any kind** (npm pack --dry-run and packed
   tarball execution are local-only; actual publish requires the human-gated
   GitHub environment — out of scope for this port, §6).
10. **Risks**: release-please v5 config drift; publint/attw false positives on
    ESM-only exports (resolve per docs, not by loosening exports).
11. **Definition of done**: `just pack-check` green; meta-tests green;
    actionlint clean; `just all` green; version surface consistent
    (cli --version == package.json == manifest).

## Slice S6a — Community files + contributors automation (branch `slice/s6a-community`)

1. **Goal**: complete open-source community surface, adapted where the
   toolchain changed, byte-faithful where cross-platform.
2. **Source files/features involved**: `.github/CODE_OF_CONDUCT.md`,
   `CONTRIBUTING.md`, `FUNDING.yml`, `ISSUE_TEMPLATE/{01,02,03,config}`,
   `SECURITY.md`, `pull_request_template.md`,
   `.github/workflows/update-contributors.yml`, `CONTRIBUTORS.md`,
   `scripts/update_contributors.py`.
3. **Target files**: same paths; CODE_OF_CONDUCT + FUNDING copied as-is
   (D-024(12) as amended by D-028); CONTRIBUTING adapted (uv→npm/just flow,
   debug-info reference kept); issue templates adapted (Python-version field →
   Node-version; commands adjusted); SECURITY.md adapted AND now truthful re
   dependabot (S4 landed it); PR template copied-then-modified;
   `update-contributors.yml` ported to contributors-please-action (D-024(9)),
   `CONTRIBUTORS.md` reset with correct generator attribution (fixing the
   false cog header), `scripts/update_contributors.py` → replaced by the org
   tool (no custom script; Justfile `contributors` recipe calls
   contributors-please, fixing the source's divergent-recipe defect).
4. **Research decisions applied**: D-024(8,9,12 as amended by D-028), D-022(11).
5. **Existing repo decisions**: contributors-please + action (org's own tool);
   update-contributors bot-PR pattern preserved.
6. **Implementation tasks**: port files; verify template YAML validity; wire
   recipe; remove the malformed `@contributors:` recipe defect.
7. **Tests**: repo-hygiene meta-tests: issue-template YAML parses; CONTRIBUTORS
   markers present; no reference to update_contributors.py remains.
8. **Documentation updates**: the files ARE the documentation; cross-links
   checked in S6b link pass.
9. **CI validation**: actionlint for the new workflow; `just all` green.
10. **Risks**: contributors-please-action input drift vs its README (pin by
    major tag per D-022(9)).
11. **Definition of done**: all files present and adapted; meta-tests green;
    actionlint clean; CLA docs land in S6b (docs tree).

## Slice S6b — Docs tree + README (branch `slice/s6b-docs`)

1. **Goal**: the source's Diátaxis documentation carried into a README-centric,
   CommonMark `docs/` tree (D-023) — all 39 content pages ported, rewritten, or
   omitted-with-reason; Sphinx machinery dropped.
2. **Source files/features involved**: all `docs/source/**` (39 md + conf.py +
   Makefile + base.html + _static logo), `.readthedocs.yaml` (omit),
   `README.md` (full), `assets/images/logos/*` (3, omit w/ replacement note),
   index.md↔README duplication (merge, D-023(5)).
3. **Target files**: `docs/` flattened tree preserving IA: `about/`,
   `contributing/` (incl. `cla/` — 5 CLA files copied as-is per D-024(8)),
   `reference/` (cli_reference rewritten for ts-projects; configuration_files
   for TOML+XDG; project_structure for src/dist layout; versioning rewritten
   per D-021 WITHOUT the source doc's two false claims), `tasks/` (managing
   dependencies→npm; type_checking→tsc; debugging_configuration; contributing_
   code; setting_up_development; using_ci_cd), `tools/` (mypy.md→typescript.md,
   pytest.md→vitest.md, ruff.md→oxlint.md, uv.md→npm.md, precommit_hooks.md→
   lefthook.md, yaml_lint.md folded into oxfmt notes or adapted, taplo.md
   omitted (D-014(6)), justfiles/makefiles/vs_code/github_actions/cla-assistant
   adapted incl. D-028 CLA wording), `tutorials/full_project_setup.md`
   (rewritten flow), index pages per dir (plain markdown lists, toctree
   stripped, D-023(3)), `docs/docs.md` (docs-about-docs adapted), `docs/
   github-templates.md`, `README.md` (full: pitch, badges fixed — the source's
   wrong simonw/llm badge NOT carried, features, quickstart, command table,
   docs links), Justfile: docs-check (markdown link checker), docs-api
   (TypeDoc optional, D-023(4)).
4. **Research decisions applied**: D-023 (all 6), D-024(10,11), D-014(6),
   D-028.
5. **Existing repo decisions**: README-centric org practice (Synthesis #10);
   docs/ decision-record convention.
6. **Implementation tasks**: fan-out port of the tree (one agent per docs
   group); MyST→CommonMark normalization; link pass; logo directory keeps a
   PLACEHOLDER note (new TS logo is a deliberate omission — needs future
   asset, documented).
7. **Tests**: `just docs-check` (link checker) green; repo-hygiene meta-test:
   no {toctree}/{figure} MyST syntax remains; no py-launch-blueprint-only
   references except in historical/port docs.
8. **Documentation updates**: this slice IS docs; also updates README.
9. **CI validation**: docs-check added to ci.yml steps; `just all` green.
10. **Risks**: 39-file volume → drift; mitigated by per-group validators
    re-reading source vs ported page pairs.
11. **Definition of done**: every docs/source file accounted for (ported/
    rewritten/omitted with D-ref) in a slice manifest; docs-check green;
    validator page-pair sample (100% of rewritten pages, 30% of copy-modified)
    confirms fidelity + correct tool substitution.

## Slice S7 — Final polish + relocation + completeness (branch `slice/s7-polish`)

1. **Goal**: ship-ready template: port artifacts relocated, INDEX statuses
   advanced, every reviewer pass closed, definition of done confirmed.
2. **Source files/features involved**: whole-repo parity; goal.md §11; D-006.
3. **Target files**: `docs/port/` (goal.md, typescript_port_process_prompt.md,
   TS_PORT_*.md moved; root cleaned, D-006); `TS_PORT_INDEX.md` Status fields
   advanced to Implemented/Tested/Verified per reality; README final links;
   any straggler fixes from reviewer passes.
4. **Research decisions applied**: D-006; all others verified here.
5. **Existing repo decisions**: difftree welcome-announcement check
   (.claude/settings.json content final).
6. **Implementation tasks**: `git mv` artifacts; fix references to moved
   files; run Reviewers 6-8 (feature parity, implementation, test/CI) as
   validators; run the §11 completeness critic (no unported, unomitted, or
   undocumented source file or feature).
7. **Tests**: full suite; `just all`; `just pack-check`; `just docs-check`;
   actionlint.
8. **Documentation updates**: docs/port/README pointer; root README final.
9. **CI validation**: everything green on the slice branch.
10. **Risks**: broken relative links after the move (docs-check catches).
11. **Definition of done**: goal.md §11 list fully satisfied; completeness
    critic report clean (or every finding resolved/accepted with D-ref);
    root contains no TS_PORT_*/goal/process files; all checks green; merged.

---

## Coverage appendix — all 93 source files → slice

Every `git ls-files` entry at the pinned SHA maps to exactly one primary slice
(secondary touches noted). Omissions carry their reason/D-ref. §2.3/D-005
exclusions are not in this table (untracked at the SHA; listed in the INDEX).

| Source file | Slice | Treatment |
|---|---|---|
| .github/CODE_OF_CONDUCT.md | S6a | copy as-is |
| .github/CONTRIBUTING.md | S6a | adapt (npm/just flow) |
| .github/FUNDING.yml | S6a | copy as-is (D-028 label) |
| .github/ISSUE_TEMPLATE/01-feature-request.yml | S6a | adapt |
| .github/ISSUE_TEMPLATE/02-documentation-request.yml | S6a | copy as-is |
| .github/ISSUE_TEMPLATE/03-bug-report.yml | S6a | adapt (Node env fields) |
| .github/ISSUE_TEMPLATE/config.yml | S6a | adapt (links) |
| .github/SECURITY.md | S6a | adapt (dependabot now true, D-022(8)) |
| .github/pull_request_template.md | S6a | adapt |
| .github/workflows/changelog.yml | S5 | omit — superseded by release-please (D-021(6)/D-022(12)) |
| .github/workflows/ci.yaml | S4 | translate (D-022) |
| .github/workflows/codeql.yml | S4 | copy-then-modify (js-ts matrix, D-022(4)) |
| .github/workflows/dependency-review.yml | S4 | copy-then-modify (v5, D-022(5)) |
| .github/workflows/manual-pr-security-scan.yml | S4 | replace scanner (osv-scanner + id fix, D-022(6)) |
| .github/workflows/release.yml | S5 | translate (verify+publish, D-021(5)) |
| .github/workflows/update-contributors.yml | S6a | translate (contributors-please-action, D-024(9)) |
| .gitignore | S1 | adapt |
| .gitlint | S2 | replace (commitlint, D-020(2)) |
| .gitmessage | S2 | copy as-is (types reconciled, D-020(4)) |
| .pre-commit-config.yaml | S2 | replace (lefthook, D-020(1,6)) |
| .python-version | S1 | replace (.nvmrc, D-011(3)) |
| .readthedocs.yaml | S6b | omit (README-centric, D-023(1,5)) |
| .taplo.toml | S2 | omit (no shipped TOML formatter; D-014(6); cog.toml dropped D-021(4)) |
| .yamlfmt | S2 | omit (Oxfmt formats YAML, D-014(7)) |
| cog.toml | S5 | omit — duties → release-please+commitlint (D-021(3,4)) |
| pyproject.toml | S1 | split → package.json/tsconfig/vitest+oxlint configs (S1 primary; S2 lint parts) |
| pyrightconfig.json | S1 | merge → tsconfig.json (D-013/D-015(2)) |
| .cursor/rules/doc-template.mdc | S2 | adapt (→AGENTS.md refs) |
| .cursor/rules/projectenv.mdc | S2 | adapt |
| .vscode/extensions.json | S2 | adapt (D-024(4)) |
| .vscode/launch.json | S2 | replace (vscode-js-debug, D-024(3)) |
| .windsurf/rules/justfile-rules.md | S2 | adapt |
| .windsurfrules | S2 | translate → AGENTS.md hub (D-024(5)) |
| CLAUDE.md | S2 | translate (command card) |
| CONTRIBUTORS.md | S6a | adapt (reset + true attribution) |
| EXAMPLECLI.md | S3a/S3b | adapt (spec for ts-projects; exit codes per cli-standards, D-024(11)) |
| Justfile | S1 | adapt (S1 core; recipes accrete in S2,S4,S5,S6) |
| Makefile | S1 | adapt (bootstrap-only, D-024(2)) |
| README.md | S6b | adapt (full; stub in S1) |
| assets/images/logos/*.png (×3) | S6b | omit — Python-branded artwork; placeholder note; new TS logo is future work (INDEX Omit) |
| docs/Makefile | S6b | omit (no Sphinx; just docs-check instead, D-023(5)) |
| docs/source/_static/py_launch_blueprint_logo_100x100.png | S6b | omit (same as assets) |
| docs/source/_templates/base.html | S6b | omit (Furo-specific, D-023(5)) |
| docs/source/conf.py | S6b | omit (Sphinx machinery, D-023(5)) |
| docs/source/index.md | S6b | merge → README + docs/ index (D-023(5)) |
| docs/source/docs.md | S6b | adapt |
| docs/source/github-templates.md | S6b | adapt |
| docs/source/about/{features,index,philosophy}.md | S6b | adapt |
| docs/source/contributing/CODE_OF_CONDUCT.md | S6b | copy as-is |
| docs/source/contributing/cla/{cla-setup-guide,corporate_cla,individual_cla}.md | S6b | copy as-is (+D-028 wording in setup guide) |
| docs/source/contributing/cla_faq.md | S6b | copy as-is |
| docs/source/contributing/index.md | S6b | adapt |
| docs/source/reference/cli_reference.md | S6b | rewrite (ts-projects) |
| docs/source/reference/configuration_files.md | S6b | rewrite (TOML+XDG, D-017) |
| docs/source/reference/index.md | S6b | adapt |
| docs/source/reference/project_structure.md | S6b | rewrite (src/dist) |
| docs/source/reference/versioning.md | S6b | rewrite (D-021; drop the two false claims) |
| docs/source/tasks/contributing_code.md | S6b | adapt |
| docs/source/tasks/debugging_configuration.md | S6b | adapt |
| docs/source/tasks/index.md | S6b | adapt |
| docs/source/tasks/managing_dependencies.md | S6b | rewrite (npm, D-011) |
| docs/source/tasks/setting_up_development.md | S6b | adapt |
| docs/source/tasks/type_checking_code.md | S6b | rewrite (tsc, D-015) |
| docs/source/tasks/using_ci_cd.md | S6b | adapt (D-022) |
| docs/source/tools/cla-assistant.md | S6b | adapt (D-028) |
| docs/source/tools/github_actions.md | S6b | adapt (D-022) |
| docs/source/tools/index.md | S6b | adapt (+fix source toctree drift) |
| docs/source/tools/justfiles.md | S6b | adapt |
| docs/source/tools/makefiles.md | S6b | adapt |
| docs/source/tools/mypy.md | S6b | rewrite → typescript.md (D-015) |
| docs/source/tools/precommit_hooks.md | S6b | rewrite → lefthook.md (D-020) |
| docs/source/tools/pytest.md | S6b | rewrite → vitest.md (D-019) |
| docs/source/tools/ruff.md | S6b | rewrite → oxlint.md (D-014) |
| docs/source/tools/taplo.md | S6b | omit (paired with .taplo.toml, D-014(6)) |
| docs/source/tools/uv.md | S6b | rewrite → npm.md (D-011) |
| docs/source/tools/vs_code.md | S6b | adapt (D-024(3,4)) |
| docs/source/tools/yaml_lint.md | S6b | rewrite → folded into oxfmt/formatting page (D-014(7)) |
| docs/source/tutorials/full_project_setup.md | S6b | rewrite |
| docs/source/tutorials/index.md | S6b | adapt |
| py_launch_blueprint/__init__.py | S1 | translate → src/lib.ts (public API) |
| py_launch_blueprint/_version.py | S1/S5 | replace → src/version.ts + release-please (D-021(2)) |
| py_launch_blueprint/projects.py | S3a/S3b | translate → src/cli.ts, router.ts, lib/*, commands/projects.ts |
| scripts/update_contributors.py | S6a | replace → contributors-please (D-024(9)) |
| tests/__init__.py | S3b | omit (no package marker needed; INDEX Omit) |
| tests/test_api.py | S3b | translate → tests/api.test.ts |
| tests/test_cli.py | S3b | translate → tests/cli.test.ts + e2e.test.ts (correct mock seams) |
| tests/test_config.py | S3a | translate → tests/config.test.ts |

(Grouped rows expand to one file each; total = 93.)
