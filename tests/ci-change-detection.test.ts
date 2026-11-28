// Tests the CI `changes` path-detector script in `.github/workflows/ci.yml`
// by executing it in bash inside synthetic temporary git repositories.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const REPOSITORY = 'owner/repo';
const RELEASE_BRANCH = 'release-please--branches--main--components--pkg';

const BASE_ROOT_PKG = JSON.stringify(
  {
    name: 'pkg-workspace',
    version: '1.0.0',
    private: true,
    devDependencies: { vitest: '^4.0.0' },
  },
  null,
  2
);

const BASE_CORE_PKG = JSON.stringify(
  {
    name: 'pkg-core',
    version: '1.0.0',
    dependencies: { zod: '^4.0.0' },
  },
  null,
  2
);

const BASE_CLI_PKG = JSON.stringify(
  {
    name: 'pkg',
    version: '1.0.0',
    dependencies: { commander: '^15.0.0' },
  },
  null,
  2
);

const BASE_FILES: Record<string, string> = {
  '.release-please-manifest.json': '{\n  ".": "1.0.0"\n}\n',
  'CHANGELOG.md': '# Changelog\n',
  'package.json': `${BASE_ROOT_PKG}\n`,
  'packages/core/package.json': `${BASE_CORE_PKG}\n`,
  'packages/core/README.md': '# Core\n',
  'apps/cli/package.json': `${BASE_CLI_PKG}\n`,
  'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
  'packages/core/src/index.ts': 'export const version = 1;\n',
  'docs/index.md': '# Docs\n',
  'README.md': '# Project\n',
  '.contributors.jsonl': '{"login":"alice"}\n',
};

const RELEASE_BUMP: Record<string, string> = {
  '.release-please-manifest.json': '{\n  ".": "1.1.0"\n}\n',
  'CHANGELOG.md': '# Changelog\n\n## 1.1.0\n\n- feat: thing\n',
  'package.json': `${BASE_ROOT_PKG.replace('"1.0.0"', '"1.1.0"')}\n`,
  'packages/core/package.json': `${BASE_CORE_PKG.replace('"1.0.0"', '"1.1.0"')}\n`,
  'apps/cli/package.json': `${BASE_CLI_PKG.replace('"1.0.0"', '"1.1.0"')}\n`,
};

