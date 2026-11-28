// Tests for env/flag-only tokens (ADR 0002), 3-layer TOML config discovery & degradation (ADR 0004),
// atomic temp+fsync+rename writes, corrupt-file write refusal, and typed M3 config helpers (P11-TS03).
// cspell:ignore gettable bcde
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, win32 } from 'node:path';

import {
  AuthError,
  ConfigError,
  ConflictError,
  DomainError,
  ERROR_CODES,
  NotFoundError,
} from '@ts-launch-blueprint/core';
import { afterEach, describe, expect, it } from 'vitest';

import {
  allowedConfigValues,
  coerceConfigValue,
  CONFIG_FILE_NAME,
  CONFIG_PATH_ENV_VAR,
  type ConfigFs,
  defaultConfigPath,
  getConfigFileValue,
  gettableKeys,
  initConfigValues,
  maskToken,
  missingTokenMessage,
  parseConfigKey,
  readConfigForWrite,
  redactToken,
  requireToken,
  resolveConfig,
  setConfigValue,
  TOKEN_ENV_VAR,
  writableKeys,
  writeConfigData,
  writeUserConfig,
} from '../src/cli/config.js';
import { CliError, EXIT_CODES, exitCodeFor, UsageError } from '../src/cli/exit-codes.js';
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

/** Write a user config file under <home>/.config/ts-projects and return home + path. */
function makeHomeWithConfig(contents: string, mode = 0o600): { home: string; path: string } {
  const home = makeTempDir();
  const dir = join(home, '.config', 'ts-projects');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, CONFIG_FILE_NAME);
  writeFileSync(path, contents, { mode });
  chmodSync(path, mode);
  return { home, path };
}

function baseOptions(
  home: string,
  env: Record<string, string | undefined> = {},
  cwd?: () => string
) {
  return {
    env,
    homedir: () => home,
    cwd: cwd ?? (() => join(home, 'no-project-here')),
    platform: 'linux' as const,
  };
}

describe('token resolution — env/flag only (ADR 0002)', () => {
  it('CFG-01: flag --token beats TS_PROJECTS_TOKEN env', () => {
    const home = makeTempDir();
    const config = resolveConfig({
      ...baseOptions(home, { [TOKEN_ENV_VAR]: 'env_token' }),
      flagToken: 'flag_token',
    });
    expect(config.token).toBe('flag_token');
    expect(config.tokenSource).toBe('flag');
  });

  it('CFG-02: env TS_PROJECTS_TOKEN works and empty string flag/env is treated as unset', () => {
    const home = makeTempDir();
    const envOnly = resolveConfig(baseOptions(home, { [TOKEN_ENV_VAR]: 'env_token' }));
    expect(envOnly.token).toBe('env_token');
    expect(envOnly.tokenSource).toBe('env');

    const emptyFlag = resolveConfig({
      ...baseOptions(home, { [TOKEN_ENV_VAR]: 'env_token' }),
      flagToken: '',
    });
    expect(emptyFlag.token).toBe('env_token');
    expect(emptyFlag.tokenSource).toBe('env');

    const emptyEnv = resolveConfig(baseOptions(home, { [TOKEN_ENV_VAR]: '' }));
    expect(emptyEnv.token).toBeUndefined();
    expect(emptyEnv.tokenSource).toBe('none');
  });

  it('CFG-03: TOML token is silently ignored in discovered and explicit config (no loose-perm warning)', () => {
    const { home } = makeHomeWithConfig('token = "file_token"\n', 0o644);
    const warnings: string[] = [];
    const discovered = resolveConfig({
      ...baseOptions(home),
      warn: (message) => warnings.push(message),
    });
    expect(discovered.token).toBeUndefined();
    expect(discovered.tokenSource).toBe('none');
    expect(warnings).toEqual([]);
    expect(discovered.warnings).toEqual([]);

    const explicit = join(makeTempDir(), 'explicit.toml');
    writeFileSync(explicit, 'token = "explicit_token"\n', { mode: 0o644 });
    const explicitConfig = resolveConfig({
      ...baseOptions(home),
      configPathFlag: explicit,
      warn: (message) => warnings.push(message),
    });
    expect(explicitConfig.token).toBeUndefined();
    expect(explicitConfig.tokenSource).toBe('none');
    expect(warnings).toEqual([]);
  });

  it('flag alone works via requireToken', () => {
    const home = makeTempDir();
    const config = resolveConfig({ ...baseOptions(home), flagToken: 'flag_token' });
    expect(requireToken(config, {}, () => home)).toBe('flag_token');
  });

  it('CFG-04: missing token -> AuthError with 2 remedies and ts-projects doctor hint', () => {
    const home = makeTempDir();
    const config = resolveConfig(baseOptions(home));
    let caught: unknown;
    try {
      requireToken(config, {}, () => home);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AuthError);
    const authErr = caught as AuthError;
    expect(authErr.code).toBe(ERROR_CODES.auth);
    expect(authErr.message).toContain('never stored in the config file');
    expect(authErr.message).toContain('--token');
    expect(authErr.message).toContain(`export ${TOKEN_ENV_VAR}=`);
    expect(authErr.message).toContain('ts-projects doctor');
    expect(authErr.message).not.toContain('three options');
    expect(authErr.message).not.toContain(CONFIG_FILE_NAME);
    expect(authErr.message).not.toContain('chmod 600');
    expect(authErr.hint).toContain('--token');
    expect(authErr.hint).toContain(TOKEN_ENV_VAR);
    expect(authErr.hint).toContain('ts-projects doctor');
    expect(exitCodeFor(caught)).toBe(4);
    expect(missingTokenMessage({}, () => home)).toBe(authErr.message);
  });

  it('CFG-05: maskToken and redactToken mask <=4 chars as **** and >4 chars as ****XXXX', () => {
    expect(maskToken('')).toBe('****');
    expect(maskToken('t')).toBe('****');
    expect(maskToken('abcd')).toBe('****');
    expect(maskToken('abcde')).toBe('****bcde');
    expect(maskToken('supersecret1234')).toBe('****1234');
    expect(redactToken('short')).toBe('****hort');
    expect(redactToken('abcd')).toBe('****');
  });
});

