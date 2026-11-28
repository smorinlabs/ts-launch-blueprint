// Tests for global output formatting, GFM markdown, relativeTime/richLink,
// --output-file across subcommands, TS000 crash log, interactive pager,
// first-run onboarding marker, and dual-sink logging (P11-TS05).
// cspell:ignore fakepager lesspipe Pfoo unwritable
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Project } from 'ts-launch-blueprint-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PagerRunner } from '../src/cli/adapters.js';
import { realPager } from '../src/cli/adapters.js';
import { colorEnabled, createColors } from '../src/cli/colors.js';
import { CONFIG_FILE_NAME, TOKEN_ENV_VAR } from '../src/cli/config.js';
import type { CliDeps } from '../src/cli/deps.js';
import {
  formatOutput,
  OUTPUT_FORMATS,
  relativeTime,
  renderFormattedResult,
  richLink,
} from '../src/cli/format.js';
import {
  createLogger,
  redactLogFields,
  resolveLevel,
  resolveLogFilePath,
} from '../src/cli/logger.js';
import {
  DEFAULT_PAGER,
  parsePagerArgv,
  resolvePagerCommand,
  writePagedOutput,
} from '../src/cli/pager.js';
import { runCli } from '../src/cli/router.js';
import { configDir } from '../src/cli/xdg-paths.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ts-projects-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeHarness(overrides: Partial<CliDeps> = {}): {
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
    env: {},
    homedir: () => makeTempDir(),
    stdoutIsTTY: false,
    stderrIsTTY: false,
    stdinIsTTY: false,
    fetchImpl: () => Promise.reject(new Error('no network in format tests')),
    prompter: () => Promise.resolve([]),
    clipboard: () => Promise.resolve(),
    spinner: () => ({ stop: () => undefined }),
    ...overrides,
  };
  return { deps, stdout: () => out.join(''), stderr: () => err.join('') };
}

describe('OUTPUT_FORMATS and pure formatters', () => {
  it('OUTPUT_FORMATS includes text, json, csv, markdown', () => {
    expect(OUTPUT_FORMATS).toEqual(['text', 'json', 'csv', 'markdown']);
  });

  it('formatOutput renders markdown GFM table with escaped pipes and title', () => {
    const projects: Project[] = [
      { id: '1', name: 'A|B', workspace: { name: 'W|1' } },
      { id: '2', name: 'Plain', workspace: null },
    ];
    const md = formatOutput(projects, 'markdown');
    expect(md).toBe(
      [
        '## Projects (2)',
        '',
        '| Name | Workspace | ID |',
        '| --- | --- | --- |',
        '| A\\|B | W\\|1 | 1 |',
        '| Plain | - | 2 |',
      ].join('\n')
    );
    expect(formatOutput([], 'markdown')).toBe('No projects found.');
  });

  it('formatOutput escapes newlines and carriage returns as <br> in markdown table cells', () => {
    const projects: Project[] = [{ id: '1\n2', name: 'A\nB\r\nC', workspace: { name: 'W|1\rZ' } }];
    const md = formatOutput(projects, 'markdown');
    expect(md).toBe(
      [
        '## Projects (1)',
        '',
        '| Name | Workspace | ID |',
        '| --- | --- | --- |',
        '| A<br>B<br>C | W\\|1<br>Z | 1<br>2 |',
      ].join('\n')
    );
  });

  it('renderFormattedResult handles empty table with humanNote and non-empty CSV/Markdown/JSON/Text', () => {
    const empty = {
      tableTitle: 'Projects (0)',
      tableColumns: () => ['Name', 'Workspace', 'ID'],
      tableRows: () => [],
      humanNote: () => 'No projects found.',
      toJson: () => ({ projects: [] }),
    };
    expect(renderFormattedResult(empty, 'text', false)).toBe('No projects found.');
    expect(renderFormattedResult(empty, 'markdown', false)).toBe('No projects found.');
    expect(renderFormattedResult(empty, 'csv', false)).toBe('Name,Workspace,ID');
    expect(JSON.parse(renderFormattedResult(empty, 'json', false))).toEqual({ projects: [] });
  });

  it('relativeTime formats past, present, and future deltas', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    expect(relativeTime(new Date('2026-06-01T11:59:30Z'), now)).toBe('just now');
    expect(relativeTime(new Date('2026-06-01T11:58:00Z'), now)).toBe('2 minutes ago');
    expect(relativeTime(new Date('2026-06-01T11:00:00Z'), now)).toBe('1 hour ago');
    expect(relativeTime(new Date('2026-05-30T12:00:00Z'), now)).toBe('2 days ago');
    expect(relativeTime(new Date('2026-06-03T12:00:00Z'), now)).toBe('in 2 days');
    expect(relativeTime(new Date('2025-05-01T12:00:00Z'), now)).toBe('1 year ago');
  });

  it('richLink emits OSC-8 hyperlink when enabled and plain text when disabled (preserving brackets)', () => {
    const link = richLink('a[b]', 'file:///tmp/a%5Bb%5D');
    expect(link).toBe('\x1b]8;;file:///tmp/a%5Bb%5D\x07a[b]\x1b]8;;\x07');
    expect(richLink('a[b]', 'file:///tmp/a%5Bb%5D', false)).toBe('a[b]');
  });
});

