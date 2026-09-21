# Type Checking with tsc

Type checking is an essential part of maintaining a robust and error-free
codebase. This project uses a single engine for it: the TypeScript compiler
itself, `tsc`, run in `--noEmit` mode (D-015(1)). There is no second
checker — see [Why just one checker?](#why-just-one-checker) below.

## Setting Up tsc

TypeScript 7 is already a pinned `devDependency`
([`package.json`](../../package.json)), so `pnpm install` is all the setup
required. There is nothing to install globally.

1. **Install dependencies** (if you haven't already):

   ```bash
   pnpm install
   ```

2. **Configure**: the compiler options live in
   [`tsconfig.json`](../../tsconfig.json) at the repository root — the same
   file the native TypeScript 7 editor language service reads (see
   [Why just one checker?](#why-just-one-checker)).

3. **Run tsc**:

   ```bash
   pnpm exec tsc --noEmit
   ```

   or, via the project's command surface:

   ```bash
   just typecheck   # alias: just tc
   ```

   `just typecheck` is also composed into `just all` (format-check + lint +
   typecheck + test) and `just pre-commit-run`, so it always runs as part
   of the full quality gate.

## The strictness flags

`tsconfig.json` turns on `strict` plus a union of additional flags chosen
to match the source project's combined mypy-strict + pyright-strict
coverage (D-013(2)):

| Flag                                       | Why it's on                                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `strict`                                   | The TypeScript baseline strict-mode bundle (explicit here even though TS 6.0 defaults it)                       |
| `noUncheckedIndexedAccess`                 | Array/object index access returns `T \| undefined`, closing a hole `strict` alone leaves open                   |
| `noImplicitOverride`                       | Mirrors mypy/pyright's override checking                                                                        |
| `noFallthroughCasesInSwitch`               | Catches accidental `switch` fallthrough                                                                         |
| `noImplicitReturns`                        | Equivalent to mypy's `warn_no_return`                                                                           |
| `allowUnreachableCode: false`              | Equivalent to mypy's `warn_unreachable`                                                                         |
| `allowUnusedLabels: false`                 | Rejects a rare but easy-to-miss mistake                                                                         |
| `exactOptionalPropertyTypes`               | An optional property must be present-with-the-type or absent, never explicitly `undefined`                      |
| `verbatimModuleSyntax` / `isolatedModules` | Module-hygiene flags required for the NodeNext + tsdown build pipeline (D-013(1))                               |
| `isolatedDeclarations`                     | Lets `tsdown` use its fast oxc `.d.ts` path instead of falling back to a `tsc`-driven declaration build (D-025) |

`noUnusedLocals` / `noUnusedParameters` are deliberately **not** set here —
that class of check is delegated to Oxlint (the org convention, with an
`_`-prefix escape hatch for intentionally-unused parameters); see
[Oxlint](../tools/oxlint.md).

`tsconfig.json`'s `include` covers `src/**/*.ts` **and** `tests/**/*.ts`,
so test files get the same strict checking as production code — closing a
gap the Python source had (its mypy config under-checked `tests/`).

Emit is disabled (`noEmit: true`): `tsc` here is a pure typecheck gate.
Building the distributable output is a separate step owned by `tsdown` —
see `just build` and [`tsdown.config.ts`](../../tsdown.config.ts).

## Why just one checker?

The Python source ran two type checkers — mypy in CI, pyright in the
editor — because they are different programs that can (and did) disagree.
In TypeScript, the compiler and the editor's language service are **the
same engine** reading the **same `tsconfig.json`**, so that dual-checker
redundancy disappears by design (D-015(2)). The only real drift risk left is a
version mismatch between the editor's bundled TypeScript and the project's
pinned one. The committed
[`.vscode/settings.json`](../../.vscode/settings.json) registers the workspace
package:

```json
{
  "js/ts.experimental.useTsgo": true,
  "js/ts.tsdk.path": "./node_modules/typescript"
}
```

On first open, trust the workspace and accept the TypeScript 7 extension's
**Allow** prompt. If you dismissed it, run **TypeScript: Select TypeScript
Version...** and choose **Use Workspace Version**. This one-time approval pins
VS Code to the workspace's TypeScript version instead of the extension's
bundled copy (D-032).

## Best Practices for Type Checking

- **Avoid `any`**: prefer precise types or `unknown` with a narrowing check;
  `any` opts an expression back out of every strictness flag above.
- **Let inference work**: annotate function parameters and exported
  function/public-API return types explicitly, but let TypeScript infer
  local variable types where it can.
- **Model unions, not booleans-plus-fields**: a discriminated union
  (`{ kind: 'a'; ... } | { kind: 'b'; ... }`) is usually a better fit than a
  loosely-related set of optional fields — and lets `noUncheckedIndexedAccess`
  / `exactOptionalPropertyTypes` actually help you.
- **Keep third-party types honest**: most modern packages ship their own
  `.d.ts`; if a dependency has none, check `@types/<package>` before
  reaching for a local `.d.ts` shim.

## Common Issues and Solutions

1. **`Object is possibly 'undefined'` on array/object access**

   - **Cause**: `noUncheckedIndexedAccess` — `arr[i]` and `obj[key]` are
     typed `T | undefined`.
   - **Solution**: narrow with a check, use `.at()` with a guard, or assert
     non-null (`arr[i]!`) only when you have already proven it's safe.

2. **Incompatible types in assignments or calls**

   - **Solution**: fix the mismatch at the source rather than widening the
     type or reaching for `as`; a cast just moves the error to runtime.

3. **Suppressing a specific error**

   - **Solution**: use a targeted `// @ts-expect-error` (not the older
     `@ts-ignore`) directly above the line, with a short comment on why —
     `@ts-expect-error` additionally fails the build if the suppressed line
     stops erroring, so a fixed bug doesn't leave a stale suppression
     behind.

   ```ts
   // @ts-expect-error narrowing TODO once upstream types land
   const value = something();
   ```

4. **Missing types for a third-party library**

   - **Solution**: install its `@types/<library>` package, or add a
     `declare module '<library>'` ambient shim under `src/` if none exists.

5. **Type checking only specific files**

   - **Solution**: `tsc` type-checks per the `include` in `tsconfig.json`
     as a whole program — it does not accept a file-list override the way
     `mypy`/`pyright` do, because TypeScript needs the full module graph to
     resolve types correctly. To iterate faster on one area, use your
     editor's inline diagnostics (same engine, same config) while working,
     and run `just typecheck` before committing for the authoritative
     result.

Read more about the compiler configuration in
[TypeScript](../tools/typescript.md).
