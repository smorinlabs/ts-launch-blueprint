# npm Package Manager

npm is the package manager used for dependency management in this project, replacing uv. This guide covers how to set up and use npm in the _TS Launch Blueprint_ project.

## Installation

npm ships bundled with Node.js — there is no separate install step once Node is present. This project pins its Node floor in three consistent places (checked by a repo-hygiene meta-test): [`package.json`](../../package.json)'s `engines.node`/`devEngines.runtime`, and [`.nvmrc`](../../.nvmrc):

```json
// package.json (excerpt)
{
  "devEngines": {
    "packageManager": { "name": "npm", "onFail": "error" },
    "runtime": { "name": "node", "version": ">=24", "onFail": "error" }
  },
  "engines": {
    "node": ">=24"
  }
}
```

```
// .nvmrc
24
```

`devEngines` is checked by npm itself on `install`/`ci`/`run` (npm >=11), so a Node/npm mismatch fails fast with a clear message rather than an obscure error deep in a dependency. This project does **not** declare a `packageManager` field or use Corepack: Corepack is being removed from Node in a future major version, so `devEngines` — enforced natively by npm — is the mechanism that stays supported, and it matches the other recent org TypeScript repos.

This project's root [`Makefile`](makefiles.md) provides convenience targets for checking and installing Node itself (not npm packages):

```bash
make install-node
make install-node-force
```

Refer to the [Makefiles documentation](makefiles.md) for more details on these `make` targets, especially if you don't already have a Node version manager and want project-standardized guidance.

## Using npm for Dependency Management

### Installing dependencies

To install dependencies from `package.json` (respecting the committed lockfile), the everyday command during development is:

```bash
npm install
```

or via [`just`](justfiles.md):

```bash
just install
```

In CI, and anywhere reproducibility matters more than convenience, use `npm ci` instead — it installs exactly what [`package-lock.json`](../../package-lock.json) specifies and fails if the lockfile and `package.json` have drifted, rather than silently updating the lockfile the way `npm install` can:

```bash
npm ci
```

### Adding a package

To install a package and add it to `dependencies`:

```bash
npm install <package-name>
```

To add it as a `devDependency` instead (linters, test tools, build tools — everything this project's own tooling belongs under):

```bash
npm install --save-dev <package-name>
```

### Removing a package

To uninstall a package and remove it from `package.json`:

```bash
npm uninstall <package-name>
```

### The lockfile

Unlike the Python source project, which `.gitignore`d `uv.lock`, this project **commits** [`package-lock.json`](../../package-lock.json) — the inverse policy, chosen deliberately rather than carried over by default. The [`.gitignore`](../../.gitignore) documents why inline:

```
# NOTE: package-lock.json IS committed (D-011(5)) — the inverse of the Python
# source, which gitignored uv.lock ("remove if you want to pin versions").
# Node CI (npm ci, setup-node caching, the GitHub dependency graph) is designed
# around a committed lockfile; delete the lockfile and add it here if you want
# unpinned installs.
```

A committed lockfile is what makes `npm ci`, GitHub's dependency graph, `actions/setup-node`'s built-in caching, and Dependabot/dependency-review all work correctly — they're all designed around a lockfile that's part of the repository, not a developer-local artifact. If you do want uv-style unpinned installs for a downstream fork, delete `package-lock.json` and add it to `.gitignore` — but note this opts out of the CI integrations above.

The lockfile updates automatically whenever you run `npm install` after editing `package.json`'s dependencies; there's no separate "generate the lockfile" command to run, unlike `uv pip freeze > requirements.lock`.

## Additional Resources

For more details, see the [official npm documentation](https://docs.npmjs.com/), and [`just install` / `just ci`](justfiles.md) for how this project wires npm into its command surface.
