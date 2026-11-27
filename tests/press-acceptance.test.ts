// Live template-press acceptance test (blueprint-only; [[remove]]d in stamped
// child repositories so they do not recurse).
//
// Run explicitly:
//   PRESS_ACCEPTANCE=1 pnpm exec vitest run tests/press-acceptance.test.ts
// Optionally point at a local template-press checkout:
//   PRESS_ACCEPTANCE=1 TEMPLATE_PRESS_PROJECT=/path/to/template-press \
//     pnpm exec vitest run tests/press-acceptance.test.ts
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const RUN_ACCEPTANCE = process.env['PRESS_ACCEPTANCE'] === '1';
const TEMPLATE_PRESS_COMMIT = '04769b24b7b5665d8932cac3a6c1ac876b8a98bb';

const DEST_IDENTITY = {
  package_name: 'harbor_sample',
  repo_name: 'harbor-sample',
  app_name: 'harbor_cli',
  author: 'Example Maintainer',
  email: 'maintainer@example.org',
  owner: 'example-labs',
  display_name: 'Harbor Sample',
  cli_name: 'harbor-cli',
} as const;

function runOrThrow(cmd: string, args: string[], cwd: string): string {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    timeout: 240_000,
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `Command failed (${result.status}): ${cmd} ${args.join(' ')}\n` +
        `cwd: ${cwd}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }
  return result.stdout;
}

function pressCommand(): [string, string[]] {
  const localProject = process.env['TEMPLATE_PRESS_PROJECT'];
  if (localProject) {
    return ['uv', ['run', '--project', localProject, 'press']];
  }
  return [
    'uvx',
    [
      '--from',
      `git+https://github.com/smorinlabs/template-press@${TEMPLATE_PRESS_COMMIT}`,
      'press',
    ],
  ];
}

function collectFiles(dir: string, relBase = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(abs, rel));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

/** Copy tracked and unignored working-tree files into a fresh git repo. */
function copyWorkingTreeToTempRepo(targetDir: string): void {
  const listed = runOrThrow(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    REPO_ROOT
  );
  for (const rel of listed.split('\0')) {
    if (!rel) continue;
    const src = join(REPO_ROOT, rel);
    if (!existsSync(src)) continue;
    const dst = join(targetDir, rel);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src, dst, { verbatimSymlinks: true });
  }
  runOrThrow('git', ['init', '-q', '--initial-branch=main'], targetDir);
  runOrThrow('git', ['config', 'user.name', 'Press Acceptance'], targetDir);
  runOrThrow('git', ['config', 'user.email', 'acceptance@example.org'], targetDir);
  runOrThrow('git', ['add', '--all'], targetDir);
  runOrThrow('git', ['commit', '-q', '-m', 'test: seed template copy'], targetDir);
  runOrThrow(
    'git',
    [
      'remote',
      'add',
      'origin',
      `https://github.com/${DEST_IDENTITY.owner}/${DEST_IDENTITY.repo_name}.git`,
    ],
    targetDir
  );
}

