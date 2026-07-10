## TypeScript (tsc)

This project uses a single type checker: `tsc`, the TypeScript compiler, run in `--noEmit` mode.

- **tsc** is used in CI and in git hooks for strict type checking.
- **The VS Code TypeScript language service** (the same `tsc` engine, via `typescript.tsdk`) is used in the editor for real-time feedback during development.

### About tsc

[TypeScript](https://www.typescriptlang.org/)'s compiler, `tsc`, is a static type checker that reads type annotations in your source and flags code that doesn't adhere to them, catching errors before they reach runtime. Because the compiler and the editor's language service are the same program reading the same [`tsconfig.json`](../../tsconfig.json), there is no separate "editor checker" to keep in sync — the only drift risk is a version mismatch between the workspace `typescript` package and the one VS Code's built-in TypeScript falls back to, which [`.vscode/settings.json`](../../.vscode/settings.json) closes by pinning:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

This is a deliberate difference from the Python source project, which ran Mypy in CI/pre-commit and Pyright/Pylance in the editor as two distinct engines: in TypeScript, the compiler and the language service are one engine, so a dual-checker split would just duplicate work rather than add coverage. The gap that Pyright's editor-only diagnostics used to cover (unused symbols, unnecessary conditions) is covered by Oxlint instead — see [Oxlint & Oxfmt](oxlint.md).

Run it directly with:

```bash
npx tsc --noEmit
```

or via the project's [`just`](justfiles.md) recipe:

```bash
just typecheck   # alias: just tc
```

### The strict flag set

The project's [`tsconfig.json`](../../tsconfig.json) enables `strict` plus a union of additional flags chosen to reach parity with the source project's Mypy-strict + Pyright-strict combination:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "types": ["node"],

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "exactOptionalPropertyTypes": true,

    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "isolatedDeclarations": true,
    "declaration": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,

    "noEmit": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "tsdown.config.ts", "vitest.config.ts"]
}
```

`noEmit` is set because emit is owned by [tsdown](../reference/project-structure.md), the build tool; this `tsconfig.json` exists purely to typecheck `src/`, `tests/`, and the top-level config files listed in `include` — note that, unlike a Mypy setup that often only checks a package's source, this config checks the test tree too.

| Flag                          | What it catches                                                                                         | Mypy/Pyright analogue                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `strict`                      | The baseline bundle (no implicit `any`, strict null checks, strict bind/call/apply, ...)                | `strict = true`                               |
| `noUncheckedIndexedAccess`    | Array/record index access typed as possibly-`undefined`                                                 | closest to `--strict` index-safety in Pyright |
| `noImplicitOverride`          | Requires an explicit `override` keyword on overriding methods                                           | n/a (TS-specific)                             |
| `noFallthroughCasesInSwitch`  | Disallows accidental `switch` fallthrough                                                               | n/a (TS-specific)                             |
| `noImplicitReturns`           | Every code path in a function must return a value if any does                                           | `warn_no_return`                              |
| `allowUnreachableCode: false` | Errors on code after a `return`/`throw`/`break` that can never run                                      | `warn_unreachable`                            |
| `allowUnusedLabels: false`    | Errors on an unused loop/statement label                                                                | n/a (TS-specific)                             |
| `exactOptionalPropertyTypes`  | `{ a?: string }` rejects `{ a: undefined }` explicitly assigned                                         | closest to Pyright's optional-strictness      |
| `verbatimModuleSyntax`        | Forces explicit `import type` for type-only imports; keeps emit predictable                             | n/a (TS-specific)                             |
| `isolatedModules`             | Disallows patterns that can't be compiled file-by-file                                                  | n/a (TS-specific)                             |
| `isolatedDeclarations`        | Every exported API must have an inferable, explicit-enough type; enables tsdown's fast oxc `.d.ts` path | n/a (TS-specific)                             |

Deliberately **not** enabled here: `noUnusedLocals` / `noUnusedParameters`. Those are delegated to Oxlint's `no-unused-vars` rule instead, which supports the project's `^_` prefix escape convention (`function f(_unused: string)`) — `tsc` itself has no such escape hatch. See [Oxlint & Oxfmt](oxlint.md) for that rule.

### Why and how to disable a strict flag

Every flag above is a trade-off between safety and friction. The project ships all of them enabled from day one, but if you're adapting this template and need to loosen one, here's the shape of the decision for the two flags most likely to bite:

**`exactOptionalPropertyTypes: true` (current setting)**

```ts
interface Options {
  timeout?: number;
}