describe('global output precedence & --output-file across subcommands', () => {
  it('precedence: --json > -o > TS_PROJECTS_OUTPUT > [output].format > text', async () => {
    const home = makeTempDir();
    const cfgDir = configDir({}, () => home);
    mkdirSync(cfgDir, { recursive: true });
    writeFileSync(join(cfgDir, CONFIG_FILE_NAME), '[output]\nformat = "markdown"\n', {
      mode: 0o600,
    });

    // Config supplies markdown
    const hCfg = makeHarness({ homedir: () => home });
    expect(await runCli(['config', 'path'], hCfg.deps)).toBe(0);
    expect(hCfg.stdout()).toContain('| Config path | Exists |');

    // TS_PROJECTS_OUTPUT beats config
    const hEnv = makeHarness({ homedir: () => home, env: { TS_PROJECTS_OUTPUT: 'json' } });
    expect(await runCli(['config', 'path'], hEnv.deps)).toBe(0);
    expect(JSON.parse(hEnv.stdout())).toHaveProperty('exists');

    // -o beats TS_PROJECTS_OUTPUT
    const hFlag = makeHarness({ homedir: () => home, env: { TS_PROJECTS_OUTPUT: 'json' } });
    expect(await runCli(['config', 'path', '-o', 'csv'], hFlag.deps)).toBe(0);
    expect(hFlag.stdout()).toContain('Config path,Exists');

    // --json beats -o and TS_PROJECTS_OUTPUT
    const hJson = makeHarness({ homedir: () => home, env: { TS_PROJECTS_OUTPUT: 'csv' } });
    expect(await runCli(['-o', 'markdown', 'config', 'path', '--json'], hJson.deps)).toBe(0);
    expect(JSON.parse(hJson.stdout())).toHaveProperty('path');
  });

  it('invalid TS_PROJECTS_OUTPUT -> exit 2', async () => {
    const h = makeHarness({ env: { TS_PROJECTS_OUTPUT: 'yaml' } });
    expect(await runCli(['config', 'path'], h.deps)).toBe(2);
    expect(h.stderr()).toContain('yaml');
  });

  it('explicit --json and -o flags override invalid TS_PROJECTS_OUTPUT env', async () => {
    const hJson = makeHarness({ env: { TS_PROJECTS_OUTPUT: 'yaml' } });
    expect(await runCli(['--json', 'config', 'path'], hJson.deps)).toBe(0);
    expect(JSON.parse(hJson.stdout())).toHaveProperty('path');

    const hCsv = makeHarness({ env: { TS_PROJECTS_OUTPUT: 'yaml' } });
    expect(await runCli(['-o', 'csv', 'config', 'path'], hCsv.deps)).toBe(0);
    expect(hCsv.stdout()).toContain('Config path,Exists');
  });

  it('--output-file works across all subcommands and strips ANSI unless color=always', async () => {
    const home = makeTempDir();
    const cases: Array<{ name: string; argv: string[] }> = [
      { name: 'projects-list', argv: ['projects', 'list', '--source', 'memory', '--no-input'] },
      { name: 'projects-get', argv: ['projects', 'get', 'p-1', '--source', 'memory'] },
      { name: 'config-init', argv: ['config', 'init', '--yes', '--dry-run'] },
      { name: 'config-path', argv: ['config', 'path'] },
      { name: 'config-get', argv: ['config', 'get', 'output.format'] },
      { name: 'config-set', argv: ['config', 'set', 'output.color', 'auto', '--dry-run'] },
      { name: 'doctor', argv: ['doctor'] },
      { name: 'doctor-bundle', argv: ['doctor', '--bundle'] },
      { name: 'completion', argv: ['completion', 'bash'] },
    ];

    for (const c of cases) {
      const outFile = join(home, `${c.name}.out`);
      const h = makeHarness({ homedir: () => home, stdoutIsTTY: true });
      const code = await runCli([...c.argv, '--output-file', outFile], h.deps);
      expect(code).toBe(0);
      expect(h.stdout()).toBe('');
      const content = readFileSync(outFile, 'utf8');
      expect(content.length).toBeGreaterThan(0);
      // File is not a TTY: no ANSI escape codes when color=auto
      expect(content).not.toContain('\x1b[');
    }
  });
});

