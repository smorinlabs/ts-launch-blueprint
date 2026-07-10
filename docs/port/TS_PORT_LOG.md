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

## 2026-07-08 — Slice S2: quality gates + editor/AI configs — merged

> Retroactive record (written 2026-07-09, S7 completeness-critic finding):
> the original entry was lost when its append was `&&`-chained after a merge
> command whose commit-msg hook rejected an over-long header — the chain
> short-circuited and the follow-up commit completed the pending merge
> without the log text. The S2 work itself merged and validated normally;
> only this record was missing. Evidence below is from the original gate.

- **Phase or slice**: S2 (branch `slice/s2-quality`, 7 commits f60062d..45b7fdb, merge commit `eb92a31`)
- **Source→Target**: .pre-commit-config.yaml→lefthook.yml; .gitlint→commitlint (types reconciled with .gitmessage; lower-case subject guidance matching config-conventional); ruff intent→.oxlintrc.json (oxlint 1.73.0); formatting→.oxfmtrc.json (oxfmt 0.58.0 exact-pinned, YAML included per D-014(7)); .taplo.toml/.yamlfmt omitted per D-014(6,7); AGENTS.md hub replacing .windsurfrules (D-024(5)); CLAUDE.md command card; .cursor rules re-pointed; .vscode extensions/launch/settings (one-key tsdk per D-032); .claude/settings.json announcements+plugins (D-024(6)); Justfile quality recipes; repo-hygiene meta-tests.
- **Validation**: 2 independent validators (wf_d6dc9d76-56c) re-ran just all / hook suite / commitlint gates (bad message rejected, good passes) / formatter negative-proof / vitest / tsc — both PASS, 0 blocking. Shared minor (D-020(6) large-file check missing) fixed in `45b7fdb` with a 600KB negative proof, independently re-verified by a third validator.
- **Deviations (accepted at gate)**: oxfmt ignorePatterns exclude the port-process artifacts (line-number cross-references; relocated in S7); no-underscore-dangle off (conflicts with the _-prefix unused convention, probe-verified); commitlint.config.d.mts companion for the typed meta-test import; package.json key-sort by oxfmt; `all` = format-check variant (CI-safe); pre-push tests env-guarded (TS_PROJECTS_PREPUSH_TESTS=1).
- **Result**: Gate PASS (Fable), merged --no-ff as `eb92a31`. Suite: 13/13 tests at the time.

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

## 2026-07-09 — Slice S4: CI + security workflows — merged

