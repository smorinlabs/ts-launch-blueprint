# TS Port Log

What actually happened during the py-launch-blueprint → ts-launch-blueprint port,
including gate records and user approvals/waivers. Governed by `goal.md` §8 and the
domain spec Phase 6 log-entry format. The index says what exists; the repo review
says what prior decisions exist; the research says what should be chosen; the plan
says what should happen; **this log says what actually happened.**

---

## 2026-07-06 — User instruction: §6 human approval gates waived

Recorded verbatim from the user's `/goal` directive (autonomous full-run variant,
goal.md §10):

> Autonomous full run per goal.md, with the user waiving all §6 human
> approval gates (record the waiver in TS_PORT_LOG.md as a user instruction):
> Phases 0 through 6 complete end to end — source SHA pinned and D-001 through
> D-006 logged; TS_PORT_INDEX.md, TS_EXISTING_REPO_REVIEW.md, TS_PORT_RESEARCH.md,
> and TS_PORT_PLAN.md committed, each with cross-validation evidence and a
> passing Fable gate verdict recorded in TS_PORT_LOG.md; every decision logged
> with a D-### in TS_PORT_DECISIONS.md; every TS_PORT_PLAN.md slice implemented
> on its own branch and merged after a passing gate; build, lint, typecheck, and
> tests shown passing; port artifacts relocated to docs/port/ per D-006; and the
> §11 definition of done confirmed by a completeness critic — while still
> escalating irreversible or outward-facing actions per §6 or 2000 turns

Effect: no pauses at the Phase 0–5 artifact gates; Fable's gate verdict is final,
and the user reviews after the fact through `TS_PORT_DECISIONS.md` and this log.
All other contract rules remain in force — cross-validation, evidence citations,
decision logging, rework limits, and the §6 irreversible-action escalations
(publishing to any registry, changing repo settings/visibility, force-pushing,
deleting files not created by the port, credentialed external calls) still stop
and ask the user.

---

## 2026-07-06 — Phase 0: Bootstrap

- **Date**: 2026-07-06
- **Phase or slice**: Phase 0 (Bootstrap, goal.md §2)
- **Source file(s)**: n/a (environment + scope pinning)
- **Target file(s)**: `TS_PORT_DECISIONS.md`, `TS_PORT_LOG.md`
- **Decision or change**:
  - Environment verified: main-loop model is Fable (`claude-fable-5`); source repo
    exists at `~/c/py-launch-blueprint`; `gh` authenticated as `smorin` (keyring).
  - **Pinned source SHA: `4828f8596b2332d74fbcff932ebab6f0030febd5`** (HEAD of
    `~/c/py-launch-blueprint` at 2026-07-06). All scope claims mean `git ls-files`
    at this SHA — 93 tracked files.
  - Scope exclusions recorded (D-005): untracked working-tree files
    `TEMPLATE_USAGE.md`, `scripts/cleanup_template.py`,
    `scripts/init_from_template.py`, `scripts/rename_template.py`,
    `typescript_port_process_prompt.md` are excluded from the port.
  - Artifact skeletons created; D-001–D-006 logged in `TS_PORT_DECISIONS.md`.
- **Rationale**: goal.md §2 bootstrap steps 1–5.
- **Existing repo influence**: n/a
- **Deviation from plan**: none
- **Alternatives considered**: n/a (pre-seeded user decisions)
- **Validation performed**: independent validator sub-agent (agent id
  `ac7440166b05e03bc`) re-verified all claims against primary sources:
  (1) `git -C ~/c/py-launch-blueprint rev-parse HEAD` →
  `4828f8596b2332d74fbcff932ebab6f0030febd5` PASS; (2) `git ls-files | wc -l` →
  93 PASS; (3) `git status --porcelain` → exactly the five D-005 untracked files
  PASS; (4) `TS_PORT_DECISIONS.md` committed in `ac98f3c`, D-001–D-006 present
  with all four fields, substance matches goal.md §5 one-for-one PASS;
  (5) `TS_PORT_LOG.md` committed, SHA + waiver recorded PASS; (6) `gh auth
  status` → logged in as smorin PASS. Overall: PASS.
