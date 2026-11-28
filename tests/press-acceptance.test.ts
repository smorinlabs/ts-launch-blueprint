// Live template-press acceptance test (blueprint-only; [[remove]]d in stamped
// child repositories so they do not recurse).
//
// Run explicitly:
//   PRESS_ACCEPTANCE=1 pnpm exec vitest run tests/press-acceptance.test.ts
// Optionally point at a local template-press checkout:
//   PRESS_ACCEPTANCE=1 TEMPLATE_PRESS_PROJECT=/path/to/template-press \
//     pnpm exec vitest run tests/press-acceptance.test.ts
import { spawn, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const RUN_ACCEPTANCE = process.env['PRESS_ACCEPTANCE'] === '1';
const TEMPLATE_PRESS_SPEC = 'template-press==5.0.0';

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
  return ['uvx', ['--from', TEMPLATE_PRESS_SPEC, 'press']];
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
    if (lstatSync(src).isSymbolicLink()) {
      symlinkSync(readlinkSync(src), dst);
    } else {
      cpSync(src, dst, { verbatimSymlinks: true });
    }
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

function getFreePort(): Promise<number> {
  return new Promise((resolvePort, rejectPort) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', rejectPort);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (addr === null || typeof addr === 'string') {
        srv.close(() => rejectPort(new Error('Failed to bind ephemeral TCP port')));
        return;
      }
      const { port } = addr;
      srv.close((err) => {
        if (err) rejectPort(err);
        else resolvePort(port);
      });
    });
  });
}

async function smokeTestBuiltApi(targetDir: string): Promise<void> {
  const port = await getFreePort();
  const child = spawn(process.execPath, ['apps/api/dist/server.js'], {
    cwd: targetDir,
    env: {
      ...process.env,
      PORT: String(port),
      LOG_LEVEL: 'silent',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
  });

  try {
    runOrThrow('sh', ['scripts/smoke-api.sh', `http://127.0.0.1:${port}`, '20'], targetDir);
  } catch (err) {
    throw new Error(`${err instanceof Error ? err.message : String(err)}\napi stderr:\n${stderr}`, {
      cause: err,
    });
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      await new Promise<void>((resolveStop) => {
        const killTimer = setTimeout(() => {
          child.kill('SIGKILL');
        }, 5000);
        child.once('exit', () => {
          clearTimeout(killTimer);
          resolveStop();
        });
        child.kill('SIGTERM');
      });
    }
  }
}

