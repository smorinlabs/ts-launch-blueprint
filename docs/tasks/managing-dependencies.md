# Managing Dependencies with npm

[npm](https://docs.npmjs.com/) is the package manager for this project — it
ships with Node.js itself, so there is no separate tool to install
(D-011(1)). Node.js >=24 is required (also pinned in
[`.nvmrc`](../../.nvmrc) and `engines`/`devEngines` in
[`package.json`](../../package.json)).

## Installing Dependencies

To install all dependencies and generate/refresh the lockfile:

```sh
npm install
```

`just install` runs `just check-deps` first and then this same command — it
is the recommended entry point on a fresh clone.

In CI, and anywhere a byte-for-byte reproducible install matters, use
`npm ci` instead: it installs strictly from `package-lock.json` and fails
fast if the lockfile and `package.json` have drifted apart.

## Adding a Dependency

```sh
npm install <package-name>              # runtime dependency
npm install --save-dev <package-name>   # development-only dependency
```

Both commands update `package.json` and `package-lock.json` together —
always commit the two files as a pair.

## Development Tools

The project's quality gates are exposed as `just` recipes (thin wrappers
around npm scripts / `npx`, so they always run the exact versions pinned in
`package-lock.json`):

```sh
just format         # oxfmt --write (+ sortImports)
just format-check    # oxfmt --check
just lint            # oxlint
just lint-fix        # oxlint --fix
just typecheck       # tsc --noEmit
just test            # vitest run
just coverage        # vitest run --coverage
just all             # format-check + lint + typecheck + test
```

See [Type Checking Code](type-checking-code.md) for the `tsc` gate in
detail, [Oxlint](../tools/oxlint.md) for linting, and
[Vitest](../tools/vitest.md) for the test runner.

## Updating & Removing Packages

```sh
npm update                    # update all dependencies within their declared ranges
npm update <package-name>     # update a specific package
npm uninstall <package-name>  # remove a package
```

To see which installed packages have newer versions available beyond their
declared semver range (i.e. a version bump you'd need to edit
`package.json` for):

```sh
npm outdated
```

## Auditing for Vulnerabilities

```sh
npm audit             # report known vulnerabilities in the dependency tree
npm audit fix         # apply non-breaking fixes automatically
```

`npm audit` is advisory here — it is not wired into a `just` recipe or CI
gate. Automated vulnerability response for this repo is Dependabot-driven
(next section) plus the CodeQL workflow; `npm audit` remains available for
an ad hoc check before a release.

## Lockfile Policy

`package-lock.json` **is committed** to the repository (D-011(5)) — see the
note at the top of [`.gitignore`](../../.gitignore). This is a deliberate
inversion of the Python source, which `.gitignore`d `uv.lock` with a
"remove if you want to pin versions" comment: npm's tooling (`npm ci`, the
GitHub dependency graph, `dependency-review-action`, npm Trusted
Publishing) is designed around a committed lockfile, and every other
TypeScript repo in the org commits one too. Do not add
`package-lock.json` to `.gitignore`, and do not run `npm install` with
`--no-package-lock` for a change you intend to commit.

## Automated Dependency Updates (Dependabot)

[`​.github/dependabot.yml`](../../.github/dependabot.yml) keeps two
ecosystems current on a weekly schedule:

- `npm` — runtime and dev dependencies declared in `package.json` /
  `package-lock.json`.
- `github-actions` — the SHA-pinned third-party actions used by the
  workflows in `.github/workflows/`.

Both ecosystems group minor+patch updates into a single low-noise PR
(`npm-minor-patch` / `actions-minor-patch`); major-version bumps are left
as individual PRs so they get a deliberate look. Dependabot PRs run through
the same `just all` CI gate as any other change before merge.
