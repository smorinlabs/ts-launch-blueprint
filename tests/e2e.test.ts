// Subprocess e2e tier (D-019(4) tier 2): spawn the BUILT CLI
// (node dist/cli.js) against a local mock HTTP server on an ephemeral
// 127.0.0.1 port, driven through the real process entry — signal
// handlers, stream wiring, env config. The API root is injected via the
// documented TS_PROJECTS_API_URL override (EXAMPLECLI.md).
//
// Key assertions the in-process tier cannot make: piped stdout is one
// clean JSON document with NO regex-stripping (D-018(5) — the source's
// progress-on-stdout wart is gone), and SIGINT/SIGTERM map to 130/143
// (closes S3a's deferred signal verification).
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const CLI = join(ROOT, 'dist', 'cli.js');

/** Newest mtime (ms) under a directory tree. */
function newestMtime(dir: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(path) : statSync(path).mtimeMs);
  }
  return newest;
}

/** Staleness-aware rebuild (claim-npm globalSetup pattern, D-019(4)). */
function buildIfStale(): void {
  let distMtime = 0;
  try {
    distMtime = statSync(CLI).mtimeMs;
  } catch {
    // dist/cli.js missing -> build.
  }
  const sourcesMtime = Math.max(
    newestMtime(join(ROOT, 'src')),
    statSync(join(ROOT, 'package.json')).mtimeMs,
    statSync(join(ROOT, 'tsdown.config.ts')).mtimeMs
  );
  if (sourcesMtime > distMtime) {
    execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'ignore' });
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

/** Mock projects API: Bearer good-token -> data; anything else -> 401. */
function startMockApi(): Promise<MockApi> {
  const server = createServer((req, res) => {
    if (req.headers.authorization !== 'Bearer good-token') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errors: [{ message: 'Not authorized' }] }));
      return;
    }
    const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    const body = path.endsWith('/workspaces')
      ? { data: [{ gid: 'ws1', name: 'Acme' }] }
      : { data: PROJECTS };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
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
      // 'exit' can fire before the stdio streams flush; 'close' waits.
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
  // Hermetic child env: isolated HOME (no user config), no inherited
  // TS_PROJECTS_*/color vars.
  baseEnv = {
    PATH: process.env['PATH'] ?? '',
    HOME: home,
    NO_COLOR: '1',
    TS_PROJECTS_TOKEN: 'good-token',
    TS_PROJECTS_API_URL: `${api.url}/api/1.0`,
  };
}, 120_000);

afterAll(() => {
  api.server.close();
  rmSync(home, { recursive: true, force: true });
});

describe('piped stdout purity (D-018(4,5))', () => {
  it('--format json parses as one clean document — no regex-stripping', async () => {
    const result = await runCliProcess(['projects', '--no-input', '--format', 'json'], baseEnv);
    expect(result.code).toBe(0);
    // The whole stream IS the document (plus the trailing newline):
    // no spinner bytes, no progress line, nothing to strip.
    expect(JSON.parse(result.stdout)).toEqual({ projects: PROJECTS });
    expect(result.stdout.startsWith('{')).toBe(true);
    expect(result.stderr).not.toContain('Fetching');
  });

  it('default command dispatch works through the real binary', async () => {
    const result = await runCliProcess(['--no-input', '--format', 'text'], baseEnv);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('1\n2\n');
  });
});

describe('exit codes end-to-end (D-016(2))', () => {
  it('success -> 0', async () => {
    const result = await runCliProcess(['projects', '--no-input'], baseEnv);
    expect(result.code).toBe(0);
  });

  it('rejected token (HTTP 401) -> 4 (auth)', async () => {
    const result = await runCliProcess(['projects', '--no-input'], {
      ...baseEnv,
      TS_PROJECTS_TOKEN: 'wrong-token',
    });
    expect(result.code).toBe(4);
    expect(result.stderr).toContain('API authentication failed');
    expect(result.stdout).toBe('');
  });

  it('unreachable server -> 1 (API/network error; source used 3)', async () => {
    const result = await runCliProcess(['projects', '--no-input'], {
      ...baseEnv,
      // TEST-NET-1 address with a tiny client timeout would hang; a
      // closed local port refuses instantly and deterministically.
      TS_PROJECTS_API_URL: 'http://127.0.0.1:1/api/1.0',
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('API request failed');
    expect(result.stdout).toBe('');
  });

  it('usage error -> 2 through the real binary', async () => {
    const result = await runCliProcess(['projects', '--format', 'yaml'], baseEnv);
    expect(result.code).toBe(2);
  });
});

/** Server that never answers /projects; resolves once the CLI's
 * request has arrived so the signal lands mid-fetch. */
function startSlowApi(): Promise<MockApi & { requestArrived: Promise<void> }> {
  let markArrived: () => void;
  const requestArrived = new Promise<void>((resolve) => {
    markArrived = resolve;
  });
  const server = createServer(() => {
    markArrived();
    // Never respond: the CLI hangs in the fetch until signaled.
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

describe('signal contract (S3a deferred verification: SIGINT/SIGTERM)', () => {
  async function signalMidFetch(signal: NodeJS.Signals): Promise<CliResult> {
    const slow = await startSlowApi();
    try {
      const child = spawnCli(['projects', '--no-input'], {
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
});
