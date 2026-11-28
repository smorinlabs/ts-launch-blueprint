// Unit and property tests for cross-platform XDG + Windows path resolution (P11-TS02, ADR 0011).
// cspell:ignore localappdata programdata dotfile
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, win32 } from 'node:path';

import * as fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';

import {
  cacheDir,
  cacheHome,
  CONFIG_FILE_NAME,
  configDir,
  configDirs,
  configFile,
  configHome,
  databaseFile,
  dataDir,
  dataHome,
  ensureDir,
  isWindowsPlatform,
  logFile,
  projectConfigFile,
  stateDir,
  stateFile,
  stateHome,
  systemConfigFiles,
  TOOL_DIR_NAME,
} from '../src/cli/xdg-paths.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ts-projects-xdg-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const winHome = (): string => 'C:\\Users\\alice';
const posixHome = (): string => '/home/alice';

describe('isWindowsPlatform and constants', () => {
  it('identifies win32 vs POSIX platforms', () => {
    expect(TOOL_DIR_NAME).toBe('ts-projects');
    expect(CONFIG_FILE_NAME).toBe('ts-projects_config.toml');
    expect(isWindowsPlatform('win32')).toBe(true);
    expect(isWindowsPlatform('linux')).toBe(false);
    expect(isWindowsPlatform('darwin')).toBe(false);
  });
});

describe('Windows native paths + XDG overrides (ADR 0011)', () => {
  const roaming = 'C:\\Users\\alice\\AppData\\Roaming';
  const local = 'C:\\Users\\alice\\AppData\\Local';

  it('XDG-01: Windows configDir and configFile use %APPDATA%\\ts-projects', () => {
    const env = { APPDATA: roaming };
    expect(configHome(env, winHome, 'win32')).toBe(roaming);
    expect(configDir(env, winHome, 'win32')).toBe(win32.join(roaming, 'ts-projects'));
    expect(configFile(env, winHome, 'win32')).toBe(
      win32.join(roaming, 'ts-projects', 'ts-projects_config.toml')
    );
  });

  it('XDG-02: Windows dataDir and stateDir use %LOCALAPPDATA%\\ts-projects', () => {
    const env = { LOCALAPPDATA: local };
    expect(dataHome(env, winHome, 'win32')).toBe(local);
    expect(stateHome(env, winHome, 'win32')).toBe(local);
    expect(dataDir(env, winHome, 'win32')).toBe(win32.join(local, 'ts-projects'));
    expect(stateDir(env, winHome, 'win32')).toBe(win32.join(local, 'ts-projects'));
  });

  it('XDG-03: Windows cacheDir nests Cache under app dir when XDG_CACHE_HOME is unset', () => {
    const env = { LOCALAPPDATA: local };
    expect(cacheHome(env, winHome, 'win32')).toBe(local);
    expect(cacheDir(env, winHome, 'win32')).toBe(win32.join(local, 'ts-projects', 'Cache'));
  });

  it('XDG-04: Windows XDG_CONFIG_HOME and XDG_CACHE_HOME overrides win without Cache nesting', () => {
    const xdgConfig = 'D:\\xdg\\config';
    const xdgCache = 'D:\\xdg\\cache';
    const env = {
      APPDATA: roaming,
      LOCALAPPDATA: local,
      XDG_CONFIG_HOME: xdgConfig,
      XDG_CACHE_HOME: xdgCache,
    };
    expect(configDir(env, winHome, 'win32')).toBe(win32.join(xdgConfig, 'ts-projects'));
    expect(cacheDir(env, winHome, 'win32')).toBe(win32.join(xdgCache, 'ts-projects'));
  });

  it('XDG-05: Windows unset/empty/relative APPDATA & LOCALAPPDATA fall back to home', () => {
    for (const env of [
      {},
      { APPDATA: '', LOCALAPPDATA: '' },
      { APPDATA: 'relative\\roaming', LOCALAPPDATA: 'relative\\local' },
    ]) {
      expect(configHome(env, winHome, 'win32')).toBe(win32.join(winHome(), 'AppData', 'Roaming'));
      expect(dataHome(env, winHome, 'win32')).toBe(win32.join(winHome(), 'AppData', 'Local'));
      expect(stateHome(env, winHome, 'win32')).toBe(win32.join(winHome(), 'AppData', 'Local'));
      expect(cacheHome(env, winHome, 'win32')).toBe(win32.join(winHome(), 'AppData', 'Local'));
    }
  });

  it('XDG-06: Windows configDirs uses %PROGRAMDATA% or C:\\ProgramData fallback', () => {
    expect(configDirs({ PROGRAMDATA: 'D:\\ProgramData' }, 'win32')).toEqual(['D:\\ProgramData']);
    expect(configDirs({}, 'win32')).toEqual(['C:\\ProgramData']);
    expect(configDirs({ PROGRAMDATA: '' }, 'win32')).toEqual(['C:\\ProgramData']);
    expect(configDirs({ PROGRAMDATA: 'relative\\pd' }, 'win32')).toEqual(['C:\\ProgramData']);
  });

  it('XDG-07: Windows XDG_CONFIG_DIRS splits on semicolons and drops empty/relative entries', () => {
    const env = {
      PROGRAMDATA: 'D:\\ProgramData',
      XDG_CONFIG_DIRS: 'C:\\one;;relative\\dir;D:/two;C:drive-relative',
    };
    expect(configDirs(env, 'win32')).toEqual(['C:\\one', 'D:/two']);
    expect(configDirs({ XDG_CONFIG_DIRS: ';rel;' }, 'win32')).toEqual(['C:\\ProgramData']);
  });
});