describe('TS000 unexpected-error crash log (ADR 0006)', () => {
  it('writes crash log in XDG state dir and prints full traceback / traceback_path', async () => {
    const stateHome = makeTempDir();
    const boomFetch = (() =>
      Promise.reject(new Error('non-domain-unexpected-boom'))) as unknown as typeof fetch;
    // Note: HttpProjectsRepository wraps fetch errors in ApiError; trigger unexpected error via a throwing prompter or fetchImpl getter,
    // or throwing inside spinner!
    const hText = makeHarness({
      env: { XDG_STATE_HOME: stateHome, [TOKEN_ENV_VAR]: 't' },
      stderrIsTTY: true,
      spinner: () => {
        throw new Error('kaboom-spinner');
      },
    });
    expect(await runCli(['projects', 'list', '--no-input'], hText.deps)).toBe(1);
    expect(hText.stderr()).toContain('TS000');
    expect(hText.stderr()).toContain('full traceback:');
    const crashPath = join(stateHome, 'ts-projects', 'ts-projects_crash.log');
    const crashBody = readFileSync(crashPath, 'utf8');
    expect(crashBody).toContain('kaboom-spinner');

    const hJson = makeHarness({
      env: { XDG_STATE_HOME: stateHome, [TOKEN_ENV_VAR]: 't' },
      stderrIsTTY: true,
      spinner: () => {
        throw new Error('kaboom-json');
      },
    });
    expect(await runCli(['projects', 'list', '--no-input', '--json'], hJson.deps)).toBe(1);
    const envelope = JSON.parse(hJson.stderr()) as {
      error: { code: number; name: string; error_code?: string; traceback_path?: string };
    };
    expect(envelope.error.code).toBe(1);
    expect(envelope.error.name).toBe('ERROR');
    expect(envelope.error.error_code).toBe('TS000');
    expect(envelope.error.traceback_path).toBe(crashPath);
    expect(boomFetch).toBeDefined();
  });

  it('best-effort crash log swallows unwritable state dir errors without masking original error', async () => {
    const home = makeTempDir();
    const blockedState = join(home, 'blocked-file');
    writeFileSync(blockedState, 'not-a-directory', 'utf8');
    const h = makeHarness({
      homedir: () => home,
      env: { XDG_STATE_HOME: blockedState, [TOKEN_ENV_VAR]: 't' },
      stderrIsTTY: true,
      spinner: () => {
        throw new Error('original-boom');
      },
    });
    expect(await runCli(['projects', 'list', '--no-input', '--json'], h.deps)).toBe(1);
    const envelope = JSON.parse(h.stderr()) as {
      error: { message: string; error_code?: string; traceback_path?: string };
    };
    expect(envelope.error.message).toContain('original-boom');
    expect(envelope.error.error_code).toBe('TS000');
    expect('traceback_path' in envelope.error).toBe(false);
  });
});

