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
  it('memory source: lists the default demo projects', async () => {
    const { projects } = createCore({ source: 'memory' });
    expect(await projects.listProjects()).toEqual(DEFAULT_IN_MEMORY_SEED.projects);
  });

  it('memory source: uses the given seed', async () => {
    const seed: InMemoryProjectsSeed = {
      workspaces: [{ gid: 'ws1', name: 'Acme' }],
      projects: [PROJECT],
    };
    const { projects } = createCore({ source: 'memory', seed });
    expect(await projects.listProjects({ workspaceName: 'acme' })).toEqual([PROJECT]);
  });

  it('http source: sends its request through the given fetchImpl', async () => {
    const urls: URL[] = [];
    const fetchImpl = ((input: URL) => {
      urls.push(input);
      return Promise.resolve(Response.json({ data: [PROJECT] }));
    }) as unknown as typeof fetch;
    const { projects } = createCore({ source: 'http', http: { token: 't', fetchImpl } });
    expect(await projects.listProjects()).toEqual([PROJECT]);
    expect(urls).toHaveLength(1);
    expect(urls[0]!.pathname.endsWith('/projects')).toBe(true);
  });
});
