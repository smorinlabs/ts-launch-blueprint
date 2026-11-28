// Subprocess e2e tier (D-019(4) tier 2): spawn the BUILT CLI (node dist/cli.js)
// against a local mock HTTP server on 127.0.0.1.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const CLI = join(ROOT, 'dist', 'cli.js');

function newestMtime(dir: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('__boundary-probe-')) {
      continue;
    }
    const path = join(dir, entry.name);
    try {
      newest = Math.max(newest, entry.isDirectory() ? newestMtime(path) : statSync(path).mtimeMs);
    } catch {
      // Removed between readdir and stat.
    }
  }
  return newest;
}

function buildIfStale(): void {
  let distMtime = 0;
  try {
    distMtime = statSync(CLI).mtimeMs;
  } catch {
    // dist/cli.js missing -> build.
  }
  const sourcesMtime = Math.max(
    newestMtime(join(ROOT, 'src')),
    newestMtime(join(ROOT, '..', '..', 'packages', 'core', 'src')),
    statSync(join(ROOT, 'package.json')).mtimeMs,
    statSync(join(ROOT, 'tsdown.config.ts')).mtimeMs
  );
  if (sourcesMtime > distMtime) {
    execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
      cwd: ROOT,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
  }
}

const PROJECTS = [
  { id: '1', name: 'Alpha', workspace: { name: 'Acme' } },
  { id: '2', name: 'Beta', workspace: { name: 'Acme' } },
];

interface MockApi {
  url: string;
  server: Server;
}

function startMockApi(): Promise<MockApi> {
  const server = createServer((req, res) => {
    if (req.headers.authorization !== 'Bearer good-token') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errors: [{ message: 'Not authorized' }] }));
      return;
    }
    const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    if (path.endsWith('/workspaces')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ gid: 'ws1', name: 'Acme' }] }));
      return;
    }
    const itemMatch = path.match(/\/projects\/([^/]+)$/);
    if (itemMatch !== null) {
      const id = decodeURIComponent(itemMatch[1]!);
      const found = PROJECTS.find((p) => p.id === id);
      if (found === undefined) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errors: [{ message: 'Not found' }] }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: found }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: PROJECTS }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        throw new Error('mock API failed to bind');
      }
      resolve({ url: `http://127.0.0.1:${address.port}`, server });
    });
  });
}

interface CliResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

function spawnCli(args: string[], env: Record<string, string>): ChildProcess {
  return spawn(process.execPath, [CLI, ...args], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function collect(child: ChildProcess): Promise<CliResult> {
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk));
  child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
  return new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      child.on('close', () =>
        resolve({
          code,
          signal,
          stdout: Buffer.concat(stdout).toString('utf8'),
          stderr: Buffer.concat(stderr).toString('utf8'),
        })
      );
    });
  });
}

function runCliProcess(args: string[], env: Record<string, string>): Promise<CliResult> {
  return collect(spawnCli(args, env));
}

let api: MockApi;
let home: string;
let baseEnv: Record<string, string>;

beforeAll(async () => {
  buildIfStale();
  api = await startMockApi();
  home = mkdtempSync(join(tmpdir(), 'ts-projects-e2e-'));
  baseEnv = {
    PATH: process.env['PATH'] ?? '',
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: join(home, '.config'),
    XDG_STATE_HOME: join(home, '.local', 'state'),
    NO_COLOR: '1',
    TS_PROJECTS_TOKEN: 'good-token',
    TS_PROJECTS_API_URL: `${api.url}/api/1.0`,
  };
}, 120_000);

afterAll(() => {
  api.server.close();
  rmSync(home, { recursive: true, force: true });
});

