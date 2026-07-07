# TS Port Decisions

Append-only, numbered, ADR-style decision log for the py-launch-blueprint →
ts-launch-blueprint port. Governed by `goal.md` §5. IDs are sequential and never
reused or renumbered. Reversing a decision requires a new entry that supersedes
the old one.

---

## D-001: Fable for all planning and gating
- Ref: goal.md §1 (Role Bindings), §5 pre-seeded decision 1
- Options: (1) Fable in the main loop for all planning artifacts and gate verdicts (2) delegate planning/gating to sub-agents (3) mixed model per phase
- Decision: (1) Fable in the main loop for all planning artifacts and gate verdicts
- Why: User instruction pre-seeded in goal.md §5. Planning and gate decisions are never delegated to sub-agents per §1.

## D-002: Sub-agents for all execution
- Ref: goal.md §1 (Role Bindings), §5 pre-seeded decision 2
- Options: (1) sub-agents (Agent tool for single tasks, Workflow tool for fan-out) for all execution (2) main-loop execution (3) mixed
- Decision: (1) Sub-agents for all execution; exception: Phase 0 bootstrap may run in the main loop
- Why: User instruction pre-seeded in goal.md §5. Keeps the main loop for planning/gating and avoids bulk file inspection in the main context.

## D-003: /deep-research prompting for research phases
- Ref: goal.md §1 (Role Bindings), §5 pre-seeded decision 3
- Options: (1) /deep-research prompting for Phase 3 and Phase 4 topics (2) settle tool choices from model memory (3) ad-hoc web search only
- Decision: (1) /deep-research prompting for Phase 3 (existing-repo review) and Phase 4 (ecosystem research)
- Why: User instruction pre-seeded in goal.md §5. Phase 4 tool choices must never be settled from memory alone (§1).

## D-004: Branch-per-slice for Phase 6 implementation
- Ref: goal.md §5 pre-seeded decision 4; §7 Phase 6 row
- Options: (1) branch-per-slice, merged to main only after the slice's gate passes (2) implement directly on main (3) one long-lived port branch
- Decision: (1) Branch-per-slice, merged to main only after the slice's gate passes
- Why: User instruction pre-seeded in goal.md §5. Keeps main always in a gate-passed state and makes rework isolatable.

## D-005: Untracked source working-tree files excluded from the port
- Ref: goal.md §2.3, §5 pre-seeded decision 5
- Options: (1) exclude untracked working-tree files from the port scope (2) include them (3) include selectively
- Decision: (1) Exclude. As of 2026-07-06 these are: `TEMPLATE_USAGE.md`, `scripts/cleanup_template.py`, `scripts/init_from_template.py`, `scripts/rename_template.py`, `typescript_port_process_prompt.md`
- Why: User instruction pre-seeded in goal.md §5. Scope claims ("every file") mean `git ls-files` at the pinned SHA `4828f8596b2332d74fbcff932ebab6f0030febd5`; these files are untracked there. Verified 2026-07-06 via `git status --porcelain` in the source repo — the untracked set matches this list exactly. Listed in `TS_PORT_INDEX.md` as deliberate exclusions so validators do not flag them.

## D-006: Port artifacts relocated to docs/port/ in final-polish slice
- Ref: goal.md §5 pre-seeded decision 6, §8
- Options: (1) relocate `goal.md`, `typescript_port_process_prompt.md`, and all `TS_PORT_*.md` to `docs/port/` in the final-polish slice (2) keep at repo root (3) delete after port
- Decision: (1) Relocate to `docs/port/` in the final-polish slice
- Why: User instruction pre-seeded in goal.md §5. The finished template ships with a clean root while preserving the full port record.

## D-007: Phase 1 INDEX fan-out grouping (11 file groups)
- Ref: goal.md §7 Phase 1 row; TS_PORT_LOG.md Phase 1–2 plan entry
- Options: (1) 11 logical groups (github-community, github-workflows, root-configs, editor-ai-configs, root-docs-build, assets-docs-infra, docs-about-contributing, docs-reference-tasks, docs-tools, docs-tutorials, python-src-tests) (2) one agent per file (93 agents) (3) one agent per top-level directory
- Decision: (1) 11 logical groups summing to exactly 93 files, counts asserted in the workflow script
- Why: Groups keep related files with one agent (better feature detection) while staying within workflow concurrency; per-file agents would lose cross-file context; per-directory splits unevenly (docs/ = 44 files).

## D-008: Phase 1 validation sampling rate
- Ref: goal.md §4.6; TS_PORT_LOG.md Phase 1–2 plan entry
- Options: (1) 100% of critical entries (Omit/Replace/Needs research/Split/Merge) + 25% random sample of the rest (2) 100% of everything (3) critical-only
- Decision: (1) 100% critical + 25% random sample of remaining entries, sampling rate recorded in the gate verdict
- Why: §4.6 permits stated sampling where full re-verification is impractical; §4.4 requires 100% on critical calls. 25% of ~70 non-critical entries (~18 files) is a meaningful audit at reasonable cost.

## D-009: Fold Phase 2 gate into Phase 1 gate
- Ref: goal.md §7 Phase 2 row ("folds into Phase 1 user gate if run together")
- Options: (1) run Phases 1 and 2 in one workflow with a single combined gate (2) separate gates
- Decision: (1) Combined: index fan-out, then feature-extraction fan-out by feature area, one gate over both
- Why: §7 explicitly permits folding; feature extraction updates the same artifact (TS_PORT_INDEX.md), so a single gate reviews a coherent document.
