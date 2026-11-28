// Proof that the architecture boundary rules (D-042) are enforced: each case
// writes a small probe file into an isolated temporary workspace copy, runs the
// real tool on the real config, checks the result, and always removes the probe.
// Isolating probes in tmpdir() prevents races when `just all` runs in parallel.
// Rules and tags: docs/reference/boundary-rules.md.
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const BIN = join(REPO_ROOT, 'node_modules', '.bin');
const CORE = 'packages/core/src';
const CLI = 'apps/cli/src';
const API = 'apps/api/src';
const WEB = 'apps/web/src';
const PROBE_APP = 'apps/__boundary-probe-app';
const TIMEOUT_MS = 30_000;

let probeRoot = '';

function linkNodeModulesDir(srcDir: string, dstDir: string, tempRoot: string): void {
  mkdirSync(dstDir, { recursive: true });
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === '.bin') continue;
    const srcPath = join(srcDir, entry.name);
    const dstPath = join(dstDir, entry.name);
    const stat = lstatSync(srcPath);
    if (stat.isSymbolicLink()) {
      const realTarget = realpathSync(srcPath);
      const relToRepo = relative(REPO_ROOT, realTarget);
      const relPosix = relToRepo.replaceAll('\\', '/');
      const isWorkspaceTarget =
        !relPosix.startsWith('..') &&
        (relPosix.startsWith('packages/') || relPosix.startsWith('apps/'));
      const target = isWorkspaceTarget ? join(tempRoot, relToRepo) : realTarget;
      symlinkSync(target, dstPath, 'junction');
    } else if (stat.isDirectory()) {
      linkNodeModulesDir(srcPath, dstPath, tempRoot);
    }
  }
}

function createProbeWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'ts-boundaries-probe-'));
  for (const configFile of [
    '.oxlintrc.json',
    '.dependency-cruiser.cjs',
    'tsconfig.json',
    'tsconfig.base.json',
    'package.json',
    'pnpm-workspace.yaml',
  ]) {
    const src = join(REPO_ROOT, configFile);
    if (existsSync(src)) {
      copyFileSync(src, join(root, configFile));
    }
  }

  symlinkSync(join(REPO_ROOT, 'node_modules'), join(root, 'node_modules'), 'junction');

  for (const group of ['packages', 'apps']) {
    const groupSrc = join(REPO_ROOT, group);
    if (!existsSync(groupSrc)) continue;
    for (const pkg of readdirSync(groupSrc, { withFileTypes: true })) {
      if (!pkg.isDirectory() || pkg.name.startsWith('__boundary-probe-')) continue;
      const pkgSrc = join(groupSrc, pkg.name);
      const pkgDst = join(root, group, pkg.name);
      cpSync(pkgSrc, pkgDst, {
        recursive: true,
        filter: (src) => {
          const rel = relative(pkgSrc, src).replaceAll('\\', '/');
          if (!rel) return true;
          const top = rel.split('/')[0] ?? '';
          return (
            top !== 'node_modules' &&
            top !== 'dist' &&
            top !== 'coverage' &&
            !top.startsWith('__boundary-probe-')
          );
        },
      });
    }
  }

  for (const group of ['packages', 'apps']) {
    const groupSrc = join(REPO_ROOT, group);
    if (!existsSync(groupSrc)) continue;
    for (const pkg of readdirSync(groupSrc, { withFileTypes: true })) {
      if (!pkg.isDirectory() || pkg.name.startsWith('__boundary-probe-')) continue;
      const nmSrc = join(groupSrc, pkg.name, 'node_modules');
      if (existsSync(nmSrc)) {
        linkNodeModulesDir(nmSrc, join(root, group, pkg.name, 'node_modules'), root);
      }
    }
  }

  return root;
}

beforeAll(() => {
  probeRoot = createProbeWorkspace();
});

afterAll(() => {
  if (probeRoot) {
    rmSync(probeRoot, { recursive: true, force: true });
    probeRoot = '';
  }
});

/** Files (and the probe app folder) written by the current case. */
const written: string[] = [];

