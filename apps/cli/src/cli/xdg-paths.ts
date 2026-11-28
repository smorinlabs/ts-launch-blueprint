// Cross-platform XDG base-directory and Windows native path resolution (ADR 0011).
// Non-empty absolute XDG_* overrides win on all platforms; Windows falls back to
// %APPDATA%, %LOCALAPPDATA%, %PROGRAMDATA%, and nested Cache under %LOCALAPPDATA%.
// Platform is injectable on every function for concurrent test safety (sequence.shuffle).
// cspell:ignore appdata localappdata programdata dotfile
import { existsSync, mkdirSync } from 'node:fs';
import { posix, win32 } from 'node:path';

/** Tool directory name under XDG and Windows app directories. */
export const TOOL_DIR_NAME = 'ts-projects' as const;

/** Canonical TOML configuration filename. */
export const CONFIG_FILE_NAME = 'ts-projects_config.toml' as const;

/** True when the target platform is Windows (`win32`). */
export function isWindowsPlatform(platform?: string): boolean {
  return (platform ?? process.platform) === 'win32';
}

function pathImpl(platform?: string): typeof posix | typeof win32 {
  return isWindowsPlatform(platform) ? win32 : posix;
}

function xdgOverride(
  env: Record<string, string | undefined>,
  varName: string,
  platform?: string
): string | undefined {
  const raw = env[varName];
  if (raw === undefined || raw === '') {
    return undefined;
  }
  return pathImpl(platform).isAbsolute(raw) ? raw : undefined;
}

function windowsEnvDir(
  env: Record<string, string | undefined>,
  homedir: () => string,
  varName: string,
  ...fallbackParts: string[]
): string {
  const raw = env[varName];
  if (raw !== undefined && raw !== '' && win32.isAbsolute(raw)) {
    return raw;
  }
  return win32.join(homedir(), ...fallbackParts);
}

/** Base user config home (`$XDG_CONFIG_HOME`, else `%APPDATA%` on Windows or `~/.config`). */
export function configHome(
  env: Record<string, string | undefined>,
  homedir: () => string,
  platform?: string
): string {
  const override = xdgOverride(env, 'XDG_CONFIG_HOME', platform);
  if (override !== undefined) {
    return override;
  }
  if (isWindowsPlatform(platform)) {
    return windowsEnvDir(env, homedir, 'APPDATA', 'AppData', 'Roaming');
  }
  return posix.join(homedir(), '.config');
}

/** Base user data home (`$XDG_DATA_HOME`, else `%LOCALAPPDATA%` on Windows or `~/.local/share`). */
export function dataHome(
  env: Record<string, string | undefined>,
  homedir: () => string,
  platform?: string
): string {
  const override = xdgOverride(env, 'XDG_DATA_HOME', platform);
  if (override !== undefined) {
    return override;
  }
  if (isWindowsPlatform(platform)) {
    return windowsEnvDir(env, homedir, 'LOCALAPPDATA', 'AppData', 'Local');
  }
  return posix.join(homedir(), '.local', 'share');
}

/** Base user state home (`$XDG_STATE_HOME`, else `%LOCALAPPDATA%` on Windows or `~/.local/state`). */
export function stateHome(
  env: Record<string, string | undefined>,
  homedir: () => string,
  platform?: string
): string {
  const override = xdgOverride(env, 'XDG_STATE_HOME', platform);
  if (override !== undefined) {
    return override;
  }
  if (isWindowsPlatform(platform)) {
    return windowsEnvDir(env, homedir, 'LOCALAPPDATA', 'AppData', 'Local');
  }
  return posix.join(homedir(), '.local', 'state');
}

/** Base user cache home (`$XDG_CACHE_HOME`, else `%LOCALAPPDATA%` on Windows or `~/.cache`). */
export function cacheHome(
  env: Record<string, string | undefined>,
  homedir: () => string,
  platform?: string
): string {
  const override = xdgOverride(env, 'XDG_CACHE_HOME', platform);
  if (override !== undefined) {
    return override;
  }
  if (isWindowsPlatform(platform)) {
    return windowsEnvDir(env, homedir, 'LOCALAPPDATA', 'AppData', 'Local');
  }
  return posix.join(homedir(), '.cache');
}

