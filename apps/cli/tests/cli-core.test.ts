// In-process CLI core tests (P11-TS04): noun-verb CLI tree, bare group
// help, did-you-mean suggestions, config init/path/get/set, doctor [--bundle],
// completion {bash,zsh,fish}, single-emission config warnings, logging & color.
// cspell:ignore verbos projcts envtoken envtokenvalue flagtokenvalue filetoken powershell
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ChoicePrompter, ConfirmPrompter } from '../src/cli/adapters.js';
import { createColors } from '../src/cli/colors.js';
import { CONFIG_FILE_NAME, TOKEN_ENV_VAR } from '../src/cli/config.js';
import type { CliDeps } from '../src/cli/deps.js';
import { realDeps, runCli } from '../src/cli/router.js';
import { TOOL_DIR_NAME } from '../src/cli/xdg-paths.js';
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
const ANSI_PATTERN = /\x1b\[/;

describe('version, bare help, and did-you-mean (Q3.A)', () => {
  it('--version emits exact single-line ts-projects <VERSION>, exit 0', async () => {
    const h = makeHarness();
    const code = await runCli(['--version'], h.deps);
    expect(code).toBe(0);
    expect(h.stdout()).toBe(`ts-projects ${VERSION}\n`);
    expect(h.stderr()).toBe('');
  });

  it('-V is the short version flag', async () => {
    const h = makeHarness();
    expect(await runCli(['-V'], h.deps)).toBe(0);
    expect(h.stdout()).toBe(`ts-projects ${VERSION}\n`);
  });

  it('--help shows usage, global options, and v4 noun commands', async () => {
    const h = makeHarness();
    const code = await runCli(['--help'], h.deps);
    expect(code).toBe(0);
    expect(h.stderr()).toBe('');
    const help = h.stdout();
    expect(help).toContain('Usage: ts-projects [options] [command]');
    for (const flag of [
      '-V, --version',
      '-h, --help',
      '-o, --output <format>',
      '--json',
      '--output-file <path>',
      '--log-level <level>',
      '--log-file [path]',
      '-v, --verbose',
      '-q, --quiet',
      '--debug',
      '--no-color',
      '--no-input',
      '--config <path>',
      '--token <token>',
    ]) {
      expect(help).toContain(flag);
    }
    for (const cmd of ['projects', 'config', 'doctor', 'completion']) {
      expect(help).toContain(cmd);
    }
  });

  it('bare ts-projects prints root help to stdout and exits 0', async () => {
    const h = makeHarness();
    const code = await runCli([], h.deps);
    expect(code).toBe(0);
    expect(h.stderr()).toBe('');
    expect(h.stdout()).toContain('Usage: ts-projects [options] [command]');
    expect(h.stdout()).toContain('projects');
    expect(h.stdout()).toContain('config');
  });

  it('bare projects and bare config print group help to stdout and exit 0', async () => {
    const proj = makeHarness();
    expect(await runCli(['projects'], proj.deps)).toBe(0);
    expect(proj.stderr()).toBe('');
    expect(proj.stdout()).toContain('list');
    expect(proj.stdout()).toContain('get');

    const cfg = makeHarness();
    expect(await runCli(['config'], cfg.deps)).toBe(0);
    expect(cfg.stderr()).toBe('');
    expect(cfg.stdout()).toContain('init');
    expect(cfg.stdout()).toContain('path');
    expect(cfg.stdout()).toContain('get');
    expect(cfg.stdout()).toContain('set');
  });

  it('unknown flag -> exit 2 with did-you-mean suggestion', async () => {
    const h = makeHarness();
    const code = await runCli(['--verbos'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain("unknown option '--verbos'");
    expect(h.stderr()).toContain('Did you mean --verbose?');
    expect(h.stdout()).toBe('');
  });

  it('unknown root command -> exit 2 with did-you-mean suggestion', async () => {
    const h = makeHarness();
    const code = await runCli(['projcts'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain("unknown command 'projcts'");
    expect(h.stderr()).toContain('Did you mean projects?');
    expect(h.stdout()).toBe('');
  });

  it('unknown verb in projects and config groups -> exit 2 with did-you-mean suggestion', async () => {
    const p = makeHarness();
    expect(await runCli(['projects', 'lst'], p.deps)).toBe(2);
    expect(p.stderr()).toContain('Did you mean list?');

    const c = makeHarness();
    expect(await runCli(['config', 'st'], c.deps)).toBe(2);
    expect(c.stderr()).toContain('Did you mean set?');
  });
});

describe('config path', () => {
  it('shows resolved path and exists status in text and JSON', async () => {
    const home = makeTempDir();
    const expectedPath = join(home, '.config', 'ts-projects', CONFIG_FILE_NAME);

    const hText = makeHarness({ homedir: () => home });
    expect(await runCli(['config', 'path'], hText.deps)).toBe(0);
    expect(hText.stdout()).toContain(expectedPath);
    expect(hText.stdout()).toContain('no');

    const hJson = makeHarness({ homedir: () => home });
    expect(await runCli(['config', 'path', '--json'], hJson.deps)).toBe(0);
    expect(JSON.parse(hJson.stdout())).toEqual({ path: expectedPath, exists: false });
  });

  it('wraps absolute path in OSC-8 file:// link in TTY text mode, plain for relative path', async () => {
    const home = makeTempDir();
    const hTty = makeHarness({ homedir: () => home, stdoutIsTTY: true });
    expect(await runCli(['config', 'path'], hTty.deps)).toBe(0);
    expect(hTty.stdout()).toContain('\x1b]8;;file://');

    const hRel = makeHarness({ homedir: () => home, stdoutIsTTY: true });
    expect(await runCli(['config', 'path', '--config', 'rel.toml'], hRel.deps)).toBe(0);
    expect(hRel.stdout()).toContain('rel.toml');
    expect(hRel.stdout()).not.toContain('\x1b]8;;file://');
  });
});

describe('config get', () => {
  it('returns setting value with source "config" vs "default"', async () => {
    const home = makeTempDir();
    const cfg = join(home, 'custom.toml');
    writeFileSync(cfg, '[output]\ncolor = "always"\n', 'utf8');

    const hCfg = makeHarness({ homedir: () => home });
    expect(
      await runCli(['config', 'get', 'output.color', '--config', cfg, '--json'], hCfg.deps)
    ).toBe(0);
    expect(JSON.parse(hCfg.stdout())).toEqual({
      key: 'output.color',
      value: 'always',
      source: 'config',
    });

    const hDef = makeHarness({ homedir: () => home });
    expect(
      await runCli(['config', 'get', 'logging.level', '--config', cfg, '--json'], hDef.deps)
    ).toBe(0);
    expect(JSON.parse(hDef.stdout())).toEqual({
      key: 'logging.level',
      value: 'warning',
      source: 'default',
    });
  });

  it('masks token (flag/env/absent) and never exposes raw secret', async () => {
    const hEnv = makeHarness({ env: { [TOKEN_ENV_VAR]: 'supersecret1234' } });
    expect(await runCli(['config', 'get', 'token', '--json'], hEnv.deps)).toBe(0);
    expect(JSON.parse(hEnv.stdout())).toEqual({
      key: 'token',
      value: '****1234',
      source: 'env',
    });
    expect(hEnv.stdout()).not.toContain('supersecret1234');
    expect(hEnv.stderr()).not.toContain('supersecret1234');

    const hFlag = makeHarness({ env: { [TOKEN_ENV_VAR]: 'envtokenvalue1' } });
    expect(await runCli(['config', 'get', 'token', '--token', 'abcd', '--json'], hFlag.deps)).toBe(
      0
    );
    expect(JSON.parse(hFlag.stdout())).toEqual({
      key: 'token',
      value: '****',
      source: 'flag',
    });

    const hNone = makeHarness();
    expect(await runCli(['config', 'get', 'token', '--json'], hNone.deps)).toBe(0);
    expect(JSON.parse(hNone.stdout())).toEqual({
      key: 'token',
      value: null,
      source: null,
    });
  });

  it('unknown key -> exit 2 usage error', async () => {
    const h = makeHarness();
    expect(await runCli(['config', 'get', 'unknown.key'], h.deps)).toBe(2);
  });
});

describe('config init', () => {
  it('--yes writes [output] and [logging] defaults atomically (0600 on POSIX)', async () => {
    const dir = makeTempDir();
    const target = join(dir, 'cfg.toml');
    const h = makeHarness({ homedir: () => dir });
    const code = await runCli(['config', 'init', '--yes', '--config', target], h.deps);
    expect(code).toBe(0);
    const body = readFileSync(target, 'utf8');
    expect(body).toContain('format = "text"');
    expect(body).toContain('color = "auto"');
    expect(body).toContain('level = "warning"');
    expect(h.stderr()).toContain(`Wrote ${target}`);
    const mode = process.platform === 'win32' ? 0o600 : statSync(target).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('--dry-run emits preview lines and writes nothing', async () => {
    const dir = makeTempDir();
    const target = join(dir, 'dry.toml');
    const h = makeHarness({ homedir: () => dir });
    const code = await runCli(['config', 'init', '--yes', '--dry-run', '--config', target], h.deps);
    expect(code).toBe(0);
    expect(h.stderr()).toContain('[dry-run] would set output.format = text');
    expect(h.stderr()).toContain('[dry-run] would set output.color = auto');
    expect(h.stderr()).toContain('[dry-run] would set logging.level = warning');
    expect(existsSync(target)).toBe(false);
  });

  it('--no-input without --yes refuses with ConfigError (exit 1) and --yes hint', async () => {
    const dir = makeTempDir();
    const target = join(dir, 'nope.toml');
    const h = makeHarness({ homedir: () => dir });
    const code = await runCli(['config', 'init', '--no-input', '--config', target], h.deps);
    expect(code).toBe(1);
    expect(h.stderr()).toContain('--yes');
    expect(existsSync(target)).toBe(false);
  });

  it('interactive prompts via promptChoice write chosen values', async () => {
    const dir = makeTempDir();
    const target = join(dir, 'interactive.toml');
    const promptChoice = vi.fn<ChoicePrompter>(async (key: string) => {
      if (key === 'output.format') return 'json';
      if (key === 'output.color') return 'always';
      return 'info';
    });
    const h = makeHarness({ homedir: () => dir, promptChoice });
    const code = await runCli(['config', 'init', '--config', target], h.deps);
    expect(code).toBe(0);
    expect(promptChoice).toHaveBeenCalledTimes(3);
    const body = readFileSync(target, 'utf8');
    expect(body).toContain('format = "json"');
    expect(body).toContain('color = "always"');
    expect(body).toContain('level = "info"');
  });

  it('refuses to overwrite corrupt target file', async () => {
    const dir = makeTempDir();
    const target = join(dir, 'corrupt.toml');
    writeFileSync(target, '[output\nbroken\n', 'utf8');
    // Note: explicit --config already fails at resolveConfig with ConfigError (exit 1);
    // also verify user-config target refusal without --config.
    const userDir = join(dir, '.config', 'ts-projects');
    mkdirSync(userDir, { recursive: true });
    const userTarget = join(userDir, CONFIG_FILE_NAME);
    writeFileSync(userTarget, '[output\nbroken\n', 'utf8');
    chmodSync(userTarget, 0o600);
    const h = makeHarness({ homedir: () => dir });
    const code = await runCli(['config', 'init', '--yes'], h.deps);
    expect(code).toBe(1);
    expect(readFileSync(userTarget, 'utf8')).toBe('[output\nbroken\n');
  });
});

describe('config set', () => {
  it('writes nested TOML key atomically on new file even with --no-input', async () => {
    const dir = makeTempDir();
    const target = join(dir, 'cfg.toml');
    const h = makeHarness({ homedir: () => dir });
    const code = await runCli(
      ['config', 'set', 'logging.level', 'info', '--config', target, '--no-input'],
      h.deps
    );
    expect(code).toBe(0);
    const body = readFileSync(target, 'utf8');
    expect(body).toContain('[logging]');
    expect(body).toContain('level = "info"');
  });

  it('rejects token and invalid enum values with exit 1', async () => {
    const dir = makeTempDir();
    const target = join(dir, 'cfg.toml');
    const hTok = makeHarness({ homedir: () => dir });
    expect(await runCli(['config', 'set', 'token', 'secret', '--config', target], hTok.deps)).toBe(
      1
    );
    expect(hTok.stderr()).toContain('TS001');

    const hBad = makeHarness({ homedir: () => dir });
    expect(
      await runCli(['config', 'set', 'output.color', 'rainbow', '--config', target], hBad.deps)
    ).toBe(1);
    expect(existsSync(target)).toBe(false);
  });

  it('--dry-run returns source "dry-run" and writes nothing', async () => {
    const dir = makeTempDir();
    const target = join(dir, 'dry.toml');
    const h = makeHarness({ homedir: () => dir });
    const code = await runCli(
      ['config', 'set', 'output.color', 'never', '--config', target, '--dry-run', '--json'],
      h.deps
    );
    expect(code).toBe(0);
    expect(JSON.parse(h.stdout())).toEqual({
      key: 'output.color',
      value: 'never',
      source: 'dry-run',
    });
    expect(existsSync(target)).toBe(false);
  });

  it('overwrite confirmation: same value skips prompt, changed value prompts, decline exits 130', async () => {
    const dir = makeTempDir();
    const target = join(dir, 'cfg.toml');
    writeFileSync(target, '[logging]\nlevel = "warning"\n', 'utf8');

    // Same value -> no prompt even with --no-input
    const promptConfirmSame = vi.fn<ConfirmPrompter>(async () => false);
    const hSame = makeHarness({ homedir: () => dir, promptConfirm: promptConfirmSame });
    expect(
      await runCli(
        ['config', 'set', 'logging.level', 'warning', '--config', target, '--no-input'],
        hSame.deps
      )
    ).toBe(0);
    expect(promptConfirmSame).not.toHaveBeenCalled();

    // Changed value + --no-input without --yes -> ConfigError exit 1
    const hNoInput = makeHarness({ homedir: () => dir });
    expect(
      await runCli(
        ['config', 'set', 'logging.level', 'info', '--config', target, '--no-input'],
        hNoInput.deps
      )
    ).toBe(1);
    expect(hNoInput.stderr()).toContain('--yes');
    expect(readFileSync(target, 'utf8')).toContain('level = "warning"');

    // Changed value + interactive decline -> Aborted. + exit 130
    const promptDecline = vi.fn<ConfirmPrompter>(async () => false);
    const hDecline = makeHarness({ homedir: () => dir, promptConfirm: promptDecline });
    expect(
      await runCli(['config', 'set', 'logging.level', 'info', '--config', target], hDecline.deps)
    ).toBe(130);
    expect(promptDecline).toHaveBeenCalledTimes(1);
    expect(hDecline.stderr()).toContain('Aborted.');
    expect(readFileSync(target, 'utf8')).toContain('level = "warning"');

    // Changed value + --yes -> overwrites cleanly
    const hYes = makeHarness({ homedir: () => dir });
    expect(
      await runCli(
        ['config', 'set', 'logging.level', 'info', '--config', target, '--yes'],
        hYes.deps
      )
    ).toBe(0);
    expect(readFileSync(target, 'utf8')).toContain('level = "info"');
  });

  it('refuses corrupt target file on config set', async () => {
    const dir = makeTempDir();
    const userDir = join(dir, '.config', 'ts-projects');
    mkdirSync(userDir, { recursive: true });
    const userTarget = join(userDir, CONFIG_FILE_NAME);
    writeFileSync(userTarget, '[logging\nbroken\n', 'utf8');
    const h = makeHarness({ homedir: () => dir });
    expect(await runCli(['config', 'set', 'logging.level', 'info', '--yes'], h.deps)).toBe(1);
    expect(readFileSync(userTarget, 'utf8')).toBe('[logging\nbroken\n');
  });
});

describe('doctor and doctor --bundle', () => {
  it('runs checks and exits 0 when only warnings are present', async () => {
    const home = makeTempDir();
    const h = makeHarness({ homedir: () => home });
    const code = await runCli(['doctor', '--json'], h.deps);
    expect(code).toBe(0);
    const payload = JSON.parse(h.stdout()) as {
      checks: Array<{ name: string; status: string; detail: string }>;
    };
    const names = payload.checks.map((c) => c.name);
    expect(names).toEqual(['node', 'platform', 'config-file', 'token']);
    expect(payload.checks.find((c) => c.name === 'token')?.status).toBe('warn');
  });

  it('exits 1 when node check fails (< 24)', async () => {
    const h = makeHarness({ nodeVersion: '22.11.0' });
    const code = await runCli(['doctor', '--json'], h.deps);
    expect(code).toBe(1);
    const payload = JSON.parse(h.stdout()) as {
      checks: Array<{ name: string; status: string; detail: string }>;
    };
    expect(payload.checks.find((c) => c.name === 'node')?.status).toBe('error');
  });

  it('doctor --bundle redacts sensitive TS_PROJECTS_* env vars and excludes log contents', async () => {
    const home = makeTempDir();
    const logPath = join(home, 'secret.log');
    writeFileSync(logPath, 'DO_NOT_LEAK_THIS_LOG_CONTENT\n', 'utf8');
    const h = makeHarness({
      homedir: () => home,
      env: {
        TS_PROJECTS_TOKEN: 'secret-tok',
        TS_PROJECTS_API_KEY: 'secret-key',
        TS_PROJECTS_SECRET: 'secret-val',
        TS_PROJECTS_PASSWORD: 'secret-pw',
        TS_PROJECTS_CRED: 'secret-cred',
        TS_PROJECTS_PRIVATE: 'secret-priv',
        TS_PROJECTS_SOURCE: 'memory',
        TS_PROJECTS_OUTPUT: 'json',
        TS_PROJECTS_LOG_FILE: logPath,
      },
    });
    const code = await runCli(['doctor', '--bundle', '--json'], h.deps);
    expect(code).toBe(0);
    const raw = h.stdout();
    for (const secret of [
      'secret-tok',
      'secret-key',
      'secret-val',
      'secret-pw',
      'secret-cred',
      'secret-priv',
      'DO_NOT_LEAK_THIS_LOG_CONTENT',
    ]) {
      expect(raw).not.toContain(secret);
    }
    const bundle = JSON.parse(raw) as {
      version: string;
      token_present: boolean;
      token_source: string | null;
      env: Record<string, string>;
      log_file: string;
    };
    expect(bundle.version).toBe(VERSION);
    expect(bundle.token_present).toBe(true);
    expect(bundle.token_source).toBe('env');
    expect(bundle.env['TS_PROJECTS_TOKEN']).toBe('<redacted>');
    expect(bundle.env['TS_PROJECTS_API_KEY']).toBe('<redacted>');
    expect(bundle.env['TS_PROJECTS_SECRET']).toBe('<redacted>');
    expect(bundle.env['TS_PROJECTS_PASSWORD']).toBe('<redacted>');
    expect(bundle.env['TS_PROJECTS_CRED']).toBe('<redacted>');
    expect(bundle.env['TS_PROJECTS_PRIVATE']).toBe('<redacted>');
    expect(bundle.env['TS_PROJECTS_SOURCE']).toBe('memory');
    expect(typeof bundle.log_file).toBe('string');
  });
});

describe('completion {bash,zsh,fish}', () => {
  it.each(['bash', 'zsh', 'fish'] as const)(
    'emits %s completion script to stdout',
    async (shell) => {
      const h = makeHarness();
      const code = await runCli(['completion', shell], h.deps);
      expect(code).toBe(0);
      expect(h.stderr()).toBe('');
      expect(h.stdout()).toContain(TOOL_DIR_NAME);
      expect(h.stdout()).toContain(`_${TOOL_DIR_NAME.replaceAll('-', '_')}_completion`);
    }
  );

  it('rejects unsupported shell with exit 2', async () => {
    const h = makeHarness();
    const code = await runCli(['completion', 'powershell'], h.deps);
    expect(code).toBe(2);
    expect(h.stdout()).toBe('');
  });
});

describe('single-emission config warnings & suppression in json mode', () => {
  it('emits discovered-config degradation warning ONCE on stderr even with -q, suppressed in json mode', async () => {
    const home = makeTempDir();
    const dir = join(home, '.config', 'ts-projects');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, CONFIG_FILE_NAME), '[output]\ncolor = "yes"\n', { mode: 0o600 });

    const hText = makeHarness({ homedir: () => home });
    expect(await runCli(['-q', 'config', 'path'], hText.deps)).toBe(0);
    const matches = hText.stderr().match(/ignoring invalid config value output\.color/g) ?? [];
    expect(matches).toHaveLength(1);

    const hJson = makeHarness({ homedir: () => home });
    expect(await runCli(['config', 'path', '--json'], hJson.deps)).toBe(0);
    expect(hJson.stderr()).not.toContain('ignoring invalid config value');
  });

  it('corrupt explicit --config -> exit 1 ConfigError; missing explicit --config -> tolerated', async () => {
    const home = makeTempDir();
    const missing = join(home, 'nope.toml');
    const hMissing = makeHarness({ homedir: () => home });
    expect(await runCli(['config', 'path', '--config', missing, '--json'], hMissing.deps)).toBe(0);
    expect(JSON.parse(hMissing.stdout())).toEqual({ path: missing, exists: false });

    const corrupt = join(home, 'bad.toml');
    writeFileSync(corrupt, '[output\nbroken\n', 'utf8');
    const hCorrupt = makeHarness({ homedir: () => home });
    expect(await runCli(['config', 'path', '--config', corrupt], hCorrupt.deps)).toBe(1);
    expect(hCorrupt.stderr()).toContain('invalid TOML in config file');
  });
});

describe('color gating (D-018(2), D-038)', () => {
  it('FORCE_COLOR yields ANSI on error output, --no-color and NO_COLOR strip it', async () => {
    const hForce = makeHarness({ env: { FORCE_COLOR: '1' } });
    await runCli(['projects', 'list', '--no-input'], hForce.deps);
    expect(hForce.stderr()).toMatch(ANSI_PATTERN);

    const hNoFlag = makeHarness({ env: { FORCE_COLOR: '1' } });
    await runCli(['--no-color', 'projects', 'list', '--no-input'], hNoFlag.deps);
    expect(hNoFlag.stderr()).not.toMatch(ANSI_PATTERN);

    const hNoEnv = makeHarness({ env: { NO_COLOR: '1', FORCE_COLOR: '1' } });
    await runCli(['projects', 'list', '--no-input'], hNoEnv.deps);
    expect(hNoEnv.stderr()).not.toMatch(ANSI_PATTERN);
  });

  it('enabled=true/false determines picocolors output independently', () => {
    expect(createColors(true).error('x')).toMatch(ANSI_PATTERN);
    expect(createColors(false).error('x')).toBe('x');
  });
});

describe('realDeps (process-backed wiring)', () => {
  it('exposes writers, env, homedir, TTY flags, and adapters', () => {
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
    deps.stdout('');
    deps.stderr('');
  });
});