describe('schema, 3-layer discovery & warning degradation (ADR 0004)', () => {
  it('CFG-06: defaults when no config file exists', () => {
    const home = makeTempDir();
    const config = resolveConfig(baseOptions(home));
    expect(config.settings).toEqual({
      output: { format: 'text', color: 'auto' },
      logging: { level: 'warning', file: '', file_level: 'debug', format: 'text' },
    });
    expect(config.setFields.size).toBe(0);
    expect(config.loadedPaths).toEqual([]);
    expect(config.configPath).toBeUndefined();
    expect(config.targetPath).toBe(defaultConfigPath({}, () => home, 'linux'));
    expect(config.warnings).toEqual([]);
  });

  it('CFG-07: parses [output], [logging], and compat workspace/limit with setFields tracking', () => {
    const { home, path } = makeHomeWithConfig(
      [
        'workspace = "Acme"',
        'limit = 50',
        '',
        '[output]',
        'format = "markdown"',
        'color = "always"',
        '',
        '[logging]',
        'level = "info"',
        'file = "/tmp/app.log"',
        'file_level = "error"',
        'format = "json"',
        '',
      ].join('\n')
    );
    const config = resolveConfig(baseOptions(home));
    expect(config.workspace).toBe('Acme');
    expect(config.limit).toBe(50);
    expect(config.configPath).toBe(path);
    expect(config.loadedPaths).toEqual([path]);
    expect(config.settings).toEqual({
      output: { format: 'markdown', color: 'always' },
      logging: { level: 'info', file: '/tmp/app.log', file_level: 'error', format: 'json' },
    });
    const setFieldsList = [...config.setFields];
    setFieldsList.sort();
    expect(setFieldsList).toEqual([
      'logging.file',
      'logging.file_level',
      'logging.format',
      'logging.level',
      'output.color',
      'output.format',
    ]);
  });

  it('CFG-08: unknown sections/keys and non-object sections are ignored without warnings', () => {
    const { home } = makeHomeWithConfig(
      ['output = "not-a-table"', 'unknown_top = 123', '', '[extra]', 'foo = "bar"', ''].join('\n')
    );
    const warnings: string[] = [];
    const config = resolveConfig({
      ...baseOptions(home),
      warn: (msg) => warnings.push(msg),
    });
    expect(config.settings).toEqual({
      output: { format: 'text', color: 'auto' },
      logging: { level: 'warning', file: '', file_level: 'debug', format: 'text' },
    });
    expect(warnings).toEqual([]);
    expect(config.warnings).toEqual([]);
  });

  it('CFG-09: 3-layer precedence system (reversed XDG_CONFIG_DIRS) -> user -> project (dotfile wins)', () => {
    const root = makeTempDir();
    const sys1 = join(root, 'sys1');
    const sys2 = join(root, 'sys2');
    const home = join(root, 'home');
    const project = join(root, 'project');
    mkdirSync(join(sys1, 'ts-projects'), { recursive: true });
    mkdirSync(join(sys2, 'ts-projects'), { recursive: true });
    mkdirSync(join(home, '.config', 'ts-projects'), { recursive: true });
    mkdirSync(project, { recursive: true });

    const sys2Path = join(sys2, 'ts-projects', CONFIG_FILE_NAME);
    const sys1Path = join(sys1, 'ts-projects', CONFIG_FILE_NAME);
    const userPath = join(home, '.config', 'ts-projects', CONFIG_FILE_NAME);
    const nonDotProject = join(project, CONFIG_FILE_NAME);
    const dotProject = join(project, `.${CONFIG_FILE_NAME}`);

    // sys2 (lowest) sets format, color, level, file_level
    writeFileSync(
      sys2Path,
      '[output]\nformat = "csv"\ncolor = "never"\n[logging]\nlevel = "error"\nfile_level = "critical"\n'
    );
    // sys1 (higher system) overrides output.format and logging.level
    writeFileSync(sys1Path, '[output]\nformat = "json"\n[logging]\nlevel = "info"\n');
    // user overrides output.color
    writeFileSync(userPath, '[output]\ncolor = "always"\n');
    // both project files exist -> dotfile wins and overrides logging.level
    writeFileSync(nonDotProject, '[logging]\nlevel = "debug"\n');
    writeFileSync(dotProject, '[logging]\nlevel = "warning"\n');

    const config = resolveConfig({
      env: { XDG_CONFIG_DIRS: `${sys1}:${sys2}` },
      homedir: () => home,
      cwd: () => project,
      platform: 'linux',
    });

    expect(config.loadedPaths).toEqual([sys2Path, sys1Path, userPath, dotProject]);
    expect(config.configPath).toBe(dotProject);
    expect(config.targetPath).toBe(userPath);
    expect(config.settings.output).toEqual({ format: 'json', color: 'always' });
    expect(config.settings.logging).toEqual({
      level: 'warning',
      file: '',
      file_level: 'critical',
      format: 'text',
    });
  });

  it('CFG-10: invalid setting value drops only offending key, preserves siblings, and warns', () => {
    const { home } = makeHomeWithConfig(
      [
        '[output]',
        'color = "yes"',
        'format = "json"',
        '',
        '[logging]',
        'file = 123',
        'level = "debug"',
        '',
      ].join('\n')
    );
    const warnings: string[] = [];
    const config = resolveConfig({
      ...baseOptions(home),
      warn: (msg) => warnings.push(msg),
    });

    expect(config.settings.output).toEqual({ format: 'json', color: 'auto' });
    expect(config.settings.logging).toEqual({
      level: 'debug',
      file: '',
      file_level: 'debug',
      format: 'text',
    });
    expect(config.setFields.has('output.format')).toBe(true);
    expect(config.setFields.has('logging.level')).toBe(true);
    expect(config.setFields.has('output.color')).toBe(false);
    expect(config.setFields.has('logging.file')).toBe(false);

    expect(warnings).toHaveLength(2);
    expect(config.warnings).toEqual(warnings);
    expect(warnings[0]).toContain('ignoring invalid config value output.color = "yes"');
    expect(warnings[0]).toContain('allowed: auto, always, never');
    expect(warnings[1]).toBe('ignoring invalid config value logging.file = 123');
  });

  it('CFG-11: corrupt or unreadable discovered layer degrades to warning while valid layers survive', () => {
    const root = makeTempDir();
    const sysDir = join(root, 'sys');
    const home = join(root, 'home');
    const project = join(root, 'project');
    mkdirSync(join(sysDir, 'ts-projects'), { recursive: true });
    mkdirSync(join(home, '.config', 'ts-projects'), { recursive: true });
    mkdirSync(project, { recursive: true });

    const sysPath = join(sysDir, 'ts-projects', CONFIG_FILE_NAME);
    const userPath = join(home, '.config', 'ts-projects', CONFIG_FILE_NAME);
    const projPath = join(project, CONFIG_FILE_NAME);

    writeFileSync(sysPath, '[output]\nformat = "csv"\n');
    writeFileSync(userPath, '[output\nbroken = toml\n');
    writeFileSync(projPath, '[logging]\nformat = "json"\n');

    const warnings: string[] = [];
    const config = resolveConfig({
      env: { XDG_CONFIG_DIRS: sysDir },
      homedir: () => home,
      cwd: () => project,
      platform: 'linux',
      warn: (msg) => warnings.push(msg),
    });

    expect(config.settings.output.format).toBe('csv');
    expect(config.settings.logging.format).toBe('json');
    expect(config.loadedPaths).toEqual([sysPath, userPath, projPath]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(`ignoring unreadable config file ${userPath}`);

    // Unreadable discovered file via fs.readFileSync error also degrades
    const fakeFs: ConfigFs = {
      existsSync: (p) => p === userPath,
      readFileSync: () => {
        throw new Error('EACCES: permission denied');
      },
      statSync,
      mkdirSync: () => undefined,
      writeFileSync: () => undefined,
      chmodSync: () => undefined,
      openSync: () => 1,
      writeSync: () => 0,
      fsyncSync: () => undefined,
      closeSync: () => undefined,
      renameSync: () => undefined,
      unlinkSync: () => undefined,
    };
    const unreadable = resolveConfig({
      ...baseOptions(home),
      fs: fakeFs,
    });
    expect(unreadable.warnings).toHaveLength(1);
    expect(unreadable.warnings[0]).toContain(`ignoring unreadable config file ${userPath}`);
    expect(unreadable.warnings[0]).toContain('EACCES');
  });
});

describe('explicit --config / TS_PROJECTS_CONFIG override (ADR 0004)', () => {
  it('CFG-12: missing explicit --config is tolerated with empty warnings and loadedPaths', () => {
    const { home } = makeHomeWithConfig('[output]\nformat = "json"\n');
    const explicit = join(home, 'missing.toml');
    const config = resolveConfig({
      ...baseOptions(home),
      configPathFlag: explicit,
    });
    expect(config.targetPath).toBe(explicit);
    expect(config.loadedPaths).toEqual([]);
    expect(config.configPath).toBeUndefined();
    expect(config.warnings).toEqual([]);
    // Discovery did NOT run:
    expect(config.settings.output.format).toBe('text');
  });

  it('TS_PROJECTS_CONFIG env replaces discovery; empty string falls back to discovery', () => {
    const { home, path: userPath } = makeHomeWithConfig('[output]\nformat = "json"\n');
    const explicit = join(makeTempDir(), 'env-override.toml');
    writeFileSync(explicit, '[output]\nformat = "csv"\n');

    const overridden = resolveConfig(baseOptions(home, { [CONFIG_PATH_ENV_VAR]: explicit }));
    expect(overridden.targetPath).toBe(explicit);
    expect(overridden.loadedPaths).toEqual([explicit]);
    expect(overridden.settings.output.format).toBe('csv');

    const emptyEnv = resolveConfig(baseOptions(home, { [CONFIG_PATH_ENV_VAR]: '' }));
    expect(emptyEnv.targetPath).toBe(userPath);
    expect(emptyEnv.settings.output.format).toBe('json');
  });

  it('CFG-13: invalid TOML or unreadable explicit --config throws ConfigError (TS001)', () => {
    const home = makeTempDir();
    const explicit = join(home, 'bad.toml');
    writeFileSync(explicit, 'output = [broken\n');

    let caughtInvalid: unknown;
    try {
      resolveConfig({ ...baseOptions(home), configPathFlag: explicit });
    } catch (err) {
      caughtInvalid = err;
    }
    expect(caughtInvalid).toBeInstanceOf(ConfigError);
    expect(caughtInvalid).toBeInstanceOf(DomainError);
    expect((caughtInvalid as ConfigError).code).toBe(ERROR_CODES.config);
    expect((caughtInvalid as ConfigError).message).toContain('invalid TOML in config file');
    expect((caughtInvalid as ConfigError).message).toContain(explicit);
    expect(exitCodeFor(caughtInvalid)).toBe(1);

    const fakeFs: ConfigFs = {
      existsSync: (p) => p === explicit,
      readFileSync: () => {
        throw new Error('EACCES: permission denied');
      },
      statSync,
      mkdirSync: () => undefined,
      writeFileSync: () => undefined,
      chmodSync: () => undefined,
      openSync: () => 1,
      writeSync: () => 0,
      fsyncSync: () => undefined,
      closeSync: () => undefined,
      renameSync: () => undefined,
      unlinkSync: () => undefined,
    };

    let caughtUnreadable: unknown;
    try {
      resolveConfig({ ...baseOptions(home), configPathFlag: explicit, fs: fakeFs });
    } catch (err) {
      caughtUnreadable = err;
    }
    expect(caughtUnreadable).toBeInstanceOf(ConfigError);
    expect((caughtUnreadable as ConfigError).message).toContain('cannot read config file');
    expect((caughtUnreadable as ConfigError).message).toContain(explicit);
  });
});

describe('typed config key/value helpers and atomic writes', () => {
  it('CFG-14: writableKeys, gettableKeys, parseConfigKey, coerceConfigValue, allowedConfigValues', () => {
    expect(writableKeys()).toEqual([
      'logging.file',
      'logging.file_level',
      'logging.format',
      'logging.level',
      'output.color',
      'output.format',
    ]);
    expect(gettableKeys()).toEqual([
      'logging.file',
      'logging.file_level',
      'logging.format',
      'logging.level',
      'output.color',
      'output.format',
      'token',
    ]);

    expect(parseConfigKey('output.color')).toEqual({ section: 'output', key: 'color' });
    expect(() => parseConfigKey('token')).toThrow(ConfigError);
    expect(() => parseConfigKey('token')).toThrow(/unknown config key 'token'/);
    expect(() => parseConfigKey('logging.nope')).toThrow(ConfigError);
    expect(() => parseConfigKey('a.b.c')).toThrow(ConfigError);

    expect(allowedConfigValues('output', 'format')).toEqual(['text', 'json', 'csv', 'markdown']);
    expect(allowedConfigValues('output', 'color')).toEqual(['auto', 'always', 'never']);
    expect(allowedConfigValues('logging', 'level')).toEqual([
      'debug',
      'info',
      'warning',
      'error',
      'critical',
    ]);
    expect(allowedConfigValues('logging', 'format')).toEqual(['text', 'json']);
    expect(allowedConfigValues('logging', 'file')).toBeUndefined();

    expect(coerceConfigValue('output', 'color', 'always')).toBe('always');
    expect(coerceConfigValue('logging', 'file', '')).toBe('');
    expect(coerceConfigValue('logging', 'file', '123')).toBe('123');
    // Case-sensitive and no trimming
    expect(() => coerceConfigValue('output', 'color', 'ALWAYS')).toThrow(ConfigError);
    expect(() => coerceConfigValue('output', 'color', ' always ')).toThrow(ConfigError);
    expect(() => coerceConfigValue('output', 'color', 'rainbow')).toThrow(
      /invalid value for output\.color: 'rainbow' \(allowed: auto, always, never\)/
    );
  });

  it('CFG-15: setConfigValue writes nested tables, preserves siblings, and getConfigFileValue reads back', () => {
    const dir = makeTempDir();
    const target = join(dir, 'nested', CONFIG_FILE_NAME);

    expect(setConfigValue(target, 'output.format', 'csv')).toBe('csv');
    expect(setConfigValue(target, 'output.color', 'never')).toBe('never');
    expect(setConfigValue(target, 'logging.level', 'info')).toBe('info');
    expect(setConfigValue(target, 'logging.level', 'error', { dryRun: true })).toBe('error');

    expect(getConfigFileValue(target, 'output.format')).toBe('csv');
    expect(getConfigFileValue(target, 'output.color')).toBe('never');
    // dryRun did not modify disk
    expect(getConfigFileValue(target, 'logging.level')).toBe('info');
    expect(getConfigFileValue(join(dir, 'missing.toml'), 'output.format')).toBeUndefined();

    const loaded = resolveConfig({
      env: {},
      homedir: () => dir,
      configPathFlag: target,
    });
    expect(loaded.settings.output).toEqual({ format: 'csv', color: 'never' });
    expect(loaded.settings.logging.level).toBe('info');
  });

  it('CFG-16: corrupt target refusal on readConfigForWrite, setConfigValue, initConfigValues, and writeUserConfig', () => {
    const dir = makeTempDir();
    const target = join(dir, CONFIG_FILE_NAME);
    const corrupt = '[output\ncolor = "always"\n';
    writeFileSync(target, corrupt, { mode: 0o600 });

    expect(() => readConfigForWrite(target)).toThrow(ConfigError);
    expect(() => readConfigForWrite(target)).toThrow(/refusing to modify/);
    expect(() => setConfigValue(target, 'output.color', 'never')).toThrow(ConfigError);
    expect(() => initConfigValues(target, { output: { format: 'json', color: 'always' } })).toThrow(
      ConfigError
    );

    expect(readFileSync(target, 'utf8')).toBe(corrupt);
    expect(readdirSync(dir)).toEqual([CONFIG_FILE_NAME]);
  });

  it('initConfigValues supports dryRun without writing and writes valid TOML otherwise', () => {
    const dir = makeTempDir();
    const target = join(dir, CONFIG_FILE_NAME);

    const preview = initConfigValues(
      target,
      { output: { format: 'markdown', color: 'always' }, logging: { level: 'info' } },
      { dryRun: true }
    );
    expect(preview).toContain('format = "markdown"');
    expect(readdirSync(dir)).toEqual([]);

    const written = initConfigValues(target, {
      output: { format: 'markdown', color: 'always' },
      logging: { level: 'info' },
    });
    expect(readFileSync(target, 'utf8')).toBe(written);
    expect(getConfigFileValue(target, 'output.format')).toBe('markdown');
  });

  it.skipIf(process.platform === 'win32')(
    'CFG-17a: writeUserConfig and writeConfigData write 0o600 atomically with zero temp files',
    () => {
      const home = makeTempDir();
      const target = writeUserConfig(
        { workspace: 'Acme', limit: 25, output: { format: 'json' } },
        baseOptions(home)
      );
      expect(target).toBe(defaultConfigPath({}, () => home, 'linux'));
      expect(statSync(target).mode & 0o777).toBe(0o600);

      chmodSync(target, 0o644);
      writeUserConfig({ workspace: 'Beta', output: { color: 'never' } }, baseOptions(home));
      expect(statSync(target).mode & 0o777).toBe(0o600);
      expect(readdirSync(configDir({}, () => home, 'linux'))).toEqual([CONFIG_FILE_NAME]);

      const resolved = resolveConfig(baseOptions(home));
      expect(resolved.workspace).toBe('Beta');
      expect(resolved.settings.output.color).toBe('never');
    }
  );

  it('CFG-17b: atomic write failure cleans up temp file and leaves original target intact', () => {
    const dir = makeTempDir();
    const target = join(dir, CONFIG_FILE_NAME);
    const original = '[output]\nformat = "text"\n';
    writeFileSync(target, original, { mode: 0o600 });

    let closeCount = 0;
    let openCount = 0;
    const failingFs: ConfigFs = {
      existsSync: (p) => p === target,
      readFileSync: (p) => (p === target ? original : ''),
      statSync,
      mkdirSync,
      writeFileSync,
      chmodSync,
      openSync: (p, flags, mode) => {
        openCount += 1;
        writeFileSync(p, '', mode !== undefined ? { mode } : {});
        return openCount;
      },
      writeSync: () => 0,
      fsyncSync: () => {
        throw new Error('EIO: disk failure');
      },
      closeSync: () => {
        closeCount += 1;
      },
      renameSync: () => undefined,
      unlinkSync: (p) => {
        rmSync(p, { force: true });
      },
    };

    expect(() =>
      writeConfigData(target, { output: { format: 'json' } }, { fs: failingFs, platform: 'linux' })
    ).toThrow('EIO: disk failure');
    expect(closeCount).toBe(1);
    expect(readFileSync(target, 'utf8')).toBe(original);
    expect(readdirSync(dir)).toEqual([CONFIG_FILE_NAME]);
  });

  it('CFG-17c: Windows atomic write skips POSIX chmod/mode and uses APPDATA path', () => {
    const home = 'C:\\Users\\alice';
    const openModes: Array<number | undefined> = [];
    const writtenFiles = new Map<string, string>();
    const fakeFs: ConfigFs = {
      existsSync: (p) => writtenFiles.has(p),
      readFileSync: (p) => writtenFiles.get(p) ?? '',
      statSync: () => ({ mode: 0o600 }),
      mkdirSync: () => undefined,
      writeFileSync: () => undefined,
      chmodSync: () => {
        throw new Error('chmod must not be called on win32');
      },
      openSync: (p, _flags, mode) => {
        openModes.push(mode);
        writtenFiles.set(p, '');
        return 7;
      },
      writeSync: () => 0,
      fsyncSync: () => undefined,
      closeSync: () => undefined,
      renameSync: (oldPath, newPath) => {
        writtenFiles.set(newPath, writtenFiles.get(oldPath) ?? '');
        writtenFiles.delete(oldPath);
      },
      unlinkSync: (p) => {
        writtenFiles.delete(p);
      },
    };

    const writtenPath = writeUserConfig(
      { output: { color: 'never' } },
      {
        env: { APPDATA: 'C:\\Users\\alice\\AppData\\Roaming' },
        homedir: () => home,
        fs: fakeFs,
        platform: 'win32',
      }
    );
    expect(writtenPath).toBe(
      win32.join('C:\\Users\\alice\\AppData\\Roaming', 'ts-projects', CONFIG_FILE_NAME)
    );
    expect(openModes).toEqual([undefined]);
  });
});

describe('prototype safety, class-based ConfigFs, and nested token stripping', () => {
  it('PROTO-ADV-01: [__proto__] and [section.__proto__] tables do not pollute resolveConfig', () => {
    const { home } = makeHomeWithConfig(
      [
        '[__proto__]',
        'workspace = "pwned_via_proto"',
        'limit = 999',
        '',
        '[output.__proto__]',
        'format = "json"',
        '',
        '[logging.__proto__]',
        'level = "debug"',
        '',
      ].join('\n')
    );

    const resolved = resolveConfig(baseOptions(home));
    expect(resolved.workspace).toBeUndefined();
    expect(resolved.limit).toBeUndefined();
    expect(resolved.settings.output).toEqual({ format: 'text', color: 'auto' });
    expect(resolved.settings.logging).toEqual({
      level: 'warning',
      file: '',
      file_level: 'debug',
      format: 'text',
    });
    expect(resolved.setFields.size).toBe(0);
  });

  it('PROTO-ADV-02: getConfigFileValue ignores Object.prototype properties and __proto__ lookups', () => {
    const dir = makeTempDir();
    const target = join(dir, CONFIG_FILE_NAME);
    writeFileSync(target, '[output]\nformat = "json"\n', { mode: 0o600 });

    expect(getConfigFileValue(target, 'output.format')).toBe('json');
    expect(getConfigFileValue(target, 'output.toString')).toBeUndefined();
    expect(getConfigFileValue(target, 'output.constructor')).toBeUndefined();
    expect(getConfigFileValue(target, 'output.hasOwnProperty')).toBeUndefined();
    expect(getConfigFileValue(target, '__proto__.workspace')).toBeUndefined();
  });

  it('FS-ADV-01: class-based ConfigFs relying on this works in resolveConfig, writeConfigData, and setConfigValue', () => {
    class MemoryConfigFs implements ConfigFs {
      readonly files: Map<string, string> = new Map();
      readonly dirs: Set<string> = new Set();
      private nextFd = 10;
      private readonly openBuffers: Map<number, { path: string; chunks: string[] }> = new Map();

      existsSync(path: string): boolean {
        return this.files.has(path);
      }

      readFileSync(path: string, _encoding: 'utf8'): string {
        const content = this.files.get(path);
        if (content === undefined) {
          throw new Error(`ENOENT: ${path}`);
        }
        return content;
      }

      statSync(_path: string): { mode: number } {
        return { mode: 0o600 };
      }

      mkdirSync(path: string, _options: { recursive: true; mode?: number | undefined }): unknown {
        this.dirs.add(path);
        return undefined;
      }

      writeFileSync(path: string, data: string, _options: { mode?: number }): void {
        this.files.set(path, data);
      }

      chmodSync(_path: string, _mode: number): void {
        // no-op
      }

      openSync(path: string, _flags: string, _mode?: number): number {
        const fd = this.nextFd;
        this.nextFd += 1;
        this.openBuffers.set(fd, { path, chunks: [] });
        return fd;
      }

      writeSync(fd: number, data: string): number {
        const entry = this.openBuffers.get(fd);
        if (entry === undefined) {
          throw new Error(`EBADF: ${fd}`);
        }
        entry.chunks.push(data);
        return data.length;
      }

      fsyncSync(_fd: number): void {
        // no-op
      }

      closeSync(fd: number): void {
        const entry = this.openBuffers.get(fd);
        if (entry !== undefined) {
          this.files.set(entry.path, entry.chunks.join(''));
          this.openBuffers.delete(fd);
        }
      }

      renameSync(oldPath: string, newPath: string): void {
        const content = this.files.get(oldPath);
        if (content === undefined) {
          throw new Error(`ENOENT: ${oldPath}`);
        }
        this.files.set(newPath, content);
        this.files.delete(oldPath);
      }

      unlinkSync(path: string): void {
        this.files.delete(path);
      }
    }

    const memFs = new MemoryConfigFs();
    const home = '/virtual/home';
    const project = '/virtual/project';
    const dotProject = `${project}/.${CONFIG_FILE_NAME}`;
    memFs.files.set(dotProject, '[output]\nformat = "json"\n');

    const resolved = resolveConfig({
      env: {},
      homedir: () => home,
      cwd: () => project,
      fs: memFs,
      platform: 'linux',
    });
    expect(resolved.configPath).toBe(dotProject);
    expect(resolved.settings.output.format).toBe('json');

    const target = `${home}/.config/ts-projects/${CONFIG_FILE_NAME}`;
    writeConfigData(target, { output: { format: 'csv' } }, { fs: memFs, platform: 'linux' });
    expect(memFs.dirs.has(`${home}/.config/ts-projects`)).toBe(true);
    expect(getConfigFileValue(target, 'output.format', memFs)).toBe('csv');

    setConfigValue(target, 'output.color', 'never', { fs: memFs, platform: 'linux' });
    expect(getConfigFileValue(target, 'output.color', memFs)).toBe('never');
  });

  it('TOK-ADV-05: writeConfigData strips nested token keys inside [output] and [logging]', () => {
    const dir = makeTempDir();
    const target = join(dir, CONFIG_FILE_NAME);
    writeConfigData(target, {
      token: 'TOP_SECRET',
      output: { format: 'json', token: 'NESTED_OUTPUT_SECRET' },
      logging: { level: 'info', token: 'NESTED_LOGGING_SECRET' },
    });

    const raw = readFileSync(target, 'utf8');
    expect(raw).not.toContain('TOP_SECRET');
    expect(raw).not.toContain('NESTED_OUTPUT_SECRET');
    expect(raw).not.toContain('NESTED_LOGGING_SECRET');
    expect(raw).not.toContain('token');
    expect(getConfigFileValue(target, 'output.format')).toBe('json');
    expect(getConfigFileValue(target, 'logging.level')).toBe('info');
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
});
