// Public request/response contract for listProjects. Controllers (the API's
// tRPC procedure now, any other later) validate with these instead of
// redefining shapes. Converters and raw-API schemas stay internal (D-047).
import { z } from 'zod';

import { ProjectSchema } from './project.schema.js';

/** Input for listProjects: same meaning as the service's ListProjectsInput
 * (an empty or missing workspaceName means no filter; limit is a positive
 * integer). The core's contract test keeps the two types exactly equal. */
export const ListProjectsInputSchema: z.ZodObject<{
  workspaceName: z.ZodOptional<z.ZodString>;
  limit: z.ZodOptional<z.ZodNumber>;
}> = z.object({
  workspaceName: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

/** Output of listProjects: an object (not a bare array) so fields such as
 * a next-page cursor can be added later without a breaking change. Same
 * shape as the CLI's JSON output. */
export const ListProjectsOutputSchema: z.ZodObject<{
  projects: z.ZodArray<typeof ProjectSchema>;
}> = z.object({
  projects: z.array(ProjectSchema),
});

/** The listProjects response shape. */
export type ListProjectsOutput = z.infer<typeof ListProjectsOutputSchema>;
