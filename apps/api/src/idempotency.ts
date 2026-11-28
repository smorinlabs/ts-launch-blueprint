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

interface CachedHeader {
  name: string;
  value: string;
  appended: boolean;
}

interface CacheEntry {
  storedAt: number;
  status: number;
  headers: CachedHeader[];
  body: ArrayBuffer;
}

function buildHeaders(pairs: readonly [string, string][]): Headers {
  const headers = new Headers();
  for (const [name, value] of pairs) {
    headers.append(name, value);
  }
  return headers;
}

function splitCommaTokens(value: string): string[] {
  return value
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function mergeHeaderTokens(existing: string, incoming: string, caseInsensitive: boolean): string {
  const existingTokens = splitCommaTokens(existing);
  const incomingTokens = splitCommaTokens(incoming);
  const seen = new Set(
    existingTokens.map((token) => (caseInsensitive ? token.toLowerCase() : token))
  );
  const merged = [...existingTokens];
  for (const token of incomingTokens) {
    const key = caseInsensitive ? token.toLowerCase() : token;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(token);
    }
  }
  return merged.join(', ');
}

function extractRouteHeaders(
  initialPairs: readonly [string, string][],
  preHeaders: readonly [string, string][]
): CachedHeader[] {
  const remainingPre = [...preHeaders];
  const cached: CachedHeader[] = [];

  for (const [name, value] of initialPairs) {
    const lower = name.toLowerCase();
    const exactIdx = remainingPre.findIndex(
      ([preName, preValue]) => preName.toLowerCase() === lower && preValue === value
    );
    if (exactIdx !== -1) {
      remainingPre.splice(exactIdx, 1);
      continue;
    }

    if (lower !== 'set-cookie') {
      const prefixIdx = remainingPre.findIndex(([preName, preValue]) => {
        if (preName.toLowerCase() !== lower || preValue.length === 0) {
          return false;
        }
        return (
          value.startsWith(preValue) &&
          value.length > preValue.length &&
          value[preValue.length] === ','
        );
      });
      if (prefixIdx !== -1) {
        const [, preValue] = remainingPre[prefixIdx]!;
        remainingPre.splice(prefixIdx, 1);
        const suffix = value.slice(preValue.length + 1).trimStart();
        if (suffix.length > 0) {
          cached.push({ name, value: suffix, appended: true });
        }
        continue;
      }
    }

    cached.push({ name, value, appended: false });
  }

  return cached;
}

function buildReplayHeaders(
  preHeaders: readonly [string, string][],
  cachedHeaders: readonly CachedHeader[]
): Headers {
  const headers = new Headers();
  for (const [name, value] of preHeaders) {
    headers.append(name, value);
  }
  for (const { name, value, appended } of cachedHeaders) {
    const lower = name.toLowerCase();
    if (lower === 'set-cookie') {
      headers.append(name, value);
      continue;
    }
    const existing = headers.get(name);
    if (existing === null) {
      headers.append(name, value);
    } else if (appended || lower === 'vary') {
      headers.set(name, mergeHeaderTokens(existing, value, lower === 'vary'));
    } else {
      headers.set(name, value);
    }
  }
  return headers;
}

/** Hono middleware caching and replaying successful unsafe responses keyed by Idempotency-Key. */
export function idempotency(options: IdempotencyOptions = {}): MiddlewareHandler {
  const ttlMs = options.ttlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_IDEMPOTENCY_MAX_ENTRIES;
  const now = options.now ?? ((): number => performance.now());
  const store = new Map<string, CacheEntry>();
  const inFlight = new Map<string, Promise<CacheEntry | null>>();

  return async (c, next) => {
    const method = c.req.method.toUpperCase();
    const key = c.req.header(IDEMPOTENCY_HEADER);
    if (!UNSAFE_METHODS.has(method) || key === undefined || key.trim() === '') {
      await next();
      return;
    }

    const url = new URL(c.req.url);
    const cacheKey = JSON.stringify([method, url.pathname, url.search, key]);
    const preHeaders = [...c.res.headers.entries()];

    let entry: CacheEntry | undefined;
    while (true) {
      const cached = store.get(cacheKey);
      if (cached !== undefined) {
        if (now() - cached.storedAt < ttlMs) {
          store.delete(cacheKey);
          store.set(cacheKey, cached);
          entry = cached;
          break;
        }
        store.delete(cacheKey);
      }

      const pending = inFlight.get(cacheKey);
      if (pending !== undefined) {
        const settled = await pending;
        if (settled !== null) {
          entry = settled;
          break;
        }
        continue;
      }

      break;
    }

    if (entry !== undefined) {
      const replayHeaders = buildReplayHeaders(preHeaders, entry.headers);
      replayHeaders.set(REPLAYED_HEADER, 'true');
      for (const [name] of preHeaders) {
        c.res.headers.delete(name);
      }
      c.header(REPLAYED_HEADER, undefined);
      c.res = new Response(responseBodyFor(entry.status, entry.body), {
        status: entry.status,
        headers: replayHeaders,
      });
      return;
    }

    let resolvePending!: (value: CacheEntry | null) => void;
    const pendingPromise = new Promise<CacheEntry | null>((resolve) => {
      resolvePending = resolve;
    });
    inFlight.set(cacheKey, pendingPromise);

    let settledEntry: CacheEntry | null = null;
    try {
      await next();

      const original = c.res;
      const body = NULL_BODY_STATUSES.has(original.status)
        ? new ArrayBuffer(0)
        : await original.arrayBuffer();
      const initialHeaderPairs = [...original.headers.entries()].filter(
        ([name]) => name.toLowerCase() !== REPLAYED_HEADER.toLowerCase()
      );
      const cacheHeaderPairs = extractRouteHeaders(initialHeaderPairs, preHeaders);
      const rebuiltHeaders = buildHeaders(initialHeaderPairs);
      c.header(REPLAYED_HEADER, undefined);
      c.res = new Response(responseBodyFor(original.status, body), {
        status: original.status,
        headers: rebuiltHeaders,
      });
      c.res.headers.delete(REPLAYED_HEADER);

      if (original.status >= 200 && original.status < 300 && maxEntries > 0) {
        const newEntry: CacheEntry = {
          storedAt: now(),
          status: original.status,
          headers: cacheHeaderPairs,
          body,
        };
        store.delete(cacheKey);
        store.set(cacheKey, newEntry);
        while (store.size > maxEntries) {
          const oldest = store.keys().next().value;
          if (oldest !== undefined) {
            store.delete(oldest);
          }
        }
        settledEntry = newEntry;
      }
    } finally {
      inFlight.delete(cacheKey);
      resolvePending(settledEntry);
    }
  };
}