describe('interactive pager (ADR 0008)', () => {
  it('resolves pager precedence TS_PROJECTS_PAGER > PAGER > less -FRX (empty disables)', () => {
    expect(resolvePagerCommand({})).toBe(DEFAULT_PAGER);
    expect(resolvePagerCommand({ PAGER: 'more' })).toBe('more');
    expect(resolvePagerCommand({ PAGER: 'more', TS_PROJECTS_PAGER: 'bat' })).toBe('bat');
    expect(resolvePagerCommand({ PAGER: 'more', TS_PROJECTS_PAGER: '' })).toBe('');
  });

  it('tokenizes pager argv cleanly on POSIX and Windows', () => {
    expect(parsePagerArgv('less -FRX', 'linux')).toEqual(['less', '-FRX']);
    expect(parsePagerArgv('less -P"foo bar"', 'linux')).toEqual(['less', '-Pfoo bar']);
    expect(parsePagerArgv('C:\\tools\\less.exe -FRX', 'win32')).toEqual([
      'C:\\tools\\less.exe',
      '-FRX',
    ]);
    expect(parsePagerArgv('"C:\\Program Files\\less.exe" -FRX', 'win32')).toEqual([
      'C:\\Program Files\\less.exe',
      '-FRX',
    ]);
  });

  it('pages tall text output on stdout TTY and obeys all 6 disable gates + spawn fallback', async () => {
    const tallProjects: Project[] = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      name: `Proj ${i}`,
      workspace: { name: 'Eng' },
    }));
    const tallFetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: tallProjects }), { status: 200 })
      )) as unknown as typeof fetch;

    // 1. Invoked when all 6 gates hold
    const pagerCalls: Array<{ argv: string[]; input: string }> = [];
    const hPaged = makeHarness({
      stdoutIsTTY: true,
      terminalRows: 10,
      env: { [TOKEN_ENV_VAR]: 't', TS_PROJECTS_PAGER: 'fakepager --flag' },
      fetchImpl: tallFetch,
      pager: (argv, input) => {
        pagerCalls.push({ argv, input });
        return true;
      },
    });
    expect(await runCli(['projects', 'list'], hPaged.deps)).toBe(0);
    expect(pagerCalls).toHaveLength(1);
    expect(pagerCalls[0]?.argv).toEqual(['fakepager', '--flag']);
    expect(pagerCalls[0]?.input).toContain('Proj 29');
    expect(hPaged.stdout()).toBe('');

    // 2. Skipped when not stdoutIsTTY even if color=always
    const pagerNever = vi.fn<PagerRunner>(() => true);
    const home = makeTempDir();
    const cfgDir = configDir({}, () => home);
    mkdirSync(cfgDir, { recursive: true });
    writeFileSync(join(cfgDir, CONFIG_FILE_NAME), '[output]\ncolor = "always"\n', { mode: 0o600 });
    const hPipe = makeHarness({
      homedir: () => home,
      stdoutIsTTY: false,
      terminalRows: 10,
      env: { [TOKEN_ENV_VAR]: 't' },
      fetchImpl: tallFetch,
      pager: pagerNever,
    });
    expect(await runCli(['projects', 'list', '--no-input'], hPipe.deps)).toBe(0);
    expect(pagerNever).not.toHaveBeenCalled();
    expect(hPipe.stdout()).toContain('Proj 29');

    // 3. Skipped when --no-input? Wait: --no-input disables pager!
    // Verify with interactive TTY false vs true: even when stdoutIsTTY=true, --no-input disables pager!
    const hNoInput = makeHarness({
      stdoutIsTTY: true,
      terminalRows: 10,
      env: { [TOKEN_ENV_VAR]: 't' },
      fetchImpl: tallFetch,
      pager: pagerNever,
    });
    expect(await runCli(['projects', 'list', '--no-input'], hNoInput.deps)).toBe(0);
    expect(pagerNever).not.toHaveBeenCalled();

    // Wait: re-verify gate 1 with input enabled (stdinIsTTY: false so checkbox skipped, no --no-input)!
    const pagerCalledReal: string[][] = [];
    const hInteractivePaging = makeHarness({
      stdoutIsTTY: true,
      stdinIsTTY: false,
      terminalRows: 10,
      env: { [TOKEN_ENV_VAR]: 't', TS_PROJECTS_PAGER: 'fakepager --flag' },
      fetchImpl: tallFetch,
      pager: (argv) => {
        pagerCalledReal.push(argv);
        return true;
      },
    });
    expect(await runCli(['projects', 'list'], hInteractivePaging.deps)).toBe(0);
    expect(pagerCalledReal).toEqual([['fakepager', '--flag']]);

    // 4. Skipped when TS_PROJECTS_PAGER=""
    const hEmptyPager = makeHarness({
      stdoutIsTTY: true,
      terminalRows: 10,
      env: { [TOKEN_ENV_VAR]: 't', TS_PROJECTS_PAGER: '', PAGER: 'more' },
      fetchImpl: tallFetch,
      pager: pagerNever,
    });
    expect(await runCli(['projects', 'list'], hEmptyPager.deps)).toBe(0);
    expect(pagerNever).not.toHaveBeenCalled();

    // 5. Fallback to direct stdout when pager returns false (spawn failure)
    const hFallback = makeHarness({
      stdoutIsTTY: true,
      terminalRows: 10,
      env: { [TOKEN_ENV_VAR]: 't', TS_PROJECTS_PAGER: 'missing-pager' },
      fetchImpl: tallFetch,
      pager: () => false,
    });
    expect(await runCli(['projects', 'list'], hFallback.deps)).toBe(0);
    expect(hFallback.stdout()).toContain('Proj 29');
  });

  it('realPager returns true on exit 0, false on non-zero exit, and writePagedOutput falls back on non-zero exit', () => {
    expect(realPager([process.execPath, '-e', 'process.exit(0)'], 'hi')).toBe(true);
    expect(realPager([process.execPath, '-e', 'process.exit(1)'], 'hi')).toBe(false);

    const out: string[] = [];
    const tallText = Array.from({ length: 30 }, (_, i) => `line-${i}`).join('\n');
    writePagedOutput(
      tallText,
      'text',
      { paging: true },
      {
        stdout: (text) => out.push(text),
        stdoutIsTTY: true,
        terminalRows: 10,
        env: { TS_PROJECTS_PAGER: `"${process.execPath}" -e "process.exit(1)"` },
        platform: process.platform,
        pager: realPager,
      }
    );
    expect(out.join('')).toContain('line-29');
  });
});

