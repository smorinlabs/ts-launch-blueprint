// In-process CLI core tests (D-016(1), D-019(4) tier 1): runCli(argv,
// deps) with injected writers/env — no subprocess, no process.exit.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createColors } from '../src/lib/colors.js';
import { CONFIG_FILE_NAME, TOKEN_ENV_VAR } from '../src/lib/config.js';
import { type CliDeps, realDeps, runCli } from '../src/router.js';
import { VERSION } from '../src/version.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ts-projects-cli-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

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
    fetchImpl: () => Promise.reject(new Error('no network in cli-core tests')),
    prompter: () => Promise.resolve([]),
    clipboard: () => Promise.resolve(),
    spinner: () => ({ stop: () => undefined }),
    ...overrides,
  };
  return { deps, stdout: () => out.join(''), stderr: () => err.join('') };
}

// eslint-disable-next-line no-control-regex -- ANSI escape detection
const ANSI_PATTERN = /\[/;

describe('version and help (cli-standards R4.1)', () => {
  it('--version prints ts-projects plus the version, exit 0', async () => {
    const h = makeHarness();
    const code = await runCli(['--version'], h.deps);
    expect(code).toBe(0);
    expect(h.stdout()).toBe(`ts-projects ${VERSION}\n`);
    expect(h.stderr()).toBe('');
  });

  it('-V is the short version flag', async () => {
    const h = makeHarness();
    expect(await runCli(['-V'], h.deps)).toBe(0);
    expect(h.stdout()).toContain(`ts-projects ${VERSION}`);
  });

  it('--help shows usage and the global options, exit 0', async () => {
    const h = makeHarness();
    const code = await runCli(['--help'], h.deps);
    expect(code).toBe(0);
    const help = h.stdout();
    expect(help).toContain('Usage: ts-projects [options] [command]');
    for (const flag of [
      '-V, --version',
      '-h, --help',
      '-v, --verbose',
      '-q, --quiet',
      '--no-color',
      '--config <path>',
      '--debug',
      '--token <token>',
    ]) {
      expect(help).toContain(flag);
    }
    expect(help).toContain('projects');
    expect(help).toContain('config');
  });

  it('no arguments dispatches to the default projects command', async () => {
    // Source parity: bare `py-projects` ran the command; with no token
    // anywhere that is the missing-token auth path (exit 4, D-016(2)).
    const h = makeHarness();
    expect(await runCli([], h.deps)).toBe(4);
    expect(h.stderr()).toContain('No TS_PROJECTS_TOKEN found');
  });
});

describe('usage errors (exit 2, D-016(2,8))', () => {
  it('unknown flag -> exit 2 with a did-you-mean suggestion', async () => {
    const h = makeHarness();
    const code = await runCli(['--verbos'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain("unknown option '--verbos'");
    expect(h.stderr()).toContain('Did you mean --verbose?');
    expect(h.stdout()).toBe('');
  });

  it('unknown command word -> exit 2 usage error', async () => {
    // With projects as the DEFAULT command (S3b), a stray word becomes
    // an unexpected operand of projects — the same usage-error semantics
    // as bare `py-projects projcts` under click ("unexpected extra
    // argument", exit 2). Option did-you-mean is unaffected (above).
    const h = makeHarness();
    const code = await runCli(['projcts'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain("too many arguments for 'projects'");
    expect(h.stderr()).toContain('projcts');
  });
});

describe('config --show (token resolution surface)', () => {
  it('env token -> exit 0, redacted token on stdout only', async () => {
    const h = makeHarness({ env: { [TOKEN_ENV_VAR]: 'supersecret1234' } });
    const code = await runCli(['config', '--show'], h.deps);
    expect(code).toBe(0);
    expect(h.stdout()).toContain('token = "***1234" (source: env)');
    expect(h.stdout()).not.toContain('supersecret1234');
    expect(h.stderr()).not.toContain('supersecret1234');
  });

  it('flag token beats env token', async () => {
    const h = makeHarness({ env: { [TOKEN_ENV_VAR]: 'envtokenvalue1' } });
    const code = await runCli(['--token', 'flagtokenvalue2', 'config', '--show'], h.deps);
    expect(code).toBe(0);
    expect(h.stdout()).toContain('token = "***lue2" (source: flag)');
  });

  it('file token surfaces workspace/limit and the file path', async () => {
    const home = makeTempDir();
    const dir = join(home, '.config', 'ts-projects');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, CONFIG_FILE_NAME),
      'token = "filetoken5678"\nworkspace = "Acme"\nlimit = 50\n',
      { mode: 0o600 }
    );
    const h = makeHarness({ homedir: () => home });
    const code = await runCli(['config', '--show'], h.deps);
    expect(code).toBe(0);
    const output = h.stdout();
    expect(output).toContain('token = "***5678" (source: file)');
    expect(output).toContain('workspace = "Acme"');
    expect(output).toContain('limit = 50');
    expect(output).toContain(join(dir, CONFIG_FILE_NAME));
  });

  it('missing token everywhere -> exit 4 with the three remedies on stderr', async () => {
    const h = makeHarness();
    const code = await runCli(['config', '--show'], h.deps);
    expect(code).toBe(4);
    expect(h.stdout()).toBe('');
    const err = h.stderr();
    expect(err).toContain('No TS_PROJECTS_TOKEN found');
    expect(err).toContain('three options');
    expect(err).toContain('--token');
    expect(err).toContain(`export ${TOKEN_ENV_VAR}=`);
    expect(err).toContain(CONFIG_FILE_NAME);
  });

  it('nonexistent --config -> exit 2 usage error', async () => {
    const home = makeTempDir();
    const h = makeHarness({ homedir: () => home });
    const code = await runCli(['--config', join(home, 'nope.toml'), 'config', '--show'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain('Config file does not exist');
  });

  it('malformed TOML -> exit 1 config error', async () => {
    const home = makeTempDir();
    const dir = join(home, '.config', 'ts-projects');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, CONFIG_FILE_NAME), 'token = broken\n', { mode: 0o600 });
    const h = makeHarness({ homedir: () => home });
    const code = await runCli(['config', '--show'], h.deps);
    expect(code).toBe(1);
    expect(h.stderr()).toContain('Invalid TOML');
  });

  it('config without --show prints the subcommand help', async () => {
    const h = makeHarness();
    const code = await runCli(['config'], h.deps);
    expect(code).toBe(0);
    expect(h.stdout()).toContain('--show');
  });
});

describe('verbosity ladder (D-018(3), cli-standards R4.4)', () => {
  const env = { [TOKEN_ENV_VAR]: 'supersecret1234' };

  it('default level shows info but not debug/trace', async () => {
    const h = makeHarness({ env });
    await runCli(['config', '--show'], h.deps);
    expect(h.stderr()).toContain('resolved configuration');
    expect(h.stderr()).not.toContain('token source:');
    expect(h.stderr()).not.toContain('trace:');
  });

  it('-v adds debug output', async () => {
    const h = makeHarness({ env });
    await runCli(['-v', 'config', '--show'], h.deps);
    expect(h.stderr()).toContain('token source: env');
    expect(h.stderr()).not.toContain('trace:');
  });

  it('-vv adds trace output', async () => {
    const h = makeHarness({ env });
    await runCli(['-v', '-v', 'config', '--show'], h.deps);
    expect(h.stderr()).toContain('token source: env');
    expect(h.stderr()).toContain('configuration resolution complete');
  });

  it('-q suppresses info', async () => {
    const h = makeHarness({ env });
    await runCli(['-q', 'config', '--show'], h.deps);
    expect(h.stderr()).not.toContain('resolved configuration');
  });

  it('quiet beats verbose when both are given', async () => {
    const h = makeHarness({ env });
    await runCli(['-q', '-v', 'config', '--show'], h.deps);
    expect(h.stderr()).not.toContain('resolved configuration');
    expect(h.stderr()).not.toContain('token source:');
  });

  it('--debug overrides --quiet', async () => {
    const h = makeHarness({ env });
    await runCli(['--debug', '-q', 'config', '--show'], h.deps);
    expect(h.stderr()).toContain('token source: env');
  });

  it.skipIf(process.platform === 'win32')(
    '-q still shows warnings (loose permissions)',
    async () => {
      const home = makeTempDir();
      const dir = join(home, '.config', 'ts-projects');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, CONFIG_FILE_NAME), 'token = "filetoken5678"\n', {
        mode: 0o644,
      });
      const h = makeHarness({ homedir: () => home });
      const code = await runCli(['-q', 'config', '--show'], h.deps);
      expect(code).toBe(0);
      expect(h.stderr()).toContain('chmod 600');
    }
  );
});

describe('stack traces (source --verbose traceback intent)', () => {
  it('hides the stack by default', async () => {
    const h = makeHarness();
    await runCli(['config', '--show'], h.deps);
    expect(h.stderr()).not.toContain('at ');
  });

  it('shows the stack under --debug', async () => {
    const h = makeHarness();
    await runCli(['--debug', 'config', '--show'], h.deps);
    expect(h.stderr()).toContain('AuthError');
    expect(h.stderr()).toMatch(/\n\s+at /);
  });

  it('shows the stack under -v', async () => {
    const h = makeHarness();
    await runCli(['-v', 'config', '--show'], h.deps);
    expect(h.stderr()).toMatch(/\n\s+at /);
  });
});

describe('color gating (D-018(2), D-038)', () => {
  it('FORCE_COLOR yields ANSI on error output', async () => {
    const h = makeHarness({ env: { FORCE_COLOR: '1' } });
    await runCli(['config', '--show'], h.deps);
    expect(h.stderr()).toMatch(ANSI_PATTERN);
  });

  it('--no-color strips ANSI even under FORCE_COLOR', async () => {
    const h = makeHarness({ env: { FORCE_COLOR: '1' } });
    await runCli(['--no-color', 'config', '--show'], h.deps);
    expect(h.stderr()).not.toMatch(ANSI_PATTERN);
  });

  it('NO_COLOR strips ANSI', async () => {
    const h = makeHarness({ env: { NO_COLOR: '1', FORCE_COLOR: '' } });
    await runCli(['config', '--show'], h.deps);
    expect(h.stderr()).not.toMatch(ANSI_PATTERN);
  });

  it('non-TTY stderr without FORCE_COLOR has no ANSI', async () => {
    const h = makeHarness();
    await runCli(['config', '--show'], h.deps);
    expect(h.stderr()).not.toMatch(ANSI_PATTERN);
  });

  it('TTY stderr enables ANSI', async () => {
    const h = makeHarness({ stderrIsTTY: true });
    await runCli(['config', '--show'], h.deps);
    expect(h.stderr()).toMatch(ANSI_PATTERN);
  });

  // D-038: createColors(enabled) must be fully determined by the passed
  // boolean, never by picocolors' own module-load env/argv/TTY detection
  // (pc.isColorSupported, derived from the real process this test runs
  // in). Assert both directions unconditionally: whatever the ambient
  // real environment's auto-detected verdict happens to be here, at
  // least one of these two assertions would fail if colors.ts fell back
  // to picocolors' default-detected formatters (e.g. `pc.red`) instead
  // of the enabled-gated instance from `pc.createColors(enabled)`.
  it('enabled=true yields ANSI regardless of the ambient real environment', () => {
    expect(createColors(true).error('x')).toMatch(ANSI_PATTERN);
  });

  it('enabled=false yields no ANSI regardless of the ambient real environment', () => {
    expect(createColors(false).error('x')).toBe('x');
  });
});

describe('realDeps (process-backed wiring)', () => {
  it('exposes writers, env, homedir, and TTY flags', () => {
    const deps = realDeps();
    expect(deps.env).toBe(process.env);
    expect(typeof deps.homedir()).toBe('string');
    expect(typeof deps.stdoutIsTTY).toBe('boolean');
    expect(typeof deps.stderrIsTTY).toBe('boolean');
    expect(typeof deps.stdinIsTTY).toBe('boolean');
    expect(deps.fetchImpl).toBe(globalThis.fetch);
    expect(typeof deps.prompter).toBe('function');
    expect(typeof deps.clipboard).toBe('function');
    expect(typeof deps.spinner).toBe('function');
    // Writers target the real streams; exercise them with empty writes.
    deps.stdout('');
    deps.stderr('');
  });
});
