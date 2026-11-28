// Unit tests for the zero-dep fixed-window rate limiter middleware (P09, #94).
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { PROBLEM_CONTENT_TYPE } from '../src/problems.js';
import { clientKeyFrom, ipMatchesCidr, rateLimit } from '../src/rate-limit.js';

function socketEnv(remoteAddress: string): Record<string, unknown> {
  return { incoming: { socket: { remoteAddress } } };
}

describe('ipMatchesCidr', () => {
  it('matches exact IPv4/IPv6 addresses, CIDRs, /0 catch-all, and IPv4-mapped IPv6', () => {
    expect(ipMatchesCidr('127.0.0.1', '127.0.0.1')).toBe(true);
    expect(ipMatchesCidr('127.0.0.2', '127.0.0.1')).toBe(false);
    expect(ipMatchesCidr('10.20.30.40', '10.0.0.0/8')).toBe(true);
    expect(ipMatchesCidr('11.20.30.40', '10.0.0.0/8')).toBe(false);
    expect(ipMatchesCidr('::ffff:10.1.2.3', '10.0.0.0/8')).toBe(true);
    expect(ipMatchesCidr('10.1.2.3', '::ffff:10.0.0.0/104')).toBe(true);
    expect(ipMatchesCidr('203.0.113.5', '0.0.0.0/0')).toBe(true);
    expect(ipMatchesCidr('::1', '::1')).toBe(true);
    expect(ipMatchesCidr('fd12:3456::1', 'fd00::/8')).toBe(true);
    expect(ipMatchesCidr('2001:db8::1', 'fd00::/8')).toBe(false);
    expect(ipMatchesCidr('[::1]', '::1')).toBe(true);
    expect(ipMatchesCidr('::1', '127.0.0.1')).toBe(false);
    expect(ipMatchesCidr('not-an-ip', '10.0.0.0/8')).toBe(false);
    expect(ipMatchesCidr('10.0.0.1', 'not-a-cidr')).toBe(false);
  });
});

