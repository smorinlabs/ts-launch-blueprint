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
      tracing: { tracesUrl: undefined, serviceName: 'ts-launch-blueprint-api', sampleRatio: 1 },
    });
  });

  it('reads a valid PORT', () => {
    expect(resolveApiConfig({ PORT: '3000' })).toEqual({
      port: 3000,
      source: 'memory',
      logLevel: 'info',
      gcpProjectId: undefined,
      metricsEnabled: true,
      tracing: { tracesUrl: undefined, serviceName: 'ts-launch-blueprint-api', sampleRatio: 1 },
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
      tracing: { tracesUrl: undefined, serviceName: 'ts-launch-blueprint-api', sampleRatio: 1 },
    });
    expect(resolveApiConfig({ TS_PROJECTS_SOURCE: 'http', TS_PROJECTS_TOKEN: 't' })).toEqual({
      port: 8080,
      source: 'http',
      token: 't',
      baseUrl: undefined,
      logLevel: 'info',
      gcpProjectId: undefined,
      metricsEnabled: true,
      tracing: { tracesUrl: undefined, serviceName: 'ts-launch-blueprint-api', sampleRatio: 1 },
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
});
