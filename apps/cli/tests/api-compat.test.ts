import type { Project } from '@ts-launch-blueprint/core';
// createApiClient compatibility details not covered by tests/api.test.ts
// (which stays unedited as the P1-3 regression proof).
import { describe, expect, it } from 'vitest';

import { createApiClient } from '../src/api.js';

const PROJECT: Project = { id: '1', name: 'Alpha', workspace: { name: 'Acme' } };

describe('createApiClient compatibility', () => {
  it('treats an empty workspaceName as no filter (no /workspaces lookup)', async () => {
    const urls: URL[] = [];
    const fetchImpl = ((input: URL) => {
      urls.push(input);
      return Promise.resolve(Response.json({ data: [PROJECT] }));
    }) as unknown as typeof fetch;

    const projects = await createApiClient({ token: 't', fetchImpl }).getProjects({
      workspaceName: '',
    });

    expect(projects).toEqual([PROJECT]);
    expect(urls).toHaveLength(1);
    expect(urls[0]!.pathname.endsWith('/projects')).toBe(true);
    expect(urls[0]!.searchParams.has('workspace')).toBe(false);
  });
});
