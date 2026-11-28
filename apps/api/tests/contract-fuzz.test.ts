// Property-based HTTP/tRPC contract fuzzing over /trpc/projects.list (P08-TS03).
import { createCore, ListProjectsOutputSchema } from '@ts-launch-blueprint/core';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { captureLogger } from './log-capture.js';

const { logger } = captureLogger();
const app = createApp({ core: createCore({ source: 'memory' }), logger });

function hasStackTraceLeak(bodyText: string): boolean {
  return bodyText.includes('"stack"') || /\bat\s+\S+\s+\(/.test(bodyText);
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
});