describe('first-run onboarding hint (ADR 0009)', () => {
  it('shows hint once on interactive TTY stderr when no config loaded and creates marker', async () => {
    const stateHome = makeTempDir();
    const home = makeTempDir();
    const env = { XDG_STATE_HOME: stateHome, XDG_CONFIG_HOME: join(home, '.config') };

    // Suppressed under --json, -q, --no-input, piped stderr, or config init without burning marker
    for (const [, argv, extra] of [
      ['json', ['config', 'path', '--json'], { stderrIsTTY: true }],
      ['quiet', ['-q', 'config', 'path'], { stderrIsTTY: true }],
      ['no-input', ['--no-input', 'config', 'path'], { stderrIsTTY: true }],
      ['piped-stderr', ['config', 'path'], { stderrIsTTY: false }],
      ['config-init', ['config', 'init', '--yes', '--dry-run'], { stderrIsTTY: true }],
    ] as const) {
      const h = makeHarness({ env, homedir: () => home, ...extra });
      expect(await runCli([...argv], h.deps)).toBe(0);
      expect(h.stderr()).not.toContain('config init');
    }

    const markerPath = join(stateHome, 'ts-projects', 'ts-projects_first_run.marker');
    expect(existsSync(markerPath)).toBe(false);

    // Now interactive TTY text run shows hint and creates marker
    const hFirst = makeHarness({ env, homedir: () => home, stderrIsTTY: true });
    expect(await runCli(['config', 'path'], hFirst.deps)).toBe(0);
    expect(hFirst.stderr()).toContain('ts-projects config init');
    expect(readFileSync(markerPath, 'utf8')).toBe('');

    // Second run is silent
    const hSecond = makeHarness({ env, homedir: () => home, stderrIsTTY: true });
    expect(await runCli(['config', 'path'], hSecond.deps)).toBe(0);
    expect(hSecond.stderr()).not.toContain('ts-projects config init');
  });

  it('swallows unwritable state dir silently without printing hint', async () => {
    const home = makeTempDir();
    const blockedState = join(home, 'blocked');
    writeFileSync(blockedState, 'file', 'utf8');
    const h = makeHarness({
      homedir: () => home,
      env: { XDG_STATE_HOME: blockedState, XDG_CONFIG_HOME: join(home, '.config') },
      stderrIsTTY: true,
    });
    expect(await runCli(['config', 'path'], h.deps)).toBe(0);
    expect(h.stderr()).not.toContain('ts-projects config init');
  });
});

