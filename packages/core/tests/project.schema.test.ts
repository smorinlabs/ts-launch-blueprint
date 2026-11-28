// Schema layer: one raw item -> a validated Project / Workspace, as a
// result (never a throw). Problems are matched on our own parts only
// (the path), never on Zod's wording, so a Zod minor release can't break
// these tests. Response-wrapper cases live in http-projects.repository.test.ts.
import { describe, expect, it } from 'vitest';

import { convertProject, convertWorkspace } from '../src/schemas/project.converter.js';
import type { Project, Workspace } from '../src/schemas/project.schema.js';

const WORKSPACE: Workspace = { gid: 'ws1', name: 'Acme' };
const PROJECT: Project = { id: '1', name: 'Alpha', workspace: { name: 'Acme' } };
const CANARY = 'canary-must-not-appear-in-logs';

/** The problem text of a failed conversion. */
function problemOf(result: { ok: true } | { ok: false; problem: string }): string {
  if (result.ok) {
    throw new Error('expected the conversion to fail');
  }
  return result.problem;
}

describe('convertWorkspace / convertProject: valid items', () => {
  it('converts a valid workspace', () => {
    expect(convertWorkspace(WORKSPACE)).toEqual({ ok: true, value: WORKSPACE });
  });

  it('converts a valid project', () => {
    expect(convertProject(PROJECT)).toEqual({ ok: true, value: PROJECT });
  });

  it('removes unknown extra fields (strict output shape)', () => {
    expect(convertWorkspace({ ...WORKSPACE, extra: 1 })).toEqual({ ok: true, value: WORKSPACE });
    expect(
      convertProject({ ...PROJECT, extra: 1, workspace: { name: 'Acme', gid: 'ws1' } })
    ).toEqual({ ok: true, value: PROJECT });
  });

  it('prefers gid over id and falls back to id when gid is absent', () => {
    expect(convertProject({ gid: 'g-1', id: 'i-1', name: 'Alpha' })).toEqual({
      ok: true,
      value: { id: 'g-1', name: 'Alpha', workspace: null },
    });
    expect(convertProject({ id: '7', name: 'Alpha' })).toEqual({
      ok: true,
      value: { id: '7', name: 'Alpha', workspace: null },
    });
  });

  it('coerces finite numeric gid/id to string on ID fields only', () => {
    expect(convertProject({ gid: 123, name: 'Alpha' })).toEqual({
      ok: true,
      value: { id: '123', name: 'Alpha', workspace: null },
    });
    expect(convertProject({ id: 0, name: 'Zero' })).toEqual({
      ok: true,
      value: { id: '0', name: 'Zero', workspace: null },
    });
    expect(convertWorkspace({ gid: 45, name: 'Acme' })).toEqual({
      ok: true,
      value: { gid: '45', name: 'Acme' },
    });
  });

  it.each([
    ['empty object', {}],
    ['null', null],
    ['missing key', undefined],
  ])('normalizes %s workspace to null', (_label, workspace) => {
    const raw =
      workspace === undefined
        ? { gid: '1', name: 'Alpha' }
        : { gid: '1', name: 'Alpha', workspace };
    expect(convertProject(raw)).toEqual({
      ok: true,
      value: { id: '1', name: 'Alpha', workspace: null },
    });
  });
});

describe('convertWorkspace / convertProject: invalid items', () => {
  it('names the field of a missing field', () => {
    expect(problemOf(convertWorkspace({ name: 'No gid' }))).toMatch(/^gid: \S/);
  });

  it('names the field of a wrong-typed value', () => {
    expect(problemOf(convertProject({ ...PROJECT, name: 42 }))).toMatch(/^name: \S/);
  });

  it('rejects numeric name even though numeric gid/id is coerced', () => {
    expect(problemOf(convertProject({ gid: '1', name: 12345 }))).toMatch(/^name: \S/);
    expect(problemOf(convertWorkspace({ gid: 'ws1', name: 12345 }))).toMatch(/^name: \S/);
  });

  it.each([true, false, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects non-coercible gid/id (%j)',
    (badId) => {
      expect(problemOf(convertProject({ gid: badId, name: 'X' }))).toMatch(/^id: \S/);
      expect(problemOf(convertWorkspace({ gid: badId, name: 'X' }))).toMatch(/^gid: \S/);
    }
  );

  it('does not fall back to id when gid key is explicitly invalid', () => {
    expect(problemOf(convertProject({ gid: true, id: '7', name: 'X' }))).toMatch(/^id: \S/);
  });

  it('names the dotted path of an invalid nested workspace field', () => {
    // cspell:ignore nayme
    expect(problemOf(convertProject({ ...PROJECT, workspace: { nayme: 'typo' } }))).toMatch(
      /^workspace\.name: \S/
    );
  });

  it.each([[''], [[]], [0], [false], ['acme']])(
    'rejects falsy or wrong-typed workspace (%j) instead of treating it as null',
    (badWorkspace) => {
      expect(problemOf(convertProject({ gid: '1', name: 'X', workspace: badWorkspace }))).toMatch(
        /^workspace: \S/
      );
    }
  );

  it('redacts raw payload values and reports (+N more) when multiple issues exist', () => {
    const problem = problemOf(
      convertProject({
        gid: '1',
        name: 42,
        workspace: CANARY,
        auth_token: CANARY,
      })
    );
    expect(problem).toMatch(/^name: /);
    expect(problem).toContain('(+1 more)');
    expect(problem).not.toContain(CANARY);
  });

  it('leaves out the path prefix when the item is not an object', () => {
    for (const problem of [problemOf(convertProject('oops')), problemOf(convertWorkspace(null))]) {
      expect(problem).not.toMatch(/^: /);
      expect(problem).not.toMatch(/^[\w.]+: Invalid/);
      expect(problem.length).toBeGreaterThan(0);
    }
  });
});
