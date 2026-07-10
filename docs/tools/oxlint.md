## Oxlint & Oxfmt: A Fast TypeScript Linter and Formatter

Oxlint and Oxfmt are the high-performance linter and code formatter used in this project, replacing Ruff. Both are part of the [oxc](https://oxc.rs/) project, written in Rust, and together they cover the same ground Ruff covered for the Python source project: linting, formatting, and import sorting, in place of separate tools.

**Pros**:

- 🚀 **Very Fast**: Written in Rust, both tools process this codebase near-instantly, the same performance argument that motivated Ruff's adoption in the source project.
- 🛠 **Split, focused tools**: Oxlint handles linting (correctness/suspicious categories, security-adjacent rules, per-file overrides); Oxfmt handles formatting, including import sorting and JSON/YAML/Markdown — one formatter for every config format, rather than a formatter per file type.
- ⚙ **Customizable**: `.oxlintrc.json` and `.oxfmtrc.json` let the project select categories/rules and formatting style precisely.
- 🔗 **Easy integration**: Wired into [lefthook](../../lefthook.yml) pre-commit hooks, CI, and `pnpm` — no separate binary install.
- 🔄 **Automated fixes**: `oxlint --fix` and `oxfmt` (without `--check`) both auto-correct.

**Cons**:

- **Oxfmt is beta** (0.58.0, exact-pinned in `package.json` rather than range-pinned) — younger than Ruff's format mode, so its version is pinned exactly rather than with a caret range.
- Oxlint has no dedicated security-rule plugin (Ruff's `S`/flake8-bandit equivalent) — see [Security-rule coverage](#security-rule-coverage) below for how this project compensates.

### Formatting style

Unlike the Python source project's 88-column (Black-default) line length, this project's Oxfmt configuration uses values agreed across recent org TypeScript projects, not a straight port of the Python norm:

```json
// .oxfmtrc.json
{
  "printWidth": 100,
  "singleQuote": true,
  "semi": true,
  "trailingComma": "es5",
  "endOfLine": "lf",
  "sortImports": true,
  "ignorePatterns": [
    "docs/port/TS_PORT_*.md",
    "docs/port/TS_EXISTING_REPO_REVIEW.md",
    "docs/port/goal.md",
    "docs/port/typescript_port_process_prompt.md",
    ".claude/settings.local.json"
  ]
}
```

- **`printWidth: 100`**: wider than Python's 88-column norm — a reasonable width for TypeScript's syntax, not a re-derivation of the "88 vs 100 vs 120" line-length debate that motivated the source project's Black-default choice.
- **`singleQuote` / `semi` / `trailingComma`**: standard TypeScript/Prettier-compatible style choices.
- **`sortImports: true`**: Oxfmt's built-in import-sorting algorithm, the structural equivalent of Ruff's `I` (isort) category — import order is treated as a formatting concern here too, so there's no separate import-sort tool or lint rule.
- **`ignorePatterns`**: files Oxfmt must never reformat because they cross-reference each other by line number (the port-process documents); template/example content is _not_ excluded.

Oxfmt also formats JSON, YAML, and Markdown — the source project's `taplo` (TOML) and `yamlfmt` (YAML) are both dropped in favor of this one tool covering every config format Ruff-adjacent tooling used to split across three binaries.

Run it with:

```bash
pnpm exec oxfmt            # write fixes
pnpm exec oxfmt --check    # CI-parity check, no writes
```

or via [`just`](justfiles.md):

```bash
just format          # alias: just f
just format-check    # alias: just fc
```

### Lint rule selection

```jsonc
// .oxlintrc.json (abridged — see .oxlintrc.json for the authoritative config)
{
  "categories": {
    "correctness": "error",
    "suspicious": "error",
  },
  "plugins": ["typescript", "unicorn", "oxc", "import", "promise", "node", "vitest"],
  "rules": {
    "no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_",
      },
    ],
    "no-underscore-dangle": "off",
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "no-script-url": "error",
    "no-caller": "error",
    "no-proto": "error",
    "eqeqeq": "error",
    "no-var": "error",
    "prefer-const": "error",
  },
  "overrides": [
    {
      "files": ["tests/**", "**/*.test.ts"],
      "rules": {
        "typescript/no-non-null-assertion": "off",
        "typescript/no-explicit-any": "off",
        "no-magic-numbers": "off",
        "no-console": "off",
      },
    },
  ],
  "ignorePatterns": ["dist/**", "coverage/**"],
}
```

Both `"correctness"` and `"suspicious"` are set to `"error"` everywhere — this project does not reuse a warn-level laxity some earlier org proof-of-concept used.

Reading Ruff's rule-select codes as _intent_, not as rules to literally reproduce, here's how they map onto Oxlint:

| Ruff selector                        | Ruff intent                          | Oxlint equivalent                                                       |
| ------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------- |
| `E`/`W` (pycodestyle)                | Style/whitespace                     | Oxfmt's job (formatting), plus the `correctness` category for real bugs |
| `F` (pyflakes)                       | Undefined names, unused imports/vars | `correctness` category + `no-unused-vars`                               |
| `I` (isort)                          | Import ordering                      | Oxfmt's `sortImports` (a formatting concern here, not a lint rule)      |
| `B` (bugbear)                        | Common bug patterns                  | `suspicious` category + `eqeqeq`, `no-caller`, `no-proto`               |
| `C4`/`UP` (comprehensions/pyupgrade) | Modernize syntax                     | `unicorn` plugin + `no-var`/`prefer-const`                              |
| `N` (pep8-naming)                    | Naming conventions                   | No direct equivalent; left to code review                               |
| `S` (bandit)                         | Security-sensitive patterns          | See [Security-rule coverage](#security-rule-coverage) below             |

### `no-unused-vars` and the `^_` convention

Because `tsc`'s own `noUnusedLocals`/`noUnusedParameters` have no escape hatch, unused-code diagnostics live entirely in Oxlint instead (see [TypeScript (tsc)](typescript.md#the-strict-flag-set)), configured to permit an explicit `_`-prefix convention for intentionally-unused bindings:

```ts
// Error: 'data' is defined but never used
function handler(data: string): void {}

// Allowed: leading underscore signals "intentionally unused"
function handler(_data: string): void {}
```

`no-underscore-dangle` is turned off specifically so that convention doesn't fight itself — that rule would otherwise flag the very `_`-prefixed identifiers the unused-vars config is designed to permit.

### Security-rule coverage

Oxlint has no dedicated security/bandit-equivalent plugin (none of its built-in plugins target it), so this project layers coverage instead of pretending one tool fully replaces `S`:

1. Oxlint's own security-adjacent built-ins: `no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url`.
2. Bugbear-adjacent hardening in the same spirit: `no-caller`, `no-proto`, `eqeqeq`.
3. [CodeQL](github-actions.md), run as a separate CI workflow, for deeper security analysis.
4. `eslint-plugin-security` is deferred until Oxlint's JS-plugin support leaves alpha — documented here as a gap, not silently dropped.

### Per-context overrides

Oxlint's `overrides` array is the structural equivalent of Ruff's `per-file-ignores` for `tests/*`. Where the source project relaxed `S101`/`S105`/`S106` (assert usage, hardcoded test tokens) for its test tree, this project relaxes the TypeScript-idiom equivalents for `tests/**` and `**/*.test.ts`:

- `typescript/no-non-null-assertion`: off — non-null assertions (`value!`) are idiomatic in test bodies asserting on results that are known-non-null by test setup.
- `typescript/no-explicit-any`: off — loose typing is acceptable in test fixtures and mocks.
- `no-magic-numbers`: off — literal expected values are the point of an assertion.
- `no-console`: off — debug output in tests is harmless (the rule is not enabled globally today either, but this keeps the override future-proof if it is).

Some of these rules aren't in the enabled categories yet; they're pinned `"off"` in the override anyway so that tightening the global gate later (more categories, type-aware mode) never retroactively taxes test code.

### Best practice recommendation

- Run `just lint` (or `pnpm exec oxlint`) locally before pushing; `just lint-fix` (`pnpm exec oxlint --fix`) applies safe autofixes.
- Run `just format` before committing; the pre-commit hook also runs it on staged files and re-stages fixes automatically.
- Treat `.oxlintrc.json`'s `overrides` as the only place test-specific relaxations belong — don't loosen the global `categories`/`rules` to accommodate test code.

### Troubleshooting

- **Lint failing on files you didn't touch**: `no-unused-vars` and `eqeqeq` run repo-wide, not just on staged files, when invoked directly (`pnpm exec oxlint`); the pre-commit hook only lints staged files (`pnpm exec oxlint {staged_files}`).
- **Formatter and linter disagreeing**: they shouldn't — `printWidth`/`singleQuote`/etc. are formatting-only concerns owned by `.oxfmtrc.json`; if a lint rule appears to fight the formatter's output, check whether the rule belongs in `.oxlintrc.json` at all.
- **A file that should be ignored is still being linted/formatted**: check both `.oxlintrc.json`'s `ignorePatterns` and `.oxfmtrc.json`'s `ignorePatterns` — they're separate lists (lint vs. format), and [`lefthook.yml`](../../lefthook.yml)'s hook `exclude` globs must mirror both.

See also: [TypeScript (tsc)](typescript.md) for the type-checking gate, [Vitest](vitest.md) for the test-glob overrides in context, and [`just format` / `just lint`](justfiles.md).