- **Phase or slice**: S4 (branch `slice/s4-ci`, commits 7c7cccc, dc284e3). Executor: Opus; validators: 2× Sonnet + 1 Sonnet rework check (D-034 routing).
- **Source→Target**: ci.yaml→ci.yml (matrix ["24.x","26.x"] per D-027, just-recipe steps, dual enforcement incl. lefthook all-files re-run, commented codecov/npm-audit scaffolding preserved); codeql.yml (js-ts, weekly cron); dependency-review.yml (v5, comment always); manual-pr-security-scan.yml (safety→osv-scanner per D-022(6), source's missing-id output bug FIXED, env-passed comment body); NEW dependabot.yml (both ecosystems, grouped) closing the SECURITY.md mismatch per D-022(8); just ci recipe; 5 workflow meta-tests.
- **Validation**: 2 Sonnet validators re-ran actionlint (1.7.12, clean), just all (151 tests), just ci, meta-test quality read, line-by-line source diff, live SHA verification via GitHub API, zizmor scan. Attempt 1 → REWORK on a real find: actions/dependency-review-action publishes NO floating v5/v4 tag (source's @v4 carries the identical latent bug) — @v5 would fail to resolve at first run. Fixed by SHA-pin a1d282b3… # v5.0.0 (tag SHA verified live twice); plus dynamic heredoc delimiter (injection hardening), persist-credentials:false on all checkouts (zizmor artipacked), pinning meta-test extended (official actions: vN OR SHA+comment).
- **Deviations (accepted)**: checkout@v7 and github-script@v9 vs D-022(1)'s v6/v7 text — current majors consistent with the D-022(9) major-tag policy for official actions; dependency-review SHA-pinned despite being official (no floating major exists upstream — documented in-workflow).
- **Result**: Gate PASS (Fable). actionlint clean; 151/151 tests; live Actions runs deferred until the repo is pushed (out of port scope).

## 2026-07-09 — Slice S5: release, versioning, packaging — merged

- **Phase or slice**: S5 (branch `slice/s5-release`, commits 19ff9b5, b17392c). Executor: Opus; validators: 2× Sonnet; docs gap fixed by Haiku (D-034 routing).
- **Source→Target**: cog.toml taxonomy → release-please-config.json changelog-sections (cog.toml itself dropped per D-021(4)); release.yml → release-please.yml (GITHUB_TOKEN active, App-token upgrade documented) + publish.yml (verify job: tag-ancestor-of-main + tag==package.json==manifest + full gate + pack dry-run; publish job: protected npm environment, id-token OIDC Trusted Publishing, NO NPM_TOKEN); changelog.yml stub omitted per D-021(6); CHANGELOG.md bootstrap; just release-status + pack-check (publint 0.3.21, attw 0.18.5 esm-only profile, whitelist file-list assertion, packed-tarball install + bin/lib smoke in /private/tmp); 10 new meta-tests; README Releases section + docs/maintainers-release.md runbook stub.
- **Validation**: 2 Sonnet validators re-ran pack-check (verified the file-list check is a real two-way assertion, not a rubber stamp; attw esm-only profile verified legitimate by re-running WITHOUT the flag), actionlint (clean over all 6 workflows), 161 tests, live SHA verification of release-please-action v5.0.0 pin. 0 blocking. s5-v2 flagged the missing plan-item-8 docs — fixed by Haiku (b17392c), spot-checked by Fable (two factual defects in the first draft corrected: Trusted Publishing URL, human-approval wording).
- **No registry contact of any kind** (§6): npm pack/publint/attw/local installs only; publish requires the human-gated GitHub environment.
- **Deviations (accepted)**: attw 0.18.5 vs research's 0.18.4 (current); npm pack --ignore-scripts (prepare-script stdout pollutes --json; build runs explicitly first).
- **Result**: Gate PASS (Fable). 161/161 tests; actionlint clean.

## 2026-07-09 — Slice S6a: community files + contributors — merged

- **Phase or slice**: S6a (branch `slice/s6a-community`, commit 5a8e98b). Executor: Sonnet; validators: Sonnet conformance + Haiku mechanical (D-034).
- **Source→Target**: 9 community files ported (CODE_OF_CONDUCT content-identical with [INSERT CONTACT] preserved; CONTRIBUTING npm/just flow; FUNDING as-is with SPDX header per D-028; issue templates adapted incl. Node-version field; SECURITY now truthful about dependabot per D-022(8); PR template just-recipes); update-contributors.yml → contributors-please-action (mode: pull-request, SHA-pinned v1.3.9, GITHUB_TOKEN default with App upgrade path); CONTRIBUTORS.md reset with the tool's real markers and correct attribution (false cog header fixed); .contributors.yml validated against the real CLI; just contributors recipe (source's malformed/divergent recipes not carried); 10 meta-tests.
- **Validation**: Sonnet conformance validator line-by-line diffed every file vs source (zero stale Python-toolchain references in shipped files), verified the action tag→SHA live, re-ran just all (173 tests)/actionlint (7 workflows); Haiku mechanical validator parsed all YAML, verified markers against the tool README, greps clean. Both PASS, 0 blocking.
- **Deviations (accepted)**: schedule+dispatch triggers instead of the source's push set (documented in-workflow; sidesteps the action's push-loop caveat); full workflow headers retained matching in-repo precedent — repo-wide SPDX sweep deferred to S7; CONTRIBUTING's CLA links are forward references to S6b's docs tree (docs-check in S6b must confirm they resolve).
- **Result**: Gate PASS (Fable). 173/173 tests; actionlint clean.

## 2026-07-09 — Slice S6b: docs tree + README — merged

