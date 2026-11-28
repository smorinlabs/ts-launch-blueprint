# 0016. Canonical AGENTS.md, plain CommonMark docs, and template-press lifecycle

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`Q10.A`, `D-023`, `D-024(5)`)
- **Related:** `AGENTS.md`, `CLAUDE.md`, `docs/docs.md`, `press/press-rules.toml`, `scripts/check-links.mjs`

## Context

Duplicating agent instructions across vendor-specific rule folders
(`.cursor/rules/`, `.windsurf/rules/`, `CLAUDE.md`) causes drift, and heavy
documentation generators (Sphinx, MyST, Read the Docs) add maintenance overhead
when GitHub already renders CommonMark/GFM natively. Downstream forks also need
a deterministic way to rebrand all template identities and retire template-only
history.

## Decision

We will consolidate agent context, documentation, and template lifecycle around
three standards:

- **Single `AGENTS.md` hub (`Q10.A`):** `AGENTS.md` is the canonical agent
  guide; `CLAUDE.md` is a minimal `@AGENTS.md` import, and vendor-specific
  `.cursor/rules/` and `.windsurf/rules/` directories are retired.
- **Plain CommonMark/GFM `docs/` (`D-023`):** Documentation uses standard
  `.md` files validated offline by `scripts/check-links.mjs` (`just docs-check`),
  with optional `just docs-api` (TypeDoc) and zero Sphinx/RTD build steps.
- **`template-press` lifecycle:** `press/press-rules.toml` rewrites identity
  tokens, resets template-framing stubs (`README.md`, `PROJECTS.md`,
  `docs/POST_INIT.md`, `.github/SECURITY.md`), removes template-only files
  (`docs/port/`, `projects/`, bootstrap skill), and ships `press-verify.yml`
  plus `scripts/guard.sh` for ongoing fork safety.

## Consequences

- Every AI coding tool reads one authoritative instruction file, and
  documentation link integrity runs offline in milliseconds.
- Retained documentation (`docs/adr/`, `docs/about/design-decisions.md`,
  `docs/PROJECT_SETUP.md`, `docs/RELEASE.md`) never links to removed
  template-only directories (`docs/port/`, `projects/`).

## Alternatives considered

- **Maintain separate `.cursor/` / `.windsurf/` / `CLAUDE.md` rule copies** —
  diverges rapidly across edits.
- **Ship a static-site docs build (Sphinx / VitePress)** — adds build/hosting
  machinery unneeded for repository-native Markdown.