describe('clientKeyFrom', () => {
  it('ignores forwarding headers by default (trustProxy=false) to prevent header spoofing', async () => {
    const app = new Hono();
    const keys: string[] = [];
    app.get('/key', (c) => {
      keys.push(clientKeyFrom(c));
      return c.text('ok');
    });

    await app.request(
      '/key',
      { headers: { 'x-forwarded-for': '203.0.113.1', 'x-real-ip': '198.51.100.2' } },
      socketEnv('::ffff:192.0.2.9')
    );
    await app.request('/key', { headers: { 'x-forwarded-for': '203.0.113.1' } });

    expect(keys).toEqual(['192.0.2.9', 'unknown']);
  });

  it('consults x-forwarded-for, then x-real-ip, then socket when trustProxy=true', async () => {
    const app = new Hono();
    const keys: string[] = [];
    app.get('/key', (c) => {
      keys.push(clientKeyFrom(c, true));
      return c.text('ok');
    });

    await app.request('/key', {
      headers: { 'x-forwarded-for': ' 203.0.113.1 , 10.0.0.1 ', 'x-real-ip': '198.51.100.2' },
    });
    await app.request('/key', {
      headers: { 'x-forwarded-for': ' , ', 'x-real-ip': ' 198.51.100.2 ' },
    });
    await app.request('/key', {}, socketEnv('192.0.2.9'));
    await app.request('/key');

    expect(keys).toEqual(['203.0.113.1', '198.51.100.2', '192.0.2.9', 'unknown']);
  });

  it('walks XFF right-to-left only when socket peer is in the TRUST_PROXY allowlist', async () => {
    const policy = ['10.0.0.0/8', '127.0.0.1'];
    const app = new Hono();
    const keys: string[] = [];
    app.get('/key', (c) => {
      keys.push(clientKeyFrom(c, policy));
      return c.text('ok');
    });

    // Untrusted direct peer attempting to spoof XFF -> uses socket peer.
    await app.request(
      '/key',
      { headers: { 'x-forwarded-for': '198.51.100.99' } },
      socketEnv('203.0.113.50')
    );
    // Missing socket peer with allowlist -> untrusted -> unknown.
    await app.request('/key', { headers: { 'x-forwarded-for': '198.51.100.99' } });
    // Trusted proxy peer with spoofed leftmost hop -> skips trusted 10.0.0.2, picks real 203.0.113.7.
    await app.request(
      '/key',
      { headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.7, 10.0.0.2' } },
      socketEnv('10.0.0.1')
    );
    // All hops trusted -> falls back to leftmost hop.
    await app.request(
      '/key',
      { headers: { 'x-forwarded-for': '10.0.0.9, 10.0.0.2' } },
      socketEnv('127.0.0.1')
    );
    // Trusted proxy with x-real-ip only.
    await app.request('/key', { headers: { 'x-real-ip': '198.51.100.5' } }, socketEnv('127.0.0.1'));
    // Trusted proxy with no forwarding headers -> socket remoteAddress.
    await app.request('/key', {}, socketEnv('127.0.0.1'));

    expect(keys).toEqual([
      '203.0.113.50',
      'unknown',
      '203.0.113.7',
      '10.0.0.9',
      '198.51.100.5',
      '127.0.0.1',
    ]);
  });
});

describe('rateLimit middleware', () => {
  it('sets X-RateLimit-* headers, enforces limit with 429 problem+json + Retry-After, and resets after window', async () => {
    let clock = 1_000_000;
    const app = new Hono();
    app.use('*', rateLimit({ limit: 2, windowMs: 60_000, trustProxy: true, now: () => clock }));
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

  it('prevents X-Forwarded-For spoofing by default when trustProxy is omitted', async () => {
    const app = new Hono();
    app.use('*', rateLimit({ limit: 1, windowMs: 60_000, now: () => 1_000 }));
    app.get('/ping', (c) => c.text('ok'));

    const r1 = await app.request(
      '/ping',
      { headers: { 'x-forwarded-for': '198.51.100.1' } },
      socketEnv('203.0.113.10')
    );
    expect(r1.status).toBe(200);

    // Changing XFF from the same socket peer still hits the rate limit.
    const r2 = await app.request(
      '/ping',
      { headers: { 'x-forwarded-for': '198.51.100.2' } },
      socketEnv('203.0.113.10')
    );
    expect(r2.status).toBe(429);
  });

  it('sweeps expired windows when map grows past maxEntries', async () => {
    let clock = 1_000;
    const app = new Hono();
    app.use(
      '*',
      rateLimit({ limit: 1, windowMs: 1_000, trustProxy: true, now: () => clock, maxEntries: 2 })
    );
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

  it('evicts oldest active entries via FIFO so map size never exceeds maxEntries under active-window floods', async () => {
    const clock = 1_000;
    const app = new Hono();
    app.use(
      '*',
      rateLimit({ limit: 1, windowMs: 60_000, trustProxy: true, now: () => clock, maxEntries: 2 })
    );
    app.get('/ping', (c) => c.text('ok'));

    expect((await app.request('/ping', { headers: { 'x-real-ip': '1.1.1.1' } })).status).toBe(200);
    expect((await app.request('/ping', { headers: { 'x-real-ip': '2.2.2.2' } })).status).toBe(200);

    // Within the active window, inserting a 3rd key must evict the oldest (1.1.1.1) while keeping 2.2.2.2.
    expect((await app.request('/ping', { headers: { 'x-real-ip': '3.3.3.3' } })).status).toBe(200);

    // 2.2.2.2 is still tracked and hits the limit (429).
    expect((await app.request('/ping', { headers: { 'x-real-ip': '2.2.2.2' } })).status).toBe(429);

    // 1.1.1.1 was evicted, so it starts fresh (200) and evicts 2.2.2.2 (the oldest in FIFO order).
    const r1 = await app.request('/ping', { headers: { 'x-real-ip': '1.1.1.1' } });
    expect(r1.status).toBe(200);
    expect(r1.headers.get('x-ratelimit-remaining')).toBe('0');

    // 3.3.3.3 is still tracked (429), while 2.2.2.2 was evicted and starts fresh (200).
    expect((await app.request('/ping', { headers: { 'x-real-ip': '3.3.3.3' } })).status).toBe(429);
    expect((await app.request('/ping', { headers: { 'x-real-ip': '2.2.2.2' } })).status).toBe(200);
  });
});
