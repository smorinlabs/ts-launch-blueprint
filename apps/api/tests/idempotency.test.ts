// Standalone Idempotency-Key middleware tests (P10-TS04, Q8.A).
import { createCore } from '@ts-launch-blueprint/core';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp } from '../src/app.js';
import {
  DEFAULT_IDEMPOTENCY_MAX_ENTRIES,
  DEFAULT_IDEMPOTENCY_TTL_MS,
  idempotency,
  type IdempotencyOptions,
} from '../src/idempotency.js';
import { publicProcedure, router } from '../src/trpc.js';
import { captureLogger } from './log-capture.js';

function makeFixtureApp(options?: IdempotencyOptions): {
  app: Hono;
  calls: () => number;
  setStatus: (status: number) => void;
} {
  let count = 0;
  let nextStatus = 201;
  const app = new Hono();
  app.use('*', idempotency(options));

  const handleWrite = (c: { json: (body: unknown, status?: number) => Response }): Response => {
    count += 1;
    return c.json({ count }, nextStatus);
  };

  app.post('/things', handleWrite);
  app.put('/things', handleWrite);
  app.patch('/things', handleWrite);
  app.get('/things', (c) => {
    count += 1;
    return c.json({ count }, 200);
  });
  app.delete('/things', (c) => {
    count += 1;
    return c.json({ count }, 200);
  });
  app.post('/cookies', (c) => {
    count += 1;
    c.header('Set-Cookie', 'a=1; Path=/', { append: true });
    c.header('Set-Cookie', 'b=2; Path=/', { append: true });
    return c.json({ count }, 201);
  });
  app.post('/empty', (c) => {
    count += 1;
    return c.body(null, 204);
  });
  app.post('/spoof', (c) => {
    count += 1;
    c.header('Idempotency-Replayed', 'spoofed');
    return c.json({ count }, 201);
  });

  return {
    app,
    calls: () => count,
    setStatus: (status) => {
      nextStatus = status;
    },
  };
}

