// The public listProjects and getProject contracts (D-047): what they accept
// and reject, that real service outputs parse with them, and compile-time
// checks that input schemas and service/contract types never drift apart.
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';

import {
  createCore,
  DEFAULT_IN_MEMORY_SEED,
  type GetProjectInput,
  GetProjectInputSchema,
  GetProjectOutputSchema,
  type ListProjectsInput,
  ListProjectsInputSchema,
  ListProjectsOutputSchema,
} from '../src/index.js';

// Exact type equality, checked by tsc (`just typecheck`): fails if either
// side gains, loses or changes a field.
expectTypeOf<z.infer<typeof ListProjectsInputSchema>>().toEqualTypeOf<ListProjectsInput>();
expectTypeOf<z.infer<typeof GetProjectInputSchema>>().toEqualTypeOf<GetProjectInput>();

describe('ListProjectsInputSchema', () => {
  it.each([
    ['no input', {}],
    ['a workspace name', { workspaceName: 'Engineering' }],
    ['an empty workspace name (no filter)', { workspaceName: '' }],
    ['the smallest limit', { limit: 1 }],
    ['the default limit', { limit: 200 }],
    ['an uncapped limit (> 100 in core)', { limit: 500 }],
    ['a non-empty cursor', { cursor: 'cursor-1' }],
  ])('accepts %s', (_label, input) => {
    expect(ListProjectsInputSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    ['a zero limit', { limit: 0 }],
    ['a negative limit', { limit: -1 }],
    ['a fractional limit', { limit: 1.5 }],
    ['a string limit', { limit: '10' }],
    ['a non-string workspace name', { workspaceName: 42 }],
    ['an empty cursor', { cursor: '' }],
    ['a non-string cursor', { cursor: 123 }],
  ])('rejects %s', (_label, input) => {
    expect(ListProjectsInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('ListProjectsOutputSchema', () => {
  it('accepts the in-memory seed wrapped as { projects, nextCursor }', () => {
    expect(
      ListProjectsOutputSchema.safeParse({
        projects: DEFAULT_IN_MEMORY_SEED.projects,
        nextCursor: null,
      }).success
    ).toBe(true);
    expect(
      ListProjectsOutputSchema.safeParse({
        projects: [{ id: 'p-1', name: 'Solo', workspace: null }],
        nextCursor: 'next-1',
      }).success
    ).toBe(true);
  });

  it('rejects missing nextCursor or a project missing its name', () => {
    expect(
      ListProjectsOutputSchema.safeParse({ projects: DEFAULT_IN_MEMORY_SEED.projects }).success
    ).toBe(false);
    expect(
      ListProjectsOutputSchema.safeParse({
        projects: [{ id: 'p-1', workspace: { name: 'Engineering' } }],
        nextCursor: null,
      }).success
    ).toBe(false);
  });

  it('rejects a bare array (the output is an object)', () => {
    expect(ListProjectsOutputSchema.safeParse(DEFAULT_IN_MEMORY_SEED.projects).success).toBe(false);
  });

  it('parses the real service output: service and contract agree', async () => {
    const output = await createCore({ source: 'memory' }).projects.listProjects();
    expect(ListProjectsOutputSchema.parse(output)).toEqual(output);
  });
});

describe('GetProjectInputSchema and GetProjectOutputSchema', () => {
  it('accepts a non-empty id and rejects empty/missing id and dot segments', () => {
    expect(GetProjectInputSchema.safeParse({ id: 'p-1' }).success).toBe(true);
    expect(GetProjectInputSchema.safeParse({ id: 'a/b?c=1' }).success).toBe(true);
    expect(GetProjectInputSchema.safeParse({ id: 'proj.1' }).success).toBe(true);
    expect(GetProjectInputSchema.safeParse({ id: '' }).success).toBe(false);
    expect(GetProjectInputSchema.safeParse({ id: '.' }).success).toBe(false);
    expect(GetProjectInputSchema.safeParse({ id: '..' }).success).toBe(false);
    expect(GetProjectInputSchema.safeParse({}).success).toBe(false);
  });

  it('parses real getProject output including nullable workspace', async () => {
    const project = await createCore({ source: 'memory' }).projects.getProject('p-1');
    expect(GetProjectOutputSchema.parse({ project })).toEqual({ project });
    expect(
      GetProjectOutputSchema.safeParse({
        project: { id: 'p-2', name: 'Unassigned', workspace: null },
      }).success
    ).toBe(true);
  });
});
