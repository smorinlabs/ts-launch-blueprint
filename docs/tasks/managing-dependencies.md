# Managing Dependencies with pnpm

[pnpm](https://pnpm.io/) is the package manager for this project (D-035).
Unlike npm it does not ship with Node.js, so it needs a one-time bootstrap
(`make install-pnpm` prints the options); after that it self-manages to the
exact pinned version via the `packageManager` field and
[`.npmrc`](../../.npmrc). Node.js >=24 is required (also pinned in
[`.nvmrc`](../../.nvmrc) and `engines`/`devEngines.runtime` in
[`package.json`](../../package.json)).

## Installing Dependencies

To install all dependencies and generate/refresh the lockfile:

```sh
pnpm install
```

`just install` runs `just check-deps` first and then this same command — it
is the recommended entry point on a fresh clone.

In CI, and anywhere a byte-for-byte reproducible install matters, use
`pnpm install --frozen-lockfile` instead: it installs strictly from
`pnpm-lock.yaml` and fails fast if the lockfile and `package.json` have
drifted apart.

## Adding a Dependency

```sh
pnpm add <package-name>        # runtime dependency
pnpm add -D <package-name>     # development-only dependency
```

Both commands update `package.json` and `pnpm-lock.yaml` together —
always commit the two files as a pair.

## Development Tools

The project's quality gates are exposed as `just` recipes (thin wrappers
around pnpm scripts / `pnpm exec`, so they always run the exact versions
pinned in `pnpm-lock.yaml`):

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
pnpm update                    # update all dependencies within their declared ranges
pnpm update <package-name>     # update a specific package
pnpm remove <package-name>     # remove a package
```

To see which installed packages have newer versions available beyond their
declared semver range (i.e. a version bump you'd need to edit
`package.json` for):

```sh
pnpm outdated
```

## Auditing for Vulnerabilities

```sh
pnpm audit             # report known vulnerabilities in the dependency tree
pnpm audit --fix       # apply non-breaking fixes automatically
```

`pnpm audit` is advisory here — it is not wired into a `just` recipe or CI
gate. Automated vulnerability response for this repo is Dependabot-driven
(next section) plus the CodeQL workflow; `pnpm audit` remains available for
an ad hoc check before a release.

## Lockfile Policy

`pnpm-lock.yaml` **is committed** to the repository (D-035, amending
D-011(5)) — see the note at the top of [`.gitignore`](../../.gitignore).
This is a deliberate inversion of the Python source, which `.gitignore`d
`uv.lock` with a "remove if you want to pin versions" comment: the Node
tooling (`pnpm install --frozen-lockfile`, the GitHub dependency graph,
`dependency-review-action`, npm Trusted Publishing at release) is designed
around a committed lockfile, and every other TypeScript repo in the org
commits one too. Do not add `pnpm-lock.yaml` to `.gitignore`, and do not
run `pnpm install --no-lockfile` for a change you intend to commit.

## Automated Dependency Updates (Dependabot)

[`​.github/dependabot.yml`](../../.github/dependabot.yml) keeps two
ecosystems current on a weekly schedule:

- `npm` — runtime and dev dependencies declared in `package.json` /
  `pnpm-lock.yaml`. Dependabot's ecosystem id for pnpm is still `npm`; it
  reads the pnpm lockfile.
- `github-actions` — the SHA-pinned third-party actions used by the
  workflows in `.github/workflows/`.

Both ecosystems group minor+patch updates into a single low-noise PR
(`npm-minor-patch` / `actions-minor-patch`); major-version bumps are left
as individual PRs so they get a deliberate look. Dependabot PRs run through
the same `just all` CI gate as any other change before merge.