function probe(path: string, content: string): string {
  const absolute = join(probeRoot, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
  written.push(absolute);
  return path;
}

function removeProbes(): void {
  for (const path of written.splice(0)) {
    rmSync(path, { force: true });
  }
  if (probeRoot) {
    rmSync(join(probeRoot, PROBE_APP), { recursive: true, force: true });
  }
}

afterEach(removeProbes);

interface RunResult {
  status: number | null;
  output: string;
}

function run(bin: string, args: string[], cwd: string): RunResult {
  const binPath = join(BIN, process.platform === 'win32' ? `${bin}.cmd` : bin);
  const result = spawnSync(binPath, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

// Pinned: in GitHub Actions oxlint switches to its `github` format, which
// drops the `help:` text that carries our rule tags.
const oxlint = (files: string[], cwd = probeRoot): RunResult =>
  run('oxlint', ['--format', 'default', ...files], cwd);

/** A result shape whose comparison shows the tool output on failure. */
const outcome = (result: RunResult): { passed: boolean; output: string } => ({
  passed: result.status === 0,
  output: result.output,
});
const PASSED = { passed: true, output: expect.any(String) };
const depcruise = (outputType = 'err-long', cwd = probeRoot): RunResult =>
  run(
    'depcruise',
    ['packages', 'apps', '--config', '.dependency-cruiser.cjs', '--output-type', outputType],
    cwd
  );

/** Probe files whose `export … from` would make them a barrel. */
const ENTRY_FILES = new Set([`${CORE}/index.ts`, `${CLI}/lib.ts`, `${CLI}/api.ts`]);

/** [reexport-entry-only]: every src/ file that re-exports must be an entry. */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  );
}

function reexportViolations(root = REPO_ROOT): string[] {
  const roots = ['packages', 'apps'].flatMap((group) =>
    readdirSync(join(root, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(root, group, entry.name, 'src'))
      .filter((src) => existsSync(src))
  );
  return roots
    .flatMap(walk)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => relative(root, file).replaceAll('\\', '/'))
    .filter((file) => !ENTRY_FILES.has(file))
    .filter((file) =>
      /export\s+(type\s+)?(\*|\{[^}]*\})\s*from\s/s.test(readFileSync(join(root, file), 'utf8'))
    );
}

interface ForbiddenCase {
  tag: string;
  files: () => string[];
  /** Tools that own the rule; each must fail and print the tag. */
  tools: ('oxlint' | 'depcruise')[];
}

