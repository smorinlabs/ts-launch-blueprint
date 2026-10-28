// The built web bundle holds no API runtime code ([web-types-only-from-api],
// D-054): build if stale (like the API e2e), then search dist/assets.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const ASSETS = join(ROOT, 'dist', 'assets');

/** Newest mtime (ms) under a directory tree, skipping boundary-test probes. */
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

/** Rebuild when the web source, its config or index.html changed. */
function buildIfStale(): void {
  let distMtime = 0;
  try {
    distMtime = statSync(join(ROOT, 'dist', 'index.html')).mtimeMs;
  } catch {
    // Never built -> build.
  }
  const sourcesMtime = Math.max(
    newestMtime(join(ROOT, 'src')),
    ...['index.html', 'package.json', 'vite.config.ts'].map(
      (file) => statSync(join(ROOT, file)).mtimeMs
    )
  );
  if (sourcesMtime > distMtime) {
    execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'ignore' });
  }
}

describe('web bundle', () => {
  it('contains no API runtime code (Hono, pino, prom-client, OpenTelemetry, the procedures)', () => {
    buildIfStale();
    const code = readdirSync(ASSETS)
      .filter((file) => file.endsWith('.js'))
      .map((file) => readFileSync(join(ASSETS, file), 'utf8'))
      .join('\n');
    expect(code).toContain('/trpc');
    const markers = ['hono', 'pino', 'prom-client', 'opentelemetry', 'listProjects'];
    expect(markers.filter((marker) => code.includes(marker))).toEqual([]);
  }, 60_000);
});