- **Phase or slice**: S6b (branch `slice/s6b-docs`, commits 7a56cfa..4148d1e). Executors per D-034: Sonnet infra + 6 Sonnet rewrite groups + 3 Haiku copy/light groups + Sonnet assembly + Sonnet CI-wiring fix; validators: 2× Sonnet fidelity (100% of rewrite/adapt pairs + copy sample) + Haiku mechanical.
- **Source→Target**: 37 docs pages ported into flat CommonMark docs/ preserving the Diátaxis IA (about/contributing+cla/reference/tasks/tools/tutorials + docs.md + github-templates); tool pages remapped (mypy→typescript, pytest→vitest, ruff→oxlint, uv→npm, precommit_hooks→lefthook, yaml_lint→formatting); reference pages rewritten from the ACTUAL repo (cli-reference verified against live --help; versioning drops the source doc's two false claims); Sphinx machinery omitted per D-023(5) (conf.py, docs/Makefile, base.html, _static logo, .readthedocs.yaml); taplo.md omitted per D-014(6); source logos omitted with assets/images/logos/PLACEHOLDER.md; index.md merged into the full README (correct badges — source's simonw/llm badge defect not carried); scripts/check-links.mjs (dependency-free) + just docs-check (also in ci.yml) + docs-api TypeDoc stub per D-023(4).
- **Validation**: fidelity validators read every source/target pair and re-verified claims against repo files; mechanical validator: 37/37 manifest files, index-page link coverage complete, 0 broken links (191 checked), MyST grep clean. Attempt 1 → REWORK on 5 blocking truth defects (false `just i` alias; docs-check step missing from using-ci-cd + github-actions descriptions; two underscore links in CONTRIBUTING.md) + 2 minors (unfulfilled vs-code cross-promise; "verbatim" oxlint block relabeled abridged). All fixed in 4148d1e; Haiku spot-check re-verified 6/6 + docs-check 0 broken + 45 hygiene tests + actionlint clean.
- **Deviations (accepted)**: debugging-configuration.md deliberately pivots from editor-breakpoint content to CLI config-resolution debugging (signposted; editor debugging lives in vs-code.md — the source page's intent split across the two).
- **Result**: Gate PASS (Fable). 174/174 tests; docs-check 0/191 broken.

## 2026-07-09 — Slice S7: final polish + relocation — merged

- **Phase or slice**: S7 (branch `slice/s7-polish`, commits f005b2c, 8b41152, 23de1be). Executor: Sonnet; final panel per D-034: Opus completeness critic + Sonnet final-gates validator.
- **Decision or change**: all 9 port artifacts relocated to docs/port/ with a README (D-006; root clean); every reference to the old paths repointed (.oxfmtrc/lefthook excludes, docs, README, .contributors.yml, meta-test mirror); TS_PORT_INDEX.md statuses advanced 93/93 → Verified (6 as "Verified (omitted per plan/D-ref)"); .claude/settings.local.json ignore coverage; companyAnnouncements updated.
- **Validation**: final-gates validator (Sonnet) re-ran the FULL suite from a clean install: npm ci → just build → just all (174/174), coverage 98.63/92.76/98.36/98.62 vs 95/95/90/95 with real denominators, docs-check 0/192 broken across 49 files, pack-check 6/6 stages, actionlint clean over 7 workflows, hook suite green, release-status consistent, behavioral smoke (version/help/exit-2/exit-4) — PASS, 0 findings. Completeness critic (Opus, §11): file sweep 93/93 mapped with 20+ targets opened (zero stubs), D-005 exclusions confirmed absent, all documented omissions verified with D-refs, 8/8 feature areas delivered, domain-spec 12-item Expected Final Output verified, 10+ decisions checked as implemented — ONE blocking finding: the S2 gate record was missing from this log (its append had been short-circuited by a failed merge-commit hook on 2026-07-08). Restored retroactively in 23de1be with honest provenance; critic re-verified against git history and superseded its FAIL with **PASS**.
- **Result**: Gate PASS (Fable), merged --no-ff.

---

## 2026-07-09 — PORT COMPLETE (goal.md §11 definition of done)

- All four planning artifacts committed with cross-validation evidence and passing Fable gate verdicts (Phases 0-5 records above).
- All 9 implementation slices (S1, S2, S3a, S3b, S4, S5, S6a, S6b, S7) implemented on their own branches (D-004) and merged to main only after passing gates; every rework cycle documented.
- Build, lint, typecheck, tests, coverage, docs-check, pack-check, actionlint, hook suite: all green from a clean install (final-gates validator, above).
- TS_PORT_DECISIONS.md: D-001–D-034, append-only, every decision cited by the work that implements it; supersessions as new entries.
- Port artifacts relocated to docs/port/ (D-006).
- §11 completeness critic (independent, Opus): PASS — no unported, unomitted, or undocumented source file or feature.
- §6 escalations: none required — no registry contact, no force-push, no settings changes, no deletion of non-port files; nothing was pushed to the remote (publishing the branch is left to the user).
- User approvals: waived throughout per the recorded 2026-07-06 instruction; this log and TS_PORT_DECISIONS.md are the review trail.