const FORBIDDEN: [string, ForbiddenCase][] = [
  [
    'schemas/ importing a service',
    {
      tag: 'schema-is-leaf',
      tools: ['oxlint', 'depcruise'],
      files: () => [
        probe(
          `${CORE}/schemas/__boundary-probe-leaf.ts`,
          "import { createProjectsService } from '../services/projects.service.js';\nexport const probe: unknown = createProjectsService;\n"
        ),
      ],
    },
  ],
  [
    'repositories/ importing a service',
    {
      tag: 'repository-no-service',
      tools: ['oxlint', 'depcruise'],
      files: () => [
        probe(
          `${CORE}/repositories/__boundary-probe-service.ts`,
          "import { DEFAULT_LIMIT } from '../services/projects.service.js';\nexport const probe: unknown = DEFAULT_LIMIT;\n"
        ),
      ],
    },
  ],
  [
    'services/ importing a concrete repository',
    {
      tag: 'service-no-concrete-repository',
      tools: ['oxlint', 'depcruise'],
      files: () => [
        probe(
          `${CORE}/services/__boundary-probe-concrete.ts`,
          "import { createHttpProjectsRepository } from '../repositories/http-projects.repository.js';\nexport const probe: unknown = createHttpProjectsRepository;\n"
        ),
      ],
    },
  ],
  [
    'services/ with a value import from the repository interface',
    {
      tag: 'service-type-only-repository',
      tools: ['depcruise'],
      files: () => [
        probe(
          `${CORE}/services/__boundary-probe-value.ts`,
          "import * as repository from '../repositories/projects.repository.js';\nexport const probe: unknown = repository;\n"
        ),
      ],
    },
  ],
  [
    'core importing a concrete repository outside composition.ts',
    {
      tag: 'concrete-repository-in-composition-only',
      tools: ['depcruise'],
      files: () => [
        probe(
          `${CORE}/__boundary-probe-wiring.ts`,
          "import { createInMemoryProjectsRepository } from './repositories/in-memory-projects.repository.js';\nexport const probe: unknown = createInMemoryProjectsRepository;\n"
        ),
      ],
    },
  ],
  [
    'core importing commander',
    {
      tag: 'core-no-framework-import',
      tools: ['oxlint', 'depcruise'],
      files: () => [
        probe(
          `${CORE}/__boundary-probe-framework.ts`,
          "import { Command } from 'commander';\nexport const probe: unknown = Command;\n"
        ),
      ],
    },
  ],
  [
    'core importing an observability library (@opentelemetry/api)',
    {
      tag: 'core-no-framework-import',
      tools: ['oxlint', 'depcruise'],
      files: () => [
        probe(
          `${CORE}/__boundary-probe-observability.ts`,
          "import { trace } from '@opentelemetry/api';\nexport const probe: unknown = trace;\n"
        ),
      ],
    },
  ],
  [
    'core importing from apps/cli/src',
    {
      tag: 'core-no-app-import',
      tools: ['oxlint', 'depcruise'],
      files: () => [
        probe(
          `${CORE}/__boundary-probe-app.ts`,
          "import { runCli } from '../../../apps/cli/src/cli/router.js';\nexport const probe: unknown = runCli;\n"
        ),
      ],
    },
  ],
  [
    'apps/cli importing the core by a relative path',
    {
      tag: 'app-core-entry-only',
      tools: ['oxlint', 'depcruise'],
      files: () => [
        probe(
          `${CLI}/__boundary-probe-relative.ts`,
          "import { createCore } from '../../../packages/core/src/index.js';\nexport const probe: unknown = createCore;\n"
        ),
      ],
    },
  ],
  [
    'apps/cli importing a core subpath',
    {
      tag: 'app-core-entry-only',
      tools: ['oxlint', 'depcruise'],
      files: () => [
        probe(
          `${CLI}/__boundary-probe-subpath.ts`,
          "import { createCore } from 'ts-launch-blueprint-core/src/composition.js';\nexport const probe: unknown = createCore;\n"
        ),
      ],
    },
  ],
  [
    'apps/api importing a service factory instead of using createCore',
    {
      tag: 'api-core-via-create-core',
      tools: ['oxlint'],
      files: () => [
        // cspell:ignore createservice
        probe(
          `${API}/__boundary-probe-createservice.ts`,
          "import { createProjectsService } from 'ts-launch-blueprint-core';\nexport const probe: unknown = createProjectsService;\n"
        ),
      ],
    },
  ],
  [
    'apps/api importing the core by a relative path (the API override keeps the rule)',
    {
      tag: 'app-core-entry-only',
      tools: ['oxlint', 'depcruise'],
      files: () => [
        probe(
          `${API}/__boundary-probe-relative.ts`,
          "import { createCore } from '../../../packages/core/src/index.js';\nexport const probe: unknown = createCore;\n"
        ),
      ],
    },
  ],
  [
    'one app importing another app',
    {
      tag: 'app-no-cross-app-import',
      tools: ['depcruise'],
      files: () => [
        probe(
          `${PROBE_APP}/src/__boundary-probe-cross.ts`,
          "import { runCli } from '../../cli/src/cli/router.js';\nexport const probe: unknown = runCli;\n"
        ),
      ],
    },
  ],
  [
    'apps/web with a value import of the API router',
    {
      tag: 'web-types-only-from-api',
      tools: ['oxlint', 'depcruise'],
      files: () => [
        probe(
          `${WEB}/__boundary-probe-router-value.ts`,
          "import { appRouter } from '@ts-launch-blueprint/api/router';\nexport const probe: unknown = appRouter;\n"
        ),
      ],
    },
  ],
  [
    'apps/web importing another API file (apps/api/src/app.ts)',
    {
      tag: 'web-types-only-from-api',
      tools: ['oxlint', 'depcruise'],
      files: () => [
        probe(
          `${WEB}/__boundary-probe-api-file.ts`,
          "import { createApp } from '../../api/src/app.js';\nexport const probe: unknown = createApp;\n"
        ),
      ],
    },
  ],
  [
    'apps/cli importing the API (even its router type)',
    {
      tag: 'app-no-cross-app-import',
      tools: ['depcruise'],
      files: () => [
        probe(
          `${CLI}/__boundary-probe-api.ts`,
          "import type { AppRouter } from '../../api/src/router.js';\nexport type Probe = AppRouter;\n"
        ),
      ],
    },
  ],
  [
    'a two-file cycle',
    {
      tag: 'no-cycle',
      tools: ['depcruise'],
      files: () => [
        probe(
          `${CORE}/__boundary-probe-cycle-a.ts`,
          "import { b } from './__boundary-probe-cycle-b.js';\nexport const a: unknown = b;\n"
        ),
        probe(
          `${CORE}/__boundary-probe-cycle-b.ts`,
          "import { a } from './__boundary-probe-cycle-a.js';\nexport const b: unknown = a;\n"
        ),
      ],
    },
  ],
];

