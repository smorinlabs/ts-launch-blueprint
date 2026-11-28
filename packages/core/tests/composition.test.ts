// Composition root: createCore picks the data source and builds the
// services on it.
import { describe, expect, it } from 'vitest';

import { createCore } from '../src/composition.js';
import {
  DEFAULT_IN_MEMORY_SEED,
  type InMemoryProjectsSeed,
} from '../src/repositories/in-memory-projects.repository.js';
import type { Project } from '../src/schemas/project.schema.js';

const PROJECT: Project = { id: '1', name: 'Alpha', workspace: { name: 'Acme' } };

describe('createCore', () => {
  it('memory source: lists the default demo projects and gets one by id', async () => {
    const { projects } = createCore({ source: 'memory' });
    expect(await projects.listProjects()).toEqual({
      projects: DEFAULT_IN_MEMORY_SEED.projects,
      nextCursor: null,
    });
    expect(await projects.getProject('p-1')).toEqual(DEFAULT_IN_MEMORY_SEED.projects[0]);
  });

  it('memory source: uses the given seed', async () => {
    const seed: InMemoryProjectsSeed = {
      workspaces: [{ gid: 'ws1', name: 'Acme' }],
      projects: [PROJECT],
    };
    const { projects } = createCore({ source: 'memory', seed });
    expect(await projects.listProjects({ workspaceName: 'acme' })).toEqual({
      projects: [PROJECT],
      nextCursor: null,
    });
  });

  it('http source: sends its request through the given fetchImpl', async () => {
    const urls: URL[] = [];
    const fetchImpl = ((input: URL) => {
      urls.push(input);
      if (input.pathname.endsWith('/projects/1')) {
        return Promise.resolve(Response.json({ data: PROJECT }));
      }
      return Promise.resolve(Response.json({ data: [PROJECT] }));
    }) as unknown as typeof fetch;
    const { projects } = createCore({ source: 'http', http: { token: 't', fetchImpl } });
    expect(await projects.listProjects()).toEqual({ projects: [PROJECT], nextCursor: null });
    expect(await projects.getProject('1')).toEqual(PROJECT);
    expect(urls).toHaveLength(2);
    expect(urls[0]!.pathname.endsWith('/projects')).toBe(true);
    expect(urls[1]!.pathname.endsWith('/projects/1')).toBe(true);
  });
});
