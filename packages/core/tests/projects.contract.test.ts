// The public listProjects contract (D-047): what it accepts and rejects, that
// the real service output parses with it, and a compile-time check that the
// input schema and the service's ListProjectsInput never drift apart.
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';

import {
  createCore,
  DEFAULT_IN_MEMORY_SEED,
  type ListProjectsInput,
  ListProjectsInputSchema,
  ListProjectsOutputSchema,
} from '../src/index.js';

// Exact type equality, checked by tsc (`just typecheck`): fails if either
// side gains, loses or changes a field. toEqualTypeOf, not a mutual-
// assignability check: an extra optional field on one side only is still
// assignable both ways, so that check would miss real drift.
expectTypeOf<z.infer<typeof ListProjectsInputSchema>>().toEqualTypeOf<ListProjectsInput>();

describe('ListProjectsInputSchema', () => {
  it.each([
    ['no input', {}],
    ['a workspace name', { workspaceName: 'Engineering' }],
    ['an empty workspace name (no filter)', { workspaceName: '' }],
    ['the smallest limit', { limit: 1 }],
    ['the default limit', { limit: 200 }],
  ])('accepts %s', (_label, input) => {
    expect(ListProjectsInputSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    ['a zero limit', { limit: 0 }],
    ['a negative limit', { limit: -1 }],
    ['a fractional limit', { limit: 1.5 }],
    ['a string limit', { limit: '10' }],
    ['a non-string workspace name', { workspaceName: 42 }],
  ])('rejects %s', (_label, input) => {
    expect(ListProjectsInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('ListProjectsOutputSchema', () => {
  it('accepts the in-memory seed wrapped as { projects }', () => {
    expect(
      ListProjectsOutputSchema.safeParse({ projects: DEFAULT_IN_MEMORY_SEED.projects }).success
    ).toBe(true);
  });

  it('rejects a project missing its name', () => {
    expect(
      ListProjectsOutputSchema.safeParse({
        projects: [{ id: 'p-1', workspace: { name: 'Engineering' } }],
      }).success
    ).toBe(false);
  });

  it('rejects a bare array (the output is an object)', () => {
    expect(ListProjectsOutputSchema.safeParse(DEFAULT_IN_MEMORY_SEED.projects).success).toBe(false);
  });

  it('parses the real service output: service and contract agree', async () => {
    const projects = await createCore({ source: 'memory' }).projects.listProjects();
    expect(ListProjectsOutputSchema.parse({ projects })).toEqual({ projects });
  });
});
