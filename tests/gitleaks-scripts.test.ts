// Behavioral tests for scripts/check-gitleaks.sh and scripts/install-gitleaks.sh.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const CHECK_SCRIPT = join(REPO_ROOT, 'scripts', 'check-gitleaks.sh');
const INSTALL_SCRIPT = join(REPO_ROOT, 'scripts', 'install-gitleaks.sh');

function runGit(cwd: string, args: string[]): void {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  }
}

function makeStubGitleaks(binDir: string, exitCode = 0, versionOutput = '8.27.2'): void {
  const path = join(binDir, 'gitleaks');
  writeFileSync(
    path,
    [
      '#!/usr/bin/env bash',
      'if [ "${1:-}" = "version" ]; then',
      `  echo "${versionOutput}"`,
      '  exit 0',
      'fi',
      'if [ -n "${GITLEAKS_ARGS_LOG:-}" ]; then',
      '  printf "%s\\n" "$*" >> "$GITLEAKS_ARGS_LOG"',
      'fi',
      `exit ${exitCode}`,
    ].join('\n'),
    'utf8'
  );
  chmodSync(path, 0o755);
}

describe('scripts/check-gitleaks.sh & scripts/install-gitleaks.sh (POSIX)', () => {
  it.skipIf(process.platform === 'win32')(
    'check-gitleaks.sh exits 2 on invalid args and 127 when gitleaks is missing',
    () => {
      const noArgs = spawnSync('bash', [CHECK_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
      expect(noArgs.status).toBe(2);
      expect(noArgs.stderr).toContain('Usage:');

      const emptyBin = mkdtempSync(join(tmpdir(), 'gitleaks-empty-bin-'));
      try {
        const bashLookup = spawnSync('which', ['bash'], { encoding: 'utf8' });
        const bashExe = bashLookup.stdout.trim() || '/bin/bash';
        const missing = spawnSync(bashExe, [CHECK_SCRIPT, '--staged'], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          env: { PATH: emptyBin },
        });
        expect(missing.status).toBe(127);
        expect(missing.stderr).toContain('gitleaks not on PATH');
      } finally {
        rmSync(emptyBin, { recursive: true, force: true });
      }
    }
  );

  it.skipIf(process.platform === 'win32')(
    'check-gitleaks.sh runs --staged and --full modes against gitleaks',
    () => {
      const dir = mkdtempSync(join(tmpdir(), 'gitleaks-modes-'));
      try {
        const passBin = join(dir, 'pass-bin');
        const failBin = join(dir, 'fail-bin');
        mkdirSync(passBin, { recursive: true });
        mkdirSync(failBin, { recursive: true });
        const argsLog = join(dir, 'args.log');
        makeStubGitleaks(passBin, 0);
        makeStubGitleaks(failBin, 1);

        const stagedOk = spawnSync('bash', [CHECK_SCRIPT, '--staged'], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${passBin}:${process.env.PATH}`,
            GITLEAKS_ARGS_LOG: argsLog,
          },
        });
        expect(stagedOk.status).toBe(0);

        const fullOk = spawnSync('bash', [CHECK_SCRIPT, '--full'], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${passBin}:${process.env.PATH}`,
            GITLEAKS_ARGS_LOG: argsLog,
          },
        });
        expect(fullOk.status).toBe(0);

        const logged = readFileSync(argsLog, 'utf8');
        expect(logged).toContain('protect --staged --config .gitleaks.toml');
        expect(logged).toContain('detect --config .gitleaks.toml');

        const stagedFail = spawnSync('bash', [CHECK_SCRIPT, '--staged'], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          env: { ...process.env, PATH: `${failBin}:${process.env.PATH}` },
        });
        expect(stagedFail.status).toBe(1);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  );

  it.skipIf(process.platform === 'win32')(
    'check-gitleaks.sh --range handles no-remote skip, origin/main fallback, and upstream tracking',
    () => {
      const dir = mkdtempSync(join(tmpdir(), 'gitleaks-range-'));
      try {
        const binDir = join(dir, 'bin');
        const repoDir = join(dir, 'repo');
        const remoteDir = join(dir, 'remote.git');
        mkdirSync(binDir, { recursive: true });
        mkdirSync(repoDir, { recursive: true });
        const argsLog = join(dir, 'range-args.log');
        makeStubGitleaks(binDir, 0);

        runGit(repoDir, ['init', '-q', '--initial-branch=main']);
        runGit(repoDir, ['config', 'user.name', 'Test']);
        runGit(repoDir, ['config', 'user.email', 'test@example.com']);
        writeFileSync(join(repoDir, '.gitleaks.toml'), 'title = "test"\n', 'utf8');
        runGit(repoDir, ['add', '.gitleaks.toml']);
        runGit(repoDir, ['commit', '-q', '-m', 'init']);

        // 1. No remote and no upstream -> falls back to full history scan.
        const noRemote = spawnSync('bash', [CHECK_SCRIPT, '--range'], {
          cwd: repoDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${binDir}:${process.env.PATH}`,
            GITLEAKS_ARGS_LOG: argsLog,
          },
        });
        expect(noRemote.status).toBe(0);
        expect(noRemote.stderr).toContain('falling back to full history scan');
        expect(readFileSync(argsLog, 'utf8')).toContain(
          'detect --config .gitleaks.toml --no-banner --redact'
        );

        // 2. Bare remote + origin/main present, no upstream -> scans origin/main..HEAD.
        spawnSync('git', ['init', '-q', '--bare', remoteDir], { encoding: 'utf8' });
        runGit(repoDir, ['remote', 'add', 'origin', remoteDir]);
        runGit(repoDir, ['push', '-q', 'origin', 'main']);
        runGit(repoDir, ['checkout', '-q', '-b', 'feat/branch']);
        writeFileSync(join(repoDir, 'file.txt'), 'hello\n', 'utf8');
        runGit(repoDir, ['add', 'file.txt']);
        runGit(repoDir, ['commit', '-q', '-m', 'feat']);

        const fallback = spawnSync('bash', [CHECK_SCRIPT, '--range'], {
          cwd: repoDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${binDir}:${process.env.PATH}`,
            GITLEAKS_ARGS_LOG: argsLog,
          },
        });
        expect(fallback.status).toBe(0);
        expect(readFileSync(argsLog, 'utf8')).toContain('--log-opts=origin/main..HEAD');

        // 3. With upstream tracking branch configured -> scans @{u} (origin/feat/branch..HEAD).
        runGit(repoDir, ['push', '-q', '-u', 'origin', 'feat/branch']);
        writeFileSync(join(repoDir, 'file2.txt'), 'world\n', 'utf8');
        runGit(repoDir, ['add', 'file2.txt']);
        runGit(repoDir, ['commit', '-q', '-m', 'feat 2']);

        const upstream = spawnSync('bash', [CHECK_SCRIPT, '--range'], {
          cwd: repoDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${binDir}:${process.env.PATH}`,
            GITLEAKS_ARGS_LOG: argsLog,
          },
        });
        expect(upstream.status).toBe(0);
        expect(readFileSync(argsLog, 'utf8')).toContain('--log-opts=origin/feat/branch..HEAD');

        // 4. Multi-ref pre-push stdin: scans each pushed ref range accurately (even non-HEAD),
        //    skips deleted refs, handles new branches, and fails if any ref fails.
        runGit(repoDir, ['checkout', '-q', '-b', 'feat/other', 'main']);
        writeFileSync(join(repoDir, 'other.txt'), 'other\n', 'utf8');
        runGit(repoDir, ['add', 'other.txt']);
        runGit(repoDir, ['commit', '-q', '-m', 'other 1']);
        const otherSha = spawnSync('git', ['rev-parse', 'HEAD'], {
          cwd: repoDir,
          encoding: 'utf8',
        }).stdout.trim();
        const featOldSha = spawnSync('git', ['rev-parse', 'origin/feat/branch'], {
          cwd: repoDir,
          encoding: 'utf8',
        }).stdout.trim();
        const featNewSha = spawnSync('git', ['rev-parse', 'feat/branch'], {
          cwd: repoDir,
          encoding: 'utf8',
        }).stdout.trim();
        const zeroSha = '0'.repeat(40);

        // Stay checked out on main while pushing feat/branch (update), feat/other (new), and deleting stale.
        runGit(repoDir, ['checkout', '-q', 'main']);
        const multiLog = join(dir, 'multi-args.log');
        const stdinPayload = [
          `refs/heads/feat/branch ${featNewSha} refs/heads/feat/branch ${featOldSha}`,
          `refs/heads/feat/other ${otherSha} refs/heads/feat/other ${zeroSha}`,
          `(delete) ${zeroSha} refs/heads/stale ${featOldSha}`,
        ].join('\n');
        const multiRes = spawnSync('bash', [CHECK_SCRIPT, '--range'], {
          cwd: repoDir,
          encoding: 'utf8',
          input: `${stdinPayload}\n`,
          env: {
            ...process.env,
            PATH: `${binDir}:${process.env.PATH}`,
            GITLEAKS_ARGS_LOG: multiLog,
          },
        });
        expect(multiRes.status).toBe(0);
        expect(multiRes.stderr).toContain('skipping deleted ref refs/heads/stale');
        const multiLogged = readFileSync(multiLog, 'utf8');
        expect(multiLogged).toContain(`--log-opts=${featOldSha}..${featNewSha}`);
        expect(multiLogged).toContain(`--log-opts=origin/main..${otherSha}`);
        expect(multiLogged).not.toContain('HEAD');

        // Secret found in pushed ref -> non-zero exit.
        const failBin = join(dir, 'fail-bin');
        mkdirSync(failBin, { recursive: true });
        makeStubGitleaks(failBin, 1);
        const failRes = spawnSync('bash', [CHECK_SCRIPT, '--range'], {
          cwd: repoDir,
          encoding: 'utf8',
          input: `refs/heads/feat/branch ${featNewSha} refs/heads/feat/branch ${featOldSha}\n`,
          env: {
            ...process.env,
            PATH: `${failBin}:${process.env.PATH}`,
          },
        });
        expect(failRes.status).toBe(1);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  );

  it.skipIf(process.platform === 'win32')(
    'install-gitleaks.sh is idempotent, verifies SHA256 pass, and rejects SHA256 mismatch',
    () => {
      const dir = mkdtempSync(join(tmpdir(), 'gitleaks-install-'));
      try {
        // 1. Idempotency when matching gitleaks is already on PATH.
        const existingBin = join(dir, 'existing-bin');
        mkdirSync(existingBin, { recursive: true });
        makeStubGitleaks(existingBin, 0, '8.27.2');
        const idempotent = spawnSync('bash', [INSTALL_SCRIPT], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${existingBin}:/usr/bin:/bin`,
            GITLEAKS_VERSION: '8.27.2',
          },
        });
        expect(idempotent.status).toBe(0);
        expect(idempotent.stdout).toContain('already on PATH');

        // Build a synthetic tarball matching the host platform for offline file:// test.
        const os = process.platform === 'darwin' ? 'darwin' : 'linux';
        const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
        const version = '8.27.2';
        const tarName = `gitleaks_${version}_${os}_${arch}.tar.gz`;
        const checksumName = `gitleaks_${version}_checksums.txt`;

        const stageDir = join(dir, 'stage');
        const serverDir = join(dir, 'mirror');
        mkdirSync(stageDir, { recursive: true });
        mkdirSync(serverDir, { recursive: true });
        writeFileSync(join(stageDir, 'gitleaks'), '#!/bin/sh\necho "8.27.2"\n', 'utf8');
        chmodSync(join(stageDir, 'gitleaks'), 0o755);
        spawnSync('tar', ['-czf', join(serverDir, tarName), '-C', stageDir, 'gitleaks'], {
          encoding: 'utf8',
        });

        const tarBytes = readFileSync(join(serverDir, tarName));
        const validSha = createHash('sha256').update(tarBytes).digest('hex');

        // 2. Valid SHA256 succeeds and installs executable binary.
        writeFileSync(join(serverDir, checksumName), `${validSha}  ${tarName}\n`, 'utf8');
        const installOkDir = join(dir, 'install-ok');
        const passRes = spawnSync('bash', [INSTALL_SCRIPT], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          env: {
            PATH: '/usr/bin:/bin',
            HOME: dir,
            GITLEAKS_VERSION: version,
            GITLEAKS_INSTALL_DIR: installOkDir,
            GITLEAKS_BASE_URL: `file://${serverDir}`,
          },
        });
        expect(passRes.status).toBe(0);
        expect(existsSync(join(installOkDir, 'gitleaks'))).toBe(true);

        // 3. Mismatched SHA256 fails and does not install binary.
        writeFileSync(join(serverDir, checksumName), `${'0'.repeat(64)}  ${tarName}\n`, 'utf8');
        const installBadDir = join(dir, 'install-bad');
        const failRes = spawnSync('bash', [INSTALL_SCRIPT], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          env: {
            PATH: '/usr/bin:/bin',
            HOME: dir,
            GITLEAKS_VERSION: version,
            GITLEAKS_INSTALL_DIR: installBadDir,
            GITLEAKS_BASE_URL: `file://${serverDir}`,
          },
        });
        expect(failRes.status).not.toBe(0);
        expect(existsSync(join(installBadDir, 'gitleaks'))).toBe(false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  );
});
