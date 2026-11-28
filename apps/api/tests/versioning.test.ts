// RFC 8594 Deprecation / Sunset header helpers (P10-TS04).
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { deprecationHeaders, deprecationMiddleware, V1_PREFIX } from '../src/versioning.js';

describe('versioning and deprecation helpers', () => {
  it('exposes V1_PREFIX and formats Deprecation + Sunset in GMT IMF-fixdate', () => {
    expect(V1_PREFIX).toBe('/v1');
    const sunset = new Date(Date.UTC(2027, 0, 1));
    expect(deprecationHeaders(sunset)).toEqual({
      Deprecation: 'true',
      Sunset: 'Fri, 01 Jan 2027 00:00:00 GMT',
    });
  });

  it('rejects an invalid Date', () => {
    expect(() => deprecationHeaders(new Date('not-a-date'))).toThrow(RangeError);
    expect(() => deprecationMiddleware(new Date('invalid'))).toThrow(RangeError);
  });

  it('stamps Deprecation and Sunset headers via deprecationMiddleware', async () => {
    const app = new Hono();
    app.use('/v1/*', deprecationMiddleware(new Date(Date.UTC(2027, 0, 1))));
    app.get('/v1/legacy', (c) => c.json({ ok: true }));

    const res = await app.request('/v1/legacy');
    expect(res.status).toBe(200);
    expect(res.headers.get('Deprecation')).toBe('true');
    expect(res.headers.get('Sunset')).toBe('Fri, 01 Jan 2027 00:00:00 GMT');
  });
});
