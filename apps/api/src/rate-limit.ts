// Zero-dependency fixed-window in-memory rate limiter middleware (P09).
import type { Context, MiddlewareHandler } from 'hono';

import { problemResponse } from './problems.js';

interface NodeIncomingEnv {
  incoming?: {
    socket?: {
      remoteAddress?: string | undefined;
    };
  };
}

/** Extract the client key (IP) from forwarded headers or the Node socket. */
export function clientKeyFrom(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded !== undefined) {
    const first = forwarded.split(',')[0]?.trim();
    if (first !== undefined && first !== '') {
      return first;
    }
  }
  const realIp = c.req.header('x-real-ip')?.trim();
  if (realIp !== undefined && realIp !== '') {
    return realIp;
  }
  const remoteAddress = (c.env as NodeIncomingEnv | undefined)?.incoming?.socket?.remoteAddress;
  if (remoteAddress !== undefined && remoteAddress !== '') {
    return remoteAddress;
  }
  return 'unknown';
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

/** Fixed-window rate limiter emitting X-RateLimit-* headers and RFC 9457 429s. */
export function rateLimit(options: {
  limit: number;
  windowMs: number;
  now?: (() => number) | undefined;
  keyGenerator?: ((c: Context) => string) | undefined;
  maxEntries?: number | undefined;
}): MiddlewareHandler {
  const windows = new Map<string, WindowEntry>();
  const now = options.now ?? (() => Date.now());
  const keyGenerator = options.keyGenerator ?? clientKeyFrom;
  const maxEntries = options.maxEntries ?? 1024;

  return async (c, next) => {
    const currentTime = now();
    if (windows.size > maxEntries) {
      for (const [entryKey, entryValue] of windows.entries()) {
        if (currentTime >= entryValue.resetAt) {
          windows.delete(entryKey);
        }
      }
    }

    const key = keyGenerator(c);
    let entry = windows.get(key);
    if (entry === undefined || currentTime >= entry.resetAt) {
      entry = { count: 0, resetAt: currentTime + options.windowMs };
      windows.set(key, entry);
    }
    entry.count += 1;

    const resetEpochSec = Math.ceil(entry.resetAt / 1000);
    if (entry.count > options.limit) {
      const retryAfterSec = Math.max(0, Math.ceil((entry.resetAt - currentTime) / 1000));
      return problemResponse(c, {
        status: 429,
        title: 'Too Many Requests',
        detail: `Rate limit exceeded: ${options.limit} requests per ${options.windowMs / 1000}s`,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Limit': String(options.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(resetEpochSec),
        },
      });
    }

    const remaining = Math.max(0, options.limit - entry.count);
    await next();
    c.header('X-RateLimit-Limit', String(options.limit));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(resetEpochSec));
    return;
  };
}