- **Result**: VALIDATE passed; one flag adjudicated (see gate record)
- **Follow-up tasks**: none

### Gate record — Phase 0

- **Status: PASS** (Fable gate verdict, 2026-07-06)
- Evidence reviewed: executor CHECK (environment command output in conversation)
  + validator report above. All six validation items PASS with cited evidence.
- Adjudication: validator flagged that the waiver quote ends "per §6 or 2000
  turns" while the goal.md §10 template ends "or stop after 300 turns". Fable
  (which received the user's actual /goal directive) confirms the user's
  directive said "2000 turns" — the log quote is verbatim; the user modified
  the template's turn budget. No discrepancy.
- User approval: **waived** per the user instruction recorded at the top of this
  log (autonomous full-run variant, goal.md §10).

---

## 2026-07-06 — Phase 1–2: TS_PORT_INDEX.md — PLAN

- **Scope**: catalog all 93 files from `git ls-files` at pinned SHA
  `4828f8596b2332d74fbcff932ebab6f0030febd5`, each with the domain spec's 11
  fields; then feature-level extraction across 8 feature areas, folded into the
  same gate (D-009). §2.3 exclusions listed in the artifact as deliberate
  exclusions (D-005).
- **Inputs**: source working tree at `~/c/py-launch-blueprint` (tracked files
  verified clean at pinned SHA by the Phase 0 validator); domain spec Phase 1–2
  field definitions.
- **Executor shape**: Workflow fan-out (D-002): 11 index agents, one per file
  group (D-007), each writing a markdown fragment to the session scratchpad and
  returning structured metadata; then 8 feature-extraction agents (CLI;
  versioning+release; logging+error-handling; config+env; testing; docs; CI;
  lint/format/typecheck + dev-experience/security). Fable assembles the
  artifact mechanically (cat) and authors the framing sections.
- **Definition of done**: every one of the 93 files has an entry with all 11
  fields; exclusions section present; feature section maps each feature area to
  files + intended TS representation; artifact committed.
- **Validation criteria (§4, §7 Phase 1 row)**: completeness auditor diffs INDEX
  entries against `git ls-files` at the pinned SHA; validators re-open 100% of
  files categorized Omit/Replace/Needs research/Split/Merge (critical per §4.4,
  2 validators) plus a 25% random sample of the rest (D-008); feature validators
  re-derive features from the files independently and diff against the report.
- **Decision IDs implemented**: D-002, D-005, D-007, D-008, D-009.

## 2026-07-06 — Phase 1–2: TS_PORT_INDEX.md — EXECUTE / CHECK / VALIDATE / GATE

- **Date**: 2026-07-06
- **Phase or slice**: Phases 1–2 (combined gate per D-009)
- **Source file(s)**: all 93 files at pinned SHA `4828f85…`
- **Target file(s)**: `TS_PORT_INDEX.md` (2,076 lines: Part 1 = 93 entries × 11
  fields; Part 2 = 8 feature areas, 84 feature sections)
- **Decision or change**: index authored via workflow `wf_91763317-80f` (11 index
  agents + 8 feature agents, 19/19 completed, 919k tokens); fragments assembled
  mechanically; framing sections authored by Fable. Committed at `387ad4c`.
- **Deviation from plan**: workflow `args` interpolation bug sent agents a
  literal `undefined/` fragment-path prefix; fragments landed in two locations
  and were consolidated to the scratchpad before assembly; a stray `undefined/`
  directory created in this repo by the agents was deleted (port-created,
  uncommitted). No content impact — all 19 fragments accounted for.
- **Validation performed** (workflow `wf_dc63b170-a21`, 9 validators):
  - completeness ×2 (INDEX completeness is critical → 2 validators, §4.4):
    both PASS, zero findings — bidirectional `comm` diff of 93 Part 1 entries
    vs `git ls-tree -r --name-only 4828f85…` empty both ways; each of the 10
    field labels counted exactly 93× plus per-entry awk pass; category/status
    vocabulary verified; D-005 exclusion list exact.
  - critical port-category calls ×2 (28 Omit/Replace/Needs-research/Split/Merge
    files re-opened, adversarial stance): both PASS, 5 minor findings.
  - 25% random sample (16 of 65 non-critical files re-opened; D-008): PASS,
    1 minor finding. **Sampling rate: 100% of critical + 25% of the rest.**
  - feature re-derivation ×4 (Reviewer 2 of the domain spec; independent
    re-derivation before reading Part 2): 1 PASS, 3 FAIL with 3 blocking
    findings (missed advertised-but-unimplemented fuzzy search; wrong exit-code
    semantics in the testing fragment; devex feature directing port of D-005
    exclusions) + 2 non-blocking majors + 10 minors.
- **Result**: Gate attempt 1 → **REWORK** (allowed: max 1). Rework executor
  (agent `ac9dd23560178ead9`) applied all 17 fixes; 2 fresh independent
  validators (workflow `wf_6cc45e43-9e2`) re-verified every fix against primary
  sources: both **PASS**, 17/17 APPLIED_CORRECTLY, structure intact (93 entries,
  10 field labels × 93).
- **Follow-up tasks**: none blocking. Residual minor wording imprecisions
  explicitly accepted (see gate record).

### Gate record — Phases 1–2

- **Status: PASS** (Fable gate verdict, 2026-07-06, after one rework cycle)
- Evidence: validator reports above, all citing primary-source file+line or
  command+output evidence; full reports in workflow journals `wf_dc63b170-a21`
  and `wf_6cc45e43-9e2`.
- Accepted residual findings (with rationale):
  1. INDEX:1812/1864 wording — "exercise the empty-selection path" is loose
     phrasing; the same paragraph states the correct mechanism (truthy
     MagicMock iterates empty). Facts correct; accepted as non-misleading in
     context.
  2. EXAMPLECLI.md citation ranges padded by one line (107–115 vs actual
     107–114). Ranges contain the table; substance correct.
  3. Justfile contributors-recipe cited as 303–312 vs 302–311 in two places;
     both ranges bracket the same recipe.
  Rationale: all three are wording/citation-precision issues with no factual or
  planning impact; further edits would require another validate cycle for zero
  downstream benefit.
- User approval: **waived** per the recorded user instruction; this gate verdict
  is final under the autonomous full-run variant.

---

## 2026-07-06 — Phase 3: TS_EXISTING_REPO_REVIEW.md — PLAN

- **Scope**: review 8 existing repos (D-010) for prior TypeScript/Bun/oxc/
  TurboRepo/CI/release/docs/linting/testing/logging/devworkflow decisions; all
  18 domain-spec fields per repo; record skipped repos with reasons.
- **Inputs**: repo discovery listings (REST, 2026-07-06, shown in conversation
  and summarized in D-010); the repos themselves (shallow-cloned read-only into
  the session scratchpad; two are private — cloning uses existing gh auth,
  read-only, no external writes).
- **Executor shape**: workflow fan-out, one agent per repo (D-002) with
  deep-research-style prompting (D-003): verify every claim against the actual
  repo files (configs, workflows, lockfiles), cite path+line, distinguish
  observed fact from inference; write per-repo fragment; Fable assembles.
- **Definition of done**: TS_EXISTING_REPO_REVIEW.md committed with all 18
  fields per reviewed repo, a reviewed/skipped table with reasons, and a
  synthesis of reusable defaults for the port.
- **Validation criteria (§7 Phase 3 row)**: validators re-check claimed patterns
  against the actual repos (re-open configs/workflows/lockfiles in the clones);
  Reviewer 3 of the domain spec (existing-repo pattern reviewer) checks that
  prior tool decisions were captured and flags re-selection of already-decided
  technology.
- **Decision IDs implemented**: D-002, D-003, D-010.

## 2026-07-07 — Phase 3: TS_EXISTING_REPO_REVIEW.md — EXECUTE / CHECK / VALIDATE / GATE

- **Date**: 2026-07-07 (execution began 2026-07-06)
- **Phase or slice**: Phase 3
- **Source file(s)**: 8 repos (D-010), read-only shallow clones in scratchpad
- **Target file(s)**: `TS_EXISTING_REPO_REVIEW.md` (~650 lines: discovery
  method, reviewed table, skipped table with reasons, 8 × 18-field sections,
  Fable-authored synthesis of reusable defaults / Phase 4 tie-breaks /
  do-not-reuse list). Committed at `a1e6695`.
- **Decision or change**: review executed via workflow `wf_06cdc5e5-593`
  (8 agents, deep-research discipline, 449k tokens). Notable findings: npm is
  the uniform package manager in recent published TS repos; the Bun POC
  documented pnpm-over-Bun and Biome-over-Oxlint; Vitest unanimous;
  release-please + GitHub App token + OIDC trusted publishing repeated;
  cli-standards v1.4.x is a normative CLI spec; no docs-site generator in any
  recent repo.
- **Deviation from plan**: GraphQL API quota exhausted at discovery time →
  used equivalent REST endpoints (documented in the artifact and D-010).
- **Validation performed** (workflow `wf_8564a49a-510`, 3 validators):
  claims-A (4 repos) PASS, 2 minors; claims-B (4 repos) PASS, 2 minors;
  Reviewer 3 synthesis audit PASS, 4 minors (release-pattern attribution,
  missed pre-commit data point in contributors-please-action, action-pinning
  conflict papered over, Vitest/Bun coupling). All claims verified against the
  actual clones with path+line citations; 0 blocking findings.
- **Result**: Fable applied the 6 substantive validator fixes to the artifact
  (input/output counts 32/11; POC lint:types CI wording; release attribution
  contributors-please-vs-difftree/crates.io; Vitest contingency; git-hooks
  pre-commit data point; new tie-break #7 action-pinning policy).
- **Follow-up tasks**: Phase 4 must run the 7 tie-breaks listed in the
  synthesis.

### Gate record — Phase 3

- **Status: PASS** (Fable gate verdict, 2026-07-07)
- Evidence: 3 validator reports (all PASS, 0 blocking) with primary-source
  citations; full reports in workflow journal `wf_8564a49a-510`; the 6
  substantive fixes applied and visible in the committed diff.
- Accepted residual findings: assorted one-line citation offsets (e.g.
  vitest.config.ts:18-21 vs 19-22) — content accurately characterized;
  correcting them would trigger another validate cycle for zero planning
  impact.
- User approval: **waived** per the recorded user instruction.

---

## 2026-07-07 — Phase 4: TS_PORT_RESEARCH.md — PLAN

- **Scope**: 14 research topics covering every domain-spec research area, every
  INDEX `Needs research` item, and all 7 Phase 3 tie-breaks:
  T1 package manager & runtime; T2 build & npm packaging; T3 tsconfig & module
  format; T4 lint & format (incl. TOML/YAML formatter keep-or-drop); T5 type
  checking strategy; T6 CLI framework & UX libs (per cli-standards); T7 config
  loading & env; T8 logging & output streams; T9 testing; T10 git hooks &
  commit linting; T11 versioning, release & changelog; T12 CI & security
  workflows; T13 documentation system & API docs; T14 devex & repo hygiene
  (Justfile/Makefile, editor/AI configs, LICENSE gap, CLA, contributors bot,
  turbo tie-break).
- **Inputs**: TS_PORT_INDEX.md (what must be preserved), TS_EXISTING_REPO_REVIEW.md
  (prior decisions consulted FIRST, per domain spec), live web documentation
  (tool maturity as of 2026-07 — never settled from memory, D-003).
- **Executor shape**: workflow fan-out, one deep-research agent per topic
  (D-002, D-003) with WebSearch/WebFetch; all 11 domain-spec fields per topic;
  every recommendation returned as a structured decision candidate for D-###
  logging.
- **Definition of done**: TS_PORT_RESEARCH.md committed, 14 topics × 11 fields,
  each recommendation carrying a D-### in TS_PORT_DECISIONS.md, existing-repo
  decisions explicitly consulted in each topic, disagreements with repo
  precedent documented as explicit tradeoffs.
- **Validation criteria (§7 Phase 4 row, §4.4)**: 2 independent validators per
  recommendation — one checks reasoning + sources (re-fetching cited docs), one
  checks consistency with TS_EXISTING_REPO_REVIEW.md and the domain-spec
  classification scheme; Reviewer 4 (ecosystem fit) folded into the
  reasoning-validator instructions.
- **Decision IDs implemented**: D-002, D-003; produces D-011 onward.

## 2026-07-08 — Phase 4: TS_PORT_RESEARCH.md — EXECUTE / CHECK / VALIDATE / GATE

- **Date**: 2026-07-08 (research fetched 2026-07-07)
- **Phase or slice**: Phase 4
- **Source file(s)**: TS_PORT_INDEX.md, TS_EXISTING_REPO_REVIEW.md, source repo,
  live web documentation
- **Target file(s)**: `TS_PORT_RESEARCH.md` (14 topics × 11 fields, 97
  recommendations; committed `6580fd7`), `TS_PORT_DECISIONS.md` D-011–D-024
  (one entry per topic; recommendations citable as D-0NN(k)).
- **Decision or change**: research executed via workflow `wf_09df6180-960`.
  Headline selections: npm + Node ≥24 (D-011); tsdown, ESM-only, Trusted
  Publishing (D-012); NodeNext strict union (D-013); Oxlint 1.x + Oxfmt beta —
  a documented reversal of the POC's Jan-2026 Biome pick now that Oxfmt exists
  (D-014); single tsc gate (D-015); Commander v15 + DI, cli-standards exit
  codes (D-016); TOML+XDG+zod config (D-017); stderr logger + styleText
  (D-018); Vitest 4, 95/95/90/95 (D-019); lefthook 2 + commitlint (D-020);
  release-please v5 + OIDC publish (D-021); ubuntu-latest CI, CodeQL,
  osv-scanner, dependabot, hybrid pinning (D-022); README-centric docs
  preserving Diátaxis (D-023); Justfile ~1:1, AGENTS.md hub, LICENSE fix,
  contributors-please, no Turbo (D-024).
- **Deviation from plan**: first EXECUTE attempt tripped the account usage
  burst limit (13/14 agents failed); re-run in batches of 3–4 via workflow
  resume succeeded 14/14. No content impact.
- **Validation performed** (workflow `wf_33b1d2c0-256`, 14 validators — 2 per
  topic per §4.4: reasoning+sources with live re-fetch of cited URLs, and
  consistency vs review/INDEX/decisions): all 7 reasoning validators PASS on
  facts (every version/maturity claim re-verified live) except one false CLA
  maintenance claim; consistency validators surfaced 3 cross-topic
  contradictions. 4 blocking findings total.
- **Result**: Gate attempt 1 → **REWORK** (allowed: max 1). Fable adjudicated:
  matrix owned by T01 → ["24.x","26.x"] (D-027); color owned by T08 →
  node:util styleText (D-026); isolatedDeclarations adopted (D-025); CLA hedge
  reworded archived-but-functional + fork/DCO contingency, FUNDING label fixed
  (D-028). Rework executor (agent `a6b0bf90866d1076e`) applied all 5 artifact
  fixes; supersessions appended (never editing prior entries). Fresh validator
  (agent `a3f311efe4b57d10c`) re-verified: 5/5 APPLIED_CORRECTLY, append-only
  diff confirmed (only additions in `64cfa1c`). **PASS**.
- **Follow-up tasks**: Phase 5 slices must cite D-011–D-028.

### Gate record — Phase 4

- **Status: PASS** (Fable gate verdict, 2026-07-08, after one rework cycle)
- Evidence: 14 validator reports (wf_33b1d2c0-256) + rework validation report,
  all with primary-source citations; live URL re-fetches on every load-bearing
  version/maturity claim.
- Accepted residual findings: ~45 minors (citation offsets, wording precision,
  label quibbles) — none affects a tool choice or plan input; enumerated in the
  workflow journal.
- Adjudications recorded as D-025–D-028 (supersession entries; originals
  unedited per §5).
- User approval: **waived** per the recorded user instruction.

---

## 2026-07-08 — Phase 5: TS_PORT_PLAN.md — PLAN + EXECUTE (Fable-authored)

- **Scope**: vertical-slice implementation plan; 9 slices (D-030), each with
  the 11 domain-spec slice fields, citing decision IDs D-011–D-029; coverage
  appendix mapping all 93 pinned-SHA files to slices.
- **Inputs**: TS_PORT_INDEX.md, TS_EXISTING_REPO_REVIEW.md, TS_PORT_RESEARCH.md,
  TS_PORT_DECISIONS.md D-001–D-030.
- **Executor shape**: Fable authors directly (goal.md §7 Phase 5 — planning
  not delegable, D-001); sub-agents fact-check feasibility; validators trace
  slices → INDEX/RESEARCH and flag orphans; 2 validators on slice
  definitions-of-done (§4.4 critical).
- **Definition of done**: plan committed; every slice has all 11 fields and
  cites valid D-###s; coverage appendix complete both directions (93 files ↔
  slices); validation passed; gate recorded.
- **Decision IDs implemented**: D-001, D-004, D-029, D-030; plan applies
  D-011–D-028.

## 2026-07-08 — Phase 5: TS_PORT_PLAN.md — CHECK / VALIDATE / GATE

- **Validation performed** (workflow `wf_fda7e68b-23d`, 3 validators:
  traceability×2 per §4.4 on slice DoDs + feasibility): coverage PASS twice
  (both expanded the appendix and set-diffed against `git ls-tree` at the
  pinned SHA — exactly 93 ↔ 93, empty diff both directions); all 9 slices have
  all 11 fields; ordering walk found no dependency breaks; every named tool
  matches an accepted decision. 4 distinct blocking findings: S3a DoD encoded
  the superseded exit-1-for-missing-token (caught by all 3 validators);
  orphaned mandatory fuzzy-search decision; S3a D-016(7)→(8) mis-citation
  (plus two minor mis-cites); unreconciled D-015(2)↔D-024(4) tsdk/settings.json
  contradiction.
- **Result**: Gate attempt 1 → **REWORK**. Fable (plan author) applied fixes
  directly: exit-4 DoD + full R6.1 mapping in S3a; citation fixes (D-016(8),
  D-015(4), D-024(7)); D-031 minted (drop fuzzy claim + deps — parity with
  observed behavior) and cited in S3b; D-032 minted (one-key
  .vscode/settings.json typescript.tsdk, amending D-024(4)) and cited in S2.
  Committed `c278cda`. Fresh validator (agent `abb04ea1a76c841ec`) re-verified
  6/6 APPLIED_CORRECTLY, append-only diff confirmed, zero residual exit-1
  contract text. **PASS**.

### Gate record — Phase 5

- **Status: PASS** (Fable gate verdict, 2026-07-08, after one rework cycle)
- Evidence: 3 validator reports (wf_fda7e68b-23d) + rework validation report;
  coverage proven mechanically by two independent expansions.
- Accepted residual findings: ~21 minors (wording/citation precision, e.g.
  D-015(2)'s pre-existing "js/ts.tsdk.path" key name — operative D-032 has the
  correct `typescript.tsdk`); none affects executability.
- User approval: **waived** per the recorded user instruction.

---

## 2026-07-08 — Slice S1: skeleton + toolchain — merged

- **Phase or slice**: S1 (branch `slice/s1-skeleton`, commit `e328506`, merged to main)
- **Source→Target**: pyproject.toml→package.json/tsconfig/vitest configs; .python-version→.nvmrc; Justfile/Makefile/.gitignore adapted; __init__.py→src/lib.ts; _version.py→src/version.ts; LICENSE added (source gap fixed, D-024(7)).
- **Validation**: executor CHECK all-green; 2 independent validators (wf_bb6dd474-50d) re-ran tsc/build/vitest+coverage/CLI/just/make + npm pkg fix — both PASS, 0 blocking. Coverage-threshold enforcement proven active via a 101% probe.
- **Deviations (accepted at gate)**: bin recorded npm-normalized as `dist/cli.js` (npm pkg fix strips `./`; D-012(3) intent preserved — later slices must not reintroduce the prefix); tsdown `fixedExtension:false` to match the exports map; `declaration:true` required alongside isolatedDeclarations (noEmit still suppresses output); upstream SOURCEMAP_BROKEN warning (cosmetic, tracked); transitive @babel EBADENGINE warnings on Node 24.6 (advisory only; CI's 24.x resolves current).
- **Result**: Gate PASS (Fable), merged --no-ff.

## 2026-07-09 — Slice S3a: CLI foundation — merged

- **Phase or slice**: S3a (branch `slice/s3a-cli-core`, 4 commits ending `99c9ab5`)
- **Source→Target**: projects.py (entry/consoles/errors/config/remediation) → src/cli.ts, router.ts (Commander 15 DI runCli), lib/{logger,colors,xdg-paths,config,errors}.ts; tests/test_config.py → tests/config.test.ts (every source test mapped or divergence documented inline); EXAMPLECLI.md config/env/exit-code sections rewritten (R6.1 table per D-024(11)).
- **Validation**: 2 independent validators (wf_68571b07-db6) re-ran just all/coverage/build + 9 behavioral probes on dist/cli.js (version, help, did-you-mean→2, tokenless→4 with three remedies stderr-only, redaction, precedence flag>env>file, --config nonexistent, --no-color) — both PASS, 0 blocking. Coverage real: 161/161 statements, 95.3% branches vs 90 threshold.
- **Deviations (accepted)**: remedy order matches port precedence (flag/env/file) vs source order — content parity kept; AuthError extends ConfigError with exitCode 4 override (source semantics + R6.1); SIGINT/SIGTERM handlers by inspection — subprocess tier lands in S3b per plan.
- **Result**: Gate PASS (Fable), merged --no-ff. Suite: 72/72; deps added commander 15.0.0, smol-toml 1.7.0, zod 4.4.3.

---

## 2026-07-09 — User instruction: model-tier routing for sub-agents (D-034)

Recorded verbatim from the user's message during S3b validation:

> Let's make sure all future work utilizes the correct sub-agent. Whether
> that's Opus, Sonnet, or Haiku, the planning should be done with Fable and
> then execution should be broken up and planned by Fable specifically to be
> done by Opus, Sonnet, and Haiku. Before going to each subtask and element,
> that should be done as well as using the task tool so it's easy to
> understand where we are with progress. My guess is things like documentation
> can be done with Haiku.

Effect (D-034): from this point, newly dispatched executors/validators are
routed by task complexity — Opus for complex/security-sensitive implementation
and the final completeness critic; Sonnet for standard implementation and
code-level validation; Haiku for documentation porting and mechanical checks.
Fable retains all planning, gating, and adjudication (D-001). In-flight agent
continuations (the S3b rework already dispatched) keep their existing model
for context continuity. Remaining slices are tracked as harness tasks with
their planned tiers.

## 2026-07-09 — Slice S3b: CLI feature parity — merged

- **Phase or slice**: S3b (branch `slice/s3b-cli-parity`, commits 6af76fe..efa7827)
- **Source→Target**: projects.py (API client/command/formats) → src/lib/api.ts, src/commands/projects.ts, src/lib/format.ts, src/lib/adapters.ts; tests/test_api.py+test_cli.py → tests/{api,cli,e2e}.test.ts with CORRECT mock seams (source mis-mocks at test_cli.py:82/100/155 fixed; both prompt paths pinned); EXAMPLECLI.md completed (fuzzy claim removed per D-031); parity table docs/port-parity-s3b.md (34 rows: 12 same, 5 stream-moved per D-018(4), 17 deviations each with D-ref).
- **Validation**: 2 Fable validators (wf_d2a9fbe9-554; one PTY-probed the real binary) + 1 Sonnet rework validator (D-034 routing). Attempt 1 → REWORK on a real find: ^C during the interactive prompt leaked inquirer internals and exited 1 (source: swallow→0; contract: 130). Adjudicated as D-033: Cancelled. + exit 130 in every mode; also implemented the D-018(4) JSON error envelope + --json alias, parity rows for the 30s timeout and --limit tightening, and a 0-column spinner flood guard. Rework validator re-probed via PTY: PASS on all 7 items.
- **Deviations (accepted, all with D-refs)**: exit taxonomy per D-016(2) incl. API/network→1; CSV RFC-4180 quoting; 30s request timeout; positive --limit; interrupt→130 (D-033); --output stays the file sink vs cli-standards -o enum (documented).
- **Result**: Gate PASS (Fable). Suite: 139/139; SIGINT/SIGTERM subprocess verification closed (130/143 mid-fetch). Deps: @inquirer/prompts 8.5.2, cli-table3 0.6.5, clipboardy 5.3.1, yocto-spinner 1.2.1.
