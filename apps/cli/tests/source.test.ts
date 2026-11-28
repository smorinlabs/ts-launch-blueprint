// CLI demo mode: --source / TS_PROJECTS_SOURCE selects the HTTP API or the
// core's in-memory demo seed (no token, no server).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULT_IN_MEMORY_SEED, type Project } from '@ts-launch-blueprint/core';
import { afterEach, describe, expect, it } from 'vitest';

import { CONFIG_FILE_NAME, TOKEN_ENV_VAR } from '../src/cli/config.js';
import type { CliDeps } from '../src/cli/deps.js';
import { UsageError } from '../src/cli/exit-codes.js';
import { runCli } from '../src/cli/router.js';
import { resolveSource, SOURCE_ENV_VAR } from '../src/cli/source.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ts-projects-source-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const failingFetch = ((input: Parameters<typeof fetch>[0]) => {
  throw new Error(`memory mode must not fetch: ${String(input)}`);
}) as typeof fetch;

interface Harness {
  deps: CliDeps;
  stdout: () => string;
  stderr: () => string;
}

function makeHarness(overrides: Partial<CliDeps> = {}): Harness {
  const out: string[] = [];
  const err: string[] = [];
  const deps: CliDeps = {
    stdout: (text) => {
      out.push(text);
    },
    stderr: (text) => {
      err.push(text);
    },
    env: {},
    homedir: () => makeTempDir(),
    stdoutIsTTY: false,
    stderrIsTTY: false,
    stdinIsTTY: false,
    fetchImpl: failingFetch,
    prompter: () => Promise.resolve([]),
    clipboard: () => Promise.resolve(),
    spinner: () => ({ stop: () => undefined }),
    ...overrides,
  };
  return { deps, stdout: () => out.join(''), stderr: () => err.join('') };
}

const MEMORY_ENV = { [SOURCE_ENV_VAR]: 'memory' };
const ENGINEERING: Project[] = DEFAULT_IN_MEMORY_SEED.projects.filter(
  (project) => project.workspace?.name === 'Engineering'
);

function projectsOf(stdout: string): Project[] {
  return (JSON.parse(stdout) as { projects: Project[] }).projects;
}

describe('resolveSource', () => {
  it('defaults to http', () => {
    expect(resolveSource({ env: {} })).toEqual({ source: 'http', origin: 'default' });
  });

  it('reads memory from TS_PROJECTS_SOURCE', () => {
    expect(resolveSource({ env: MEMORY_ENV })).toEqual({ source: 'memory', origin: 'env' });
  });

  it('lets the flag beat the env var, in both directions', () => {
    expect(resolveSource({ flag: 'memory', env: { [SOURCE_ENV_VAR]: 'http' } })).toEqual({
      source: 'memory',
      origin: 'flag',
    });
    expect(resolveSource({ flag: 'http', env: MEMORY_ENV })).toEqual({
      source: 'http',
      origin: 'flag',
    });
  });

  it.each([
    ['a bad flag', { flag: 'foo', env: {} }, 'foo'],
    ['a bad env value', { env: { [SOURCE_ENV_VAR]: 'foo' } }, 'foo'],
    ['an upper-case value (case-sensitive)', { flag: 'MEMORY', env: {} }, 'MEMORY'],
  ])('throws UsageError with the exact message for %s', (_label, input, value) => {
    expect(() => resolveSource(input)).toThrow(UsageError);
    expect(() => resolveSource(input)).toThrow(
      `Invalid source "${value}": expected "http" or "memory"`
    );
  });
});

