// resolveApiConfig: the API's defaults (port 8080, in-memory data) and the
// startup errors for bad values.
import { describe, expect, it } from 'vitest';

import { ConfigError, resolveApiConfig } from '../src/config.js';

describe('resolveApiConfig', () => {
  it('defaults to port 8080 and the in-memory source', () => {
    expect(resolveApiConfig({})).toEqual({
      port: 8080,
      source: 'memory',
      logLevel: 'info',
      gcpProjectId: undefined,
      metricsEnabled: true,
    });
  });

  it('reads a valid PORT', () => {
    expect(resolveApiConfig({ PORT: '3000' })).toEqual({
      port: 3000,
      source: 'memory',
      logLevel: 'info',
      gcpProjectId: undefined,
      metricsEnabled: true,
    });
  });

  it.each(['abc', '0', '65536', '80.5', '-1'])('rejects PORT=%s', (value) => {
    expect(() => resolveApiConfig({ PORT: value })).toThrow(ConfigError);
    expect(() => resolveApiConfig({ PORT: value })).toThrow(`Invalid PORT "${value}"`);
  });

  it('rejects a bad source with the same message as the CLI', () => {
    expect(() => resolveApiConfig({ TS_PROJECTS_SOURCE: 'foo' })).toThrow(
      'Invalid source "foo": expected "http" or "memory"'
    );
  });

  it('http without a token fails with a clear message', () => {
    expect(() => resolveApiConfig({ TS_PROJECTS_SOURCE: 'http' })).toThrow(
      'TS_PROJECTS_SOURCE=http needs TS_PROJECTS_TOKEN'
    );
  });

  it('http with a token (and an optional API URL) is accepted', () => {
    expect(
      resolveApiConfig({
        TS_PROJECTS_SOURCE: 'http',
        TS_PROJECTS_TOKEN: 't',
        TS_PROJECTS_API_URL: 'http://127.0.0.1:1/api',
      })
    ).toEqual({
      port: 8080,
      source: 'http',
      token: 't',
      baseUrl: 'http://127.0.0.1:1/api',
      logLevel: 'info',
      gcpProjectId: undefined,
      metricsEnabled: true,
    });
    expect(resolveApiConfig({ TS_PROJECTS_SOURCE: 'http', TS_PROJECTS_TOKEN: 't' })).toEqual({
      port: 8080,
      source: 'http',
      token: 't',
      baseUrl: undefined,
      logLevel: 'info',
      gcpProjectId: undefined,
      metricsEnabled: true,
    });
  });

  it.each(['debug', 'info', 'warn', 'error', 'silent'])('accepts LOG_LEVEL=%s', (level) => {
    expect(resolveApiConfig({ LOG_LEVEL: level }).logLevel).toBe(level);
  });

  it('rejects an unknown LOG_LEVEL with the allowed values', () => {
    expect(() => resolveApiConfig({ LOG_LEVEL: 'verbose' })).toThrow(ConfigError);
    expect(() => resolveApiConfig({ LOG_LEVEL: 'verbose' })).toThrow(
      'Invalid LOG_LEVEL "verbose": expected one of debug, info, warn, error, silent'
    );
  });

  it('reads an optional GCP_PROJECT_ID (empty means unset)', () => {
    expect(resolveApiConfig({ GCP_PROJECT_ID: 'my-proj' }).gcpProjectId).toBe('my-proj');
    expect(resolveApiConfig({ GCP_PROJECT_ID: '' }).gcpProjectId).toBeUndefined();
  });

  it('METRICS_ENABLED defaults to true (unset or empty) and accepts true or false', () => {
    expect(resolveApiConfig({}).metricsEnabled).toBe(true);
    expect(resolveApiConfig({ METRICS_ENABLED: '' }).metricsEnabled).toBe(true);
    expect(resolveApiConfig({ METRICS_ENABLED: 'true' }).metricsEnabled).toBe(true);
    expect(resolveApiConfig({ METRICS_ENABLED: 'false' }).metricsEnabled).toBe(false);
  });

  it.each(['yes', '0', 'TRUE'])('rejects METRICS_ENABLED=%s with a clear message', (value) => {
    expect(() => resolveApiConfig({ METRICS_ENABLED: value })).toThrow(ConfigError);
    expect(() => resolveApiConfig({ METRICS_ENABLED: value })).toThrow(
      `Invalid METRICS_ENABLED "${value}": expected "true" or "false"`
    );
  });
});