// Error: Type 'undefined' is not assignable to type 'number' in type 'Options'
const opts: Options = { timeout: undefined };

// Required instead — omit the key entirely
const opts2: Options = {};
```

**`exactOptionalPropertyTypes: false`**

```ts
// Both are allowed
const opts: Options = { timeout: undefined };
const opts2: Options = {};
```

**`noUncheckedIndexedAccess: true` (current setting)**

```ts
const items: string[] = getItems();

// Error: Object is possibly 'undefined'
const first: string = items[0];

// Required instead
const first: string | undefined = items[0];
```

**`noUncheckedIndexedAccess: false`**

```ts
// Allowed — items[0] is typed 'string', even though it may not exist at runtime
const first: string = items[0];
```

### When to use each setting

- **Use the strict union (current setting) when**:
  - Starting a new project.
  - Working on a codebase fully committed to precise types.
  - Ensuring complete type coverage across `src/` and `tests/`.
  - Your team is comfortable with TypeScript's stricter corners.

- **Loosen a flag when**:
  - Migrating a large untyped/`any`-heavy codebase incrementally.
  - A specific flag's false-positive rate is dominating review time and the team has weighed that against the safety it buys.
  - Adopting a third-party pattern (e.g. a library's API) that structurally conflicts with one flag, and a narrower per-file `// @ts-expect-error` is worse than a scoped `tsconfig` relaxation.

### Best practice recommendation

- Start new projects with the full strict union above for maximum type safety — that is this project's default.
- For existing projects being migrated to TypeScript, disable the costliest flag first (usually `strict` itself, then re-enable its sub-flags one at a time), rather than disabling flags piecemeal forever.
- Keep test files under the same `tsconfig.json` as production code (this project does); use Oxlint's per-glob `overrides` for test-specific _lint_ relaxations instead of a separate, looser `tsconfig`.

### Common issues and solutions

1. Third-party library types:

   ```bash
   # Install type declarations for a library that ships its own
   npm install --save-dev @types/some-legacy-package

   # For libraries that ship their own .d.ts, no @types package is needed
   ```

2. Ignoring specific lines:

   ```ts
   // Prefer @ts-expect-error: it errors if the line stops being an error,
   // so you don't accumulate stale suppressions.
   // @ts-expect-error narrowing not yet possible here
   const value: string = maybeUndefined();

   // @ts-ignore silently no-ops even if the line becomes valid — avoid it.
   ```

3. Type checking only specific files (ad hoc, outside the project config):

   ```bash
   npx tsc --noEmit src/lib/config.ts src/lib/api.ts
   ```

   Note that this bypasses `tsconfig.json`'s `include`/`compilerOptions`, so it's useful for a quick sanity check but not a substitute for `just typecheck`, which always runs the full, correctly configured program.

### Common type annotation examples

```ts
// Basic type annotations
function greet(name: string): string {
  return `Hello ${name}`;
}

// Optional parameters
function fetchUser(userId?: number): Record<string, string | number> {
  /* ... */
}

// Generics
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }
}

// Type aliases
type UserId = number;
type UserRecord = Record<UserId, Record<string, string | number>>;

// Function types
type Handler = (input: string, code: number) => boolean;

function process(handler: Handler): void {
  /* ... */
}
```

### TypeScript 7 (tsgo)

TypeScript 7, the Go-native rewrite of the compiler, was in release-candidate status at the time this project was ported (7.0.1-rc). This project does not gate on it yet, but the `tsconfig.json` is kept forward-compatible with it (no `baseUrl`, no `es5` target) — the upgrade path is a `typescript` devDependency bump once TS 7 reaches general availability, since the invoked command stays `tsc --noEmit` either way.

See also: [Vitest](vitest.md) for the test runner, [Oxlint & Oxfmt](oxlint.md) for linting/formatting, and [`just typecheck`](justfiles.md).
