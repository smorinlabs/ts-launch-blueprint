// Ports tests/test_config.py intent (D-019(5)): hermetic via injected
// env + fs.mkdtemp temp dirs — no process.env mutation, no real HOME.
// Source cases mapped:
//   test_config_from_env       -> 'env-only token works'
//   test_config_from_env_file  -> 'file-only token works'
//   test_config_precedence     -> precedence block (env>file, flag>env)
//   test_invalid_config_file   -> 'missing everywhere -> AuthError...'
// New behaviors per D-017: TOML/zod message quality, --config exists
// check, 0600 write mode, loose-permission warning, XDG resolution.
import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CONFIG_FILE_NAME,
  defaultConfigPath,
  redactToken,
  requireToken,
  resolveConfig,
  TOKEN_ENV_VAR,
  writeUserConfig,
} from '../src/lib/config.js';
import {
  AuthError,
  CliError,
  ConfigError,
  ConflictError,
  EXIT_CODES,
  exitCodeFor,
  NotFoundError,
  UsageError,
} from '../src/lib/errors.js';
import { configDir } from '../src/lib/xdg-paths.js';

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

/** Write a config file under <home>/.config/ts-projects and return home. */
function makeHomeWithConfig(contents: string, mode = 0o600): { home: string; path: string } {
  const home = makeTempDir();
  const dir = join(home, '.config', 'ts-projects');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, CONFIG_FILE_NAME);
  writeFileSync(path, contents, { mode });
  chmodSync(path, mode);
  return { home, path };
}

function baseOptions(home: string, env: Record<string, string | undefined> = {}) {
  return { env, homedir: () => home };
}

describe('resolveConfig precedence (test_config_precedence port)', () => {
  it('env-only token works (test_config_from_env port)', () => {
    const home = makeTempDir();
    const config = resolveConfig(baseOptions(home, { [TOKEN_ENV_VAR]: 'env_token' }));
    expect(config.token).toBe('env_token');
    expect(config.tokenSource).toBe('env');
  });

  it('file-only token works (test_config_from_env_file port)', () => {
    const { home } = makeHomeWithConfig('token = "file_token"\n');
    const config = resolveConfig(baseOptions(home));
    expect(config.token).toBe('file_token');
    expect(config.tokenSource).toBe('file');
  });

  it('env beats file', () => {
    const { home } = makeHomeWithConfig('token = "file_token"\n');
    const config = resolveConfig(baseOptions(home, { [TOKEN_ENV_VAR]: 'env_token' }));
    expect(config.token).toBe('env_token');
    expect(config.tokenSource).toBe('env');
  });

  it('flag beats env and file', () => {
    const { home } = makeHomeWithConfig('token = "file_token"\n');
    const config = resolveConfig({
      ...baseOptions(home, { [TOKEN_ENV_VAR]: 'env_token' }),
      flagToken: 'flag_token',
    });
    expect(config.token).toBe('flag_token');
    expect(config.tokenSource).toBe('flag');
  });

  it('flag alone works (fixes the documented source quirk)', () => {
    // In the Python source, --token alone failed because Config.from_env
    // raised before main() applied the flag; the port validates after
    // all layers merge (INDEX-mandated documented behavior).
    const home = makeTempDir();
    const config = resolveConfig({ ...baseOptions(home), flagToken: 'flag_token' });
    expect(requireToken(config, {}, () => home)).toBe('flag_token');
  });

  it('empty-string env token is treated as unset (Python falsy parity)', () => {
    const { home } = makeHomeWithConfig('token = "file_token"\n');
    const config = resolveConfig(baseOptions(home, { [TOKEN_ENV_VAR]: '' }));
    expect(config.token).toBe('file_token');
    expect(config.tokenSource).toBe('file');
  });

  it('reads workspace and limit from the file', () => {
    const { home, path } = makeHomeWithConfig('token = "t"\nworkspace = "Acme"\nlimit = 50\n');
    const config = resolveConfig(baseOptions(home));
    expect(config.workspace).toBe('Acme');
    expect(config.limit).toBe(50);
    expect(config.configPath).toBe(path);
  });

  it('resolves token source none when nothing is set', () => {
    const home = makeTempDir();
    const config = resolveConfig(baseOptions(home));
    expect(config.token).toBeUndefined();
    expect(config.tokenSource).toBe('none');
    expect(config.configPath).toBeUndefined();
  });
});

