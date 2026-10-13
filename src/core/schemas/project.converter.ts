// Converters (schema layer): one raw item -> a validated domain object.
// They return a result instead of throwing and know nothing about where
// the item came from; the caller (a repository) decides how to report a
// problem.
import type { z } from 'zod';

import { type Project, ProjectSchema, type Workspace, WorkspaceSchema } from './project.schema.js';

/** Outcome of converting one raw item. */
export type ConvertResult<T> = { ok: true; value: T } | { ok: false; problem: string };

/** Validate one item; `problem` is `<path>: <message>`, or just
 * `<message>` when the item itself is the wrong type (empty path). */
function convert<T>(schema: z.ZodType<T>, raw: unknown): ConvertResult<T> {
  const result = schema.safeParse(raw);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const issue = result.error.issues[0];
  const path = issue === undefined || issue.path.length === 0 ? '' : `${issue.path.join('.')}: `;
  return { ok: false, problem: `${path}${issue?.message ?? 'invalid item'}` };
}

/** Convert one raw workspace item. */
export function convertWorkspace(raw: unknown): ConvertResult<Workspace> {
  return convert(WorkspaceSchema, raw);
}

/** Convert one raw project item. */
export function convertProject(raw: unknown): ConvertResult<Project> {
  return convert(ProjectSchema, raw);
}
