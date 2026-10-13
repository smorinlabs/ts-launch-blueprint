// Converters (schema layer): raw response body -> validated domain objects.
// The source trusted response shapes (KeyError/implicit any); a typed port
// needs an explicit guard. Shape violations -> ApiError (clean exit 1)
// instead of the source's accidental crash path.
import type { z } from 'zod';

import { ApiError } from './errors.js';
import { type Project, ProjectSchema, type Workspace, WorkspaceSchema } from './project.schema.js';

/** Unwrap the `{ data: [...] }` envelope and validate every item. */
function convertList<T>(raw: unknown, endpoint: string, schema: z.ZodType<T>): T[] {
  if (typeof raw !== 'object' || raw === null) {
    throw new ApiError(`API request failed: unexpected ${endpoint} response shape`);
  }
  const data = (raw as { data?: unknown }).data;
  if (data === undefined) {
    // get_projects parity: response_data.get("data", []) tolerates a
    // missing key (projects.py:247).
    return [];
  }
  if (!Array.isArray(data)) {
    throw new ApiError(`API request failed: unexpected ${endpoint} response shape`);
  }
  return data.map((item: unknown, index) => {
    const result = schema.safeParse(item);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path =
        issue === undefined || issue.path.length === 0 ? '' : `${issue.path.join('.')}: `;
      throw new ApiError(
        `API request failed: unexpected ${endpoint} item at index ${index}: ${path}${issue?.message ?? 'invalid item'}`
      );
    }
    return result.data;
  });
}

/** Convert a GET /workspaces body into validated workspaces. */
export function toWorkspaces(raw: unknown): Workspace[] {
  return convertList(raw, '/workspaces', WorkspaceSchema);
}

/** Convert a GET /projects body into validated projects. */
export function toProjects(raw: unknown): Project[] {
  return convertList(raw, '/projects', ProjectSchema);
}
