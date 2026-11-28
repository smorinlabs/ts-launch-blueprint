// Converters (schema layer): internal upstream wire schemas -> validated
// domain objects. They return a result instead of throwing and know nothing
// about where the item came from; the caller (a repository) decides how to
// report a problem. Never exported from packages/core/src/index.ts (D-047).
import { z } from 'zod';

import { type Project, type Workspace } from './project.schema.js';

/** Outcome of converting one raw item. */
export type ConvertResult<T> = { ok: true; value: T } | { ok: false; problem: string };

/** Detailed outcome used by repositories to report dotted list paths and counts. */
export type DetailedConvertResult<T> =
  | { ok: true; value: T }
  | { ok: false; problem: string; firstProblem: string; firstPath: string; issueCount: number };

function coerceWireId(value: unknown): unknown {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return value;
}

const WireIdSchema = z.preprocess(coerceWireId, z.string());

const WireWorkspaceSchema = z.object({
  gid: WireIdSchema,
  name: z.string(),
});

const WireProjectSchema = z.object({
  id: WireIdSchema,
  name: z.string(),
  workspace: z.object({ name: z.string() }).nullable(),
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function preprocessWireProject(raw: unknown): unknown {
  if (!isPlainObject(raw)) {
    return raw;
  }
  // Prefer `gid` when the key is present; fall back to `id` only when absent.
  const id = Object.hasOwn(raw, 'gid') ? raw['gid'] : raw['id'];
  const rawWorkspace = raw['workspace'];
  let workspace: unknown;
  if (
    rawWorkspace === undefined ||
    rawWorkspace === null ||
    (isPlainObject(rawWorkspace) && Object.keys(rawWorkspace).length === 0)
  ) {
    workspace = null;
  } else {
    workspace = rawWorkspace;
  }
  return {
    id,
    name: raw['name'],
    workspace,
  };
}

/** Validate one item; `firstProblem` is `<path>: <message>`, or `<message>` when
 * the item itself is the wrong type. `problem` appends ` (+N more)` when >1 issue.
 * Raw payload values are never interpolated. */
function convertDetailed<T>(schema: z.ZodType<T>, raw: unknown): DetailedConvertResult<T> {
  const result = schema.safeParse(raw);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const issues = result.error.issues;
  const issue = issues[0];
  const firstPath = issue === undefined ? '' : issue.path.map(String).join('.');
  const prefix = firstPath === '' ? '' : `${firstPath}: `;
  const firstProblem = `${prefix}${issue?.message ?? 'invalid item'}`;
  const remainder = issues.length > 1 ? ` (+${issues.length - 1} more)` : '';
  return {
    ok: false,
    problem: `${firstProblem}${remainder}`,
    firstProblem,
    firstPath,
    issueCount: Math.max(issues.length, 1),
  };
}

/** Convert one raw workspace item with detailed issue metadata. */
export function convertWorkspaceDetailed(raw: unknown): DetailedConvertResult<Workspace> {
  return convertDetailed(WireWorkspaceSchema, raw);
}

/** Convert one raw project item with detailed issue metadata. */
export function convertProjectDetailed(raw: unknown): DetailedConvertResult<Project> {
  return convertDetailed(WireProjectSchema, preprocessWireProject(raw));
}

/** Convert one raw workspace item. */
export function convertWorkspace(raw: unknown): ConvertResult<Workspace> {
  const detailed = convertWorkspaceDetailed(raw);
  return detailed.ok
    ? { ok: true, value: detailed.value }
    : { ok: false, problem: detailed.problem };
}

/** Convert one raw project item. */
export function convertProject(raw: unknown): ConvertResult<Project> {
  const detailed = convertProjectDetailed(raw);
  return detailed.ok
    ? { ok: true, value: detailed.value }
    : { ok: false, problem: detailed.problem };
}