describe('missing token (test_invalid_config_file port)', () => {
  it('missing everywhere -> AuthError with the three-remedy message', () => {
    const home = makeTempDir();
    const config = resolveConfig(baseOptions(home));
    let caught: unknown;
    try {
      requireToken(config, {}, () => home);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AuthError);
    const message = (caught as AuthError).message;
    // Source parity: "No PY_TOKEN found" -> "No TS_PROJECTS_TOKEN found".
    expect(message).toMatch(/No TS_PROJECTS_TOKEN found/);
    expect(message).toContain('three options');
    expect(message).toContain('--token');
    expect(message).toContain(`export ${TOKEN_ENV_VAR}=`);
    expect(message).toContain(CONFIG_FILE_NAME);
    expect(message).toContain('chmod 600');
    expect(message).toContain('Windows note');
    // Exit 4 (auth) per D-016(2); the source exited 1.
    expect(exitCodeFor(caught)).toBe(4);
  });
});

describe('--config handling (click.Path(exists=True) parity)', () => {
  it('nonexistent --config path -> UsageError (exit 2)', () => {
    const home = makeTempDir();
    let caught: unknown;
    try {
      resolveConfig({ ...baseOptions(home), configPathFlag: join(home, 'missing.toml') });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UsageError);
    expect((caught as UsageError).message).toContain('missing.toml');
    expect(exitCodeFor(caught)).toBe(2);
  });

  it('--config replaces discovery (cli-standards R5.4)', () => {
    const { home } = makeHomeWithConfig('token = "discovered"\nworkspace = "Home"\n');
    const explicit = join(makeTempDir(), 'other.toml');
    writeFileSync(explicit, 'token = "explicit"\n', { mode: 0o600 });
    const config = resolveConfig({ ...baseOptions(home), configPathFlag: explicit });
    expect(config.token).toBe('explicit');
    // Discovered values must NOT merge in (replace, not merge).
    expect(config.workspace).toBeUndefined();
    expect(config.configPath).toBe(explicit);
  });
});

