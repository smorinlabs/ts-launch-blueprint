// Proof that the architecture boundary rules (D-042) are enforced: each case
// writes a small probe file into the real folder, runs the real tool on the
// real config, checks the result, and always removes the probe. Rules and
// tags: docs/reference/boundary-rules.md.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const BIN = join(REPO_ROOT, 'node_modules', '.bin');
const CORE = 'packages/core/src';
const CLI = 'apps/cli/src';
const PROBE_APP = 'apps/__boundary-probe-app';
const TIMEOUT_MS = 30_000;

/** Files (and the probe app folder) written by the current case. */
const written: string[] = [];

function probe(path: string, content: string): string {
  const absolute = join(REPO_ROOT, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
  written.push(absolute);
  return path;
}

function removeProbes(): void {
  for (const path of written.splice(0)) {
    rmSync(path, { force: true });
  }
  rmSync(join(REPO_ROOT, PROBE_APP), { recursive: true, force: true });
}

afterEach(removeProbes);

interface RunResult {
  status: number | null;
  output: string;
}

function run(bin: string, args: string[]): RunResult {
  const result = spawnSync(join(BIN, bin), args, { cwd: REPO_ROOT, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const oxlint = (files: string[]): RunResult => run('oxlint', files);

/** A result shape whose comparison shows the tool output on failure. */
const outcome = (result: RunResult): { passed: boolean; output: string } => ({
  passed: result.status === 0,
  output: result.output,
});
const PASSED = { passed: true, output: expect.any(String) };
const depcruise = (outputType = 'err-long'): RunResult =>
  run('depcruise', [
    'packages',
    'apps',
    '--config',
    '.dependency-cruiser.cjs',
    '--output-type',
    outputType,
  ]);

/** Probe files whose `export … from` would make them a barrel. */
const ENTRY_FILES = new Set([`${CORE}/index.ts`, `${CLI}/lib.ts`, `${CLI}/api.ts`]);

/** [reexport-entry-only]: every src/ file that re-exports must be an entry. */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  );
}

function reexportViolations(): string[] {
  const roots = ['packages', 'apps'].flatMap((group) =>
    readdirSync(join(REPO_ROOT, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(REPO_ROOT, group, entry.name, 'src'))
      .filter((src) => existsSync(src))
  );
  return roots
    .flatMap(walk)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => relative(REPO_ROOT, file))
    .filter((file) => !ENTRY_FILES.has(file))
    .filter((file) =>
      /export\s+(type\s+)?(\*|\{[^}]*\})\s*from\s/s.test(
        readFileSync(join(REPO_ROOT, file), 'utf8')
      )
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
          "import { createCore } from '@ts-launch-blueprint/core/src/composition.js';\nexport const probe: unknown = createCore;\n"
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
      expect(outcome(oxlint([]))).toEqual(PASSED);
      expect(outcome(depcruise())).toEqual(PASSED);
      expect(reexportViolations()).toEqual([]);
    },
    TIMEOUT_MS
  );

  it(
    'sanity: dependency-cruiser really parses TypeScript (guards a silent parser failure)',
    () => {
      // With TypeScript 7 the default parser sees no .ts files yet exits 0;
      // the swc parser must find the whole graph and the type-only edges.
      const result = depcruise('json');
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
        expect(reexportViolations()).toEqual([barrel]);
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
      'apps/cli importing @ts-launch-blueprint/core',
      () => {
        try {
          const path = probe(
            `${CLI}/__boundary-probe-allowed.ts`,
            "import { createCore } from '@ts-launch-blueprint/core';\nexport const probe: unknown = createCore;\n"
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
