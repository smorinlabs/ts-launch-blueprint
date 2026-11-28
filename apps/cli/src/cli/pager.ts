// Interactive pager for tall text output (ADR 0008):
// Precedence: TS_PROJECTS_PAGER > PAGER > "less -FRX" (set-but-empty disables).
// Platform-aware argv tokenization (POSIX quotes/escapes vs Windows paths).
import { writeFileSync } from 'node:fs';

import { realPager } from './adapters.js';
import type { CliContext, CliDeps } from './deps.js';
import { type CliTableResult, type OutputFormat, renderFormattedResult } from './format.js';
import { isWindowsPlatform, TOOL_DIR_NAME } from './xdg-paths.js';

/** Default pager command (`-F` quit if one screen, `-R` pass ANSI, `-X` no alt-screen clear). */
export const DEFAULT_PAGER = 'less -FRX' as const;

const PAGER_ENV_VAR = `${TOOL_DIR_NAME.toUpperCase().replaceAll('-', '_')}_PAGER`;

/**
 * Resolve pager command: `TS_PROJECTS_PAGER` > `PAGER` > `"less -FRX"`.
 * A variable that is present in `env` (even empty `""`) stops fallthrough.
 */
export function resolvePagerCommand(env: Record<string, string | undefined>): string {
  for (const key of [PAGER_ENV_VAR, 'PAGER']) {
    if (Object.hasOwn(env, key) && env[key] !== undefined) {
      return env[key].trim();
    }
  }
  return DEFAULT_PAGER;
}

/**
 * Tokenize a pager command line per-platform:
 * - POSIX: supports `'...'`, `"..."`, and `\` escapes.
 * - Windows: preserves backslashes in paths (`C:\tools\less.exe`) and strips
 *   matching surrounding quotes (`"C:\Program Files\less.exe"`).
 */
export function parsePagerArgv(pager: string, platform?: string): string[] {
  const isWin = isWindowsPlatform(platform);
  const tokens: string[] = [];
  let current = '';
  let inToken = false;
  let quote: '"' | "'" | undefined;

  for (let i = 0; i < pager.length; i += 1) {
    const ch = pager[i]!;
    if (quote !== undefined) {
      if (ch === quote) {
        quote = undefined;
      } else if (!isWin && quote === '"' && ch === '\\' && i + 1 < pager.length) {
        i += 1;
        current += pager[i]!;
      } else {
        current += ch;
      }
      inToken = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      inToken = true;
      continue;
    }
    if (!isWin && ch === '\\' && i + 1 < pager.length) {
      i += 1;
      current += pager[i]!;
      inToken = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (inToken) {
        tokens.push(current);
        current = '';
        inToken = false;
      }
      continue;
    }
    current += ch;
    inToken = true;
  }
  if (inToken) {
    tokens.push(current);
  }
  return tokens;
}

/**
 * Write rendered output to `stdout`, piping through the interactive pager ONLY
 * when all 6 ADR-0008 gates hold:
 * 1. `mode === 'text'`
 * 2. `outputFile === undefined`
 * 3. `paging === true` (`!noInput`)
 * 4. `deps.stdoutIsTTY === true`
 * 5. `resolvePagerCommand(deps.env) !== ''`
 * 6. `lineCount >= terminalRows`
 * Falls back to direct `deps.stdout` if spawning or parsing fails.
 */
export function writePagedOutput(
  text: string,
  mode: OutputFormat,
  options: { outputFile?: string | undefined; paging: boolean },
  deps: Pick<CliDeps, 'stdout' | 'stdoutIsTTY' | 'env' | 'platform' | 'pager' | 'terminalRows'>
): void {
  const out = text === '' || text.endsWith('\n') ? text : `${text}\n`;
  if (mode !== 'text' || options.outputFile !== undefined || !options.paging || !deps.stdoutIsTTY) {
    deps.stdout(out);
    return;
  }
  const pagerCmd = resolvePagerCommand(deps.env);
  if (pagerCmd === '') {
    deps.stdout(out);
    return;
  }
  const rows = deps.terminalRows ?? process.stdout.rows ?? 24;
  const lineCount = out.split('\n').length - 1;
  if (lineCount < rows) {
    deps.stdout(out);
    return;
  }
  const argv = parsePagerArgv(pagerCmd, deps.platform);
  if (argv.length === 0) {
    deps.stdout(out);
    return;
  }
  try {
    const runner = deps.pager ?? realPager;
    if (runner(argv, out)) {
      return;
    }
  } catch {
    // Fall back to direct stdout so output is never lost.
  }
  deps.stdout(out);
}

/**
 * Render and deliver a CliTableResult to `--output-file` or `stdout` (paged when
 * interactive text output is tall). Returns the rendered document string.
 */
export function deliverResult(result: CliTableResult, ctx: CliContext, deps: CliDeps): string {
  const useColor =
    ctx.outputFile !== undefined
      ? ctx.colorMode === 'always'
      : ctx.colorMode === 'always' || (ctx.colorMode === 'auto' && deps.stdoutIsTTY);
  const useRich = ctx.outputFile === undefined && useColor;
  const rendered = renderFormattedResult(result, ctx.outputMode, useColor, useRich);
  const content = rendered === '' || rendered.endsWith('\n') ? rendered : `${rendered}\n`;

  if (ctx.outputFile !== undefined) {
    if (deps.fs !== undefined) {
      deps.fs.writeFileSync(ctx.outputFile, content, {});
    } else {
      writeFileSync(ctx.outputFile, content, 'utf8');
    }
    ctx.message(ctx.colors.success(`Results written to ${ctx.outputFile}`));
  } else {
    writePagedOutput(
      rendered,
      ctx.outputMode,
      { outputFile: undefined, paging: ctx.opts.input !== false },
      deps
    );
  }
  return rendered;
}
