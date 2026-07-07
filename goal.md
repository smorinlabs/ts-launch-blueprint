# Goal: Port py-launch-blueprint to ts-launch-blueprint

Execute the full migration of `smorinlabs/py-launch-blueprint` (Python, at
`~/c/py-launch-blueprint`) into this repository as an idiomatic TypeScript project,
from beginning to end.

This file is the **orchestration contract** — it defines HOW the work is executed,
verified, and gated. The **domain spec** — WHAT to port, the phase content, and the
porting methodology — is [`typescript_port_process_prompt.md`](./typescript_port_process_prompt.md).

**Read the domain spec in full before doing anything.** Where the two documents
overlap, this contract governs execution mechanics; the domain spec governs porting
content and methodology.

---

## 1. Role Bindings

| Role | Binding | Never |
|------|---------|-------|
| **Planning & gating** | Fable (`claude-fable-5`), in the main conversation loop. Authors all planning artifacts, per-slice plans, and gate verdicts. | Never delegate planning or gate decisions to a sub-agent. |
| **Execution** | Sub-agents. Agent tool for single tasks; Workflow tool for fan-out (e.g., indexing every source file, running validator panels). | Never do bulk file inspection, research legwork, or implementation in the main loop. |
| **Research** | `/deep-research` prompting for Phase 3 (existing-repo review) and Phase 4 (ecosystem research) topics. | Never settle a Phase 4 tool choice from memory alone. |
| **Validation** | Independent sub-agents that did **not** produce the work under review. | Never let a producer validate its own output. |

---

## 2. Universal Phase Loop

Every phase of the domain spec, and every implementation slice within Phase 6,
runs the same five steps:

```
1. PLAN      Fable writes the unit plan: scope, inputs, definition of done,
             validation criteria, and the decision IDs it implements.
2. EXECUTE   Sub-agents produce the work.
3. CHECK     The executor self-checks against the definition of done and
             reports evidence (file paths, command output, diffs).
4. VALIDATE  Independent sub-agents cross-verify the reported results
             against primary sources (see §3).
5. GATE      Fable reviews CHECK + VALIDATE evidence and rules:
             pass → next unit | rework (max 1 attempt) → re-enter at EXECUTE
             | escalate → stop and ask the user.
```

No unit may begin PLAN until the previous unit's GATE has passed (or the user
has explicitly waived it).

---

## 3. Cross-Validation Rules

**Core rule: nothing reported is trusted as verified until an agent other than its
producer has confirmed it against the source.**

1. **Every reported element** — an INDEX entry, a repo-review claim, a research
   recommendation, a plan step, a slice-completion claim — must be cross-validated
   by at least one independent sub-agent before it counts.
2. **Validators verify against primary sources, not summaries**: re-open the actual
   file, re-run the actual command, re-fetch the actual doc. A validator that only
   reads the producer's report has validated nothing.
3. **Validators must cite evidence**: file path + line, command + output, or URL.
   Uncited confirmations are rejected at the gate.
4. **Critical claims get 2 independent validators.** Critical = anything that, if
   wrong, corrupts downstream phases: INDEX completeness, port-category calls of
   `Omit` or `Replace`, every RESEARCH recommendation, every slice
   definition-of-done, and any claim that a check/test/build "passes."
5. **Disagreement** between validators, or between validator and producer, is
   adjudicated by Fable at the gate; if Fable cannot resolve it from evidence,
   escalate to the user.
6. **Sampling is not allowed to silently replace coverage.** Where full re-verification
   is impractical (e.g., re-reading all files behind the INDEX), validate 100% of
   critical elements plus a stated random sample of the rest, and record the
   sampling rate in the gate verdict.

---

## 4. Decision Log — `TS_PORT_DECISIONS.md`

Append-only, numbered, ADR-style. **Every decision is logged, no matter how small** —
tool choices, mapping choices, omissions, deviations, naming, gating waivers.

Format:

```markdown
## D-###: <short title>
- Ref: <file + section, or plan file + slice/step, where the decision arises>
- Options: (1) <option> (2) <option> (3) <option>
- Decision: (<n>) <chosen option>
- Why: <rationale, citing evidence — existing-repo precedent, research finding,
  domain-spec rule, or user instruction>
```

Rules:

- IDs are sequential (`D-001`, `D-002`, …) and never reused or renumbered.
- Plans and slices cite decisions by ID ("implements D-007"); validators check
  implementations against the cited decision's text.
- Reversing a decision requires a **new** entry that references the old one
  ("supersedes D-007"); never edit a past entry.
- If work is happening without a citable decision ID, stop and log the decision first.

Pre-seeded user decisions (log these as D-001..D-003 at kickoff):
Fable for all planning; sub-agents for execution; `/deep-research` for research phases.

