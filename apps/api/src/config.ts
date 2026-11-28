// API configuration from the environment (D-048). Pure, so it is unit-tested;
// server.ts turns a ConfigError into a non-zero exit at startup. The source
// parser duplicates the CLI's on purpose: one app never imports another
// ([app-no-cross-app-import]); if both copies grow, move it into the core.
import { isIP } from 'node:net';

import { ConfigError } from 'ts-launch-blueprint-core';
import { z } from 'zod';

/** Env var selecting the data source; the API defaults to `memory`. */
export const SOURCE_ENV_VAR = 'TS_PROJECTS_SOURCE';
/** Token for the `http` source. */
export const TOKEN_ENV_VAR = 'TS_PROJECTS_TOKEN';
/** Optional API root override for the `http` source. */
export const API_URL_ENV_VAR = 'TS_PROJECTS_API_URL';
/** Bind host; defaults to loopback locally, overridden to 0.0.0.0 in containers. */
export const HOST_ENV_VAR = 'HOST';
/** Default bind host when HOST is unset. */
export const DEFAULT_HOST = '127.0.0.1';
/** Cloud Run's default port. */
export const DEFAULT_PORT = 8080;
/** Opt-in CORS allowed origins (JSON array or comma-separated list). */
export const CORS_ORIGINS_ENV_VAR = 'CORS_ORIGINS';
/** Opt-in fixed-window rate limit (`<count>/<second|minute|hour|day>`). */
export const RATE_LIMIT_ENV_VAR = 'RATE_LIMIT';
/** Opt-in trusted reverse-proxy policy (`false` default, `true`, or IP/CIDR list). */
export const TRUST_PROXY_ENV_VAR = 'TRUST_PROXY';
/** Graceful shutdown timeout in milliseconds. */
export const SHUTDOWN_TIMEOUT_ENV_VAR = 'SHUTDOWN_TIMEOUT_MS';
/** Default graceful shutdown timeout in milliseconds. */
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;
/** Log level: debug | info (default) | warn | error | silent. */
export const LOG_LEVEL_ENV_VAR = 'LOG_LEVEL';
/** Optional GCP project, for Cloud Logging's full trace name (Cloud Run
 * doesn't set one by default). */
export const GCP_PROJECT_ENV_VAR = 'GCP_PROJECT_ID';

/** Metrics endpoint switch: true (default) or false. */
export const METRICS_ENABLED_ENV_VAR = 'METRICS_ENABLED';

/** OTLP base endpoint; its presence turns tracing on (`/v1/traces` added). */
export const OTLP_ENDPOINT_ENV_VAR = 'OTEL_EXPORTER_OTLP_ENDPOINT';
/** OTLP traces endpoint, used as-is; wins over the base endpoint. */
export const OTLP_TRACES_ENDPOINT_ENV_VAR = 'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT';
/** The traces' `service.name`. */
export const SERVICE_NAME_ENV_VAR = 'OTEL_SERVICE_NAME';
/** Sampling ratio for new traces, 0 to 1. */
export const SAMPLER_ARG_ENV_VAR = 'OTEL_TRACES_SAMPLER_ARG';
/** `service.name` when OTEL_SERVICE_NAME isn't set. */
export const DEFAULT_SERVICE_NAME = 'ts-launch-blueprint-api';

/** The levels LOG_LEVEL accepts. */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;
/** A LOG_LEVEL value. */
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Parsed rate-limit specification. */
export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  unit: 'second' | 'minute' | 'hour' | 'day';
}

/** Trusted reverse-proxy policy: false (default), true (trust any), or IP/CIDR list. */
export type TrustProxyConfig = boolean | string[];

/** Tracing settings; `tracesUrl` undefined means tracing is off. */
export interface TracingConfig {
  tracesUrl: string | undefined;
  serviceName: string;
  sampleRatio: number;
}

/** Settings shared by both data sources. */
interface BaseConfig {
  host: string;
  port: number;
  logLevel: LogLevel;
  gcpProjectId: string | undefined;
  metricsEnabled: boolean;
  tracing: TracingConfig;
  corsOrigins: string[];
  rateLimit: RateLimitConfig | undefined;
  trustProxy: TrustProxyConfig;
  shutdownTimeoutMs: number;
}

/** The effective API configuration. */
export type ApiConfig =
  | (BaseConfig & { source: 'memory' })
  | (BaseConfig & { source: 'http'; token: string; baseUrl: string | undefined });