describe.skipIf(!RUN_ACCEPTANCE)('live template-press acceptance', () => {
  it('stamps a child repo cleanly, preserves difftree-pr-comment.yml intact, and passes child gates', async () => {
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

      // 0. [[clean]] removes declared ignored build/coverage outputs without
      // touching tracked files or unignored untracked files.
      mkdirSync(join(target, 'coverage'), { recursive: true });
      writeFileSync(join(target, 'coverage', 'tracked-control.txt'), 'tracked\n', 'utf8');
      runOrThrow('git', ['add', '--force', 'coverage/tracked-control.txt'], target);
      runOrThrow('git', ['commit', '-q', '-m', 'test: add tracked control'], target);
      writeFileSync(join(target, 'tests', 'local-control.txt'), 'unignored\n', 'utf8');

      const cleanableOutputs = [
        'apps/cli/dist/stale.js',
        'apps/api/dist/stale.js',
        'apps/web/dist/stale.js',
        'packages/core/dist/stale.js',
        'coverage/stale.txt',
        'apps/cli/README.md',
        'apps/cli/LICENSE',
      ];
      for (const rel of cleanableOutputs) {
        mkdirSync(dirname(join(target, rel)), { recursive: true });
        writeFileSync(join(target, rel), 'stale\n', 'utf8');
      }

      runPress(['clean', '--target', '.', '--show']);
      for (const rel of cleanableOutputs) {
        expect(existsSync(join(target, rel)), `clean --show must keep ${rel}`).toBe(true);
      }

      runPress(['clean', '--target', '.']);
      for (const rel of cleanableOutputs) {
        expect(existsSync(join(target, rel)), `clean must remove ${rel}`).toBe(false);
      }
      expect(existsSync(join(target, 'coverage', 'tracked-control.txt'))).toBe(true);
      expect(existsSync(join(target, 'tests', 'local-control.txt'))).toBe(true);

      rmSync(join(target, 'tests', 'local-control.txt'));
      runOrThrow('git', ['rm', '-q', '-f', 'coverage/tracked-control.txt'], target);
      runOrThrow('git', ['commit', '-q', '-m', 'test: drop tracked control'], target);

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

      // 4. press-verify.yml and fork guard ship intact; template-only files are removed.
      expect(
        readFileSync(join(target, '.github', 'workflows', 'press-verify.yml'), 'utf8')
      ).toContain(TEMPLATE_PRESS_SPEC);
      expect(statSync(join(target, 'scripts', 'guard.sh')).isFile()).toBe(true);
      expect(statSync(join(target, 'tests', 'guard.test.ts')).isFile()).toBe(true);

      for (const removed of [
        '.github/workflows/template-receipt-guard.yml',
        '.github/workflows/update-contributors.yml',
        '.github/workflows/bootstrap-acceptance.yml',
        '.contributors.yml',
        'CONTRIBUTORS.md',
        'tests/contributors-automation.test.ts',
        'tests/press-acceptance.test.ts',
        'tests/bootstrap-skill.test.ts',
        '.claude/skills/new-ts-project/SKILL.md',
        'docs/port',
        'projects',
        'assets/images/logos',
        '.oss-scanner',
      ]) {
        expect(existsSync(join(target, removed)), `expected removed: ${removed}`).toBe(false);
      }

      const agentsSkillDir = join(target, '.agents', 'skills', 'new-ts-project');
      const retiredStubText = readFileSync(
        join(target, 'press', 'stubs', 'retired-bootstrap.md'),
        'utf8'
      );
      const isSkillDir =
        process.platform === 'win32' ? true : statSync(agentsSkillDir).isDirectory();
      const resolvedSkillReadme =
        process.platform === 'win32'
          ? retiredStubText
          : readFileSync(join(agentsSkillDir, 'README.md'), 'utf8');
      expect(isSkillDir).toBe(true);
      expect(resolvedSkillReadme).toBe(retiredStubText);

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
      const webPkg = JSON.parse(readFileSync(join(target, 'apps/web/package.json'), 'utf8')) as {
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
      expect(webPkg.name).toBe(`@${DEST_IDENTITY.repo_name}/web`);
      expect(manifest['.']).toBe('0.1.0');
      expect(readFileSync(join(target, 'CHANGELOG.md'), 'utf8')).toBe('# Changelog\n');

      for (const [page, stub] of [
        ['README.md', 'press/stubs/readme.md'],
        ['PROJECTS.md', 'press/stubs/projects.md'],
        ['.github/SECURITY.md', 'press/stubs/security.md'],
        ['.claude/skills/new-ts-project/README.md', 'press/stubs/retired-bootstrap.md'],
        ['docs/skills/new-ts-project.md', 'press/stubs/bootstrap-provenance.md'],
        ['docs/POST_INIT.md', 'press/stubs/post-init.md'],
        ['docs/about/index.md', 'press/stubs/about-index.md'],
        ['docs/about/philosophy.md', 'press/stubs/project-philosophy.md'],
        ['docs/tutorials/full-project-setup.md', 'press/stubs/application-setup.md'],
      ] as const) {
        expect(readFileSync(join(target, page), 'utf8')).toBe(
          readFileSync(join(target, stub), 'utf8')
        );
      }

      const provenanceDoc = readFileSync(join(target, 'docs/skills/new-ts-project.md'), 'utf8');
      expect(provenanceDoc).toContain('PROJECT_SETUP.md');
      expect(provenanceDoc).toContain('RELEASE.md');
      expect(provenanceDoc).not.toContain('maintainers-release.md');

      for (const retainedDoc of [
        'docs/PROJECT_SETUP.md',
        'docs/RELEASE.md',
        'docs/adr/README.md',
        'docs/about/design-decisions.md',
      ]) {
        expect(existsSync(join(target, retainedDoc)), `expected retained doc: ${retainedDoc}`).toBe(
          true
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

      // 8. Child repository verifies frozen lockfile, runs just setup, formats,
      // passes every quality gate, docs-check, build (including web), CLI --version,
      // live API HTTP smoke test, and press verify!
      runOrThrow('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], target);
      runOrThrow('just', ['setup'], target);
      runOrThrow('pnpm', ['exec', 'oxfmt'], target);
      runOrThrow('git', ['add', '--all'], target);
      runOrThrow('git', ['commit', '-q', '-m', 'feat: initialize application'], target);
      runOrThrow('just', ['all'], target);
      runOrThrow('just', ['docs-check'], target);
      runOrThrow('just', ['build'], target);
      expect(existsSync(join(target, 'apps/web/dist/index.html'))).toBe(true);
      expect(existsSync(join(target, 'apps/api/dist/server.js'))).toBe(true);
      expect(existsSync(join(target, 'apps/cli/dist/cli.js'))).toBe(true);
      expect(runOrThrow('just', ['version'], target).trim()).toBe(
        `${DEST_IDENTITY.cli_name} 0.1.0`
      );
      await smokeTestBuiltApi(target);
      runPress(['verify', '--target', '.']);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 360_000);
});
