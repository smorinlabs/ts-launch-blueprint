// resolveApiConfig: the API's defaults (127.0.0.1:8080, in-memory data) and
// the startup errors for bad values.
import { describe, expect, it } from 'vitest';

import { ConfigError, parseRateLimit, resolveApiConfig } from '../src/config.js';

describe('resolveApiConfig', () => {
  it('defaults to 127.0.0.1:8080, in-memory source, no CORS/rate-limit, and 10s shutdown', () => {
    expect(resolveApiConfig({})).toEqual({
      host: '127.0.0.1',
      port: 8080,
      source: 'memory',
      logLevel: 'info',
      gcpProjectId: undefined,
      metricsEnabled: true,
      tracing: { tracesUrl: undefined, serviceName: 'ts-launch-blueprint-api', sampleRatio: 1 },
      corsOrigins: [],
      rateLimit: undefined,
      shutdownTimeoutMs: 10_000,
    });
  });

  it('reads a valid PORT and HOST', () => {
    expect(resolveApiConfig({ HOST: '0.0.0.0', PORT: '3000' })).toEqual({
      host: '0.0.0.0',
      port: 3000,
      source: 'memory',
      logLevel: 'info',
      gcpProjectId: undefined,
      metricsEnabled: true,
      tracing: { tracesUrl: undefined, serviceName: 'ts-launch-blueprint-api', sampleRatio: 1 },
      corsOrigins: [],
      rateLimit: undefined,
      shutdownTimeoutMs: 10_000,
    });
    expect(resolveApiConfig({ HOST: '' }).host).toBe('127.0.0.1');
  });

  it('rejects a whitespace-only HOST', () => {
    expect(() => resolveApiConfig({ HOST: '   ' })).toThrow(ConfigError);
    expect(() => resolveApiConfig({ HOST: '   ' })).toThrow('Invalid HOST "   "');
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
    expect(() =>
      resolveApiConfig({ TS_PROJECTS_SOURCE: 'http', TS_PROJECTS_TOKEN: '   ' })
    ).toThrow(ConfigError);
    expect(() =>
      resolveApiConfig({ TS_PROJECTS_SOURCE: 'http', TS_PROJECTS_TOKEN: '   ' })
    ).toThrow('TS_PROJECTS_SOURCE=http needs TS_PROJECTS_TOKEN');
  });

  it('http with a token (and an optional API URL) is accepted', () => {
    expect(
      resolveApiConfig({
        TS_PROJECTS_SOURCE: 'http',
        TS_PROJECTS_TOKEN: 't',
        TS_PROJECTS_API_URL: 'http://127.0.0.1:1/api',
      })
    ).toEqual({
      host: '127.0.0.1',
      port: 8080,
      source: 'http',
      token: 't',
      baseUrl: 'http://127.0.0.1:1/api',
      logLevel: 'info',
      gcpProjectId: undefined,
      metricsEnabled: true,
      tracing: { tracesUrl: undefined, serviceName: 'ts-launch-blueprint-api', sampleRatio: 1 },
      corsOrigins: [],
      rateLimit: undefined,
      shutdownTimeoutMs: 10_000,
    });
    expect(resolveApiConfig({ TS_PROJECTS_SOURCE: 'http', TS_PROJECTS_TOKEN: 't' })).toEqual({
      host: '127.0.0.1',
      port: 8080,
      source: 'http',
      token: 't',
      baseUrl: undefined,
      logLevel: 'info',
      gcpProjectId: undefined,
      metricsEnabled: true,
      tracing: { tracesUrl: undefined, serviceName: 'ts-launch-blueprint-api', sampleRatio: 1 },
      corsOrigins: [],
      rateLimit: undefined,
      shutdownTimeoutMs: 10_000,
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

  it('tracing is off with no OTLP endpoint, with the default service name and ratio', () => {
    expect(resolveApiConfig({}).tracing).toEqual({
      tracesUrl: undefined,
      serviceName: 'ts-launch-blueprint-api',
      sampleRatio: 1,
    });
    expect(resolveApiConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: '' }).tracing.tracesUrl).toBeUndefined();
  });

  it.each([
    ['http://localhost:4318', 'http://localhost:4318/v1/traces'],
    ['http://localhost:4318/', 'http://localhost:4318/v1/traces'],
    ['https://collector.example/otlp//', 'https://collector.example/otlp/v1/traces'],
  ])('OTEL_EXPORTER_OTLP_ENDPOINT=%s turns tracing on at %s', (endpoint, tracesUrl) => {
    expect(resolveApiConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: endpoint }).tracing.tracesUrl).toBe(
      tracesUrl
    );
  });

  it('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT is used as-is and wins over the base endpoint', () => {
    const tracing = resolveApiConfig({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://base:4318',
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://traces:4318/custom',
    }).tracing;
    expect(tracing.tracesUrl).toBe('http://traces:4318/custom');
  });

  it.each([
    ['OTEL_EXPORTER_OTLP_ENDPOINT', 'not a url'],
    ['OTEL_EXPORTER_OTLP_ENDPOINT', 'ftp://collector:21'],
    ['OTEL_EXPORTER_OTLP_TRACES_ENDPOINT', 'grpc://collector:4317'],
  ])('rejects %s=%s', (name, value) => {
    expect(() => resolveApiConfig({ [name]: value })).toThrow(
      `Invalid ${name} "${value}": expected an http(s) URL`
    );
  });

  it('OTEL_SERVICE_NAME overrides the service name (empty means the default)', () => {
    expect(resolveApiConfig({ OTEL_SERVICE_NAME: 'my-api' }).tracing.serviceName).toBe('my-api');
    expect(resolveApiConfig({ OTEL_SERVICE_NAME: '' }).tracing.serviceName).toBe(
      'ts-launch-blueprint-api'
    );
  });

  it.each([
    ['0', 0],
    ['0.25', 0.25],
    ['1', 1],
    ['', 1],
  ])('accepts OTEL_TRACES_SAMPLER_ARG=%j as %d', (value, ratio) => {
    expect(resolveApiConfig({ OTEL_TRACES_SAMPLER_ARG: value }).tracing.sampleRatio).toBe(ratio);
  });

  it.each(['1.5', '-0.1', 'half', '.5'])('rejects OTEL_TRACES_SAMPLER_ARG=%s', (value) => {
    expect(() => resolveApiConfig({ OTEL_TRACES_SAMPLER_ARG: value })).toThrow(
      `Invalid OTEL_TRACES_SAMPLER_ARG "${value}": expected a number from 0 to 1`
    );
  });

  it.each(['yes', '0', 'TRUE'])('rejects METRICS_ENABLED=%s with a clear message', (value) => {
    expect(() => resolveApiConfig({ METRICS_ENABLED: value })).toThrow(ConfigError);
    expect(() => resolveApiConfig({ METRICS_ENABLED: value })).toThrow(
      `Invalid METRICS_ENABLED "${value}": expected "true" or "false"`
    );
  });

  describe('CORS_ORIGINS', () => {
    it.each([
      [undefined, []],
      ['', []],
      ['   ', []],
      ['[]', []],
      ['*', ['*']],
      ['https://app.example.com', ['https://app.example.com']],
      ['https://a.example, http://localhost:5173', ['https://a.example', 'http://localhost:5173']],
      ['["https://app.example.com"]', ['https://app.example.com']],
      [
        '["https://a.example", "http://localhost:5173"]',
        ['https://a.example', 'http://localhost:5173'],
      ],
    ])('parses CORS_ORIGINS=%j as %j', (value, expected) => {
      expect(resolveApiConfig({ CORS_ORIGINS: value }).corsOrigins).toEqual(expected);
    });

    it.each([
      '[invalid',
      '{"origin":"https://a.example"}',
      '[""]',
      'https://a.example,',
      'not-a-url',
      'ftp://a.example',
      'https://a.example/path',
      'https://a.example/',
      'https://a.example?',
      'https://a.example#',
      'https://a.example?x=1',
      'https://user:pass@a.example',
    ])('rejects invalid CORS_ORIGINS=%s', (value) => {
      expect(() => resolveApiConfig({ CORS_ORIGINS: value })).toThrow(ConfigError);
      expect(() => resolveApiConfig({ CORS_ORIGINS: value })).toThrow(
        `Invalid CORS_ORIGINS "${value}"`
      );
    });
  });

  describe('RATE_LIMIT', () => {
    it.each([
      ['5/second', { limit: 5, windowMs: 1_000, unit: 'second' }],
      ['10/seconds', { limit: 10, windowMs: 1_000, unit: 'second' }],
      ['100/minute', { limit: 100, windowMs: 60_000, unit: 'minute' }],
      ['2/MINUTES', { limit: 2, windowMs: 60_000, unit: 'minute' }],
      ['1000/hour', { limit: 1000, windowMs: 3_600_000, unit: 'hour' }],
      ['5000/days', { limit: 5000, windowMs: 86_400_000, unit: 'day' }],
    ] as const)('parses RATE_LIMIT=%s', (value, expected) => {
      expect(resolveApiConfig({ RATE_LIMIT: value }).rateLimit).toEqual(expected);
      expect(parseRateLimit(value)).toEqual(expected);
    });

    it('treats empty RATE_LIMIT as disabled (undefined)', () => {
      expect(resolveApiConfig({ RATE_LIMIT: '' }).rateLimit).toBeUndefined();
    });

    it.each(['0/minute', '-1/minute', '10/week', 'abc', '10/', '/minute', '1.5/minute'])(
      'rejects invalid RATE_LIMIT=%s',
      (value) => {
        expect(() => resolveApiConfig({ RATE_LIMIT: value })).toThrow(ConfigError);
        expect(() => resolveApiConfig({ RATE_LIMIT: value })).toThrow(
          `Invalid RATE_LIMIT "${value}"`
        );
      }
    );
  });

  describe('SHUTDOWN_TIMEOUT_MS', () => {
    it('defaults to 10_000 when unset or empty and parses positive integers', () => {
      expect(resolveApiConfig({}).shutdownTimeoutMs).toBe(10_000);
      expect(resolveApiConfig({ SHUTDOWN_TIMEOUT_MS: '' }).shutdownTimeoutMs).toBe(10_000);
      expect(resolveApiConfig({ SHUTDOWN_TIMEOUT_MS: '2500' }).shutdownTimeoutMs).toBe(2500);
    });

    it.each(['0', '-5', '10.5', 'abc'])('rejects SHUTDOWN_TIMEOUT_MS=%s', (value) => {
      expect(() => resolveApiConfig({ SHUTDOWN_TIMEOUT_MS: value })).toThrow(ConfigError);
      expect(() => resolveApiConfig({ SHUTDOWN_TIMEOUT_MS: value })).toThrow(
        `Invalid SHUTDOWN_TIMEOUT_MS "${value}": expected a positive integer`
      );
    });
  });
});
