# 0010. TypeScript 7, Oxlint/Oxfmt, and single-engine typecheck

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** Maintainers (`D-013`, `D-014`, `D-015`, `D-025`, `D-032`, `D-046`)
- **Related:** `tsconfig.base.json`, `tsconfig.json`, `.oxlintrc.json`, `.oxfmtrc.json`, `.vscode/settings.json`

## Context

Maintaining separate formatters for JS/TS, YAML, TOML, and Markdown, separate
CI vs editor typecheckers, or slow legacy ESLint/Prettier pipelines increases
toolchain complexity and drift.

## Decision

We will standardize on the Oxc toolchain and TypeScript 7 (`^7.0.2`):

- **TypeScript 7 (`tsc --noEmit`):** Strict compiler union (`strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `NodeNext`) plus `isolatedDeclarations: true` for
  `packages/core` and `apps/cli` (enabling `tsdown` fast `.d.ts` emission).
  `apps/api` and `apps/web` carry per-app `tsconfig.json` files run by
  `scripts/typecheck.sh`. `.vscode/settings.json` pins `typescript.tsdk` to the
  workspace TypeScript package.
- **Oxlint + Oxfmt:** Oxlint handles correctness, suspicious, and boundary
  rules; Oxfmt handles formatting (`printWidth: 100`, `singleQuote: true`,
  `sortImports`) across TS, JSON, YAML, TOML, and Markdown.

## Consequences

- Editor and CI run the exact same typechecker and config.
- Every exported symbol in `packages/core` and `apps/cli` requires explicit
  type annotations (`isolatedDeclarations`).

## Alternatives considered

- **ESLint + Prettier + separate `taplo`/`yamlfmt`** — slower execution and
  extra non-Node binaries to install and synchronize.
