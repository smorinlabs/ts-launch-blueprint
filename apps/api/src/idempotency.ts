// Idempotency-Key replay protection for unsafe methods (Py WEB-05 parity, Q8.A).
// Caches 2xx responses for POST/PUT/PATCH keyed by (method, path, query, key)
// in a bounded TTL + LRU Map, preserving multi-valued headers such as Set-Cookie.
import type { MiddlewareHandler } from 'hono';

export const IDEMPOTENCY_HEADER = 'idempotency-key';
export const REPLAYED_HEADER = 'Idempotency-Replayed';
export const DEFAULT_IDEMPOTENCY_TTL_MS = 86_400_000;
export const DEFAULT_IDEMPOTENCY_MAX_ENTRIES = 1024;

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

function responseBodyFor(status: number, body: ArrayBuffer): ArrayBuffer | null {
  return NULL_BODY_STATUSES.has(status) ? null : body.slice(0);
}

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
    const preHeaders = [...c.res.headers.entries()];

    const cached = store.get(cacheKey);
    if (cached !== undefined) {
      if (currentTime - cached.storedAt < ttlMs) {
        store.delete(cacheKey);
        store.set(cacheKey, cached);
        const replayHeaders = buildHeaders(cached.headers);
        for (const [name, value] of preHeaders) {
          replayHeaders.append(name, value);
        }
        replayHeaders.set(REPLAYED_HEADER, 'true');
        c.header(REPLAYED_HEADER, undefined);
        c.res = new Response(responseBodyFor(cached.status, cached.body), {
          status: cached.status,
          headers: replayHeaders,
        });
        return;
      }
      store.delete(cacheKey);
    }

    await next();

    const original = c.res;
    const body = NULL_BODY_STATUSES.has(original.status)
      ? new ArrayBuffer(0)
      : await original.arrayBuffer();
    const initialHeaderPairs = [...original.headers.entries()].filter(
      ([name]) => name.toLowerCase() !== REPLAYED_HEADER.toLowerCase()
    );
    const remainingPre = [...preHeaders];
    const cacheHeaderPairs = initialHeaderPairs.filter(([name, value]) => {
      const matchIdx = remainingPre.findIndex(
        ([preName, preValue]) => preName.toLowerCase() === name.toLowerCase() && preValue === value
      );
      if (matchIdx !== -1) {
        remainingPre.splice(matchIdx, 1);
        return false;
      }
      return true;
    });
    const rebuiltHeaders = buildHeaders(initialHeaderPairs);
    c.header(REPLAYED_HEADER, undefined);
    c.res = new Response(responseBodyFor(original.status, body), {
      status: original.status,
      headers: rebuiltHeaders,
    });
    c.res.headers.delete(REPLAYED_HEADER);

    if (original.status >= 200 && original.status < 300 && maxEntries > 0) {
      store.delete(cacheKey);
      store.set(cacheKey, {
        storedAt: now(),
        status: original.status,
        headers: cacheHeaderPairs,
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
