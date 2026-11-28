// Public request/response contracts for listProjects and getProject. Controllers
// (the API's tRPC procedures now, any other later) validate with these instead
// of redefining shapes. Converters and raw-API schemas stay internal (D-047).
import { z } from 'zod';

import { ProjectSchema } from './project.schema.js';

/** Input for listProjects: same meaning as the service's ListProjectsInput
 * (an empty or missing workspaceName means no filter; limit is a positive
 * integer; cursor is an opaque non-empty pagination token). */
export const ListProjectsInputSchema: z.ZodObject<{
  workspaceName: z.ZodOptional<z.ZodString>;
  limit: z.ZodOptional<z.ZodNumber>;
  cursor: z.ZodOptional<z.ZodString>;
}> = z.object({
  workspaceName: z.string().optional(),
  limit: z.number().int().positive().optional(),
  cursor: z.string().min(1).optional(),
});

/** Output of listProjects: an object with projects and a nullable nextCursor
 * token for cursor-based pagination (Q7.A, D-047). */
export const ListProjectsOutputSchema: z.ZodObject<{
  projects: z.ZodArray<typeof ProjectSchema>;
  nextCursor: z.ZodNullable<z.ZodString>;
}> = z.object({
  projects: z.array(ProjectSchema),
  nextCursor: z.string().nullable(),
});

/** Input for getProject: a non-empty project ID (excluding dot segments). */
export const GetProjectInputSchema: z.ZodObject<{
  id: z.ZodString;
}> = z.object({
  id: z
    .string()
    .min(1)
    .refine((id) => id !== '.' && id !== '..', {
      message: "Project id must not be '.' or '..'",
    }),
});

/** Output of getProject: single project wrapper. */
export const GetProjectOutputSchema: z.ZodObject<{
  project: typeof ProjectSchema;
}> = z.object({
  project: ProjectSchema,
});

/** The listProjects response shape. */
export type ListProjectsOutput = z.infer<typeof ListProjectsOutputSchema>;

/** The getProject request shape. */
export type GetProjectInput = z.infer<typeof GetProjectInputSchema>;

/** The getProject response shape. */
export type GetProjectOutput = z.infer<typeof GetProjectOutputSchema>;
