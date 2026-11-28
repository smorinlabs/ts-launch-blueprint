// Property-based round-trip tests for core schemas and converters (P08-TS02, P10-TS01).
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { ListProjectsInputSchema, ListProjectsOutputSchema, type Project } from '../src/index.js';
import { convertProject, convertWorkspace } from '../src/schemas/project.converter.js';
import { ProjectSchema, WorkspaceSchema } from '../src/schemas/project.schema.js';

const projectArb: fc.Arbitrary<Project> = fc.record({
  id: fc.string(),
  name: fc.string(),
  workspace: fc.option(fc.record({ name: fc.string() }), { nil: null }),
});

describe('core schema and converter properties', () => {
  it('WorkspaceSchema and convertWorkspace strip extra keys and round-trip through JSON', () => {
    fc.assert(
      fc.property(
        fc.record({ gid: fc.string(), name: fc.string() }),
        fc.dictionary(
          fc.string().filter((k) => k !== 'gid' && k !== 'name'),
          fc.jsonValue()
        ),
        (workspace, extras) => {
          const converted = convertWorkspace({ ...extras, ...workspace });
          expect(converted).toEqual({ ok: true, value: workspace });
          const roundTripped = WorkspaceSchema.parse(JSON.parse(JSON.stringify(workspace)));
          expect(roundTripped).toEqual(workspace);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ProjectSchema and convertProject strip extra keys and round-trip through JSON', () => {
    fc.assert(
      fc.property(
        projectArb,
        fc.dictionary(
          fc.string().filter((k) => k !== 'id' && k !== 'gid' && k !== 'name' && k !== 'workspace'),
          fc.jsonValue()
        ),
        (project, extras) => {
          const rawWorkspace =
            project.workspace === null
              ? null
              : { ...project.workspace, extraWorkspaceKey: 'ignored' };
          const converted = convertProject({
            ...extras,
            ...project,
            workspace: rawWorkspace,
          });
          expect(converted).toEqual({ ok: true, value: project });
          const roundTripped = ProjectSchema.parse(JSON.parse(JSON.stringify(project)));
          expect(roundTripped).toEqual(project);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ListProjectsInputSchema and ListProjectsOutputSchema round-trip valid payloads', () => {
    const inputArb = fc.record(
      {
        workspaceName: fc.string(),
        limit: fc.integer({ min: 1, max: 1_000_000 }),
        cursor: fc.string({ minLength: 1 }),
      },
      { requiredKeys: [] }
    );

    fc.assert(
      fc.property(
        inputArb,
        fc.array(projectArb, { maxLength: 10 }),
        fc.option(fc.string(), { nil: null }),
        (input, projects, nextCursor) => {
          const parsedInput = ListProjectsInputSchema.parse(JSON.parse(JSON.stringify(input)));
          expect(parsedInput).toEqual(input);

          const output = { projects, nextCursor };
          const parsedOutput = ListProjectsOutputSchema.parse(JSON.parse(JSON.stringify(output)));
          expect(parsedOutput).toEqual(output);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ListProjectsInputSchema rejects non-positive or non-integer limits', () => {
    const badLimitArb = fc.oneof(
      fc.integer({ max: 0 }),
      fc.double({ noInteger: true, noNaN: false })
    );

    fc.assert(
      fc.property(badLimitArb, (limit) => {
        expect(ListProjectsInputSchema.safeParse({ limit }).success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