function getDetectScript(): string {
  const ci = parse(readFileSync(join(REPO_ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')) as {
    jobs?: Record<string, { steps?: Array<{ id?: string; run?: string }> }>;
  };
  const changesJob = ci.jobs?.['changes'];
  if (!changesJob?.steps) {
    throw new Error('ci.yml is missing jobs.changes.steps');
  }
  const detect = changesJob.steps.find((step) => step.id === 'detect');
  if (!detect?.run) {
    throw new Error('ci.yml is missing jobs.changes.steps[id=detect].run');
  }
  return detect.run;
}

function git(repo: string, ...args: string[]): string {
  const result = spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd: repo,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed (${result.status}): ${result.stderr}`);
  }
  return result.stdout.trim();
}

function writeFiles(repo: string, files: Record<string, string>): void {
  for (const [name, content] of Object.entries(files)) {
    const filePath = join(repo, name);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf8');
  }
}

interface RunOptions {
  event?: string;
  headRef?: string;
  headRepo?: string;
  baseFiles?: Record<string, string>;
  mutate?: (repo: string) => void;
}

function runDetect(
  change: Record<string, string>,
  options: RunOptions = {}
): Record<string, string> {
  const event = options.event ?? 'pull_request';
  const headRef = options.headRef ?? 'feature';
  const headRepo = options.headRepo ?? REPOSITORY;

  const scratch = mkdtempSync(join(tmpdir(), 'ts-ci-changes-'));
  try {
    const repo = join(scratch, 'repo');
    mkdirSync(repo);
    git(repo, 'init', '-q', '-b', 'main');
    git(repo, 'config', 'user.email', 'ci@example.invalid');
    git(repo, 'config', 'user.name', 'ci');
    writeFiles(repo, { ...BASE_FILES, ...options.baseFiles });
    git(repo, 'add', '-A');
    git(repo, 'commit', '-qm', 'base');
    const baseSha = git(repo, 'rev-parse', 'HEAD');

    writeFiles(repo, change);
    options.mutate?.(repo);
    git(repo, 'add', '-A');
    git(repo, 'commit', '-qm', 'change');

    const outputFile = join(scratch, 'output');
    writeFileSync(outputFile, '', 'utf8');

    const result = spawnSync('bash', ['-c', getDetectScript()], {
      cwd: repo,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...process.env,
        GITHUB_OUTPUT: outputFile,
        EVENT_NAME: event,
        BASE_SHA: event === 'pull_request' ? baseSha : '',
        HEAD_REF: event === 'pull_request' ? headRef : '',
        HEAD_REPO: event === 'pull_request' ? headRepo : '',
        REPOSITORY,
      },
    });
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);

    const pairs: Record<string, string> = {};
    for (const line of readFileSync(outputFile, 'utf8').trim().split('\n')) {
      if (!line) continue;
      const idx = line.indexOf('=');
      pairs[line.slice(0, idx)] = line.slice(idx + 1);
    }
    return pairs;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

describe.skipIf(process.platform === 'win32')('CI changes path detector', () => {
  it('push event on docs runs everything', () => {
    expect(runDetect({ 'docs/index.md': '# Updated\n' }, { event: 'push' })).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('merge_group event on docs runs everything', () => {
    expect(runDetect({ 'docs/index.md': '# Updated\n' }, { event: 'merge_group' })).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('docs-only pull request skips heavy jobs', () => {
    expect(
      runDetect({
        'docs/index.md': '# Updated\n',
        'CHANGELOG.md': '# Changelog\n\n- docs\n',
        '.contributors.jsonl': '{"login":"alice"}\n{"login":"bob"}\n',
        '.vscode/settings.json': '{}\n',
        'assets/logo.svg': '<svg/>\n',
        '.github/ISSUE_TEMPLATE/bug.yml': 'name: Bug\n',
        LICENSE: 'MIT\n',
      })
    ).toEqual({
      code: 'false',
      release: 'false',
      web: 'false',
    });
  });

  it('README.md-only pull request is treated as code (packaging input) without web E2E', () => {
    expect(runDetect({ 'README.md': '# Updated README\n' })).toEqual({
      code: 'true',
      release: 'false',
      web: 'false',
    });
  });

  it('packages/core/README.md-only pull request is treated as code (core packaging input)', () => {
    expect(runDetect({ 'packages/core/README.md': '# Updated Core README\n' })).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('code pull request touching packages/core runs code and web E2E jobs', () => {
    expect(runDetect({ 'packages/core/src/index.ts': 'export const version = 2;\n' })).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('apps/web pull request runs code and web E2E jobs', () => {
    expect(runDetect({ 'apps/web/src/App.tsx': 'export const App = () => null;\n' })).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('apps/api pull request runs code and web E2E jobs', () => {
    expect(runDetect({ 'apps/api/src/app.ts': 'export const app = null;\n' })).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('apps/cli-only pull request runs code jobs but skips web E2E', () => {
    expect(runDetect({ 'apps/cli/src/cli.ts': 'export const cli = true;\n' })).toEqual({
      code: 'true',
      release: 'false',
      web: 'false',
    });
  });

  it('manifest/tsconfig pull request runs code and web E2E jobs', () => {
    expect(runDetect({ 'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n" })).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
    expect(runDetect({ 'tsconfig.json': '{}\n' })).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('renaming a source file into docs/ is treated as a code change', () => {
    const sourceLines = Array.from({ length: 20 }, (_, i) => `export const line${i} = ${i};`).join(
      '\n'
    );
    expect(
      runDetect(
        {},
        {
          baseFiles: { 'packages/core/src/mod.ts': `${sourceLines}\n` },
          mutate: (repo) => {
            git(repo, 'mv', 'packages/core/src/mod.ts', 'docs/renamed.md');
          },
        }
      )
    ).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('verified release-please version bump takes the release fast path', () => {
    expect(runDetect(RELEASE_BUMP, { headRef: RELEASE_BRANCH })).toEqual({
      code: 'false',
      release: 'true',
      web: 'false',
    });
  });

  it('release-named branch touching source runs everything', () => {
    expect(
      runDetect(
        { ...RELEASE_BUMP, 'packages/core/src/index.ts': 'export const version = 2;\n' },
        { headRef: RELEASE_BRANCH }
      )
    ).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('release-named branch with dependency change in root package.json runs everything', () => {
    expect(
      runDetect(
        {
          ...RELEASE_BUMP,
          'package.json': RELEASE_BUMP['package.json']!.replace('^4.0.0', '^4.1.0'),
        },
        { headRef: RELEASE_BRANCH }
      )
    ).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('release-named branch with dependency change in packages/core/package.json runs everything', () => {
    expect(
      runDetect(
        {
          ...RELEASE_BUMP,
          'packages/core/package.json': RELEASE_BUMP['packages/core/package.json']!.replace(
            '^4.0.0',
            '^4.1.0'
          ),
        },
        { headRef: RELEASE_BRANCH }
      )
    ).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('release-named branch with dependency change in apps/cli/package.json runs everything', () => {
    expect(
      runDetect(
        {
          ...RELEASE_BUMP,
          'apps/cli/package.json': RELEASE_BUMP['apps/cli/package.json']!.replace(
            '^15.0.0',
            '^16.0.0'
          ),
        },
        { headRef: RELEASE_BRANCH }
      )
    ).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('release-named branch touching pnpm-lock.yaml runs everything', () => {
    expect(
      runDetect(
        { ...RELEASE_BUMP, 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n# updated\n" },
        { headRef: RELEASE_BRANCH }
      )
    ).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('large non-version edit on release branch runs everything (no SIGPIPE bug under pipefail)', () => {
    const filler = Array.from({ length: 20_000 }, (_, i) => `    "k${i}": "${i}"`).join(',\n');
    const largePkg = `${RELEASE_BUMP['package.json']!.slice(0, -2)},\n  "extra": {\n${filler}\n  }\n}\n`;
    expect(
      runDetect({ ...RELEASE_BUMP, 'package.json': largePkg }, { headRef: RELEASE_BRANCH })
    ).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('large code diff is not misclassified as docs-only', () => {
    const change: Record<string, string> = { 'docs/index.md': '# Updated\n' };
    for (let i = 0; i < 3000; i += 1) {
      change[`packages/core/src/mod_${i}.ts`] = 'export const x = 1;\n';
    }
    expect(runDetect(change)).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('release branch adding an extra key to .release-please-manifest.json runs everything', () => {
    expect(
      runDetect(
        {
          ...RELEASE_BUMP,
          '.release-please-manifest.json': '{\n  ".": "1.1.0",\n  "extra": "1.0.0"\n}\n',
        },
        { headRef: RELEASE_BRANCH }
      )
    ).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('release bump from a fork runs everything', () => {
    expect(runDetect(RELEASE_BUMP, { headRef: RELEASE_BRANCH, headRepo: 'fork/repo' })).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('release bump on an ordinary branch runs everything', () => {
    expect(runDetect(RELEASE_BUMP, { headRef: 'feature/bump' })).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });

  it('release-named branch without a version change runs everything', () => {
    expect(
      runDetect(
        { 'package.json': `${BASE_ROOT_PKG.replace('true', 'false')}\n` },
        { headRef: RELEASE_BRANCH }
      )
    ).toEqual({
      code: 'true',
      release: 'false',
      web: 'true',
    });
  });
});
