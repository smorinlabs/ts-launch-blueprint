# pnpm Package Manager

pnpm 10 is the package manager used for dependency management in this project, replacing uv (and the port's initial npm choice, D-035). This guide covers how to set up and use pnpm in the _TS Launch Blueprint_ project.

## Installation

Unlike npm, pnpm does **not** ship bundled with Node.js, so it needs a one-time bootstrap. Because this project pins an exact pnpm version (see [Version pinning](#version-pinning) below), any recent pnpm can bootstrap the correct one — install pnpm with whichever of these you prefer:

```bash
# standalone install script (no Node required to bootstrap)
curl -fsSL https://get.pnpm.io/install.sh | sh -

# or via npm (npm ships with Node)
npm install -g pnpm@10

# or Homebrew
brew install pnpm
```

`make install-pnpm` prints this same guidance. Corepack is **not** used — it is being removed from Node in a future major version, so the standalone script or a global install is the supported bootstrap path.

This project pins its Node floor in three consistent places (checked by a repo-hygiene meta-test): [`package.json`](../../package.json)'s `engines.node`/`devEngines.runtime`, and [`.nvmrc`](../../.nvmrc):

```json
// package.json (excerpt)
{
  "packageManager": "pnpm@10.34.3+sha512.<integrity>",
  "devEngines": {
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

Node itself can be installed or checked with the root [`Makefile`](makefiles.md) targets:

```bash
make install-node
make install-node-force
```

Refer to the [Makefiles documentation](makefiles.md) for more details.

## Version pinning

pnpm 10 does **not** read `package.json`'s `devEngines` for package-manager enforcement (npm does; pnpm ignores it), so the pinning mechanism is different from the npm approach:

- The **`packageManager`** field pins the exact pnpm version, with a Corepack-style `+sha512.<hash>` integrity suffix. That hash is computed over the pnpm standalone bundle from its GitHub release (what `corepack use pnpm@…` writes) — **not** npm's tarball `dist.integrity`, which is a different artifact and would fail verification.
- [`.npmrc`](../../.npmrc) turns on pnpm's Corepack-replacement enforcement:

```ini
managePackageManagerVersions=true   # pnpm self-manages to the pinned version
packageManagerStrict=true           # refuse a different manager / version
packageManagerStrictVersion=true    # require the exact pinned version
```

With `managePackageManagerVersions`, the first `pnpm` command in this repo transparently downloads and runs `pnpm@10.34.3`, verifying the integrity hash — no Corepack, no manual version juggling. `devEngines.runtime` (Node `>=24`) stays in `package.json` as the Node floor.

> Note: the `.npmrc` keys are pnpm settings. If you ever invoke the npm CLI here (e.g. `npm publish`), npm will warn that they are "unknown config" — that is expected and harmless; the project's own recipes and hooks run through `pnpm exec`, which does not warn.

## Using pnpm for Dependency Management

### Installing dependencies

The everyday development command (respects the committed lockfile, updating it if `package.json` changed):

```bash
pnpm install
```

or via [`just`](justfiles.md):

```bash
just install
```

In CI, and anywhere reproducibility matters more than convenience, use the frozen install — it installs exactly what [`pnpm-lock.yaml`](../../pnpm-lock.yaml) specifies and fails if the lockfile and `package.json` have drifted, rather than updating the lockfile:

```bash
pnpm install --frozen-lockfile
```

### Adding a package

```bash
pnpm add <package-name>        # runtime dependency
pnpm add -D <package-name>     # development-only dependency
```

### Removing a package

```bash
pnpm remove <package-name>
```

### Running tools

Repo-local binaries run through `pnpm exec` (the `npx` equivalent for installed dependencies); one-off tools that are deliberately **not** dependencies run through `pnpm dlx` (fetch-and-run):

```bash
pnpm exec oxlint            # a devDependency bin
pnpm dlx typedoc --version  # not a dependency (D-023(4))
```

### Build scripts are blocked by default

pnpm 10 does **not** run dependencies' install/build scripts unless they are approved — a supply-chain hardening default. On install you may see:

```
Ignored build scripts: esbuild, lefthook. Run "pnpm approve-builds" to pick …
```

This project needs none of them: esbuild and lefthook ship their binaries as platform packages (optional dependencies), so the blocked postinstall scripts are only fallback downloaders. If a future dependency genuinely needs its build script, approve it explicitly with `pnpm approve-builds` (which records it under `pnpm.onlyBuiltDependencies` in `package.json`).

## The lockfile

Unlike the Python source project, which `.gitignore`d `uv.lock`, this project **commits** [`pnpm-lock.yaml`](../../pnpm-lock.yaml) — the inverse policy, chosen deliberately rather than carried over by default. The [`.gitignore`](../../.gitignore) documents why inline:

```
# NOTE: pnpm-lock.yaml IS committed (D-035, amending D-011(5)) — the inverse of
# the Python source, which gitignored uv.lock ("remove if you want to pin
# versions"). Node CI (pnpm install --frozen-lockfile, setup-node caching, the
# GitHub dependency graph) is designed around a committed lockfile; delete the
# lockfile and add it here if you want unpinned installs.
```

A committed lockfile is what makes `pnpm install --frozen-lockfile`, GitHub's dependency graph, `actions/setup-node`'s built-in caching, and Dependabot/dependency-review all work correctly. pnpm's ecosystem id in GitHub tooling is still `npm`, so the dependency graph, Dependabot, and dependency-review read `pnpm-lock.yaml` natively. If you want uv-style unpinned installs for a downstream fork, delete `pnpm-lock.yaml` and add it to `.gitignore` — but note this opts out of the CI integrations above.

The lockfile updates automatically whenever you run `pnpm install` after editing `package.json`'s dependencies; there is no separate "generate the lockfile" command.

## Why the publish step still uses npm

Dependencies install and the package builds with pnpm, but the release workflow publishes with the **npm CLI** (`npm publish`), not `pnpm publish` (D-035). npm is available because it ships with Node 24 (bundled npm `>=11.5.1` meets the npm Trusted Publishing / OIDC floor), whereas pnpm 10's `pnpm publish` OIDC delegation has an unresolved Trusted-Publishing field-failure report. The packaging-validation recipe (`just pack-check`) uses `npm pack` for the same practical reasons — `pnpm pack --json` emits a different shape and runs the prepare script — and installing the tarball with npm mirrors how a published consumer actually installs the package. See [Versioning & Releases](../reference/versioning.md).

## Additional Resources

For more details, see the [official pnpm documentation](https://pnpm.io/), and [`just install` / `just ci`](justfiles.md) for how this project wires pnpm into its command surface.