describe('dual-sink logging (--log-level, --log-file, TS_PROJECTS_LOG_*)', () => {
  it('--log-file and TS_PROJECTS_LOG_FILE="" enable file sink in XDG state dir', async () => {
    const stateHome = makeTempDir();
    const home = makeTempDir();

    // Explicit --log-file <path>
    const customLog = join(home, 'run.log');
    const hFlag = makeHarness({ homedir: () => home });
    expect(await runCli(['config', 'path', '--log-file', customLog], hFlag.deps)).toBe(0);
    const flagLines = readFileSync(customLog, 'utf8');
    expect(flagLines).toContain('invocation context ready');

    // Bare --log-file -> <state>/ts-projects/ts-projects.log
    const hBare = makeHarness({ homedir: () => home, env: { XDG_STATE_HOME: stateHome } });
    expect(await runCli(['config', 'path', '--log-file'], hBare.deps)).toBe(0);
    const defaultLog = join(stateHome, 'ts-projects', 'ts-projects.log');
    expect(readFileSync(defaultLog, 'utf8')).toContain('invocation context ready');

    // TS_PROJECTS_LOG_FILE="" -> <state>/ts-projects/ts-projects.log
    const stateHome2 = makeTempDir();
    const hEnvEmpty = makeHarness({
      homedir: () => home,
      env: { XDG_STATE_HOME: stateHome2, TS_PROJECTS_LOG_FILE: '' },
    });
    expect(await runCli(['config', 'path'], hEnvEmpty.deps)).toBe(0);
    expect(readFileSync(join(stateHome2, 'ts-projects', 'ts-projects.log'), 'utf8')).toContain(
      'invocation context ready'
    );
  });

  it('TS_PROJECTS_LOG_FORMAT=JSON writes JSONL; invalid TS_PROJECTS_LOG_FORMAT throws TS001', async () => {
    const home = makeTempDir();
    const logPath = join(home, 'jsonl.log');
    const hJsonl = makeHarness({
      homedir: () => home,
      env: { TS_PROJECTS_LOG_FORMAT: 'JSON', TS_PROJECTS_TOKEN: 'supersecret99' },
    });
    expect(await runCli(['config', 'path', '--log-file', logPath], hJsonl.deps)).toBe(0);
    const firstLine = readFileSync(logPath, 'utf8').trim().split('\n')[0]!;
    const parsed = JSON.parse(firstLine) as { level: string; event: string };
    expect(parsed.event).toBe('invocation context ready');

    const hBad = makeHarness({ homedir: () => home, env: { TS_PROJECTS_LOG_FORMAT: 'yaml' } });
    expect(await runCli(['config', 'path'], hBad.deps)).toBe(1);
    expect(hBad.stderr()).toContain('TS_PROJECTS_LOG_FORMAT');
    expect(hBad.stderr()).toContain('TS001');
  });

  it('--log-level and TS_PROJECTS_LOG_LEVEL override -q/-v/[logging].level', async () => {
    const hDbg = makeHarness({ env: { TS_PROJECTS_LOG_LEVEL: 'debug' } });
    expect(await runCli(['-q', 'config', 'path'], hDbg.deps)).toBe(0);
    expect(hDbg.stderr()).toContain('invocation context ready');

    const hBad = makeHarness({ env: { TS_PROJECTS_LOG_LEVEL: 'verbose' } });
    expect(await runCli(['config', 'path'], hBad.deps)).toBe(2);

    const hInvalidFlag = makeHarness();
    expect(await runCli(['config', 'path', '--log-level', 'verbose'], hInvalidFlag.deps)).toBe(2);
  });

  it('logger unit contracts: resolveLevel, redaction, ~ expansion, text file sink, and colorEnabled', () => {
    expect(resolveLevel({ verbose: 0, quiet: false, debug: false })).toBe('warning');
    expect(resolveLevel({ verbose: 1, quiet: false, debug: false })).toBe('info');
    expect(resolveLevel({ verbose: 2, quiet: false, debug: false })).toBe('debug');
    expect(resolveLevel({ verbose: 2, quiet: true, debug: false })).toBe('error');
    expect(resolveLevel({ verbose: 0, quiet: true, debug: true })).toBe('debug');

    expect(
      redactLogFields({
        token: 'secret',
        api_key: 'k',
        userPassword: 'pw',
        safe: 'ok',
      })
    ).toEqual({
      token: '[REDACTED]',
      api_key: '[REDACTED]',
      userPassword: '[REDACTED]',
      safe: 'ok',
    });

    expect(
      resolveLogFilePath({
        logFileFlag: '~/app.log',
        env: {},
        homedir: () => '/home/u',
        platform: 'linux',
        configFile: '',
      })
    ).toBe('/home/u/app.log');

    expect(
      resolveLogFilePath({
        logFileFlag: undefined,
        env: {},
        homedir: () => '/home/u',
        platform: 'linux',
        configFile: '~/.local/app.log',
      })
    ).toBe('/home/u/.local/app.log');

    const home = makeTempDir();
    const logPath = join(home, 'text-sink.log');
    const stderrLines: string[] = [];
    const logger = createLogger({
      stderr: (t) => stderrLines.push(t),
      level: 'debug',
      colors: createColors(false),
      filePath: logPath,
      fileLevel: 'info',
      fileFormat: 'text',
    });
    logger.debug('dbg-only', { password: 'hidden' });
    logger.info('inf-msg', { token: 'abc', count: 3 });
    logger.warn('wrn-msg');
    logger.error('err-msg');
    logger.critical('crit-msg');
    expect(stderrLines.join('')).toContain('debug: dbg-only password=[REDACTED]');
    expect(stderrLines.join('')).toContain('Warning: wrn-msg');
    expect(stderrLines.join('')).toContain('Error: err-msg');
    expect(stderrLines.join('')).toContain('Error: crit-msg');
    const fileContent = readFileSync(logPath, 'utf8');
    expect(fileContent).not.toContain('dbg-only');
    expect(fileContent).toContain('[info] inf-msg token=[REDACTED] count=3');
    expect(fileContent).not.toContain('\x1b[');

    expect(colorEnabled({ noColorFlag: true, env: { FORCE_COLOR: '1' }, isTTY: true })).toBe(false);
    expect(colorEnabled({ noColorFlag: false, env: { NO_COLOR: '1' }, isTTY: true })).toBe(false);
    expect(colorEnabled({ noColorFlag: false, env: { FORCE_COLOR: '1' }, isTTY: false })).toBe(
      true
    );
    expect(colorEnabled({ noColorFlag: false, env: {}, isTTY: false })).toBe(false);
  });

  it('createLogger preserves existing log file (EEXIST), rethrows non-EEXIST (EISDIR), and rotates >= 10 MiB logs', () => {
    const home = makeTempDir();

    // 1. Existing log file (EEXIST) preserves prior bytes and appends
    const existingLog = join(home, 'existing.log');
    writeFileSync(existingLog, 'prior-entry\n', 'utf8');
    const existingLogger = createLogger({
      stderr: () => undefined,
      level: 'info',
      colors: createColors(false),
      filePath: existingLog,
      fileLevel: 'info',
      fileFormat: 'text',
    });
    existingLogger.info('new-entry');
    const combined = readFileSync(existingLog, 'utf8');
    expect(combined.startsWith('prior-entry\n')).toBe(true);
    expect(combined).toContain('[info] new-entry');

    // 2. Non-EEXIST openSync error (e.g., ENOENT on empty path) is rethrown instead of swallowed
    expect(() =>
      createLogger({
        stderr: () => undefined,
        level: 'info',
        colors: createColors(false),
        filePath: '',
      })
    ).toThrow(/ENOENT/);

    // 3. >= 10 MiB log file rotates to .1 and shifts .1 -> .2 while tolerating absent .2-.4
    const rotatePath = join(home, 'rotate.log');
    writeFileSync(rotatePath, Buffer.alloc(10 * 1024 * 1024, 0x61));
    writeFileSync(`${rotatePath}.1`, 'older-backup-1\n', 'utf8');
    const rotatingLogger = createLogger({
      stderr: () => undefined,
      level: 'info',
      colors: createColors(false),
      filePath: rotatePath,
      fileLevel: 'info',
      fileFormat: 'text',
    });
    rotatingLogger.info('after-rotate');
    expect(readFileSync(rotatePath, 'utf8')).toContain('[info] after-rotate');
    expect(readFileSync(`${rotatePath}.1`).byteLength).toBe(10 * 1024 * 1024);
    expect(readFileSync(`${rotatePath}.2`, 'utf8')).toBe('older-backup-1\n');
    expect(existsSync(`${rotatePath}.3`)).toBe(false);
  });

  it('pager tokenization handles quotes, backslash escapes, and empty command', () => {
    expect(parsePagerArgv('less -P\\ a\\ b "c d" \'e f\'', 'linux')).toEqual([
      'less',
      '-P a b',
      'c d',
      'e f',
    ]);
    expect(parsePagerArgv('   ', 'linux')).toEqual([]);
  });
});
