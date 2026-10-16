// Architecture boundary rules, whole-graph half (D-042). oxlint
// (.oxlintrc.json) checks each file's import specifiers cheaply; this tool
// sees what a per-file linter can't: the resolved import graph across files
// (cycles, where a re-export really leads, workspace package resolution) and
// type-only edges. Rule names are the grep-able tags from
// docs/reference/boundary-rules.md; each comment starts with the tag.
//
// Parser: swc (@swc/core). TypeScript 7 ships no JS compiler API, and
// dependency-cruiser's default TS parser then sees no .ts files at all while
// still exiting 0; tests/boundaries.test.ts guards against that silently
// coming back. Rules match on paths only: the @ts-launch-blueprint/core edge
// resolves with dependency type "undetermined", not "local" or "npm".

const CORE_SRC = '^packages/core/src/';
const ANY_SRC = '^(packages|apps)/[^/]+/src/';
const FRAMEWORKS =
  '(^|node_modules/)(commander|@inquirer/[^/]+|cli-table3|yocto-spinner|clipboardy|picocolors|smol-toml|hono|@hono/[^/]+|@trpc/[^/]+|react)(/|$)';
const CONCRETE_REPOSITORY = `${CORE_SRC}repositories/(http|in-memory)-[^/]+\\.repository\\.ts$`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-no-app-import',
      comment:
        '[core-no-app-import] The core never imports an app; apps depend on the core, not the other way round.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^(apps/|ts-launch-blueprint$)' },
    },
    {
      name: 'core-no-framework-import',
      comment:
        '[core-no-framework-import] The core imports no CLI/web/API framework; keep commander, hono, react and friends in the apps.',
      severity: 'error',
      from: { path: CORE_SRC },
      to: { path: FRAMEWORKS },
    },
    {
      name: 'schema-is-leaf',
      comment:
        '[schema-is-leaf] schemas/ imports only other schemas/ files and zod; it is the bottom layer.',
      severity: 'error',
      from: { path: `${CORE_SRC}schemas/` },
      to: { pathNot: `${CORE_SRC}schemas/|(^|node_modules/)zod(/|$)` },
    },
    {
      name: 'repository-no-service',
      comment:
        '[repository-no-service] Repositories only access data; they never import services or the composition root.',
      severity: 'error',
      from: { path: `${CORE_SRC}repositories/` },
      to: { path: `${CORE_SRC}(services/|composition\\.ts$)` },
    },
    {
      name: 'service-no-concrete-repository',
      comment:
        '[service-no-concrete-repository] Services get a ProjectsRepository injected; wire concrete repositories in composition.ts.',
      severity: 'error',
      from: { path: `${CORE_SRC}services/` },
      to: { path: `${CONCRETE_REPOSITORY}|${CORE_SRC}composition\\.ts$` },
    },
    {
      name: 'service-type-only-repository',
      comment:
        '[service-type-only-repository] Services may only `import type` from repositories/; the repository is injected at runtime.',
      severity: 'error',
      from: { path: `${CORE_SRC}services/` },
      to: { path: `${CORE_SRC}repositories/`, dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'concrete-repository-in-composition-only',
      comment:
        '[concrete-repository-in-composition-only] Only composition.ts (and the index.ts entry) may import a concrete repository.',
      severity: 'error',
      from: {
        path: CORE_SRC,
        pathNot: `${CORE_SRC}(composition|index)\\.ts$|${CONCRETE_REPOSITORY}`,
      },
      to: { path: CONCRETE_REPOSITORY },
    },
    {
      name: 'app-core-entry-only',
      comment:
        '[app-core-entry-only] Apps import the core only as `@ts-launch-blueprint/core`, never by a relative path into packages/.',
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: '^packages/', dependencyTypes: ['local'] },
    },
    {
      name: 'app-core-entry-only',
      comment:
        '[app-core-entry-only] Apps import the core only as `@ts-launch-blueprint/core`, never a `@ts-launch-blueprint/core/<subpath>`.',
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: '^@ts-launch-blueprint/core/' },
    },
    {
      name: 'app-no-cross-app-import',
      comment:
        '[app-no-cross-app-import] One app never imports another app; share code through the core.',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/', pathNot: '^apps/$1/' },
    },
    {
      name: 'no-cycle',
      comment:
        '[no-cycle] Import cycles are not allowed (type-only cycles included); extract the shared part.',
      severity: 'error',
      from: { path: ANY_SRC },
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      comment:
        '[not-to-unresolvable] This import does not resolve; check the path, or the package entry it should go through.',
      severity: 'error',
      from: { path: ANY_SRC },
      to: { couldNotResolve: true },
    },
  ],
  options: {
    // Rules apply to src/ only; tests may import their own package's src/.
    // Not includeOnly: that would also drop npm and unresolvable targets, so
    // core-no-framework-import and not-to-unresolvable could never fire.
    exclude: {
      path: '^(packages|apps)/[^/]+/(tests|scripts|dist|coverage)/|^(packages|apps)/[^/]+/[^/]+\\.config\\.ts$',
    },
    doNotFollow: { path: 'node_modules' },
    parser: 'swc',
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'default'],
    },
  },
};