const UNIT_MS: Record<RateLimitConfig['unit'], number> = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

const RATE_LIMIT_RE = /^([1-9]\d*)\/(second|minute|hour|day)s?$/i;

function isValidHttpOrigin(entry: string): boolean {
  if (entry === '*') {
    return true;
  }
  try {
    const url = new URL(entry);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === entry;
  } catch {
    return false;
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Parse a `RATE_LIMIT` string (`"<count>/<second|minute|hour|day>"`). */
export function parseRateLimit(value: string): RateLimitConfig {
  const match = RATE_LIMIT_RE.exec(value.trim());
  if (match === null) {
    throw new ConfigError(
      `Invalid ${RATE_LIMIT_ENV_VAR} "${value}": expected "<count>/<second|minute|hour|day>" (e.g. "100/minute")`
    );
  }
  const parsed = z
    .object({
      limit: z.number().int().positive(),
      unit: z.enum(['second', 'minute', 'hour', 'day']),
    })
    .safeParse({
      limit: Number(match[1]),
      unit: match[2]!.toLowerCase(),
    });
  if (!parsed.success) {
    throw new ConfigError(
      `Invalid ${RATE_LIMIT_ENV_VAR} "${value}": expected "<count>/<second|minute|hour|day>" (e.g. "100/minute")`
    );
  }
  return {
    limit: parsed.data.limit,
    windowMs: UNIT_MS[parsed.data.unit],
    unit: parsed.data.unit,
  };
}

function parseCorsOrigins(value: string | undefined): string[] {
  if (value === undefined || value.trim() === '') {
    return [];
  }
  const trimmed = value.trim();
  const invalidMessage = `Invalid ${CORS_ORIGINS_ENV_VAR} "${value}": expected "*" or a list of http(s) origins`;

  let rawEntries: unknown;
  if (trimmed.startsWith('[')) {
    try {
      rawEntries = JSON.parse(trimmed);
    } catch {
      throw new ConfigError(invalidMessage);
    }
  } else {
    rawEntries = trimmed.split(',').map((item) => item.trim());
  }

  const parsed = z.array(z.string().trim().min(1)).safeParse(rawEntries);
  if (!parsed.success) {
    throw new ConfigError(invalidMessage);
  }
  for (const origin of parsed.data) {
    if (!isValidHttpOrigin(origin)) {
      throw new ConfigError(invalidMessage);
    }
  }
  return parsed.data;
}

function isValidIpOrCidr(entry: string): boolean {
  const parts = entry.split('/');
  if (parts.length > 2) {
    return false;
  }
  const [address, prefixStr] = parts;
  const family = isIP(address ?? '');
  if (family === 0) {
    return false;
  }
  if (prefixStr === undefined) {
    return true;
  }
  if (!/^\d+$/.test(prefixStr)) {
    return false;
  }
  const prefix = Number(prefixStr);
  const maxPrefix = family === 4 ? 32 : 128;
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= maxPrefix;
}

/** Parse `TRUST_PROXY` (`false` default, `true`, or comma/JSON list of IPs/CIDRs). */
export function parseTrustProxy(value: string | undefined): TrustProxyConfig {
  if (value === undefined || value.trim() === '') {
    return false;
  }
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'false' || lower === '0') {
    return false;
  }
  if (lower === 'true' || lower === '1') {
    return true;
  }
  const invalidMessage = `Invalid ${TRUST_PROXY_ENV_VAR} "${value}": expected "true", "false", or a list of IP/CIDR entries`;

  let rawEntries: unknown;
  if (trimmed.startsWith('[')) {
    try {
      rawEntries = JSON.parse(trimmed);
    } catch {
      throw new ConfigError(invalidMessage);
    }
  } else {
    rawEntries = trimmed.split(',').map((item) => item.trim());
  }

  const parsed = z.array(z.string().trim().min(1)).min(1).safeParse(rawEntries);
  if (!parsed.success) {
    throw new ConfigError(invalidMessage);
  }
  for (const entry of parsed.data) {
    if (!isValidIpOrCidr(entry)) {
      throw new ConfigError(invalidMessage);
    }
  }
  return parsed.data;
}

const emptyOrString = z.string().optional();

const hostSchema = emptyOrString.transform((value, ctx) => {
  if (value === undefined || value === '') {
    return DEFAULT_HOST;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    ctx.addIssue({
      code: 'custom',
      message: `Invalid ${HOST_ENV_VAR} "${value}": expected a non-empty host`,
    });
    return z.NEVER;
  }
  return trimmed;
});

const portSchema = emptyOrString.transform((value, ctx) => {
  if (value === undefined || value === '') {
    return DEFAULT_PORT;
  }
  const num = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  const parsed = z.number().int().min(1).max(65_535).safeParse(num);
  if (!parsed.success) {
    ctx.addIssue({
      code: 'custom',
      message: `Invalid PORT "${value}": expected an integer from 1 to 65535`,
    });
    return z.NEVER;
  }
  return parsed.data;
});

const logLevelSchema = emptyOrString.transform((value, ctx) => {
  if (value === undefined || value === '') {
    return 'info' as const;
  }
  const parsed = z.enum(LOG_LEVELS).safeParse(value);
  if (!parsed.success) {
    ctx.addIssue({
      code: 'custom',
      message: `Invalid ${LOG_LEVEL_ENV_VAR} "${value}": expected one of ${LOG_LEVELS.join(', ')}`,
    });
    return z.NEVER;
  }
  return parsed.data;
});

const metricsEnabledSchema = emptyOrString.transform((value, ctx) => {
  if (value === undefined || value === '') {
    return true;
  }
  const parsed = z.enum(['true', 'false']).safeParse(value);
  if (!parsed.success) {
    ctx.addIssue({
      code: 'custom',
      message: `Invalid ${METRICS_ENABLED_ENV_VAR} "${value}": expected "true" or "false"`,
    });
    return z.NEVER;
  }
  return parsed.data === 'true';
});

const sampleRatioSchema = emptyOrString.transform((value, ctx) => {
  if (value === undefined || value === '') {
    return 1;
  }
  const ratio = /^\d+(\.\d+)?$/.test(value) ? Number(value) : Number.NaN;
  const parsed = z.number().min(0).max(1).safeParse(ratio);
  if (!parsed.success) {
    ctx.addIssue({
      code: 'custom',
      message: `Invalid ${SAMPLER_ARG_ENV_VAR} "${value}": expected a number from 0 to 1`,
    });
    return z.NEVER;
  }
  return parsed.data;
});

const corsOriginsSchema = emptyOrString.transform((value, ctx) => {
  try {
    return parseCorsOrigins(value);
  } catch (err) {
    ctx.addIssue({
      code: 'custom',
      message: (err as Error).message,
    });
    return z.NEVER;
  }
});

const rateLimitSchema = emptyOrString.transform((value, ctx) => {
  if (value === undefined || value === '') {
    return undefined;
  }
  try {
    return parseRateLimit(value);
  } catch (err) {
    ctx.addIssue({
      code: 'custom',
      message: (err as Error).message,
    });
    return z.NEVER;
  }
});

const trustProxySchema = emptyOrString.transform((value, ctx) => {
  try {
    return parseTrustProxy(value);
  } catch (err) {
    ctx.addIssue({
      code: 'custom',
      message: (err as Error).message,
    });
    return z.NEVER;
  }
});

const MAX_TIMEOUT_MS = 2_147_483_647;

const shutdownTimeoutMsSchema = emptyOrString.transform((value, ctx) => {
  if (value === undefined || value === '') {
    return DEFAULT_SHUTDOWN_TIMEOUT_MS;
  }
  const num = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  const parsed = z.number().int().positive().max(MAX_TIMEOUT_MS).safeParse(num);
  if (!parsed.success) {
    ctx.addIssue({
      code: 'custom',
      message: `Invalid ${SHUTDOWN_TIMEOUT_ENV_VAR} "${value}": expected an integer from 1 to ${MAX_TIMEOUT_MS}`,
    });
    return z.NEVER;
  }
  return parsed.data;
});

const sourceSchema = emptyOrString.transform((value, ctx) => {
  if (value === undefined || value === '') {
    return 'memory' as const;
  }
  const parsed = z.enum(['http', 'memory']).safeParse(value);
  if (!parsed.success) {
    ctx.addIssue({
      code: 'custom',
      message: `Invalid source "${value}": expected "http" or "memory"`,
    });
    return z.NEVER;
  }
  return parsed.data;
});

const ApiEnvSchema = z
  .object({
    [HOST_ENV_VAR]: hostSchema,
    PORT: portSchema,
    [LOG_LEVEL_ENV_VAR]: logLevelSchema,
    [GCP_PROJECT_ENV_VAR]: emptyOrString.transform((v) => (v === '' ? undefined : v)),
    [METRICS_ENABLED_ENV_VAR]: metricsEnabledSchema,
    [OTLP_TRACES_ENDPOINT_ENV_VAR]: emptyOrString.transform((v) => (v === '' ? undefined : v)),
    [OTLP_ENDPOINT_ENV_VAR]: emptyOrString.transform((v) => (v === '' ? undefined : v)),
    [SERVICE_NAME_ENV_VAR]: emptyOrString.transform((v) =>
      v === undefined || v === '' ? DEFAULT_SERVICE_NAME : v
    ),
    [SAMPLER_ARG_ENV_VAR]: sampleRatioSchema,
    [CORS_ORIGINS_ENV_VAR]: corsOriginsSchema,
    [RATE_LIMIT_ENV_VAR]: rateLimitSchema,
    [TRUST_PROXY_ENV_VAR]: trustProxySchema,
    [SHUTDOWN_TIMEOUT_ENV_VAR]: shutdownTimeoutMsSchema,
    [SOURCE_ENV_VAR]: sourceSchema,
    [TOKEN_ENV_VAR]: emptyOrString.transform((v) =>
      v === undefined || v.trim() === '' ? undefined : v
    ),
    [API_URL_ENV_VAR]: emptyOrString.transform((v) => (v === '' ? undefined : v)),
  })
  .transform((parsed, ctx): ApiConfig => {
    const tracesEndpoint = parsed[OTLP_TRACES_ENDPOINT_ENV_VAR];
    const baseEndpoint = parsed[OTLP_ENDPOINT_ENV_VAR];
    let tracesUrl: string | undefined;
    if (tracesEndpoint !== undefined) {
      if (!isValidHttpUrl(tracesEndpoint)) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid ${OTLP_TRACES_ENDPOINT_ENV_VAR} "${tracesEndpoint}": expected an http(s) URL`,
        });
        return z.NEVER;
      }
      tracesUrl = tracesEndpoint;
    } else if (baseEndpoint !== undefined) {
      if (!isValidHttpUrl(baseEndpoint)) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid ${OTLP_ENDPOINT_ENV_VAR} "${baseEndpoint}": expected an http(s) URL`,
        });
        return z.NEVER;
      }
      // Trailing slashes dropped: `http://host:4318/` must not give `//v1/traces`.
      tracesUrl = `${baseEndpoint.replace(/\/+$/, '')}/v1/traces`;
    }

    const base: BaseConfig = {
      host: parsed[HOST_ENV_VAR],
      port: parsed.PORT,
      logLevel: parsed[LOG_LEVEL_ENV_VAR],
      gcpProjectId: parsed[GCP_PROJECT_ENV_VAR],
      metricsEnabled: parsed[METRICS_ENABLED_ENV_VAR],
      tracing: {
        tracesUrl,
        serviceName: parsed[SERVICE_NAME_ENV_VAR],
        sampleRatio: parsed[SAMPLER_ARG_ENV_VAR],
      },
      corsOrigins: parsed[CORS_ORIGINS_ENV_VAR],
      rateLimit: parsed[RATE_LIMIT_ENV_VAR],
      trustProxy: parsed[TRUST_PROXY_ENV_VAR],
      shutdownTimeoutMs: parsed[SHUTDOWN_TIMEOUT_ENV_VAR],
    };

    const source = parsed[SOURCE_ENV_VAR];
    if (source === 'memory') {
      return { ...base, source };
    }
    const token = parsed[TOKEN_ENV_VAR];
    if (token === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: `${SOURCE_ENV_VAR}=http needs ${TOKEN_ENV_VAR}; set it, or use ${SOURCE_ENV_VAR}=memory for the demo data`,
      });
      return z.NEVER;
    }
    return {
      ...base,
      source,
      token,
      baseUrl: parsed[API_URL_ENV_VAR],
    };
  });

/** Resolve the API configuration; throws ConfigError on a bad value. */
export function resolveApiConfig(env: Record<string, string | undefined>): ApiConfig {
  const result = ApiEnvSchema.safeParse(env);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ConfigError(issue?.message ?? 'Invalid API configuration');
  }
  return result.data;
}