describe('idempotency middleware (standalone fixture routes)', () => {
  it('exposes Py WEB-05 parity defaults (86400s TTL, 1024 max entries)', () => {
    expect(DEFAULT_IDEMPOTENCY_TTL_MS).toBe(86_400_000);
    expect(DEFAULT_IDEMPOTENCY_MAX_ENTRIES).toBe(1024);
  });

  it.each(['POST', 'PUT', 'PATCH'] as const)(
    'replays cached 2xx %s response without stacking Idempotency-Replayed',
    async (method) => {
      const { app, calls } = makeFixtureApp();
      const first = await app.request('/things', {
        method,
        headers: { 'Idempotency-Key': 'k-1' },
      });
      expect(first.status).toBe(201);
      expect(first.headers.get('Idempotency-Replayed')).toBeNull();
      expect(await first.json()).toEqual({ count: 1 });

      const second = await app.request('/things', {
        method,
        headers: { 'Idempotency-Key': 'k-1' },
      });
      expect(second.status).toBe(201);
      expect(second.headers.get('Idempotency-Replayed')).toBe('true');
      expect(await second.json()).toEqual({ count: 1 });

      const third = await app.request('/things', {
        method,
        headers: { 'Idempotency-Key': 'k-1' },
      });
      expect(third.headers.get('Idempotency-Replayed')).toBe('true');
      expect(await third.json()).toEqual({ count: 1 });
      expect(calls()).toBe(1);
    }
  );

  it('bypasses GET, DELETE, missing keys, and whitespace-only keys', async () => {
    const { app, calls } = makeFixtureApp();
    await app.request('/things', { method: 'GET', headers: { 'Idempotency-Key': 'k-get' } });
    await app.request('/things', { method: 'GET', headers: { 'Idempotency-Key': 'k-get' } });
    await app.request('/things', { method: 'DELETE', headers: { 'Idempotency-Key': 'k-del' } });
    await app.request('/things', { method: 'DELETE', headers: { 'Idempotency-Key': 'k-del' } });
    await app.request('/things', { method: 'POST' });
    await app.request('/things', { method: 'POST', headers: { 'Idempotency-Key': '   ' } });
    await app.request('/things', { method: 'POST', headers: { 'Idempotency-Key': '   ' } });
    expect(calls()).toBe(7);
  });

  it('separates cache entries by key and by query string', async () => {
    const { app, calls } = makeFixtureApp();
    const r1 = await app.request('/things?a=1', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'same' },
    });
    const r2 = await app.request('/things?a=2', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'same' },
    });
    const r3 = await app.request('/things?a=1', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'other' },
    });
    expect(await r1.json()).toEqual({ count: 1 });
    expect(await r2.json()).toEqual({ count: 2 });
    expect(await r3.json()).toEqual({ count: 3 });
    expect(r2.headers.get('Idempotency-Replayed')).toBeNull();
    expect(calls()).toBe(3);
  });

  it('does not cache non-2xx responses (retries re-execute handler)', async () => {
    const { app, calls, setStatus } = makeFixtureApp();
    setStatus(500);
    const errRes = await app.request('/things', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k-err' },
    });
    expect(errRes.status).toBe(500);

    setStatus(201);
    const okRes = await app.request('/things', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k-err' },
    });
    expect(okRes.status).toBe(201);
    expect(okRes.headers.get('Idempotency-Replayed')).toBeNull();
    expect(calls()).toBe(2);
  });

  it('preserves multi-valued Set-Cookie headers across initial response and replay', async () => {
    const { app, calls } = makeFixtureApp();
    const first = await app.request('/cookies', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k-cookie' },
    });
    expect(first.headers.getSetCookie()).toEqual(['a=1; Path=/', 'b=2; Path=/']);

    const replay = await app.request('/cookies', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k-cookie' },
    });
    expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
    expect(replay.headers.getSetCookie()).toEqual(['a=1; Path=/', 'b=2; Path=/']);
    expect(calls()).toBe(1);
  });

  it('expires entries after ttlMs using the injected monotonic clock', async () => {
    let clock = 1000;
    const { app, calls } = makeFixtureApp({ ttlMs: 500, now: () => clock });
    await app.request('/things', { method: 'POST', headers: { 'Idempotency-Key': 'k-ttl' } });
    clock = 1499;
    const hit = await app.request('/things', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k-ttl' },
    });
    expect(hit.headers.get('Idempotency-Replayed')).toBe('true');

    clock = 1500;
    const expired = await app.request('/things', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k-ttl' },
    });
    expect(expired.headers.get('Idempotency-Replayed')).toBeNull();
    expect(await expired.json()).toEqual({ count: 2 });
    expect(calls()).toBe(2);
  });

  it('evicts the least-recently-used entry when maxEntries is exceeded', async () => {
    const { app, calls } = makeFixtureApp({ maxEntries: 2 });
    await app.request('/things', { method: 'POST', headers: { 'Idempotency-Key': 'k1' } });
    await app.request('/things', { method: 'POST', headers: { 'Idempotency-Key': 'k2' } });
    // Refresh k1 so k2 becomes the LRU entry.
    await app.request('/things', { method: 'POST', headers: { 'Idempotency-Key': 'k1' } });
    await app.request('/things', { method: 'POST', headers: { 'Idempotency-Key': 'k3' } });
    expect(calls()).toBe(3);

    // k1 survived; k2 was evicted and executes fresh.
    const k1Replay = await app.request('/things', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k1' },
    });
    expect(k1Replay.headers.get('Idempotency-Replayed')).toBe('true');
    const k2Miss = await app.request('/things', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k2' },
    });
    expect(k2Miss.headers.get('Idempotency-Replayed')).toBeNull();
    expect(calls()).toBe(4);
  });

  it('caches nothing when maxEntries <= 0', async () => {
    const { app, calls } = makeFixtureApp({ maxEntries: 0 });
    await app.request('/things', { method: 'POST', headers: { 'Idempotency-Key': 'k0' } });
    await app.request('/things', { method: 'POST', headers: { 'Idempotency-Key': 'k0' } });
    expect(calls()).toBe(2);
  });

  it('handles 204 No Content initial response and replay with empty body', async () => {
    const { app, calls } = makeFixtureApp();
    const first = await app.request('/empty', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k-204' },
    });
    expect(first.status).toBe(204);
    expect(first.headers.get('Idempotency-Replayed')).toBeNull();
    expect(await first.text()).toBe('');

    const replay = await app.request('/empty', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k-204' },
    });
    expect(replay.status).toBe(204);
    expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
    expect(await replay.text()).toBe('');
    expect(calls()).toBe(1);
  });

  it('strips handler-injected Idempotency-Replayed header on initial response', async () => {
    const { app, calls } = makeFixtureApp();
    const first = await app.request('/spoof', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k-spoof' },
    });
    expect(first.status).toBe(201);
    expect(first.headers.get('Idempotency-Replayed')).toBeNull();
    expect(await first.json()).toEqual({ count: 1 });

    const replay = await app.request('/spoof', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'k-spoof' },
    });
    expect(replay.status).toBe(201);
    expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
    expect(await replay.json()).toEqual({ count: 1 });
    expect(calls()).toBe(1);
  });
});