---

## 5. Human Gates & Escalation

**Pause and ask the user for approval** — after internal validation passes — for each
of the four planning artifacts:

1. `TS_PORT_INDEX.md`
2. `TS_EXISTING_REPO_REVIEW.md`
3. `TS_PORT_RESEARCH.md`
4. `TS_PORT_PLAN.md`

**Implementation slices run autonomously.** Escalate to the user only when:

- A slice fails its gate after one rework attempt.
- An action is hard to reverse or outward-facing: publishing a package (even dry-run
  behavior that touches a registry), changing repo visibility/settings, force-pushing,
  deleting files not created by this port, or any credentialed external call.
- Validators deadlock and Fable cannot adjudicate from evidence.
- The domain spec and observed reality conflict (e.g., a required source file is
  missing) in a way that changes scope.

Never mark the goal complete while any gate is unresolved or any escalation is
unanswered.

---

## 6. Phase Map

| # | Phase (domain spec) | Executor shape | CHECK asserts | VALIDATE re-verifies | Gate |
|---|---------------------|----------------|---------------|----------------------|------|
| 1 | `TS_PORT_INDEX.md` | Workflow fan-out: one agent per file group from `git ls-files` | Every source file has all 11 fields; no file skipped | Completeness auditor diffs INDEX vs `git ls-files`; validators re-open 100% of `Omit`/`Replace`/`Needs research` files + random sample of the rest | Fable → **user** |
| 2 | Feature extraction | Fan-out by feature area (CLI, CI, release, docs, …) | Each feature mapped to files + intended TS representation; INDEX updated | Validators re-derive features from the files independently and diff against the report | Fable (folds into Phase 1 user gate if run together) |
| 3 | `TS_EXISTING_REPO_REVIEW.md` | One agent per repo, `/deep-research` prompting | All 18 fields per repo; recent TS repos prioritized | Validators re-check claimed patterns against the actual repos (configs, workflows, lockfiles) | Fable → **user** |
| 4 | `TS_PORT_RESEARCH.md` | One `/deep-research` unit per research topic | All 11 fields per topic; existing-repo decisions consulted first; every recommendation carries a D-### | 2 validators per recommendation: one checks reasoning + sources, one checks consistency with repo review + domain-spec classification | Fable → **user** |
| 5 | `TS_PORT_PLAN.md` | Fable authors (planning, not delegable); sub-agents fact-check feasibility | Vertical slices, each with all 11 slice fields; every slice cites decision IDs | Validators trace each slice back to INDEX + RESEARCH entries; flag orphans (slice without source, or INDEX entry no slice covers) | Fable → **user** |
| 6 | Implementation slices + `TS_PORT_LOG.md` | Per slice: sub-agents implement (worktree isolation if parallel) | Slice definition of done met; commands run with output captured; LOG updated | Validators independently re-run build/lint/typecheck/tests and the slice's stated validation; 2 validators on "passes" claims | Fable (autonomous; escalate per §5) |

The 8 reviewer passes defined in the domain spec's Sub-Agent Review Process are
**not replaced** by this table — they are scheduled as VALIDATE steps of the phases
they correspond to (Reviewer 1–2 → Phases 1–2, Reviewer 3 → Phase 3, Reviewer 4 →
Phase 4, Reviewer 5 → Phase 5, Reviewers 6–8 → Phase 6 slices and final pass).

---

## 7. Artifacts

| File | Owner | Says |
|------|-------|------|
| `TS_PORT_INDEX.md` | Phase 1–2 | What exists in the source |
| `TS_EXISTING_REPO_REVIEW.md` | Phase 3 | What prior decisions already exist |
| `TS_PORT_RESEARCH.md` | Phase 4 | What should be chosen |
| `TS_PORT_DECISIONS.md` | All phases | What was decided, and why (numbered) |
| `TS_PORT_PLAN.md` | Phase 5 | What should happen |
| `TS_PORT_LOG.md` | Phase 6 | What actually happened |

All artifacts are committed to this repository as they are updated (conventional
commits), so the goal is resumable from disk state alone.

## 8. Resume Protocol

On (re)start: read this file, the domain spec, and every artifact in §7 that exists.
The furthest artifact with a passed gate defines the resume point; re-enter the
loop at the first unit whose gate has not passed. Never redo passed work; never
trust unvalidated work found on disk — re-run VALIDATE for any artifact whose gate
status is not recorded.

## 9. Definition of Done

The goal is complete when every item in the domain spec's **Expected Final Output**
list is satisfied, every phase and slice gate has passed, all escalations are
resolved, `TS_PORT_DECISIONS.md` covers every decision made, and a final
completeness critic (sub-agent) finds no unported, unomitted, or undocumented
source file or feature.
