// Idempotency-Key replay protection for unsafe methods (Py WEB-05 parity, Q8.A).
// Caches 2xx responses for POST/PUT/PATCH keyed by (method, path, query, key)
// in a bounded TTL + LRU Map, preserving multi-valued headers such as Set-Cookie.
import type { MiddlewareHandler } from 'hono';

export const IDEMPOTENCY_HEADER = 'idempotency-key';
export const REPLAYED_HEADER = 'Idempotency-Replayed';
export const DEFAULT_IDEMPOTENCY_TTL_MS = 86_400_000;
export const DEFAULT_IDEMPOTENCY_MAX_ENTRIES = 1024;

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH']);

export interface IdempotencyOptions {
  ttlMs?: number | undefined;
  maxEntries?: number | undefined;
  now?: (() => number) | undefined;
}

interface CacheEntry {
  storedAt: number;
  status: number;
  headers: [string, string][];
  body: ArrayBuffer;
}

function buildHeaders(pairs: readonly [string, string][]): Headers {
  const headers = new Headers();
  for (const [name, value] of pairs) {
    headers.append(name, value);
  }
  return headers;
}

/** Hono middleware caching and replaying successful unsafe responses keyed by Idempotency-Key. */
export function idempotency(options: IdempotencyOptions = {}): MiddlewareHandler {
  const ttlMs = options.ttlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_IDEMPOTENCY_MAX_ENTRIES;
  const now = options.now ?? ((): number => performance.now());
  const store = new Map<string, CacheEntry>();

  return async (c, next) => {
    const method = c.req.method.toUpperCase();
    const key = c.req.header(IDEMPOTENCY_HEADER);
    if (!UNSAFE_METHODS.has(method) || key === undefined || key.trim() === '') {
      await next();
      return;
    }

    const url = new URL(c.req.url);
    const cacheKey = JSON.stringify([method, url.pathname, url.search, key]);
    const currentTime = now();

    const cached = store.get(cacheKey);
    if (cached !== undefined) {
      if (currentTime - cached.storedAt < ttlMs) {
        store.delete(cacheKey);
        store.set(cacheKey, cached);
        const replayHeaders = buildHeaders(cached.headers);
        replayHeaders.set(REPLAYED_HEADER, 'true');
        c.res = new Response(cached.body.slice(0), {
          status: cached.status,
          headers: replayHeaders,
        });
        return;
      }
      store.delete(cacheKey);
    }

    await next();

    const original = c.res;
    const body = await original.arrayBuffer();
    const headerPairs = [...original.headers.entries()].filter(
      ([name]) => name.toLowerCase() !== REPLAYED_HEADER.toLowerCase()
    );
    const rebuiltHeaders = buildHeaders(headerPairs);
    c.res = new Response(body.slice(0), {
      status: original.status,
      headers: rebuiltHeaders,
    });

    if (original.status >= 200 && original.status < 300 && maxEntries > 0) {
      store.delete(cacheKey);
      store.set(cacheKey, {
        storedAt: now(),
        status: original.status,
        headers: headerPairs,
        body,
      });
      while (store.size > maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) {
          store.delete(oldest);
        }
      }
    }
  };
}
