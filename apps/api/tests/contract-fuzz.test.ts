// Property-based HTTP/tRPC contract fuzzing over /trpc/projects.list (P08-TS03).
import { createCore, ListProjectsOutputSchema } from '@ts-launch-blueprint/core';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { captureLogger } from './log-capture.js';

const { logger } = captureLogger();
const app = createApp({ core: createCore({ source: 'memory' }), logger });

function hasStackKey(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(hasStackKey);
  }
  const record = value as Record<string, unknown>;
  if (Object.hasOwn(record, 'stack') && record.stack !== undefined) {
    return true;
  }
  return Object.values(record).some(hasStackKey);
}

function hasStackTraceLeak(bodyText: string): boolean {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    return hasStackKey(parsed);
  } catch {
    return /\bat\s+\S+\s+\(/.test(bodyText);
  }
}

describe('GET /trpc/projects.list contract fuzzing', () => {
  it('valid inputs always return 200 (schema-valid) or 404 (unknown workspace) with no 5xx', async () => {
    const workspaceArb = fc.oneof(
      fc.constantFrom('Engineering', 'engineering', 'Marketing', 'marketing', 'unknown', ''),
      fc.string({ maxLength: 30 })
    );
    const validInputArb = fc.record(
      {
        workspaceName: workspaceArb,
        limit: fc.integer({ min: 1, max: 100 }),
        cursor: fc.string({ minLength: 1, maxLength: 32 }),
      },
      { requiredKeys: [] }
    );

    await fc.assert(
      fc.asyncProperty(validInputArb, async (input) => {
        const query = encodeURIComponent(JSON.stringify(input));
        const response = await app.request(`/trpc/projects.list?input=${query}`);
        expect(response.status).toBeLessThan(500);
        expect([200, 404]).toContain(response.status);

        const bodyText = await response.text();
        expect(hasStackTraceLeak(bodyText)).toBe(false);
        const schemaValid =
          response.status !== 200 ||
          ListProjectsOutputSchema.safeParse(
            (JSON.parse(bodyText) as { result?: { data?: unknown } }).result?.data
          ).success;
        expect(schemaValid).toBe(true);
      }),
      { numRuns: 75 }
    );
  });

  it('arbitrary JSON input values never trigger a 5xx or stack trace leak', async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (payload) => {
        const serialized = JSON.stringify(payload);
        const query = serialized === undefined ? '' : `?input=${encodeURIComponent(serialized)}`;
        const response = await app.request(`/trpc/projects.list${query}`);
        expect(response.status).toBeLessThan(500);

        const bodyText = await response.text();
        expect(hasStackTraceLeak(bodyText)).toBe(false);
      }),
      { numRuns: 75 }
    );
  });

  it('arbitrary raw query strings never trigger a 5xx or stack trace leak', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 80 }), async (rawInput) => {
        const response = await app.request(
          `/trpc/projects.list?input=${encodeURIComponent(rawInput)}`
        );
        expect(response.status).toBeLessThan(500);

        const bodyText = await response.text();
        expect(hasStackTraceLeak(bodyText)).toBe(false);
      }),
      { numRuns: 75 }
    );
  });

  it('does not misclassify echoed workspaceName text like "at f (" as a stack trace', async () => {
    const query = encodeURIComponent(JSON.stringify({ workspaceName: 'at f (' }));
    const response = await app.request(`/trpc/projects.list?input=${query}`);
    expect(response.status).toBe(404);
    const bodyText = await response.text();
    expect(hasStackTraceLeak(bodyText)).toBe(false);

    expect(
      hasStackTraceLeak(JSON.stringify({ error: { data: { stack: 'Error\n at f (a.ts:1)' } } }))
    ).toBe(true);
    expect(hasStackTraceLeak(JSON.stringify([{ stack: 'Error' }]))).toBe(true);
    expect(hasStackTraceLeak('Error: boom\n    at f (a.ts:1)')).toBe(true);
  });
});
