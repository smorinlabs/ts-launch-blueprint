# Port Process Records

This directory holds the process record of the TypeScript port of
[py-launch-blueprint](https://github.com/smorinlabs/py-launch-blueprint),
relocated here from the repo root in the final-polish slice per D-006 so
the finished template ships with a clean root while preserving the full
history of how it was built. `goal.md` was the orchestration contract that
drove the port end-to-end (phases, slices, human gates, and the definition
of done), and `typescript_port_process_prompt.md` is the underlying
domain-spec prompt it was built to satisfy. `TS_PORT_INDEX.md` is the
file-by-file inventory of the source repo (what got ported, adapted,
replaced, or omitted, and why); `TS_EXISTING_REPO_REVIEW.md` reviews prior
org repos for reusable TypeScript conventions; `TS_PORT_RESEARCH.md`
captures the topic-by-topic technology research (package manager, lint/
format tooling, build, CI, etc.); `TS_PORT_PLAN.md` lays out the phase/
slice execution plan; and `TS_PORT_LOG.md` is the running execution log.
`port-parity-s3b.md` is the source-vs-port CLI behavior parity table
produced during Slice S3b. **`TS_PORT_DECISIONS.md` is the authoritative
record of every port decision** — its decision IDs D-001 through D-034
are cited throughout the codebase (in comments, tests, and these
documents) as the single source of truth for _why_ the template looks the
way it does.

Note: these documents cross-reference each other and the rest of the
repo by line number (e.g. `TS_PORT_INDEX.md:1511-1515`). Those line
references were recorded while the files lived at the repo root during
the port and are **not** updated for this relocation — read them as
historical citations into the files as they existed at that time, not as
links relative to this directory.