describe.skipIf(!RUN_ACCEPTANCE)('live template-press acceptance', () => {
  it('stamps a child repo cleanly, preserves difftree-pr-comment.yml intact, and passes child gates', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'ts-press-acceptance-'));
    const target = join(scratch, DEST_IDENTITY.repo_name);
    mkdirSync(target, { recursive: true });

    try {
      copyWorkingTreeToTempRepo(target);

      const answersPath = join(scratch, 'press-answers.toml');
      const answersLines = [
        '[answers]',
        ...Object.entries(DEST_IDENTITY).map(([k, v]) => `${k} = ${JSON.stringify(v)}`),
      ];
      writeFileSync(answersPath, `${answersLines.join('\n')}\n`, 'utf8');

      const [pressBin, pressBaseArgs] = pressCommand();
      const runPress = (args: string[]): string =>
        runOrThrow(pressBin, [...pressBaseArgs, ...args], target);

      // 1. Tool check, dry-run (leaves tree clean), then real rebrand.
      runPress(['check-tools', '--target', '.']);
      runPress(['rebrand', '--target', '.', '--config', answersPath, '--dry-run']);
      expect(runOrThrow('git', ['status', '--porcelain'], target).trim()).toBe('');
      runPress(['rebrand', '--target', '.', '--config', answersPath]);

      // 2. Receipt and refreshed press-source.toml.
      const receipt = readFileSync(join(target, 'press', 'press-receipt.toml'), 'utf8');
      expect(receipt).toContain('verified = true');
      expect(receipt).toContain('"smorinlabs/difftree-action"');
      expect(receipt).toContain('"smorinlabs/template-press"');

      const refreshedSource = readFileSync(join(target, 'press', 'press-source.toml'), 'utf8');
      expect(refreshedSource).toContain(`repo_name = "${DEST_IDENTITY.repo_name}"`);
      expect(refreshedSource).toContain(`cli_name = "${DEST_IDENTITY.cli_name}"`);

      // 3. CRITICAL: difftree-pr-comment.yml survives byte-for-byte intact.
      const sourceDifftree = readFileSync(
        join(REPO_ROOT, '.github', 'workflows', 'difftree-pr-comment.yml'),
        'utf8'
      );
      const childDifftree = readFileSync(
        join(target, '.github', 'workflows', 'difftree-pr-comment.yml'),
        'utf8'
      );
      expect(childDifftree).toBe(sourceDifftree);
      expect(childDifftree).toContain('uses: smorinlabs/difftree-action@');

      // 4. press-verify.yml ships intact; template-only files are removed.
      expect(
        readFileSync(join(target, '.github', 'workflows', 'press-verify.yml'), 'utf8')
      ).toContain('smorinlabs/template-press');

      for (const removed of [
        '.github/workflows/template-receipt-guard.yml',
        '.github/workflows/update-contributors.yml',
        '.contributors.yml',
        'CONTRIBUTORS.md',
        'tests/contributors-automation.test.ts',
        'tests/press-acceptance.test.ts',
        'docs/port',
        'projects',
        'assets/images/logos',
      ]) {
        expect(existsSync(join(target, removed)), `expected removed: ${removed}`).toBe(false);
      }

      // .project-harness config ships intact into stamped child repositories.
      expect(
        readFileSync(join(target, '.project-harness', 'project-harness.config.json'), 'utf8')
      ).toBe(
        readFileSync(join(REPO_ROOT, '.project-harness', 'project-harness.config.json'), 'utf8')
      );

      // 5. Resets and aligned 0.1.0 version surface.
      const rootPkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')) as {
        name: string;
        version: string;
      };
      const cliPkg = JSON.parse(readFileSync(join(target, 'apps/cli/package.json'), 'utf8')) as {
        name: string;
        version: string;
        bin: Record<string, string>;
      };
      const corePkg = JSON.parse(
        readFileSync(join(target, 'packages/core/package.json'), 'utf8')
      ) as { name: string };
      const apiPkg = JSON.parse(readFileSync(join(target, 'apps/api/package.json'), 'utf8')) as {
        name: string;
      };
      const manifest = JSON.parse(
        readFileSync(join(target, '.release-please-manifest.json'), 'utf8')
      ) as Record<string, string>;

      expect(rootPkg.name).toBe(`${DEST_IDENTITY.repo_name}-workspace`);
      expect(rootPkg.version).toBe('0.1.0');
      expect(cliPkg.name).toBe(DEST_IDENTITY.repo_name);
      expect(cliPkg.version).toBe('0.1.0');
      expect(cliPkg.bin).toEqual({ [DEST_IDENTITY.cli_name]: 'dist/cli.js' });
      expect(corePkg.name).toBe(`@${DEST_IDENTITY.repo_name}/core`);
      expect(apiPkg.name).toBe(`@${DEST_IDENTITY.repo_name}/api`);
      expect(manifest['.']).toBe('0.1.0');
      expect(readFileSync(join(target, 'CHANGELOG.md'), 'utf8')).toBe('# Changelog\n');

      for (const [page, stub] of [
        ['README.md', 'press/stubs/readme.md'],
        ['PROJECTS.md', 'press/stubs/projects.md'],
        ['docs/about/index.md', 'press/stubs/about-index.md'],
        ['docs/about/philosophy.md', 'press/stubs/project-philosophy.md'],
        ['docs/tutorials/full-project-setup.md', 'press/stubs/application-setup.md'],
      ] as const) {
        expect(readFileSync(join(target, page), 'utf8')).toBe(
          readFileSync(join(target, stub), 'utf8')
        );
      }

      // 6. Regenerated lockfile carries the new workspace scope and no source identity.
      const lockfile = readFileSync(join(target, 'pnpm-lock.yaml'), 'utf8');
      expect(lockfile).toContain(`@${DEST_IDENTITY.repo_name}/core`);
      expect(lockfile).not.toContain('ts-launch-blueprint');

      // 7. No stray source identity outside press/press-receipt.toml and kept external repos.
      const forbiddenTokens = [
        'ts-launch-blueprint',
        'ts_launch_blueprint',
        'ts-projects',
        'TS_PROJECTS',
        'TS Launch Blueprint',
      ];
      const leaks: string[] = [];
      for (const rel of collectFiles(target)) {
        if (rel === 'press/press-receipt.toml') continue;
        const text = readFileSync(join(target, rel), 'utf8');
        for (const token of forbiddenTokens) {
          if (text.includes(token)) {
            leaks.push(`${rel} contains ${token}`);
          }
        }
      }
      expect(leaks).toEqual([]);

      // 8. Child repository installs from its regenerated lockfile, formats,
      // passes every quality gate, docs-check, build, CLI --version, and press verify!
      runOrThrow('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], target);
      runOrThrow('pnpm', ['exec', 'oxfmt'], target);
      runOrThrow('git', ['add', '--all'], target);
      runOrThrow('git', ['commit', '-q', '-m', 'feat: initialize application'], target);
      runOrThrow('just', ['all'], target);
      runOrThrow('just', ['docs-check'], target);
      runOrThrow('just', ['build'], target);
      expect(runOrThrow('just', ['version'], target).trim()).toBe(
        `${DEST_IDENTITY.cli_name} 0.1.0`
      );
      runPress(['verify', '--target', '.']);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 300_000);
});
