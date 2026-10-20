// Subprocess e2e for the API: build if stale, start the BUILT server
// (dist/server.js) on a free port, wait for its startup line, then call it
// over real HTTP. Node-only; the Bun lane's `--exclude tests/e2e.test.ts`
// already skips it (matched per Vitest project).
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const SERVER = join(ROOT, 'dist', 'server.js');

/** Newest mtime (ms) under a directory tree, skipping boundary-test probes
 * and tolerating a file vanishing mid-walk (same rules as the CLI e2e). */
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
      // Removed between readdir and stat: it no longer affects the build.
    }
  }
  return newest;
}

/** Rebuild when the API source, the bundled core, or the build config changed. */
function buildIfStale(): void {
  let distMtime = 0;
  try {
    distMtime = statSync(SERVER).mtimeMs;
  } catch {
    // dist/server.js missing -> build.
  }
  const sourcesMtime = Math.max(
    newestMtime(join(ROOT, 'src')),
    newestMtime(join(ROOT, '..', '..', 'packages', 'core', 'src')),
    statSync(join(ROOT, 'package.json')).mtimeMs,
    statSync(join(ROOT, 'tsdown.config.ts')).mtimeMs
  );
  if (sourcesMtime > distMtime) {
    execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'ignore' });
  }
}

/** A free TCP port: listen on 0, read the port, close. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

/** Start a built server with a hermetic env (no inherited TS_PROJECTS_*, so
 * the in-memory default applies); resolves once it logs its startup line. */
async function startServer(
  server: string,
  cwd: string
): Promise<{ child: ChildProcess; url: string; stdout: () => string }> {
  const port = await freePort();
  const started = spawn(process.execPath, [server], {
    cwd,
    env: { PATH: process.env['PATH'] ?? '', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  await new Promise<void>((resolve, reject) => {
    started.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.includes(`listening on :${port} (source: memory)`)) {
        resolve();
      }
    });
    started.once('exit', (code) => reject(new Error(`server exited early (${code})`)));
  });
  return { child: started, url: `http://127.0.0.1:${port}`, stdout: () => stdout };
}

let child: ChildProcess;
let baseUrl: string;

beforeAll(async () => {
  buildIfStale();
  ({ child, url: baseUrl } = await startServer(SERVER, ROOT));
}, 120_000);

afterAll(() => {
  child.kill();
});

describe('API end-to-end (built server)', () => {
  it('GET /healthz -> 200 {status: ok}', async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('an unknown workspace -> 404 NOT_FOUND', async () => {
    const input = encodeURIComponent(JSON.stringify({ workspaceName: 'nope' }));
    const response = await fetch(`${baseUrl}/trpc/projects.list?input=${input}`);
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { data: { code: string } } };
    expect(body.error.data.code).toBe('NOT_FOUND');
  });

  it('GET /trpc/projects.list -> the 4 demo projects with no token', async () => {
    const response = await fetch(`${baseUrl}/trpc/projects.list`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { result: { data: { projects: unknown[] } } };
    expect(body.result.data.projects).toHaveLength(4);
  });
});

describe('API process lifecycle (built server)', () => {
  it('exits 0 within 5 s on SIGTERM and logs the shutdown line', async () => {
    const server = await startServer(SERVER, ROOT);
    const exited = new Promise<number | null>((resolve) => {
      server.child.once('exit', (code) => resolve(code));
    });
    server.child.kill('SIGTERM');
    const timeout = new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), 5000).unref();
    });
    expect(await Promise.race([exited, timeout])).toBe(0);
    expect(server.stdout()).toContain('shutting down (SIGTERM)');
  });

  it('runs from a folder with only dist/ (no node_modules): every dependency is bundled', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'ts-api-dist-only-'));
    try {
      cpSync(join(ROOT, 'dist'), join(folder, 'dist'), { recursive: true });
      const server = await startServer(join(folder, 'dist', 'server.js'), folder);
      try {
        const response = await fetch(`${server.url}/trpc/projects.list`);
        expect(response.status).toBe(200);
      } finally {
        server.child.kill('SIGTERM');
      }
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
