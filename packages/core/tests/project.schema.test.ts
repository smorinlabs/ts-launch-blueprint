// Schema layer: one raw item -> a validated Project / Workspace, as a
// result (never a throw). Problems are matched on our own parts only
// (the path), never on Zod's wording, so a Zod minor release can't break
// these tests. Response-wrapper cases live in http-projects.repository.test.ts.
import { describe, expect, it } from 'vitest';

import { convertProject, convertWorkspace } from '../src/schemas/project.converter.js';
import type { Project, Workspace } from '../src/schemas/project.schema.js';

const WORKSPACE: Workspace = { gid: 'ws1', name: 'Acme' };
const PROJECT: Project = { id: '1', name: 'Alpha', workspace: { name: 'Acme' } };

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
});

describe('convertWorkspace / convertProject: invalid items', () => {
  it('names the field of a missing field', () => {
    expect(problemOf(convertWorkspace({ name: 'No gid' }))).toMatch(/^gid: \S/);
  });

  it('names the field of a wrong-typed value', () => {
    expect(problemOf(convertProject({ ...PROJECT, name: 42 }))).toMatch(/^name: \S/);
  });

  it('names the dotted path of an invalid nested field', () => {
    expect(problemOf(convertProject({ ...PROJECT, workspace: {} }))).toMatch(
      /^workspace\.name: \S/
    );
  });

  it('leaves out the path prefix when the item is not an object', () => {
    for (const problem of [problemOf(convertProject('oops')), problemOf(convertWorkspace(null))]) {
      expect(problem).not.toMatch(/^: /);
      expect(problem).not.toMatch(/^[\w.]+: Invalid/);
      expect(problem.length).toBeGreaterThan(0);
    }
  });
});