describe('POSIX paths + XDG overrides', () => {
  it('XDG-08: POSIX defaults resolve all quad dirs and /etc/xdg', () => {
    expect(configHome({}, posixHome, 'linux')).toBe('/home/alice/.config');
    expect(dataHome({}, posixHome, 'linux')).toBe('/home/alice/.local/share');
    expect(stateHome({}, posixHome, 'linux')).toBe('/home/alice/.local/state');
    expect(cacheHome({}, posixHome, 'linux')).toBe('/home/alice/.cache');

    expect(configDir({}, posixHome, 'linux')).toBe('/home/alice/.config/ts-projects');
    expect(dataDir({}, posixHome, 'linux')).toBe('/home/alice/.local/share/ts-projects');
    expect(stateDir({}, posixHome, 'linux')).toBe('/home/alice/.local/state/ts-projects');
    expect(cacheDir({}, posixHome, 'linux')).toBe('/home/alice/.cache/ts-projects');
    expect(configDirs({}, 'linux')).toEqual(['/etc/xdg']);
  });

  it('XDG-09: POSIX XDG_CONFIG_DIRS splits on colons and skips empty/relative entries', () => {
    expect(configDirs({ XDG_CONFIG_DIRS: '/etc/one:relative::/opt/two' }, 'linux')).toEqual([
      '/etc/one',
      '/opt/two',
    ]);
    expect(configDirs({ XDG_CONFIG_DIRS: ':rel:' }, 'linux')).toEqual(['/etc/xdg']);
  });

  it('XDG-10: empty or relative XDG_* values are ignored on POSIX and Windows', () => {
    for (const bad of ['', 'relative/not/absolute', './local']) {
      const env = {
        XDG_CONFIG_HOME: bad,
        XDG_DATA_HOME: bad,
        XDG_STATE_HOME: bad,
        XDG_CACHE_HOME: bad,
      };
      expect(configDir(env, posixHome, 'linux')).toBe('/home/alice/.config/ts-projects');
      expect(dataDir(env, posixHome, 'linux')).toBe('/home/alice/.local/share/ts-projects');
      expect(stateDir(env, posixHome, 'linux')).toBe('/home/alice/.local/state/ts-projects');
      expect(cacheDir(env, posixHome, 'linux')).toBe('/home/alice/.cache/ts-projects');

      expect(configDir(env, () => 'C:\\Users\\alice', 'win32')).toBe(
        'C:\\Users\\alice\\AppData\\Roaming\\ts-projects'
      );
      expect(cacheDir(env, () => 'C:\\Users\\alice', 'win32')).toBe(
        'C:\\Users\\alice\\AppData\\Local\\ts-projects\\Cache'
      );
    }
  });
});