/** System config base directories, highest-precedence first. */
export function configDirs(env: Record<string, string | undefined>, platform?: string): string[] {
  const isWin = isWindowsPlatform(platform);
  const p = isWin ? win32 : posix;
  const raw = env['XDG_CONFIG_DIRS'];
  if (raw !== undefined && raw !== '') {
    const sep = isWin ? ';' : ':';
    const parsed = raw.split(sep).filter((entry) => entry !== '' && p.isAbsolute(entry));
    if (parsed.length > 0) {
      return parsed;
    }
  }
  if (isWin) {
    const pd = env['PROGRAMDATA'];
    if (pd !== undefined && pd !== '' && win32.isAbsolute(pd)) {
      return [pd];
    }
    return ['C:\\ProgramData'];
  }
  return ['/etc/xdg'];
}

/** Per-app user config directory. */
export function configDir(
  env: Record<string, string | undefined>,
  homedir: () => string,
  platform?: string
): string {
  return pathImpl(platform).join(configHome(env, homedir, platform), TOOL_DIR_NAME);
}

/** Per-app user data directory. */
export function dataDir(
  env: Record<string, string | undefined>,
  homedir: () => string,
  platform?: string
): string {
  return pathImpl(platform).join(dataHome(env, homedir, platform), TOOL_DIR_NAME);
}

/** Per-app user state directory. */
export function stateDir(
  env: Record<string, string | undefined>,
  homedir: () => string,
  platform?: string
): string {
  return pathImpl(platform).join(stateHome(env, homedir, platform), TOOL_DIR_NAME);
}

/**
 * Per-app cache directory. On Windows without an explicit valid `XDG_CACHE_HOME`,
 * appends `Cache` under `<LOCALAPPDATA>\ts-projects` to avoid colliding with data/state.
 */
export function cacheDir(
  env: Record<string, string | undefined>,
  homedir: () => string,
  platform?: string
): string {
  const isWin = isWindowsPlatform(platform);
  const p = isWin ? win32 : posix;
  const base = p.join(cacheHome(env, homedir, platform), TOOL_DIR_NAME);
  if (isWin && xdgOverride(env, 'XDG_CACHE_HOME', platform) === undefined) {
    return p.join(base, 'Cache');
  }
  return base;
}

/** User config file path. */
export function configFile(
  env: Record<string, string | undefined>,
  homedir: () => string,
  platform?: string
): string {
  return pathImpl(platform).join(configDir(env, homedir, platform), CONFIG_FILE_NAME);
}

/** System config file paths, highest-precedence first. */
export function systemConfigFiles(
  env: Record<string, string | undefined>,
  platform?: string
): string[] {
  const p = pathImpl(platform);
  return configDirs(env, platform).map((dir) => p.join(dir, TOOL_DIR_NAME, CONFIG_FILE_NAME));
}

/**
 * Project-local config file in `cwd()`: prefers `./.ts-projects_config.toml`
 * when it exists, otherwise `./ts-projects_config.toml`.
 */
export function projectConfigFile(
  cwd: () => string = () => process.cwd(),
  exists: (path: string) => boolean = existsSync,
  platform?: string
): string {
  const p = pathImpl(platform);
  const base = cwd();
  const dotfile = p.join(base, `.${CONFIG_FILE_NAME}`);
  if (exists(dotfile)) {
    return dotfile;
  }
  return p.join(base, CONFIG_FILE_NAME);
}

/** Default log file path in the user state directory. */
export function logFile(
  env: Record<string, string | undefined>,
  homedir: () => string,
  platform?: string
): string {
  return pathImpl(platform).join(stateDir(env, homedir, platform), `${TOOL_DIR_NAME}.log`);
}

/** Named state file (`crash`, `first_run`, `history`, etc.) in the user state directory. */
export function stateFile(
  name: string,
  env: Record<string, string | undefined>,
  homedir: () => string,
  ext: string = 'log',
  platform?: string
): string {
  return pathImpl(platform).join(
    stateDir(env, homedir, platform),
    `${TOOL_DIR_NAME}_${name}.${ext}`
  );
}

/** Named database/data file in the user data directory. */
export function databaseFile(
  env: Record<string, string | undefined>,
  homedir: () => string,
  name: string = 'db',
  ext: string = 'db',
  platform?: string
): string {
  return pathImpl(platform).join(
    dataDir(env, homedir, platform),
    `${TOOL_DIR_NAME}_${name}.${ext}`
  );
}

/** Ensure `dirPath` exists (mode `0o700` on POSIX, omitted on Windows) and return it. */
export function ensureDir(
  dirPath: string,
  mkdir: (
    path: string,
    options: { recursive: true; mode?: number | undefined }
  ) => unknown = mkdirSync,
  platform?: string
): string {
  if (isWindowsPlatform(platform)) {
    mkdir(dirPath, { recursive: true });
  } else {
    mkdir(dirPath, { recursive: true, mode: 0o700 });
  }
  return dirPath;
}
