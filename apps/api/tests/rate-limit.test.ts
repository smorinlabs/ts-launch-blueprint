// Unit tests for the zero-dep fixed-window rate limiter middleware.
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { PROBLEM_CONTENT_TYPE } from '../src/problems.js';
import { clientKeyFrom, rateLimit } from '../src/rate-limit.js';

describe('clientKeyFrom', () => {
  it('prefers the first IP in x-forwarded-for, then x-real-ip, then socket, then unknown', async () => {
    const app = new Hono();
    const keys: string[] = [];
    app.get('/key', (c) => {
      keys.push(clientKeyFrom(c));
      return c.text('ok');
    });

    await app.request('/key', {
      headers: { 'x-forwarded-for': ' 203.0.113.1 , 10.0.0.1 ', 'x-real-ip': '198.51.100.2' },
    });
    await app.request('/key', {
      headers: { 'x-forwarded-for': ' , 10.0.0.1', 'x-real-ip': ' 198.51.100.2 ' },
    });
    await app.request('/key', {}, {
      incoming: { socket: { remoteAddress: '192.0.2.9' } },
    } as unknown as Record<string, unknown>);
    await app.request('/key');

    expect(keys).toEqual(['203.0.113.1', '198.51.100.2', '192.0.2.9', 'unknown']);
  });
});

describe('rateLimit middleware', () => {
  it('sets X-RateLimit-* headers, enforces limit with 429 problem+json + Retry-After, and resets after window', async () => {
    let clock = 1_000_000;
    const app = new Hono();
    app.use('*', rateLimit({ limit: 2, windowMs: 60_000, now: () => clock }));
    app.get('/ping', (c) => c.json({ ok: true }));

    const r1 = await app.request('/ping', { headers: { 'x-real-ip': '10.0.0.1' } });
    expect(r1.status).toBe(200);
    expect(r1.headers.get('x-ratelimit-limit')).toBe('2');
    expect(r1.headers.get('x-ratelimit-remaining')).toBe('1');
    expect(r1.headers.get('x-ratelimit-reset')).toBe(
      String(Math.ceil((1_000_000 + 60_000) / 1000))
    );

    clock += 10_000;
    const r2 = await app.request('/ping', { headers: { 'x-real-ip': '10.0.0.1' } });
    expect(r2.status).toBe(200);
    expect(r2.headers.get('x-ratelimit-remaining')).toBe('0');

    clock += 5_000;
    const r3 = await app.request('/ping', { headers: { 'x-real-ip': '10.0.0.1' } });
    expect(r3.status).toBe(429);
    expect(r3.headers.get('content-type')).toContain(PROBLEM_CONTENT_TYPE);
    expect(r3.headers.get('retry-after')).toBe('45');
    expect(r3.headers.get('x-ratelimit-limit')).toBe('2');
    expect(r3.headers.get('x-ratelimit-remaining')).toBe('0');
    expect(await r3.json()).toEqual({
      type: 'about:blank',
      title: 'Too Many Requests',
      status: 429,
      detail: 'Rate limit exceeded: 2 requests per 60s',
      instance: '/ping',
    });

    // Different client IP has an independent bucket.
    const other = await app.request('/ping', { headers: { 'x-real-ip': '10.0.0.2' } });
    expect(other.status).toBe(200);
    expect(other.headers.get('x-ratelimit-remaining')).toBe('1');

    // Advancing past windowMs resets the counter.
    clock += 45_000;
    const reset = await app.request('/ping', { headers: { 'x-real-ip': '10.0.0.1' } });
    expect(reset.status).toBe(200);
    expect(reset.headers.get('x-ratelimit-remaining')).toBe('1');
  });

  it('sweeps expired windows when map grows past maxEntries', async () => {
    let clock = 1_000;
    const app = new Hono();
    app.use('*', rateLimit({ limit: 1, windowMs: 1_000, now: () => clock, maxEntries: 2 }));
    app.get('/ping', (c) => c.text('ok'));

    await app.request('/ping', { headers: { 'x-real-ip': '1.1.1.1' } });
    await app.request('/ping', { headers: { 'x-real-ip': '2.2.2.2' } });
    // Advance past expiration and send a third IP to trigger bounded sweep.
    clock += 2_000;
    await app.request('/ping', { headers: { 'x-real-ip': '3.3.3.3' } });

    // 1.1.1.1 was swept and starts fresh.
    const res = await app.request('/ping', { headers: { 'x-real-ip': '1.1.1.1' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-ratelimit-remaining')).toBe('0');
  });
});
