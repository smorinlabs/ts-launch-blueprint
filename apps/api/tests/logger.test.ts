// createLogger: Cloud Logging's field names on every JSON line.
import { describe, expect, it } from 'vitest';

import { captureLogger } from './log-capture.js';

describe('createLogger', () => {
  it.each([
    ['debug', 'DEBUG'],
    ['info', 'INFO'],
    ['warn', 'WARNING'],
    ['error', 'ERROR'],
    ['fatal', 'CRITICAL'],
  ] as const)('maps pino level %s to severity %s', (level, severity) => {
    const { logger, lines } = captureLogger('debug');
    logger[level]('hello');
    expect(lines[0]?.severity).toBe(severity);
  });

  it('uses `message`, adds service and an ISO time, and drops pid/hostname', () => {
    const { logger, lines } = captureLogger();
    logger.info({ port: 8080 }, 'listening');
    const line = lines[0]!;
    expect(line.message).toBe('listening');
    expect(line['service']).toBe('ts-launch-blueprint-api');
    expect(Number.isNaN(Date.parse(String(line['time'])))).toBe(false);
    expect(line['port']).toBe(8080);
    expect(line).not.toHaveProperty('pid');
    expect(line).not.toHaveProperty('hostname');
    expect(line).not.toHaveProperty('msg');
  });

  it('redacts authorization, cookie and token fields, top level and nested', () => {
    const { logger, lines } = captureLogger();
    logger.info(
      { authorization: 'Bearer secret', token: 't0k3n', req: { cookie: 'session=abc' } },
      'redacted'
    );
    const text = JSON.stringify(lines[0]);
    expect(text).not.toContain('secret');
    expect(text).not.toContain('t0k3n');
    expect(text).not.toContain('session=abc');
    expect(lines[0]?.['authorization']).toBe('[Redacted]');
  });

  it('writes nothing below the configured level', () => {
    const { logger, lines } = captureLogger('warn');
    logger.info('quiet');
    logger.warn('loud');
    expect(lines.map((line) => line.message)).toEqual(['loud']);
  });
});
