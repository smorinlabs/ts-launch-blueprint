// Unexpected-error crash log (TS000, ADR 0006): appends UTC timestamp and
// stack trace to `<state>/<tool>/<tool>_crash.log` on a best-effort basis
// so reporting a crash never masks the original error.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import type { CliDeps } from './deps.js';
import { ensureDir, stateFile } from './xdg-paths.js';

/** Append `err` + UTC timestamp to the crash log and return its path (or `undefined` on OS error). */
export function writeCrashLog(
  err: unknown,
  deps: Pick<CliDeps, 'env' | 'homedir' | 'platform'>
): string | undefined {
  try {
    const crashPath = stateFile('crash', deps.env, deps.homedir, 'log', deps.platform);
    ensureDir(dirname(crashPath), mkdirSync, deps.platform);
    const stamp = new Date().toISOString();
    const detail =
      err instanceof Error ? (err.stack ?? `${err.name}: ${err.message}`) : String(err);
    appendFileSync(crashPath, `--- ${stamp} ---\n${detail}\n\n`, 'utf8');
    return crashPath;
  } catch {
    return undefined;
  }
}
