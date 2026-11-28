// Zero-dependency fixed-window in-memory rate limiter middleware (P09, #94).
import { isIP } from 'node:net';

import type { Context, MiddlewareHandler } from 'hono';

import type { TrustProxyConfig } from './config.js';
import { problemResponse } from './problems.js';

interface NodeIncomingEnv {
  incoming?: {
    socket?: {
      remoteAddress?: string | undefined;
    };
  };
}

interface ParsedIp {
  family: 4 | 6;
  value: bigint;
}

const IPV4_MAPPED_PREFIX = 0xffffn;

function parseIpv4ToBigInt(ip: string): bigint {
  let result = 0n;
  for (const octet of ip.split('.')) {
    result = (result << 8n) | BigInt(Number(octet));
  }
  return result;
}

function parseIpv6ToBigInt(ip: string): bigint {
  // Expand embedded IPv4 tail (e.g. ::ffff:192.0.2.1) into two 16-bit hex groups.
  let normalized = ip.toLowerCase();
  const lastColon = normalized.lastIndexOf(':');
  if (normalized.includes('.')) {
    const v4 = parseIpv4ToBigInt(normalized.slice(lastColon + 1));
    const hi = ((v4 >> 16n) & 0xffffn).toString(16);
    const lo = (v4 & 0xffffn).toString(16);
    normalized = `${normalized.slice(0, lastColon + 1)}${hi}:${lo}`;
  }
  const halves = normalized.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  const groups = [...left, ...Array<string>(missing).fill('0'), ...right];
  let result = 0n;
  for (const group of groups) {
    result = (result << 16n) | BigInt(Number.parseInt(group, 16));
  }
  return result;
}

function parseIp(raw: string): ParsedIp | undefined {
  const cleaned = raw.trim().replace(/^\[(.+)\]$/, '$1');
  const family = isIP(cleaned);
  if (family === 4) {
    return { family: 4, value: parseIpv4ToBigInt(cleaned) };
  }
  if (family === 6) {
    const value = parseIpv6ToBigInt(cleaned);
    // Unwrap IPv4-mapped IPv6 (::ffff:a.b.c.d) so it matches IPv4 entries/CIDRs.
    if (value >> 32n === IPV4_MAPPED_PREFIX) {
      return { family: 4, value: value & 0xffff_ffffn };
    }
    return { family: 6, value };
  }
  return undefined;
}

function normalizeIpString(raw: string): string {
  const cleaned = raw.trim().replace(/^\[(.+)\]$/, '$1');
  const v4Mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(cleaned);
  return v4Mapped?.[1] ?? cleaned;
}

/** Test whether `ip` matches an IP address or IPv4/IPv6 CIDR entry. */
export function ipMatchesCidr(ip: string, entry: string): boolean {
  const parsedIp = parseIp(ip);
  if (parsedIp === undefined) {
    return false;
  }
  const [rawNet, prefixStr] = entry.split('/');
  const netAddr = rawNet?.trim() ?? '';
  const rawFamily = isIP(netAddr);
  const parsedNet = parseIp(netAddr);
  if (rawFamily === 0 || parsedNet === undefined) {
    return false;
  }
  if (parsedIp.family !== parsedNet.family) {
    return false;
  }
  if (prefixStr === undefined) {
    return parsedIp.value === parsedNet.value;
  }
  let prefix = Number(prefixStr);
  // If CIDR was written as an IPv4-mapped IPv6 range (::ffff:10.0.0.0/104), rebase to IPv4.
  if (rawFamily === 6 && parsedNet.family === 4) {
    prefix = Math.max(0, prefix - 96);
  }
  const bits = parsedNet.family === 4 ? 32 : 128;
  if (prefix === 0) {
    return true;
  }
  const shift = BigInt(bits - prefix);
  return parsedIp.value >> shift === parsedNet.value >> shift;
}

function isTrustedProxy(ip: string, policy: TrustProxyConfig): boolean {
  if (policy === false) {
    return false;
  }
  if (policy === true) {
    return true;
  }
  return policy.some((entry) => ipMatchesCidr(ip, entry));
}

/**
 * Extract the client key (IP) from the Node socket, consulting forwarded
 * headers (`x-forwarded-for`, `x-real-ip`) ONLY when `trustProxy` permits it.
 *
 * - `trustProxy: false` (default): ignore forwarding headers; use socket `remoteAddress`.
 * - `trustProxy: true`: trust any proxy (e.g. Cloud Run / ALB); prefer first XFF entry, then `x-real-ip`.
 * - `trustProxy: string[]`: trust forwarding headers only when socket `remoteAddress` matches
 *   the IP/CIDR allowlist, walking `x-forwarded-for` right-to-left past trusted proxy hops.
 */
export function clientKeyFrom(c: Context, trustProxy: TrustProxyConfig = false): string {
  const rawRemote = (c.env as NodeIncomingEnv | undefined)?.incoming?.socket?.remoteAddress;
  const remote =
    rawRemote !== undefined && rawRemote.trim() !== '' ? normalizeIpString(rawRemote) : undefined;

  if (trustProxy === false) {
    return remote ?? 'unknown';
  }

  if (Array.isArray(trustProxy) && (remote === undefined || !isTrustedProxy(remote, trustProxy))) {
    return remote ?? 'unknown';
  }

  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded !== undefined) {
    const hops = forwarded
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .map(normalizeIpString);
    if (hops.length > 0) {
      if (Array.isArray(trustProxy)) {
        for (let i = hops.length - 1; i >= 0; i -= 1) {
          if (!isTrustedProxy(hops[i]!, trustProxy)) {
            return hops[i]!;
          }
        }
      }
      return hops[0]!;
    }
  }

  const realIp = c.req.header('x-real-ip')?.trim();
  if (realIp !== undefined && realIp !== '') {
    return normalizeIpString(realIp);
  }

  return remote ?? 'unknown';
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

/** Fixed-window rate limiter emitting X-RateLimit-* headers and RFC 9457 429s. */
export function rateLimit(options: {
  limit: number;
  windowMs: number;
  trustProxy?: TrustProxyConfig | undefined;
  now?: (() => number) | undefined;
  keyGenerator?: ((c: Context) => string) | undefined;
  maxEntries?: number | undefined;
}): MiddlewareHandler {
  const windows = new Map<string, WindowEntry>();
  const now = options.now ?? (() => Date.now());
  const trustProxy = options.trustProxy ?? false;
  const keyGenerator = options.keyGenerator ?? ((c: Context) => clientKeyFrom(c, trustProxy));
  const maxEntries = options.maxEntries ?? 1024;

  return async (c, next) => {
    const currentTime = now();
    const key = keyGenerator(c);
    let entry = windows.get(key);
    if (entry === undefined || currentTime >= entry.resetAt) {
      if (entry !== undefined) {
        // Refresh insertion order so renewed keys are not evicted ahead of newer arrivals.
        windows.delete(key);
      } else if (windows.size >= maxEntries) {
        for (const [entryKey, entryValue] of windows.entries()) {
          if (currentTime >= entryValue.resetAt) {
            windows.delete(entryKey);
          }
        }
        while (windows.size >= maxEntries) {
          const oldestKey = windows.keys().next().value;
          if (oldestKey === undefined) {
            break;
          }
          windows.delete(oldestKey);
        }
      }
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
