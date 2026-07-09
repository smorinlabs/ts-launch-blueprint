// XDG base-directory resolution (D-017(3)): hand-rolled ~30 lines on the
// agent2linear pattern — $XDG_CONFIG_HOME/<tool> else ~/.config/<tool> on
// ALL platforms (matching the Python source's cross-platform ~/.config
// behavior; get_config_path used %USERPROFILE%\.config on Windows too).
// No env-paths: its platform-native dirs (~/Library/Preferences on macOS,
// %APPDATA% on Windows) would break the documented ~/.config/<tool> UX.
//
// Windows note: os.homedir() resolves %USERPROFILE%, so the config lives
// at %USERPROFILE%\.config\ts-projects — deliberately NOT %APPDATA%, for
// parity with the source and cli-standards R5.3.
import { join } from 'node:path';

/** Tool directory name under the XDG config home (D-029). */
export const TOOL_DIR_NAME = 'ts-projects';

/**
 * Resolve the user config directory: $XDG_CONFIG_HOME/ts-projects when
 * XDG_CONFIG_HOME is set and non-empty, else <home>/.config/ts-projects.
 * env and homedir are injected for hermetic tests.
 */
export function configDir(env: Record<string, string | undefined>, homedir: () => string): string {
  const xdgConfigHome = env['XDG_CONFIG_HOME'];
  if (xdgConfigHome !== undefined && xdgConfigHome !== '') {
    return join(xdgConfigHome, TOOL_DIR_NAME);
  }
  return join(homedir(), '.config', TOOL_DIR_NAME);
}
