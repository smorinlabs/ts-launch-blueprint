// Domain shapes for the projects service (schema layer). Every other layer
// imports Project / Workspace from here, never from the HTTP client.
import { z } from 'zod';

/** Workspace shape returned by GET /workspaces (projects.py:207-214). */
export const WorkspaceSchema: z.ZodObject<{ gid: z.ZodString; name: z.ZodString }> = z.object({
  gid: z.string(),
  name: z.string(),
});

/** Project shape returned by GET /projects with
 * opt_fields=name,workspace.name (projects.py:229-247; fields consumed
 * at 288-291 and 308-312). */
export const ProjectSchema: z.ZodObject<{
  id: z.ZodString;
  name: z.ZodString;
  workspace: z.ZodObject<{ name: z.ZodString }>;
}> = z.object({
  id: z.string(),
  name: z.string(),
  workspace: z.object({ name: z.string() }),
});

/** A workspace the projects service knows about. */
export type Workspace = z.infer<typeof WorkspaceSchema>;

/** A project, with the name of the workspace it belongs to. */
export type Project = z.infer<typeof ProjectSchema>;