describe('file helpers and ensureDir', () => {
  it('XDG-11: configFile, systemConfigFiles, databaseFile, logFile, and stateFile naming', () => {
    const env = {
      XDG_CONFIG_HOME: '/xdg/cfg',
      XDG_CONFIG_DIRS: '/sys/first:/sys/second',
      XDG_DATA_HOME: '/xdg/data',
      XDG_STATE_HOME: '/xdg/state',
    };
    expect(configFile(env, posixHome, 'linux')).toBe(
      '/xdg/cfg/ts-projects/ts-projects_config.toml'
    );
    expect(systemConfigFiles(env, 'linux')).toEqual([
      '/sys/first/ts-projects/ts-projects_config.toml',
      '/sys/second/ts-projects/ts-projects_config.toml',
    ]);
    expect(databaseFile(env, posixHome, undefined, undefined, 'linux')).toBe(
      '/xdg/data/ts-projects/ts-projects_db.db'
    );
    expect(databaseFile(env, posixHome, 'cache', 'sqlite', 'linux')).toBe(
      '/xdg/data/ts-projects/ts-projects_cache.sqlite'
    );
    expect(logFile(env, posixHome, 'linux')).toBe('/xdg/state/ts-projects/ts-projects.log');
    expect(stateFile('history', env, posixHome, undefined, 'linux')).toBe(
      '/xdg/state/ts-projects/ts-projects_history.log'
    );
    expect(stateFile('first_run', env, posixHome, 'marker', 'linux')).toBe(
      '/xdg/state/ts-projects/ts-projects_first_run.marker'
    );
  });

  it('XDG-12: projectConfigFile prefers dotfile .ts-projects_config.toml when present', () => {
    const dir = makeTempDir();
    const regular = join(dir, 'ts-projects_config.toml');
    const dotfile = join(dir, '.ts-projects_config.toml');

    // Neither exists -> non-dotfile path returned
    expect(projectConfigFile(() => dir)).toBe(regular);

    // Regular exists -> regular returned
    writeFileSync(regular, '');
    expect(projectConfigFile(() => dir)).toBe(regular);

    // Both exist -> dotfile wins
    writeFileSync(dotfile, '');
    expect(projectConfigFile(() => dir)).toBe(dotfile);
  });

  it.skipIf(process.platform === 'win32')(
    'XDG-13: ensureDir creates nested directories with mode 0o700 on POSIX',
    () => {
      const root = makeTempDir();
      const target = join(root, 'nested', 'state', 'ts-projects');
      const prevUmask = process.umask(0o022);
      try {
        const result = ensureDir(target, undefined, 'linux');
        expect(result).toBe(target);
        expect(statSync(target).mode & 0o777).toBe(0o700);
      } finally {
        process.umask(prevUmask);
      }
    }
  );

  it('XDG-13b: ensureDir omits POSIX mode option on win32', () => {
    const calls: Array<{ dir: string; options: { recursive: true; mode?: number | undefined } }> =
      [];
    const target = 'C:\\Users\\alice\\AppData\\Local\\ts-projects';
    const result = ensureDir(
      target,
      (dir, options) => {
        calls.push({ dir, options });
      },
      'win32'
    );
    expect(result).toBe(target);
    expect(calls).toEqual([{ dir: target, options: { recursive: true } }]);
  });
});

describe('XDG path properties', () => {
  const segmentArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,12}$/);

  it('absolute POSIX XDG_* overrides always resolve to <override>/ts-projects', () => {
    fc.assert(
      fc.property(segmentArb, segmentArb, (seg1, seg2) => {
        const base = posix.join('/', seg1, seg2);
        const env = {
          XDG_CONFIG_HOME: base,
          XDG_DATA_HOME: base,
          XDG_STATE_HOME: base,
          XDG_CACHE_HOME: base,
        };
        const expected = posix.join(base, TOOL_DIR_NAME);
        expect(configDir(env, () => '/home/user', 'linux')).toBe(expected);
        expect(dataDir(env, () => '/home/user', 'linux')).toBe(expected);
        expect(stateDir(env, () => '/home/user', 'linux')).toBe(expected);
        expect(cacheDir(env, () => '/home/user', 'linux')).toBe(expected);
      }),
      { numRuns: 50 }
    );
  });

  it('relative XDG_* values never override defaults on POSIX or Windows', () => {
    fc.assert(
      fc.property(segmentArb, segmentArb, (seg1, seg2) => {
        const rel = `${seg1}/${seg2}`;
        const env = { XDG_CONFIG_HOME: rel, XDG_CACHE_HOME: rel };
        expect(configDir(env, () => '/home/user', 'linux')).toBe('/home/user/.config/ts-projects');
        expect(cacheDir(env, () => 'C:\\Users\\user', 'win32')).toBe(
          'C:\\Users\\user\\AppData\\Local\\ts-projects\\Cache'
        );
      }),
      { numRuns: 50 }
    );
  });
});