describe('config file quality errors', () => {
  it('malformed TOML -> ConfigError naming the file and parse problem', () => {
    const { home, path } = makeHomeWithConfig('token = not-valid-toml\n');
    let caught: unknown;
    try {
      resolveConfig(baseOptions(home));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    const message = (caught as ConfigError).message;
    expect(message).toContain('Invalid TOML');
    expect(message).toContain(path);
    expect(exitCodeFor(caught)).toBe(1);
  });

  it('zod rejection -> ConfigError naming the offending key', () => {
    const { home, path } = makeHomeWithConfig('token = "t"\nlimit = "not-a-number"\n');
    let caught: unknown;
    try {
      resolveConfig(baseOptions(home));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    const message = (caught as ConfigError).message;
    expect(message).toContain(path);
    expect(message).toContain('limit');
    expect(exitCodeFor(caught)).toBe(1);
  });

  it('unreadable config file -> ConfigError (not a crash)', () => {
    const { home, path } = makeHomeWithConfig('token = "t"\n');
    const fakeFs = {
      existsSync: () => true,
      readFileSync: (): string => {
        throw new Error('EACCES: permission denied');
      },
      statSync,
      mkdirSync: () => undefined,
      writeFileSync: () => undefined,
      chmodSync: () => undefined,
    };
    let caught: unknown;
    try {
      resolveConfig({ ...baseOptions(home), fs: fakeFs });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    expect((caught as ConfigError).message).toContain('Could not read config file');
    expect((caught as ConfigError).message).toContain(path);
  });
});

describe.skipIf(process.platform === 'win32')('POSIX permissions (D-017(6))', () => {
  it('writeUserConfig creates the file with mode 0600', () => {
    const home = makeTempDir();
    const path = writeUserConfig({ token: 'secret' }, baseOptions(home));
    expect(path).toBe(defaultConfigPath({}, () => home));
    expect(statSync(path).mode & 0o777).toBe(0o600);
    const config = resolveConfig(baseOptions(home));
    expect(config.token).toBe('secret');
  });

  it('rewriting an existing config restores mode 0600', () => {
    const home = makeTempDir();
    const path = writeUserConfig({ token: 'one' }, baseOptions(home));
    chmodSync(path, 0o644);
    writeUserConfig({ token: 'two' }, baseOptions(home));
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it('loose permissions on a token-bearing config -> non-fatal warning', () => {
    const { home, path } = makeHomeWithConfig('token = "t"\n', 0o644);
    const warnings: string[] = [];
    const config = resolveConfig({
      ...baseOptions(home),
      warn: (message) => warnings.push(message),
    });
    expect(config.token).toBe('t');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(`chmod 600 ${path}`);
  });

  it('mode 0600 config produces no warning', () => {
    const { home } = makeHomeWithConfig('token = "t"\n', 0o600);
    const warnings: string[] = [];
    resolveConfig({ ...baseOptions(home), warn: (message) => warnings.push(message) });
    expect(warnings).toHaveLength(0);
  });

  it('tokenless loose-permission config produces no warning', () => {
    const { home } = makeHomeWithConfig('workspace = "Acme"\n', 0o644);
    const warnings: string[] = [];
    resolveConfig({ ...baseOptions(home), warn: (message) => warnings.push(message) });
    expect(warnings).toHaveLength(0);
  });
});

describe('Windows behavior (platform injected)', () => {
  it('skips the permissions warning on win32', () => {
    const { home } = makeHomeWithConfig('token = "t"\n', 0o644);
    const warnings: string[] = [];
    const config = resolveConfig({
      ...baseOptions(home),
      warn: (message) => warnings.push(message),
      platform: 'win32',
    });
    expect(config.token).toBe('t');
    expect(warnings).toHaveLength(0);
  });

  it('writes without a POSIX mode on win32', () => {
    const home = makeTempDir();
    const calls: Array<{ mode?: number }> = [];
    const fakeFs = {
      existsSync: () => false,
      readFileSync: () => '',
      statSync: () => ({ mode: 0o600 }),
      mkdirSync: () => undefined,
      writeFileSync: (_path: string, _data: string, options: { mode?: number }) => {
        calls.push(options);
      },
      chmodSync: () => {
        throw new Error('chmod must not be called on win32');
      },
    };
    writeUserConfig({ token: 't' }, { ...baseOptions(home), fs: fakeFs, platform: 'win32' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.mode).toBeUndefined();
  });
});

describe('XDG path resolution (D-017(3))', () => {
  it('uses $XDG_CONFIG_HOME when set', () => {
    const xdg = makeTempDir();
    expect(configDir({ XDG_CONFIG_HOME: xdg }, () => '/unused')).toBe(join(xdg, 'ts-projects'));
  });

  it('falls back to ~/.config when XDG_CONFIG_HOME is empty or unset', () => {
    const home = makeTempDir();
    const expected = join(home, '.config', 'ts-projects');
    expect(configDir({}, () => home)).toBe(expected);
    expect(configDir({ XDG_CONFIG_HOME: '' }, () => home)).toBe(expected);
  });

  it('resolveConfig honors XDG_CONFIG_HOME for discovery', () => {
    const xdg = makeTempDir();
    mkdirSync(join(xdg, 'ts-projects'), { recursive: true });
    writeFileSync(join(xdg, 'ts-projects', CONFIG_FILE_NAME), 'token = "xdg_token"\n', {
      mode: 0o600,
    });
    const config = resolveConfig({
      env: { XDG_CONFIG_HOME: xdg },
      homedir: () => '/unused',
    });
    expect(config.token).toBe('xdg_token');
  });
});

describe('error taxonomy (D-016(2), cli-standards R6.1)', () => {
  it('maps each error class to its contract exit code', () => {
    expect(exitCodeFor(new ConfigError('x'))).toBe(1);
    expect(exitCodeFor(new UsageError('x'))).toBe(2);
    expect(exitCodeFor(new NotFoundError('x'))).toBe(3);
    expect(exitCodeFor(new AuthError('x'))).toBe(4);
    expect(exitCodeFor(new ConflictError('x'))).toBe(5);
    expect(exitCodeFor(new CliError('x'))).toBe(1);
    expect(exitCodeFor(new CliError('x', EXIT_CODES.conflict))).toBe(5);
    expect(exitCodeFor(new Error('unexpected'))).toBe(1);
    expect(exitCodeFor('not-an-error')).toBe(1);
  });

  it('AuthError is a ConfigError (config-layer compatibility) at exit 4', () => {
    const err = new AuthError('x');
    expect(err).toBeInstanceOf(ConfigError);
    expect(err.exitCode).toBe(EXIT_CODES.auth);
    expect(err.name).toBe('AuthError');
  });
});

describe('redactToken (cli-standards R5.6)', () => {
  it('masks all but the last four characters of long tokens', () => {
    expect(redactToken('supersecret1234')).toBe('***1234');
  });

  it('fully masks short tokens', () => {
    expect(redactToken('short')).toBe('***');
  });
});