describe('idempotency middleware mounted in createApp with a tRPC mutation (Q8.A)', () => {
  it('replays POST /trpc/items.create while assigning fresh x-request-id headers', async () => {
    let executions = 0;
    const mutationTestRouter = router({
      items: router({
        create: publicProcedure.input(z.object({ title: z.string() })).mutation(({ input }) => {
          executions += 1;
          return { id: executions, title: input.title };
        }),
      }),
    });
    const { logger } = captureLogger();
    const app = createApp({
      core: createCore({ source: 'memory' }),
      logger,
      router: mutationTestRouter,
    });

    const first = await app.request('/trpc/items.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'trpc-mut-1',
      },
      body: JSON.stringify({ title: 'Widget' }),
    });
    expect(first.status).toBe(200);
    expect(first.headers.get('Idempotency-Replayed')).toBeNull();
    expect(await first.json()).toEqual({ result: { data: { id: 1, title: 'Widget' } } });

    const replay = await app.request('/trpc/items.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'trpc-mut-1',
      },
      body: JSON.stringify({ title: 'Widget' }),
    });
    expect(replay.status).toBe(200);
    expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
    expect(await replay.json()).toEqual({ result: { data: { id: 1, title: 'Widget' } } });
    expect(replay.headers.get('x-request-id')).not.toBe(first.headers.get('x-request-id'));
    expect(executions).toBe(1);
  });

  it('preserves P09 secureHeaders, CORS isolation, and rateLimit 429 precedence on replay', async () => {
    let executions = 0;
    const mutationTestRouter = router({
      items: router({
        create: publicProcedure.input(z.object({ title: z.string() })).mutation(({ input }) => {
          executions += 1;
          return { id: executions, title: input.title };
        }),
      }),
    });
    const { logger } = captureLogger();
    const app = createApp({
      core: createCore({ source: 'memory' }),
      logger,
      router: mutationTestRouter,
      corsOrigins: ['https://app.example.com'],
      rateLimit: { limit: 2, windowMs: 60_000, unit: 'minute' },
    });

    const first = await app.request('/trpc/items.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'mw-1',
        origin: 'https://app.example.com',
        'x-real-ip': '203.0.113.10',
      },
      body: JSON.stringify({ title: 'First' }),
    });
    expect(first.status).toBe(200);
    expect(first.headers.get('Idempotency-Replayed')).toBeNull();
    expect(first.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(first.headers.get('x-frame-options')).toBe('DENY');
    expect(first.headers.get('x-ratelimit-remaining')).toBe('1');

    const replay = await app.request('/trpc/items.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'mw-1',
        origin: 'https://evil.example',
        'x-real-ip': '203.0.113.10',
      },
      body: JSON.stringify({ title: 'First' }),
    });
    expect(replay.status).toBe(200);
    expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
    expect(replay.headers.get('access-control-allow-origin')).toBeNull();
    expect(replay.headers.get('x-frame-options')).toBe('DENY');
    expect(replay.headers.get('x-ratelimit-remaining')).toBe('0');
    expect(executions).toBe(1);

    // Rate limit is outer to idempotency: the 3rd request returns 429 instead of replaying.
    const limited = await app.request('/trpc/items.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'mw-1',
        origin: 'https://app.example.com',
        'x-real-ip': '203.0.113.10',
      },
      body: JSON.stringify({ title: 'First' }),
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('x-frame-options')).toBe('DENY');
    expect(limited.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(executions).toBe(1);

    // Reverse CORS order: disallowed origin first, allowed origin on replay still gets CORS header.
    const reverseFirst = await app.request('/trpc/items.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'mw-2',
        origin: 'https://evil.example',
        'x-real-ip': '203.0.113.11',
      },
      body: JSON.stringify({ title: 'Second' }),
    });
    expect(reverseFirst.status).toBe(200);
    expect(reverseFirst.headers.get('access-control-allow-origin')).toBeNull();

    const reverseReplay = await app.request('/trpc/items.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'mw-2',
        origin: 'https://app.example.com',
        'x-real-ip': '203.0.113.11',
      },
      body: JSON.stringify({ title: 'Second' }),
    });
    expect(reverseReplay.status).toBe(200);
    expect(reverseReplay.headers.get('Idempotency-Replayed')).toBe('true');
    expect(reverseReplay.headers.get('access-control-allow-origin')).toBe(
      'https://app.example.com'
    );
    expect(executions).toBe(2);
  });
});

