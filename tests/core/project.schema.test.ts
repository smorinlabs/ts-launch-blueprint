// Schema layer: raw response bodies -> validated Project / Workspace.
// Messages are matched on our own parts only, never on Zod's wording, so a
// Zod minor release can't break these tests.
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../src/core/schemas/errors.js';
import { toProjects, toWorkspaces } from '../../src/core/schemas/project.converter.js';
import type { Project, Workspace } from '../../src/core/schemas/project.schema.js';

const WORKSPACE: Workspace = { gid: 'ws1', name: 'Acme' };
const PROJECT: Project = { id: '1', name: 'Alpha', workspace: { name: 'Acme' } };

/** Run a converter and return what it threw. */
function thrown(convert: () => unknown): unknown {
  try {
    convert();
  } catch (err) {
    return err;
  }
  throw new Error('expected the converter to throw');
}

describe('toWorkspaces / toProjects: valid bodies', () => {
  it('converts a valid /workspaces body', () => {
    expect(toWorkspaces({ data: [WORKSPACE, { gid: 'ws2', name: 'Beta' }] })).toEqual([
      WORKSPACE,
      { gid: 'ws2', name: 'Beta' },
    ]);
  });

  it('converts a valid /projects body', () => {
    expect(toProjects({ data: [PROJECT] })).toEqual([PROJECT]);
  });

  it('treats a missing data key as an empty list', () => {
    expect(toWorkspaces({})).toEqual([]);
    expect(toProjects({})).toEqual([]);
  });

  it('removes unknown extra fields (strict output shape)', () => {
    expect(toWorkspaces({ data: [{ ...WORKSPACE, extra: 1 }] })).toEqual([WORKSPACE]);
    expect(
      toProjects({ data: [{ ...PROJECT, extra: 1, workspace: { name: 'Acme', gid: 'ws1' } }] })
    ).toEqual([PROJECT]);
  });
});

describe('toWorkspaces / toProjects: bad response shape', () => {
  it.each([
    ['a body that is not an object', 'oops'],
    ['a null body', null],
    ['a non-array data key', { data: 'oops' }],
  ])('rejects %s with the response-shape ApiError', (_label, body) => {
    const projectsErr = thrown(() => toProjects(body));
    expect(projectsErr).toBeInstanceOf(ApiError);
    expect(projectsErr).toMatchObject({
      message: 'API request failed: unexpected /projects response shape',
    });
    const workspacesErr = thrown(() => toWorkspaces(body));
    expect(workspacesErr).toBeInstanceOf(ApiError);
    expect(workspacesErr).toMatchObject({
      message: 'API request failed: unexpected /workspaces response shape',
    });
  });
});

describe('toWorkspaces / toProjects: invalid items', () => {
  it('names the index and field of a missing field', () => {
    const err = thrown(() => toWorkspaces({ data: [WORKSPACE, { name: 'No gid' }] }));
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toMatch(
      /^API request failed: unexpected \/workspaces item at index 1: gid: /
    );
  });

  it('names the field of a wrong-typed value', () => {
    const err = thrown(() => toProjects({ data: [PROJECT, PROJECT, { ...PROJECT, name: 42 }] }));
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toMatch(
      /^API request failed: unexpected \/projects item at index 2: name: /
    );
  });

  it('names the dotted path of an invalid nested field', () => {
    const err = thrown(() => toProjects({ data: [{ ...PROJECT, workspace: {} }] }));
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toMatch(
      /^API request failed: unexpected \/projects item at index 0: workspace\.name: /
    );
  });

  it('leaves out the path prefix when the item is not an object', () => {
    const err = thrown(() => toProjects({ data: ['oops'] }));
    expect(err).toBeInstanceOf(ApiError);
    const { message } = err as ApiError;
    expect(message).toMatch(/^API request failed: unexpected \/projects item at index 0: \S/);
    expect(message).not.toMatch(/index 0: : /);
    expect(message).not.toMatch(/index 0: [\w.]+: Invalid/);
  });
});
