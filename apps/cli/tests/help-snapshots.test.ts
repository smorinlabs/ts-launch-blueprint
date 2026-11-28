// Golden snapshots of every command's --help output at a deterministic 80 columns (P08-TS04, Q3.A).
import { describe, expect, it } from 'vitest';

import { realClipboard, realPrompter, realSpinner } from '../src/cli/adapters.js';
import type { CliDeps } from '../src/cli/deps.js';
import { runCli } from '../src/cli/router.js';

function makeHelpHarness(
  env: Record<string, string | undefined> = {},
  stdoutIsTTY = false
): {
  deps: CliDeps;
  stdout: () => string;
  stderr: () => string;
} {
  const out: string[] = [];
  const err: string[] = [];
  const deps: CliDeps = {
    stdout: (text) => {
      out.push(text);
    },
    stderr: (text) => {
      err.push(text);
    },
    env,
    homedir: () => '/nonexistent-home',
    stdoutIsTTY,
    stderrIsTTY: false,
    stdinIsTTY: false,
    fetchImpl: (async () => {
      throw new Error('fetch should not be called by --help');
    }) as typeof fetch,
    prompter: realPrompter,
    clipboard: realClipboard,
    spinner: realSpinner,
  };
  return {
    deps,
    stdout: () => out.join(''),
    stderr: () => err.join(''),
  };
}

const HELP_COMMANDS: ReadonlyArray<{ label: string; argv: string[] }> = [
  { label: 'root', argv: [] },
  { label: 'projects', argv: ['projects'] },
  { label: 'config', argv: ['config'] },
];

describe('CLI --help golden snapshots', () => {
  it.each(HELP_COMMANDS)(
    'matches committed 80-column --help snapshot for $label',
    async ({ argv }) => {
      const { deps, stdout, stderr } = makeHelpHarness({ COLUMNS: '160' });
      const code = await runCli([...argv, '--help'], deps);
      expect(code).toBe(0);
      expect(stderr()).toBe('');
      expect(stdout()).toMatchSnapshot();
    }
  );

  it('locks 80-column help width via deps.stdoutIsTTY even when process.stdout is a wide TTY', async () => {
    const isTtyDesc = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    const colsDesc = Object.getOwnPropertyDescriptor(process.stdout, 'columns');
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    Object.defineProperty(process.stdout, 'columns', { value: 200, configurable: true });
    try {
      const { deps, stdout } = makeHelpHarness();
      const code = await runCli(['--help'], deps);
      expect(code).toBe(0);
      expect(stdout()).toContain('(default:\n                      false)');
    } finally {
      if (isTtyDesc === undefined) {
        Reflect.deleteProperty(process.stdout, 'isTTY');
      } else {
        Object.defineProperty(process.stdout, 'isTTY', isTtyDesc);
      }
      if (colsDesc === undefined) {
        Reflect.deleteProperty(process.stdout, 'columns');
      } else {
        Object.defineProperty(process.stdout, 'columns', colsDesc);
      }
    }
  });

  it('uses process.stdout.columns (falling back to 80) when deps.stdoutIsTTY is true', async () => {
    const colsDesc = Object.getOwnPropertyDescriptor(process.stdout, 'columns');
    try {
      Object.defineProperty(process.stdout, 'columns', { value: 200, configurable: true });
      const wide = makeHelpHarness({}, true);
      expect(await runCli(['--help'], wide.deps)).toBe(0);
      expect(wide.stdout()).toContain('(default: false)');

      Object.defineProperty(process.stdout, 'columns', { value: undefined, configurable: true });
      const fallback = makeHelpHarness({}, true);
      expect(await runCli(['--help'], fallback.deps)).toBe(0);
      expect(fallback.stdout()).toContain('(default:\n                      false)');
    } finally {
      if (colsDesc === undefined) {
        Reflect.deleteProperty(process.stdout, 'columns');
      } else {
        Object.defineProperty(process.stdout, 'columns', colsDesc);
      }
    }
  });
});
