// API configuration from the environment (D-048). Pure, so it is unit-tested;
// server.ts turns a ConfigError into a non-zero exit at startup. The source
// parser duplicates the CLI's on purpose: one app never imports another
// ([app-no-cross-app-import]); if both copies grow, move it into the core.

/** Env var selecting the data source; the API defaults to `memory`. */
export const SOURCE_ENV_VAR = 'TS_PROJECTS_SOURCE';
/** Token for the `http` source. */
export const TOKEN_ENV_VAR = 'TS_PROJECTS_TOKEN';
/** Optional API root override for the `http` source. */
export const API_URL_ENV_VAR = 'TS_PROJECTS_API_URL';
/** Cloud Run's default port. */
export const DEFAULT_PORT = 8080;

/** A configuration problem, reported at startup. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** The effective API configuration. */
export type ApiConfig =
  | { port: number; source: 'memory' }
  | { port: number; source: 'http'; token: string; baseUrl: string | undefined };

function parsePort(value: string | undefined): number {
  if (value === undefined || value === '') {
    return DEFAULT_PORT;
  }
  const port = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new ConfigError(`Invalid PORT "${value}": expected an integer from 1 to 65535`);
  }
  return port;
}

function parseSource(value: string | undefined): 'http' | 'memory' {
  if (value === undefined || value === '') {
    return 'memory';
  }
  if (value === 'http' || value === 'memory') {
    return value;
  }
  throw new ConfigError(`Invalid source "${value}": expected "http" or "memory"`);
}

/** Resolve the API configuration; throws ConfigError on a bad value. */
export function resolveApiConfig(env: Record<string, string | undefined>): ApiConfig {
  const port = parsePort(env['PORT']);
  const source = parseSource(env[SOURCE_ENV_VAR]);
  if (source === 'memory') {
    return { port, source };
  }
  const token = env[TOKEN_ENV_VAR];
  if (token === undefined || token === '') {
    throw new ConfigError(
      `${SOURCE_ENV_VAR}=http needs ${TOKEN_ENV_VAR}; set it, or use ${SOURCE_ENV_VAR}=memory for the demo data`
    );
  }
  const baseUrl = env[API_URL_ENV_VAR];
  return { port, source, token, baseUrl: baseUrl === '' ? undefined : baseUrl };
}
