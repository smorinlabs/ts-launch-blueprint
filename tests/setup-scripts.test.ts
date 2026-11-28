// Contract tests for scripts/setup-github-environments.sh and scripts/setup-npm-publishing.sh.
// Ships to pressed child repositories too: assertions avoid source identity literals
// and exercise scripts offline via temporary repos and a fake `gh` CLI shim.
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const ENV_SCRIPT = join(REPO_ROOT, 'scripts', 'setup-github-environments.sh');
const NPM_SCRIPT = join(REPO_ROOT, 'scripts', 'setup-npm-publishing.sh');

function runScript(
  scriptPath: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync('bash', [scriptPath, ...args], {
    cwd: opts.cwd ?? REPO_ROOT,
    env: opts.env ?? process.env,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function createFakeGhBin(dir: string, extraCases = ''): { binDir: string; logFile: string } {
  const binDir = join(dir, 'bin');
  const logFile = join(dir, 'gh.log');
  mkdirSync(binDir, { recursive: true });
  writeFileSync(logFile, '', 'utf8');

  const ghShim = `#!/usr/bin/env bash
set -euo pipefail
if [[ " $* " == *" --input - "* ]]; then
  stdin_payload="$(cat)"
  printf '%s | stdin=%s\n' "$*" "$stdin_payload" >> "${logFile}"
else
  printf '%s\n' "$*" >> "${logFile}"
fi
${extraCases}
case "$*" in
  "auth status")
    exit 0
    ;;
  "repo view --json nameWithOwner -q .nameWithOwner")
    echo "auto-org/auto-cli"
    exit 0
    ;;
  api\\ --paginate\\ repos/*/*/environments/*/deployment-branch-policies\\ -q*)
    exit 0
    ;;
  api\\ repos/*/*/environments/*)
    echo '{"message":"Not Found","status":"404"}'
    echo 'gh: Not Found (HTTP 404)' >&2
    exit 1
    ;;
  api\\ --method\\ DELETE*)
    exit 0
    ;;
  api\\ --method\\ POST*)
    exit 0
    ;;
  api\\ --method\\ PUT*)
    exit 0
    ;;
  api\\ repos/*/*)
    echo '{"full_name":"ok"}'
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
`;
  const ghPath = join(binDir, 'gh');
  writeFileSync(ghPath, ghShim, 'utf8');
  chmodSync(ghPath, 0o755);
  return { binDir, logFile };
}

function initGitRepo(dir: string, remoteUrl?: string): void {
  const init = spawnSync('git', ['init', '-q', '--initial-branch=main'], {
    cwd: dir,
    encoding: 'utf8',
  });
  if (init.status !== 0) {
    throw new Error(`git init failed: ${init.stderr}`);
  }
  if (remoteUrl !== undefined) {
    const remote = spawnSync('git', ['remote', 'add', 'origin', remoteUrl], {
      cwd: dir,
      encoding: 'utf8',
    });
    if (remote.status !== 0) {
      throw new Error(`git remote add failed: ${remote.stderr}`);
    }
  }
}

describe('setup scripts existence', () => {
  it('ships scripts/setup-github-environments.sh and scripts/setup-npm-publishing.sh', () => {
    expect(existsSync(ENV_SCRIPT)).toBe(true);
    expect(existsSync(NPM_SCRIPT)).toBe(true);
  });
});

describe.skipIf(process.platform === 'win32')('scripts/setup-github-environments.sh', () => {
  it('is executable and passes bash -n syntax check', () => {
    expect(statSync(ENV_SCRIPT).mode & 0o111).toBeGreaterThan(0);
    const syntax = spawnSync('bash', ['-n', ENV_SCRIPT], { encoding: 'utf8' });
    expect(syntax.status).toBe(0);
  });

  it.each(['--help', '-h'])('exits 0 offline with usage output for %s', (flag) => {
    const res = runScript(ENV_SCRIPT, [flag], {
      env: { ...process.env, PATH: '/usr/bin:/bin' },
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Usage:');
    expect(res.stdout).toContain('npm');
    expect(res.stdout).toContain('security-review');
  });

  it('rejects unknown flags and extra positional arguments before checking gh', () => {
    const unknown = runScript(ENV_SCRIPT, ['--bogus']);
    expect(unknown.status).not.toBe(0);
    expect(unknown.stderr).toContain('unknown option');

    const extra = runScript(ENV_SCRIPT, ['example-org/example-cli', 'extra-arg']);
    expect(extra.status).not.toBe(0);
    expect(extra.stderr).toContain('unexpected argument');
  });

  it.each(['bad-repo', 'a/b/c', '/repo', 'owner/'])(
    'rejects malformed owner/repo argument %s',
    (badRepo) => {
      const scratch = mkdtempSync(join(tmpdir(), 'setup-env-bad-'));
      try {
        const { binDir } = createFakeGhBin(scratch);
        const res = runScript(ENV_SCRIPT, [badRepo], {
          env: { ...process.env, PATH: `${binDir}:${process.env['PATH'] ?? ''}` },
        });
        expect(res.status).not.toBe(0);
        expect(res.stderr).toContain('owner/repo');
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    }
  );

  it('creates missing environments (404 -> defaults), paginates policies, and creates v* + main/release/* rules', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'setup-env-ok-'));
    try {
      const { binDir, logFile } = createFakeGhBin(
        scratch,
        `if [[ "$*" == *"--paginate"*"deployment-branch-policies -q"* ]]; then
  echo "101"
  echo "102"
  exit 0
fi`
      );
      const res = runScript(ENV_SCRIPT, ['example-org/example-cli'], {
        env: { ...process.env, PATH: `${binDir}:${process.env['PATH'] ?? ''}` },
      });
      expect(res.stderr).toBe('');
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('Target repo: example-org/example-cli');

      const calls = readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
      expect(calls).toContain('api repos/example-org/example-cli/environments/npm');
      expect(calls).toContain('api repos/example-org/example-cli/environments/security-review');
      expect(calls).toContain(
        'api --paginate repos/example-org/example-cli/environments/npm/deployment-branch-policies -q .branch_policies[].id'
      );

      const defaultPayload = {
        wait_timer: 0,
        prevent_self_review: false,
        reviewers: [],
        deployment_branch_policy: {
          protected_branches: false,
          custom_branch_policies: true,
        },
      };
      const npmPutLine = calls.find((line) =>
        line.startsWith(
          'api --method PUT repos/example-org/example-cli/environments/npm --input - | stdin='
        )
      );
      expect(npmPutLine).toBeDefined();
      expect(JSON.parse(npmPutLine!.split('| stdin=')[1]!)).toEqual(defaultPayload);

      const secPutLine = calls.find((line) =>
        line.startsWith(
          'api --method PUT repos/example-org/example-cli/environments/security-review --input - | stdin='
        )
      );
      expect(secPutLine).toBeDefined();
      expect(JSON.parse(secPutLine!.split('| stdin=')[1]!)).toEqual(defaultPayload);

      expect(calls).toContain(
        'api --method DELETE repos/example-org/example-cli/environments/npm/deployment-branch-policies/101'
      );
      expect(calls).toContain(
        'api --method POST repos/example-org/example-cli/environments/npm/deployment-branch-policies -f name=v* -f type=tag'
      );
      expect(
        calls.some(
          (line) =>
            line.includes('environments/npm/deployment-branch-policies') &&
            line.includes('type=branch')
        )
      ).toBe(false);

      expect(calls).toContain(
        'api --method POST repos/example-org/example-cli/environments/security-review/deployment-branch-policies -f name=main -f type=branch'
      );
      expect(calls).toContain(
        'api --method POST repos/example-org/example-cli/environments/security-review/deployment-branch-policies -f name=release/* -f type=branch'
      );
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it('preserves existing wait_timer, prevent_self_review, and reviewers when updating existing environments (200)', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'setup-env-preserve-'));
    try {
      const existingNpm = JSON.stringify({
        name: 'npm',
        protection_rules: [
          { id: 1, type: 'wait_timer', wait_timer: 15 },
          {
            id: 2,
            type: 'required_reviewers',
            prevent_self_review: true,
            reviewers: [
              { type: 'User', reviewer: { id: 12345, login: 'alice' } },
              { type: 'Team', reviewer: { id: 67890, slug: 'maintainers' } },
            ],
          },
        ],
      });
      const existingSecurity = JSON.stringify({
        name: 'security-review',
        protection_rules: [],
      });
      const { binDir, logFile } = createFakeGhBin(
        scratch,
        `case "$*" in
  "api repos/example-org/example-cli/environments/npm")
    printf '%s\\n' '${existingNpm}'
    exit 0
    ;;
  "api repos/example-org/example-cli/environments/security-review")
    printf '%s\\n' '${existingSecurity}'
    exit 0
    ;;
esac`
      );
      const res = runScript(ENV_SCRIPT, ['example-org/example-cli'], {
        env: { ...process.env, PATH: `${binDir}:${process.env['PATH'] ?? ''}` },
      });
      expect(res.stderr).toBe('');
      expect(res.status).toBe(0);

      const calls = readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
      const npmPutLine = calls.find((line) =>
        line.startsWith(
          'api --method PUT repos/example-org/example-cli/environments/npm --input - | stdin='
        )
      );
      expect(npmPutLine).toBeDefined();
      expect(JSON.parse(npmPutLine!.split('| stdin=')[1]!)).toEqual({
        wait_timer: 15,
        prevent_self_review: true,
        reviewers: [
          { type: 'User', id: 12345 },
          { type: 'Team', id: 67890 },
        ],
        deployment_branch_policy: {
          protected_branches: false,
          custom_branch_policies: true,
        },
      });

      const secPutLine = calls.find((line) =>
        line.startsWith(
          'api --method PUT repos/example-org/example-cli/environments/security-review --input - | stdin='
        )
      );
      expect(secPutLine).toBeDefined();
      expect(JSON.parse(secPutLine!.split('| stdin=')[1]!)).toEqual({
        wait_timer: 0,
        prevent_self_review: false,
        reviewers: [],
        deployment_branch_policy: {
          protected_branches: false,
          custom_branch_policies: true,
        },
      });
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it('fails closed when inspecting an environment returns an unexpected error', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'setup-env-get-err-'));
    try {
      const { binDir, logFile } = createFakeGhBin(
        scratch,
        `if [[ "$*" == "api repos/example-org/example-cli/environments/npm" ]]; then
  echo 'gh: Forbidden (HTTP 403)' >&2
  exit 1
fi`
      );
      const res = runScript(ENV_SCRIPT, ['example-org/example-cli'], {
        env: { ...process.env, PATH: `${binDir}:${process.env['PATH'] ?? ''}` },
      });
      expect(res.status).not.toBe(0);
      expect(res.stderr).toContain("failed to inspect environment 'npm'");
      const calls = readFileSync(logFile, 'utf8');
      expect(calls).not.toContain('--method PUT');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it('fails closed when listing deployment-branch-policies fails', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'setup-env-list-err-'));
    try {
      const { binDir, logFile } = createFakeGhBin(
        scratch,
        `if [[ "$*" == *"deployment-branch-policies -q"* ]]; then
  echo 'gh: Internal Server Error (HTTP 500)' >&2
  exit 1
fi`
      );
      const res = runScript(ENV_SCRIPT, ['example-org/example-cli'], {
        env: { ...process.env, PATH: `${binDir}:${process.env['PATH'] ?? ''}` },
      });
      expect(res.status).not.toBe(0);
      expect(res.stderr).toContain("failed to list deployment branch policies for 'npm'");
      const calls = readFileSync(logFile, 'utf8');
      expect(calls).not.toContain('--method POST');
      expect(calls).not.toContain('--method DELETE');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it('auto-detects owner/repo via gh repo view when argument is omitted', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'setup-env-auto-'));
    try {
      const { binDir, logFile } = createFakeGhBin(scratch);
      const res = runScript(ENV_SCRIPT, [], {
        env: { ...process.env, PATH: `${binDir}:${process.env['PATH'] ?? ''}` },
      });
      expect(res.stderr).toBe('');
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('Target repo: auto-org/auto-cli');
      const calls = readFileSync(logFile, 'utf8');
      expect(calls).toContain('repos/auto-org/auto-cli/environments/npm');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});

describe.skipIf(process.platform === 'win32')('scripts/setup-npm-publishing.sh', () => {
  it('is executable and passes bash -n syntax check', () => {
    expect(statSync(NPM_SCRIPT).mode & 0o111).toBeGreaterThan(0);
    const syntax = spawnSync('bash', ['-n', NPM_SCRIPT], { encoding: 'utf8' });
    expect(syntax.status).toBe(0);
  });

  it.each(['--help', '-h'])('exits 0 offline with usage output for %s', (flag) => {
    const res = runScript(NPM_SCRIPT, [flag], {
      cwd: tmpdir(),
      env: { ...process.env, PATH: '/usr/bin:/bin' },
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Usage:');
    expect(res.stdout).toContain('apps/cli/package.json');
  });

  it('rejects unknown flags, extra args, and invalid owner/repo', () => {
    const unknown = runScript(NPM_SCRIPT, ['--bogus']);
    expect(unknown.status).not.toBe(0);
    expect(unknown.stderr).toContain('unknown option');

    const extra = runScript(NPM_SCRIPT, ['example-org/example-cli', 'extra']);
    expect(extra.status).not.toBe(0);
    expect(extra.stderr).toContain('unexpected argument');

    const bad = runScript(NPM_SCRIPT, ['not-a-repo']);
    expect(bad.status).not.toBe(0);
    expect(bad.stderr).toContain('owner/repo');
  });

  it('prints Trusted Publisher settings from apps/cli/package.json and packages/core/package.json with zero warnings in this repo', () => {
    const cliPkg = JSON.parse(
      readFileSync(join(REPO_ROOT, 'apps', 'cli', 'package.json'), 'utf8')
    ) as { name: string };
    const corePkg = JSON.parse(
      readFileSync(join(REPO_ROOT, 'packages', 'core', 'package.json'), 'utf8')
    ) as { name: string };
    const res = runScript(NPM_SCRIPT, ['example-org/example-cli']);
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(cliPkg.name);
    expect(res.stdout).toContain(corePkg.name);
    expect(res.stdout).toContain('example-org');
    expect(res.stdout).toContain('example-cli');
    expect(res.stdout).toContain('publish.yml');
    expect(res.stdout).toContain('npm');
    expect(res.stdout).toContain(`https://www.npmjs.com/package/${cliPkg.name}/access`);
    expect(res.stdout).toContain(`https://www.npmjs.com/package/${corePkg.name}/access`);
    expect(res.stdout).toContain('PUBLISH_CORE');
  });

  it('falls back to git origin remote and fails on missing or malformed apps/cli/package.json', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'setup-npm-manifest-'));
    try {
      initGitRepo(scratch, 'git@github.com:fallback-org/fallback-repo.git');
      mkdirSync(join(scratch, 'scripts'), { recursive: true });
      const copiedScript = join(scratch, 'scripts', 'setup-npm-publishing.sh');
      copyFileSync(NPM_SCRIPT, copiedScript);
      chmodSync(copiedScript, 0o755);

      const fakeBinDir = join(scratch, 'fake-bin');
      mkdirSync(fakeBinDir, { recursive: true });
      const failingGh = join(fakeBinDir, 'gh');
      writeFileSync(failingGh, '#!/usr/bin/env bash\nexit 1\n', 'utf8');
      chmodSync(failingGh, 0o755);

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        PATH: `${fakeBinDir}:${join(process.execPath, '..')}:/usr/bin:/bin`,
        GH_CONFIG_DIR: join(scratch, 'empty-gh'),
      };
      delete env['GH_REPO'];
      delete env['GH_TOKEN'];
      delete env['GITHUB_TOKEN'];

      const missing = runScript(copiedScript, [], { cwd: scratch, env });
      expect(missing.status).not.toBe(0);
      expect(missing.stderr).toContain('apps/cli/package.json not found');

      mkdirSync(join(scratch, 'apps', 'cli'), { recursive: true });
      writeFileSync(join(scratch, 'apps', 'cli', 'package.json'), '{bad json', 'utf8');
      const malformed = runScript(copiedScript, [], { cwd: scratch, env });
      expect(malformed.status).not.toBe(0);
      expect(malformed.stderr).toContain('could not read package name');

      writeFileSync(
        join(scratch, 'apps', 'cli', 'package.json'),
        JSON.stringify({ name: '@fallback-org/sample-cli', version: '0.1.0' }),
        'utf8'
      );
      const noWorkflow = runScript(copiedScript, [], { cwd: scratch, env });
      expect(noWorkflow.status).toBe(0);
      expect(noWorkflow.stdout).toContain('@fallback-org/sample-cli');
      expect(noWorkflow.stdout).toContain('fallback-org');
      expect(noWorkflow.stdout).toContain('fallback-repo');
      expect(noWorkflow.stderr).toContain('warning:');

      mkdirSync(join(scratch, 'packages', 'core'), { recursive: true });
      writeFileSync(join(scratch, 'packages', 'core', 'package.json'), '{bad json', 'utf8');
      const malformedCore = runScript(copiedScript, [], { cwd: scratch, env });
      expect(malformedCore.status).not.toBe(0);
      expect(malformedCore.stderr).toContain('packages/core/package.json');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it('strips ssh://git@host/ remote URLs cleanly to owner/repo', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'setup-npm-ssh-url-'));
    try {
      initGitRepo(scratch, 'ssh://git@github.com/ssh-proto-org/ssh-proto-cli.git');
      mkdirSync(join(scratch, 'apps', 'cli'), { recursive: true });
      mkdirSync(join(scratch, '.github', 'workflows'), { recursive: true });
      writeFileSync(
        join(scratch, 'apps', 'cli', 'package.json'),
        JSON.stringify({ name: '@ssh-proto-org/ssh-proto-cli', version: '0.1.0' }),
        'utf8'
      );
      writeFileSync(
        join(scratch, '.github', 'workflows', 'publish.yml'),
        'on:\n  push:\n    tags:\n      - "v*"\njobs:\n  publish:\n    environment: npm\n    permissions:\n      id-token: write\n    steps:\n      - run: npm publish\n',
        'utf8'
      );

      const fakeBinDir = join(scratch, 'fake-bin');
      mkdirSync(fakeBinDir, { recursive: true });
      const failingGh = join(fakeBinDir, 'gh');
      writeFileSync(failingGh, '#!/usr/bin/env bash\nexit 1\n', 'utf8');
      chmodSync(failingGh, 0o755);

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        PATH: `${fakeBinDir}:${join(process.execPath, '..')}:/usr/bin:/bin`,
        GH_CONFIG_DIR: join(scratch, 'empty-gh'),
      };
      delete env['GH_REPO'];
      delete env['GH_TOKEN'];
      delete env['GITHUB_TOKEN'];

      const res = runScript(NPM_SCRIPT, [], { cwd: scratch, env });
      expect(res.stderr).toBe('');
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('ssh-proto-org/ssh-proto-cli');
      expect(res.stdout).toContain('ssh-proto-org');
      expect(res.stdout).toContain('ssh-proto-cli');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it('warns when publish.yml is missing id-token, environment: npm, npm publish, tags trigger, or uses NPM_TOKEN', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'setup-npm-warn-'));
    try {
      initGitRepo(scratch, 'https://github.com/example-org/example-cli.git');
      mkdirSync(join(scratch, 'apps', 'cli'), { recursive: true });
      mkdirSync(join(scratch, '.github', 'workflows'), { recursive: true });
      writeFileSync(
        join(scratch, 'apps', 'cli', 'package.json'),
        JSON.stringify({ name: 'example-cli', version: '0.1.0' }),
        'utf8'
      );
      writeFileSync(
        join(scratch, '.github', 'workflows', 'publish.yml'),
        'on:\n  workflow_dispatch:\njobs:\n  publish:\n    steps:\n      - run: echo $NPM_TOKEN\n',
        'utf8'
      );
      const res = runScript(NPM_SCRIPT, ['example-org/example-cli'], { cwd: scratch });
      expect(res.status).toBe(0);
      expect(res.stderr).toContain('id-token: write');
      expect(res.stderr).toContain("environment 'npm'");
      expect(res.stderr).toContain('npm publish');
      expect(res.stderr).toContain('tags:');
      expect(res.stderr).toContain('NPM_TOKEN');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
