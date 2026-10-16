// Data-source selection for the CLI: `http` (the projects API, needs a
// token) or `memory` (the core's in-memory demo seed: no token, no server).
// Precedence: --source flag > TS_PROJECTS_SOURCE > default `http`. Both the
// flag and the env var are validated here, so a bad value gets one exact
// message either way (a Commander argument parser can't see the env var).
import { UsageError } from './exit-codes.js';

/** Env var selecting the data source (`http` or `memory`). */
export const SOURCE_ENV_VAR = 'TS_PROJECTS_SOURCE';

/** The data sources the CLI can run on. */
export type CliSource = 'http' | 'memory';

/** Where the effective source came from. */
export type CliSourceOrigin = 'flag' | 'env' | 'default';

/** The effective source and its origin. */
export interface ResolvedSource {
  source: CliSource;
  origin: CliSourceOrigin;
}

function parseSource(value: string): CliSource {
  // Case-sensitive on purpose: `MEMORY` is rejected, like any other typo.
  if (value === 'http' || value === 'memory') {
    return value;
  }
  throw new UsageError(`Invalid source "${value}": expected "http" or "memory"`);
}

/** Resolve the data source; throws UsageError (exit 2) on a bad value. */
export function resolveSource(input: {
  flag?: string | undefined;
  env: Record<string, string | undefined>;
}): ResolvedSource {
  if (input.flag !== undefined) {
    return { source: parseSource(input.flag), origin: 'flag' };
  }
  const fromEnv = input.env[SOURCE_ENV_VAR];
  if (fromEnv !== undefined && fromEnv !== '') {
    return { source: parseSource(fromEnv), origin: 'env' };
  }
  return { source: 'http', origin: 'default' };
}
