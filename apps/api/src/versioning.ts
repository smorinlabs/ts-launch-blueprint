// RFC 8594 Deprecation and Sunset header helpers (Py WEB-02 parity).
import type { MiddlewareHandler } from 'hono';

export const V1_PREFIX = '/v1';

/** Build RFC 8594 `Deprecation` and `Sunset` (IMF-fixdate GMT) response headers. */
export function deprecationHeaders(sunset: Date): Record<'Deprecation' | 'Sunset', string> {
  if (!(sunset instanceof Date) || Number.isNaN(sunset.getTime())) {
    throw new RangeError('sunset must be a valid Date');
  }
  return {
    Deprecation: 'true',
    Sunset: sunset.toUTCString(),
  };
}

/** Hono middleware stamping RFC 8594 `Deprecation` and `Sunset` headers on every response. */
export function deprecationMiddleware(sunset: Date): MiddlewareHandler {
  const headers = deprecationHeaders(sunset);
  return async (c, next) => {
    await next();
    c.header('Deprecation', headers.Deprecation);
    c.header('Sunset', headers.Sunset);
  };
}