describe('noun-verb CLI e2e (Q3.A, Q4.A)', () => {
  it('bare invocation prints root help and exits 0', async () => {
    const result = await runCliProcess([], baseEnv);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('Usage: ts-projects [options] [command]');
  });

  it('projects list -o json parses as one clean document', async () => {
    const result = await runCliProcess(['projects', 'list', '--no-input', '-o', 'json'], baseEnv);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ projects: PROJECTS });
    expect(result.stdout.startsWith('{')).toBe(true);
    expect(result.stderr).not.toContain('Fetching');
  });

  it('projects get 1 succeeds and projects get 999 exits 3', async () => {
    const ok = await runCliProcess(['projects', 'get', '1', '--json'], baseEnv);
    expect(ok.code).toBe(0);
    expect(JSON.parse(ok.stdout)).toEqual({ projects: [PROJECTS[0]] });

    const missing = await runCliProcess(['projects', 'get', '999', '--json'], baseEnv);
    expect(missing.code).toBe(3);
    const err = JSON.parse(missing.stderr) as { error: { error_code?: string; code: number } };
    expect(err.error.code).toBe(3);
    expect(err.error.error_code).toBe('TS005');
  });

  it('doctor --json, completion bash, and config path --json work end-to-end', async () => {
    const doc = await runCliProcess(['doctor', '--json'], baseEnv);
    expect(doc.code).toBe(0);
    expect(JSON.parse(doc.stdout)).toHaveProperty('checks');

    const comp = await runCliProcess(['completion', 'bash'], baseEnv);
    expect(comp.code).toBe(0);
    expect(comp.stdout).toContain('ts-projects');

    const cfgPath = await runCliProcess(['config', 'path', '--json'], baseEnv);
    expect(cfgPath.code).toBe(0);
    expect(JSON.parse(cfgPath.stdout)).toEqual({
      path: join(home, '.config', 'ts-projects', 'ts-projects_config.toml'),
      exists: false,
    });
  });

  it('--output-file redirects output cleanly through the real binary', async () => {
    const outFile = join(home, 'e2e-out.json');
    const result = await runCliProcess(
      ['projects', 'list', '--no-input', '--json', '--output-file', outFile],
      baseEnv
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('');
    expect(JSON.parse(readFileSync(outFile, 'utf8'))).toEqual({ projects: PROJECTS });
  });
});

describe('demo mode: in-memory data source end-to-end', () => {
  it('TS_PROJECTS_SOURCE=memory lists the 4 demo projects with no token configured', async () => {
    const { TS_PROJECTS_TOKEN: _token, ...envWithoutToken } = baseEnv;
    const result = await runCliProcess(['projects', 'list', '--no-input', '--json'], {
      ...envWithoutToken,
      TS_PROJECTS_SOURCE: 'memory',
    });
    expect(result.code).toBe(0);
    expect((JSON.parse(result.stdout) as { projects: unknown[] }).projects).toHaveLength(4);
    expect(result.stderr).toContain('Using in-memory demo data');
  });
});

describe('exit codes end-to-end (D-016(2))', () => {
  it('success -> 0', async () => {
    const result = await runCliProcess(['projects', 'list', '--no-input'], baseEnv);
    expect(result.code).toBe(0);
  });

  it('rejected token (HTTP 401) -> 4 (auth)', async () => {
    const result = await runCliProcess(['projects', 'list', '--no-input'], {
      ...baseEnv,
      TS_PROJECTS_TOKEN: 'wrong-token',
    });
    expect(result.code).toBe(4);
    expect(result.stderr).toContain('API authentication failed');
    expect(result.stdout).toBe('');
  });

  it('unreachable server -> 1 (API/network error)', async () => {
    const result = await runCliProcess(['projects', 'list', '--no-input'], {
      ...baseEnv,
      TS_PROJECTS_API_URL: 'http://127.0.0.1:1/api/1.0',
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('API request failed');
    expect(result.stdout).toBe('');
  });

  it('usage error -> 2 through the real binary', async () => {
    const result = await runCliProcess(['projects', 'list', '-o', 'yaml'], baseEnv);
    expect(result.code).toBe(2);
  });
});

function startSlowApi(): Promise<MockApi & { requestArrived: Promise<void> }> {
  let markArrived: () => void;
  const requestArrived = new Promise<void>((resolve) => {
    markArrived = resolve;
  });
  const server = createServer(() => {
    markArrived();
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        throw new Error('slow API failed to bind');
      }
      resolve({ url: `http://127.0.0.1:${address.port}`, server, requestArrived });
    });
  });
}

async function signalMidFetch(signal: NodeJS.Signals): Promise<CliResult> {
  const slow = await startSlowApi();
  try {
    const child = spawnCli(['projects', 'list', '--no-input'], {
      ...baseEnv,
      TS_PROJECTS_API_URL: `${slow.url}/api/1.0`,
    });
    const result = collect(child);
    await slow.requestArrived;
    child.kill(signal);
    return await result;
  } finally {
    slow.server.close();
  }
}

describe.skipIf(process.platform === 'win32')(
  'signal contract (S3a deferred verification: SIGINT/SIGTERM)',
  () => {
    it('SIGINT after connect -> exit 130', async () => {
      const result = await signalMidFetch('SIGINT');
      expect(result.code).toBe(130);
      expect(result.signal).toBeNull();
    }, 15_000);

    it('SIGTERM after connect -> exit 143', async () => {
      const result = await signalMidFetch('SIGTERM');
      expect(result.code).toBe(143);
      expect(result.signal).toBeNull();
    }, 15_000);
  }
);
