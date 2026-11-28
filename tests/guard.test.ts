// Contract tests for scripts/guard.sh (two-tier template fork guard).
// Ships to pressed child repositories too: template-press rewrites the
// canonical origin literals alongside scripts/guard.sh so every assertion stays
// valid after a press rebrand.
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const SOURCE_GUARD = join(REPO_ROOT, 'scripts', 'guard.sh');

function createTempRepo(origin?: string): string {
  const repo = mkdtempSync(join(tmpdir(), 'ts-guard-test-'));
  mkdirSync(join(repo, 'scripts'), { recursive: true });
  const dstGuard = join(repo, 'scripts', 'guard.sh');
  copyFileSync(SOURCE_GUARD, dstGuard);
  chmodSync(dstGuard, 0o755);

  const init = spawnSync('git', ['init', '-q', '--initial-branch=main'], {
    cwd: repo,
    encoding: 'utf8',
  });
  if (init.status !== 0) {
    throw new Error(`git init failed: ${init.stderr}`);
  }
  if (origin !== undefined) {
    const remote = spawnSync('git', ['remote', 'add', 'origin', origin], {
      cwd: repo,
      encoding: 'utf8',
    });
    if (remote.status !== 0) {
      throw new Error(`git remote add failed: ${remote.stderr}`);
    }
  }
  return repo;
}

function runGuard(
  repo: string,
  mode: string
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync('bash', [join(repo, 'scripts', 'guard.sh'), mode], {
    cwd: repo,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

describe.skipIf(process.platform === 'win32')('scripts/guard.sh fork guard', () => {
  it('warn mode exits 0 with one-line stderr guidance on un-initialized repo', () => {
    const repo = createTempRepo();
    try {
      const res = runGuard(repo, 'warn');
      expect(res.status).toBe(0);
      expect(res.stdout).toBe('');
      expect(res.stderr).toContain('rebrand');
      expect(res.stderr).toContain('uvx --from template-press==5.0.0 press rebrand');
      expect(res.stderr).toContain('docs/tutorials/full-project-setup.md');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('block mode exits 1 with stderr guidance box on un-initialized repo', () => {
    const repo = createTempRepo();
    try {
      const res = runGuard(repo, 'block');
      expect(res.status).toBe(1);
      expect(res.stdout).toBe('');
      expect(res.stderr).toContain('blocked');
      expect(res.stderr).toContain('ts-launch-blueprint');
      expect(res.stderr).toContain('docs/tutorials/full-project-setup.md');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('exits 2 on unknown mode', () => {
    const repo = createTempRepo();
    try {
      const res = runGuard(repo, 'bogus');
      expect(res.status).toBe(2);
      expect(res.stderr).toContain('unknown mode');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('silences both warn and block when press/press-receipt.toml exists', () => {
    const repo = createTempRepo();
    try {
      mkdirSync(join(repo, 'press'), { recursive: true });
      writeFileSync(
        join(repo, 'press', 'press-receipt.toml'),
        '[press]\nverified = true\n',
        'utf8'
      );
      const warnRes = runGuard(repo, 'warn');
      const blockRes = runGuard(repo, 'block');
      expect(warnRes.status).toBe(0);
      expect(warnRes.stderr).toBe('');
      expect(blockRes.status).toBe(0);
      expect(blockRes.stderr).toBe('');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('does not skip when only unrelated press/notes.md exists', () => {
    const repo = createTempRepo();
    try {
      mkdirSync(join(repo, 'press'), { recursive: true });
      writeFileSync(join(repo, 'press', 'notes.md'), 'not a receipt\n', 'utf8');
      const warnRes = runGuard(repo, 'warn');
      const blockRes = runGuard(repo, 'block');
      expect(warnRes.status).toBe(0);
      expect(warnRes.stderr).toContain('rebrand');
      expect(blockRes.status).toBe(1);
      expect(blockRes.stderr).toContain('blocked');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('silences both warn and block when .blueprint-contributor exists', () => {
    const repo = createTempRepo();
    try {
      writeFileSync(join(repo, '.blueprint-contributor'), '', 'utf8');
      const warnRes = runGuard(repo, 'warn');
      const blockRes = runGuard(repo, 'block');
      expect(warnRes.status).toBe(0);
      expect(warnRes.stderr).toBe('');
      expect(blockRes.status).toBe(0);
      expect(blockRes.stderr).toBe('');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it.each([
    'https://github.com/smorinlabs/ts-launch-blueprint.git',
    'https://github.com/smorinlabs/ts-launch-blueprint',
    'git@github.com:smorinlabs/ts-launch-blueprint.git',
    'https://github.com/smorin/ts-launch-blueprint.git',
    'git@github.com:smorin/ts-launch-blueprint.git',
  ])('silences warn and block for canonical origin %s', (origin) => {
    const repo = createTempRepo(origin);
    try {
      const warnRes = runGuard(repo, 'warn');
      const blockRes = runGuard(repo, 'block');
      expect(warnRes.status).toBe(0);
      expect(warnRes.stderr).toBe('');
      expect(blockRes.status).toBe(0);
      expect(blockRes.stderr).toBe('');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('warns and blocks when origin is a non-canonical fork', () => {
    const repo = createTempRepo('https://github.com/someone/their-fork.git');
    try {
      const warnRes = runGuard(repo, 'warn');
      const blockRes = runGuard(repo, 'block');
      expect(warnRes.status).toBe(0);
      expect(warnRes.stderr).toContain('rebrand');
      expect(blockRes.status).toBe(1);
      expect(blockRes.stderr).toContain('blocked');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('ignores legacy init/.blueprint-initialized marker', () => {
    const repo = createTempRepo();
    try {
      mkdirSync(join(repo, 'init'), { recursive: true });
      writeFileSync(join(repo, 'init', '.blueprint-initialized'), '', 'utf8');
      const blockRes = runGuard(repo, 'block');
      expect(blockRes.status).toBe(1);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