describe('idempotency middleware outer pre-next() header preservation', () => {
  it('preserves both outer and inner Set-Cookie headers on initial and replayed responses', async () => {
    let calls = 0;
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.header('Set-Cookie', 'outer=1; Path=/', { append: true });
      await next();
    });
    app.use('*', idempotency());
    app.post('/cookies-both', (c) => {
      calls += 1;
      c.header('Set-Cookie', 'inner=1; Path=/', { append: true });
      return c.json({ calls }, 201);
    });

    const first = await app.request('/cookies-both', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'outer-cookie-1' },
    });
    expect(first.status).toBe(201);
    expect(first.headers.get('Idempotency-Replayed')).toBeNull();
    expect(first.headers.getSetCookie()).toEqual(['outer=1; Path=/', 'inner=1; Path=/']);

    const replay = await app.request('/cookies-both', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'outer-cookie-1' },
    });
    expect(replay.status).toBe(201);
    expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
    expect(replay.headers.getSetCookie()).toEqual(['outer=1; Path=/', 'inner=1; Path=/']);
    expect(calls).toBe(1);
  });

  it('preserves both outer and inner Vary tokens without dropping or duplicating on initial and replayed responses', async () => {
    let calls = 0;
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.header('Vary', 'Accept-Encoding', { append: true });
      await next();
    });
    app.use('*', idempotency());
    app.post('/vary-both', (c) => {
      calls += 1;
      c.header('Vary', 'Accept-Language', { append: true });
      return c.json({ calls }, 201);
    });

    const first = await app.request('/vary-both', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'outer-vary-1' },
    });
    expect(first.status).toBe(201);
    expect(first.headers.get('Idempotency-Replayed')).toBeNull();
    expect(first.headers.get('Vary')).toBe('Accept-Encoding, Accept-Language');

    const replay = await app.request('/vary-both', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'outer-vary-1' },
    });
    expect(replay.status).toBe(201);
    expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
    expect(replay.headers.get('Vary')).toBe('Accept-Encoding, Accept-Language');
    expect(calls).toBe(1);
  });

  it('deduplicates Vary tokens case-insensitively and preserves overwritten vs appended custom headers on replay', async () => {
    let includeOuterVary = false;
    const app = new Hono();
    app.use('*', async (c, next) => {
      if (includeOuterVary) {
        c.header('Vary', 'accept-encoding', { append: true });
      }
      c.header('X-Mode', 'outer');
      c.header('X-Tags', 'alpha', { append: true });
      await next();
    });
    app.use('*', idempotency());
    app.post('/edge', (c) => {
      c.header('Vary', 'Accept-Encoding, Accept-Language', { append: true });
      c.header('X-Mode', 'inner');
      c.header('X-Tags', 'beta', { append: true });
      return c.json({ ok: true }, 201);
    });

    const first = await app.request('/edge', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'edge-1' },
    });
    expect(first.headers.get('Vary')).toBe('Accept-Encoding, Accept-Language');
    expect(first.headers.get('X-Mode')).toBe('inner');
    expect(first.headers.get('X-Tags')).toBe('alpha, beta');

    includeOuterVary = true;
    const replay = await app.request('/edge', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'edge-1' },
    });
    expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
    expect(replay.headers.get('Vary')).toBe('accept-encoding, Accept-Language');
    expect(replay.headers.get('X-Mode')).toBe('inner');
    expect(replay.headers.get('X-Tags')).toBe('alpha, beta');
  });

  it('coalesces concurrent overlapping requests sharing an Idempotency-Key and clears on failure', async () => {
    let execCount = 0;
    let unblockLeader!: () => void;
    let signalLeaderStarted!: () => void;
    const leaderStarted = new Promise<void>((r) => {
      signalLeaderStarted = r;
    });
    const app2 = new Hono();
    app2.use('*', idempotency());
    app2.post('/items', async (c) => {
      execCount += 1;
      const n = execCount;
      if (n === 1) {
        signalLeaderStarted();
        await new Promise<void>((r) => {
          unblockLeader = r;
        });
        return c.json({ error: 'temporary' }, 500);
      }
      return c.json({ n }, 201);
    });

    const p1 = app2.request('/items', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'race-fail' },
    });
    await leaderStarted;
    const p2 = app2.request('/items', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'race-fail' },
    });
    unblockLeader();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.status).toBe(500);
    expect(r2.status).toBe(201);
    expect(r2.headers.get('Idempotency-Replayed')).toBeNull();
    expect(await r2.json()).toEqual({ n: 2 });
    expect(execCount).toBe(2);

    // Confirm concurrent success case cleanly awaits in-flight result
    let okCount = 0;
    let unblockOk!: () => void;
    let signalOkStarted!: () => void;
    const okStarted = new Promise<void>((r) => {
      signalOkStarted = r;
    });
    const app3 = new Hono();
    app3.use('*', idempotency());
    app3.post('/ok', async (c) => {
      okCount += 1;
      const n = okCount;
      if (n === 1) {
        signalOkStarted();
        await new Promise<void>((r) => {
          unblockOk = r;
        });
      }
      return c.json({ n }, 201);
    });

    const ok1 = app3.request('/ok', { method: 'POST', headers: { 'Idempotency-Key': 'race-ok' } });
    await okStarted;
    const ok2 = app3.request('/ok', { method: 'POST', headers: { 'Idempotency-Key': 'race-ok' } });
    unblockOk();
    const [resOk1, resOk2] = await Promise.all([ok1, ok2]);
    expect(resOk1.status).toBe(201);
    expect(resOk1.headers.get('Idempotency-Replayed')).toBeNull();
    expect(await resOk1.json()).toEqual({ n: 1 });
    expect(resOk2.status).toBe(201);
    expect(resOk2.headers.get('Idempotency-Replayed')).toBe('true');
    expect(await resOk2.json()).toEqual({ n: 1 });
    expect(okCount).toBe(1);
  });
});