describe.sequential('architecture boundaries (D-042)', () => {
  it(
    'sanity: the untouched repo passes oxlint and dependency-cruiser',
    () => {
      expect(outcome(oxlint([], REPO_ROOT))).toEqual(PASSED);
      expect(outcome(depcruise('err-long', REPO_ROOT))).toEqual(PASSED);
      expect(reexportViolations(REPO_ROOT)).toEqual([]);
    },
    TIMEOUT_MS
  );

  it(
    'sanity: dependency-cruiser really parses TypeScript (guards a silent parser failure)',
    () => {
      // With TypeScript 7 the default parser sees no .ts files yet exits 0;
      // the swc parser must find the whole graph and the type-only edges.
      const result = depcruise('json', REPO_ROOT);
      expect(result.status).toBe(0);
      const graph = JSON.parse(result.output.slice(result.output.indexOf('{'))) as {
        modules: {
          source: string;
          dependencies: { resolved: string; dependencyTypes: string[] }[];
        }[];
      };
      const sources = graph.modules.map((module) => module.source);
      expect(sources).toContain(`${CORE}/services/projects.service.ts`);
      expect(sources).toContain(`${CLI}/cli/router.ts`);
      const service = graph.modules.find(
        (module) => module.source === `${CORE}/services/projects.service.ts`
      );
      const toInterface = service?.dependencies.find(
        (dependency) => dependency.resolved === `${CORE}/repositories/projects.repository.ts`
      );
      expect(toInterface?.dependencyTypes).toContain('type-only');
      // .tsx is parsed, and the web app's AppRouter import resolves (the
      // 'types' condition) as a type-only edge to the API router.
      expect(sources).toContain(`${WEB}/App.tsx`);
      const client = graph.modules.find((module) => module.source === `${WEB}/trpc.ts`);
      const toRouter = client?.dependencies.find(
        (dependency) => dependency.resolved === `${API}/router.ts`
      );
      expect(toRouter?.dependencyTypes).toContain('type-only');
    },
    TIMEOUT_MS
  );

  describe.sequential('forbidden imports fail with their tag', () => {
    for (const [label, { tag, files, tools }] of FORBIDDEN) {
      it(
        `[${tag}] ${label}`,
        () => {
          try {
            const paths = files();
            const results = tools.map((tool) => ({
              tool,
              ...outcome(tool === 'oxlint' ? oxlint(paths) : depcruise()),
            }));
            expect(results).toEqual(
              tools.map((tool) => ({
                tool,
                passed: false,
                output: expect.stringContaining(`[${tag}]`),
              }))
            );
          } finally {
            removeProbes();
          }
        },
        TIMEOUT_MS
      );
    }

    it(
      '[no-cycle] oxlint import/no-cycle also fails a two-file cycle (no tag: fixed message)',
      () => {
        try {
          const a = probe(
            `${CORE}/__boundary-probe-cycle-a.ts`,
            "import { b } from './__boundary-probe-cycle-b.js';\nexport const a: unknown = b;\n"
          );
          const b = probe(
            `${CORE}/__boundary-probe-cycle-b.ts`,
            "import { a } from './__boundary-probe-cycle-a.js';\nexport const b: unknown = a;\n"
          );
          expect(outcome(oxlint([a, b]))).toEqual({
            passed: false,
            output: expect.stringContaining('no-cycle'),
          });
        } finally {
          removeProbes();
        }
      },
      TIMEOUT_MS
    );

    it('[reexport-entry-only] a folder barrel is caught by the source scan', () => {
      try {
        const barrel = probe(
          `${CORE}/services/__boundary-probe-barrel.ts`,
          "export { createProjectsService } from './projects.service.js';\n"
        );
        expect(reexportViolations(probeRoot)).toEqual([barrel]);
      } finally {
        removeProbes();
      }
    });
  });

  describe.sequential('allowed imports pass', () => {
    it(
      'a service with `import type` from the repository interface',
      () => {
        try {
          const path = probe(
            `${CORE}/services/__boundary-probe-allowed.ts`,
            "import type { ProjectsRepository } from '../repositories/projects.repository.js';\nexport type Probe = ProjectsRepository;\n"
          );
          expect(outcome(oxlint([path]))).toEqual(PASSED);
          expect(outcome(depcruise())).toEqual(PASSED);
        } finally {
          removeProbes();
        }
      },
      TIMEOUT_MS
    );

    it(
      'apps/cli importing ts-launch-blueprint-core',
      () => {
        try {
          const path = probe(
            `${CLI}/__boundary-probe-allowed.ts`,
            "import { createCore } from 'ts-launch-blueprint-core';\nexport const probe: unknown = createCore;\n"
          );
          expect(outcome(oxlint([path]))).toEqual(PASSED);
          expect(outcome(depcruise())).toEqual(PASSED);
        } finally {
          removeProbes();
        }
      },
      TIMEOUT_MS
    );

    it(
      'apps/api importing createCore from ts-launch-blueprint-core',
      () => {
        try {
          const path = probe(
            `${API}/__boundary-probe-allowed.ts`,
            "import { createCore, NotFoundError } from 'ts-launch-blueprint-core';\nexport const probe: unknown = [createCore, NotFoundError];\n"
          );
          expect(outcome(oxlint([path]))).toEqual(PASSED);
          expect(outcome(depcruise())).toEqual(PASSED);
        } finally {
          removeProbes();
        }
      },
      TIMEOUT_MS
    );

    it(
      'apps/web with `import type { AppRouter }` from the API router, and its own modules',
      () => {
        try {
          const path = probe(
            `${WEB}/__boundary-probe-allowed.ts`,
            "import type { AppRouter } from '@ts-launch-blueprint/api/router';\n\nimport { apiBaseUrl } from './config.js';\n\nexport type Probe = AppRouter;\nexport const probe: unknown = apiBaseUrl;\n"
          );
          expect(outcome(oxlint([path]))).toEqual(PASSED);
          expect(outcome(depcruise())).toEqual(PASSED);
        } finally {
          removeProbes();
        }
      },
      TIMEOUT_MS
    );

    it('composition.ts-style wiring: the real composition root passes (covered by sanity)', () => {
      // composition.ts and index.ts are the only core files allowed to import
      // concrete repositories; the untouched-repo sanity run proves it.
      const source = readFileSync(join(REPO_ROOT, CORE, 'composition.ts'), 'utf8');
      expect(source).toContain('createHttpProjectsRepository');
      expect(source).toContain('createInMemoryProjectsRepository');
    });
  });
});
