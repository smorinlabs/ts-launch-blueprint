// First-run onboarding hint (ADR 0009): prints a one-time stderr hint on
// interactive TTY runs when no config file was loaded and not `config init`.
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname } from 'node:path';

import type { CliContext, CliDeps } from './deps.js';
import { ensureDir, stateFile, TOOL_DIR_NAME } from './xdg-paths.js';

/** Emit the one-time first-run onboarding hint iff all 7 ADR-0009 gates hold. */
export function maybeShowFirstRunHint(
  ctx: CliContext,
  deps: Pick<CliDeps, 'stderrIsTTY' | 'env' | 'homedir' | 'platform'>,
  commandPath: string
): void {
  if (ctx.opts.input === false || ctx.opts.quiet || !deps.stderrIsTTY) {
    return;
  }
  if (ctx.outputMode === 'json') {
    return;
  }
  if (ctx.resolvedConfig.loadedPaths.length > 0) {
    return;
  }
  if (commandPath === 'config init') {
    return;
  }
  const marker = stateFile('first_run', deps.env, deps.homedir, 'marker', deps.platform);
  try {
    ensureDir(dirname(marker), mkdirSync, deps.platform);
    closeSync(openSync(marker, 'wx', 0o600));
  } catch {
    return;
  }
  ctx.message(
    `Welcome to ${TOOL_DIR_NAME}! Run ${TOOL_DIR_NAME} config init to create a config file. (This hint is shown once.)`
  );
}