describe('projects list and get in memory mode (no token, no server)', () => {
  it('TS_PROJECTS_SOURCE=memory lists all 4 demo projects with no token anywhere', async () => {
    const h = makeHarness({ env: MEMORY_ENV });
    const code = await runCli(['projects', 'list', '--no-input', '--json'], h.deps);
    expect(code).toBe(0);
    expect(projectsOf(h.stdout())).toEqual(DEFAULT_IN_MEMORY_SEED.projects);
  });

  it('--source memory works the same, and beats TS_PROJECTS_SOURCE=http', async () => {
    const h = makeHarness({ env: { [SOURCE_ENV_VAR]: 'http' } });
    const code = await runCli(
      ['projects', 'list', '--source', 'memory', '--no-input', '-o', 'json'],
      h.deps
    );
    expect(code).toBe(0);
    expect(projectsOf(h.stdout())).toEqual(DEFAULT_IN_MEMORY_SEED.projects);
    expect(h.stderr()).toContain('Using in-memory demo data (--source memory)');
  });

  it('--source http beats TS_PROJECTS_SOURCE=memory (and still needs a token: exit 4)', async () => {
    const h = makeHarness({ env: MEMORY_ENV });
    const code = await runCli(['projects', 'list', '--source', 'http', '--no-input'], h.deps);
    expect(code).toBe(4);
    expect(h.stderr()).toContain(`No ${TOKEN_ENV_VAR} found`);
  });

  it('--workspace engineering (any case) lists only the Engineering projects', async () => {
    const h = makeHarness({ env: MEMORY_ENV });
    const code = await runCli(
      ['projects', 'list', '--workspace', 'engineering', '--no-input', '--json'],
      h.deps
    );
    expect(code).toBe(0);
    expect(projectsOf(h.stdout())).toEqual(ENGINEERING);
  });

  it('--workspace nope exits 3 with the service message', async () => {
    const h = makeHarness({ env: MEMORY_ENV });
    const code = await runCli(['projects', 'list', '--workspace', 'nope', '--no-input'], h.deps);
    expect(code).toBe(3);
    expect(h.stderr()).toContain('Workspace not found: nope');
  });

  it('projects get p-1 in memory mode returns the demo project', async () => {
    const h = makeHarness({ env: MEMORY_ENV });
    const code = await runCli(['projects', 'get', 'p-1', '--json'], h.deps);
    expect(code).toBe(0);
    expect(projectsOf(h.stdout())).toEqual([DEFAULT_IN_MEMORY_SEED.projects[0]]);
  });

  it('keeps stdout pure JSON and puts the notice on stderr only', async () => {
    const h = makeHarness({ env: MEMORY_ENV });
    await runCli(['projects', 'list', '--no-input', '--json'], h.deps);
    expect(() => JSON.parse(h.stdout()) as unknown).not.toThrow();
    expect(h.stdout()).not.toContain('Using in-memory demo data');
    expect(h.stderr()).toContain(`Using in-memory demo data (${SOURCE_ENV_VAR}=memory)`);
  });

  it('-q hides the notice', async () => {
    const h = makeHarness({ env: MEMORY_ENV });
    const code = await runCli(['-q', 'projects', 'list', '--no-input', '--json'], h.deps);
    expect(code).toBe(0);
    expect(h.stderr()).not.toContain('Using in-memory demo data');
  });

  it('ignores a token and TS_PROJECTS_API_URL instead of using them', async () => {
    const h = makeHarness({
      env: {
        ...MEMORY_ENV,
        [TOKEN_ENV_VAR]: 'ignored-token-1234',
        TS_PROJECTS_API_URL: 'http://127.0.0.1:1/api/1.0',
      },
    });
    const code = await runCli(['projects', 'list', '--no-input', '--json'], h.deps);
    expect(code).toBe(0);
    expect(projectsOf(h.stdout())).toEqual(DEFAULT_IN_MEMORY_SEED.projects);
  });

  it('still applies the config file workspace/limit defaults (resolveConfig kept)', async () => {
    const home = makeTempDir();
    const dir = join(home, '.config', 'ts-projects');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, CONFIG_FILE_NAME), 'workspace = "Engineering"\nlimit = 1\n', {
      mode: 0o600,
    });
    const h = makeHarness({ env: MEMORY_ENV, homedir: () => home });
    const code = await runCli(['projects', 'list', '--no-input', '--json'], h.deps);
    expect(code).toBe(0);
    expect(projectsOf(h.stdout())).toEqual(ENGINEERING.slice(0, 1));
  });

  it('--source foo exits 2 with the exact message', async () => {
    const h = makeHarness();
    const code = await runCli(['projects', 'list', '--source', 'foo', '--no-input'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain('Invalid source "foo": expected "http" or "memory"');
  });
});

describe('doctor and config get token vs source env', () => {
  it('doctor reports missing token as warn (exit 0) and present token as ok', async () => {
    const hNoTok = makeHarness({ env: MEMORY_ENV });
    expect(await runCli(['doctor', '--json'], hNoTok.deps)).toBe(0);
    const noTokPayload = JSON.parse(hNoTok.stdout()) as {
      checks: Array<{ name: string; status: string }>;
    };
    expect(noTokPayload.checks.find((c) => c.name === 'token')?.status).toBe('warn');

    const hTok = makeHarness({ env: { [TOKEN_ENV_VAR]: 'supersecret1234' } });
    expect(await runCli(['config', 'get', 'token', '--json'], hTok.deps)).toBe(0);
    expect(JSON.parse(hTok.stdout())).toEqual({
      key: 'token',
      value: '****1234',
      source: 'env',
    });
  });
});
