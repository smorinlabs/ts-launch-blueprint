// Semantic breaking-change detector tests (P10-TS05, D-043).
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  type ApiContractSnapshot,
  buildApiContractSnapshot,
  detectBreakingContractChanges,
} from '../src/contract.js';
import { publicProcedure, router } from '../src/trpc.js';

function snapshotFrom(r: Parameters<typeof buildApiContractSnapshot>[0]): ApiContractSnapshot {
  return buildApiContractSnapshot(r);
}

describe('detectBreakingContractChanges', () => {
  const baseRouter = router({
    projects: router({
      list: publicProcedure
        .input(
          z
            .object({
              workspaceName: z.string().optional(),
              limit: z.number().int().positive().max(100).optional(),
            })
            .optional()
        )
        .output(
          z.object({
            projects: z.array(z.object({ id: z.string(), name: z.string() })),
          })
        )
        .query(() => ({ projects: [] })),
    }),
  });

  it('reports zero breaking changes on identical snapshots', () => {
    const snap = snapshotFrom(baseRouter);
    expect(detectBreakingContractChanges(snap, snap).breaking).toEqual([]);
  });

  it('allows adding a new procedure, optional input field, looser input max, and new output field', () => {
    const nextRouter = router({
      projects: router({
        list: publicProcedure
          .input(
            z
              .object({
                workspaceName: z.string().optional(),
                limit: z.number().int().positive().max(200).optional(),
                cursor: z.string().min(1).optional(),
              })
              .optional()
          )
          .output(
            z.object({
              projects: z.array(z.object({ id: z.string(), name: z.string() })),
              nextCursor: z.string().nullable(),
            })
          )
          .query(() => ({ projects: [], nextCursor: null })),
        get: publicProcedure
          .input(z.object({ id: z.string().min(1) }))
          .output(z.object({ id: z.string() }))
          .query(() => ({ id: '1' })),
      }),
    });

    const diff = detectBreakingContractChanges(snapshotFrom(baseRouter), snapshotFrom(nextRouter));
    expect(diff.breaking).toEqual([]);
    expect(diff.nonBreaking.length).toBeGreaterThan(0);
  });

  it('flags removed procedure as breaking', () => {
    const emptyRouter = router({});
    const diff = detectBreakingContractChanges(snapshotFrom(baseRouter), snapshotFrom(emptyRouter));
    expect(diff.breaking).toHaveLength(1);
    expect(diff.breaking[0]?.procedure).toBe('projects.list');
  });

  it('flags procedure type change (query <-> mutation) as breaking', () => {
    const mutRouter = router({
      projects: router({
        list: publicProcedure
          .input(
            z
              .object({
                workspaceName: z.string().optional(),
                limit: z.number().int().positive().max(100).optional(),
              })
              .optional()
          )
          .output(
            z.object({
              projects: z.array(z.object({ id: z.string(), name: z.string() })),
            })
          )
          .mutation(() => ({ projects: [] })),
      }),
    });
    const diff = detectBreakingContractChanges(snapshotFrom(baseRouter), snapshotFrom(mutRouter));
    expect(diff.breaking.some((b) => b.reason.includes('type changed'))).toBe(true);
  });

  it('flags inputOptional true -> false and new required input field as breaking', () => {
    const requiredInputRouter = router({
      projects: router({
        list: publicProcedure
          .input(
            z.object({
              workspaceName: z.string().optional(),
              limit: z.number().int().positive().max(100).optional(),
              tenantId: z.string(),
            })
          )
          .output(
            z.object({
              projects: z.array(z.object({ id: z.string(), name: z.string() })),
            })
          )
          .query(() => ({ projects: [] })),
      }),
    });
    const diff = detectBreakingContractChanges(
      snapshotFrom(baseRouter),
      snapshotFrom(requiredInputRouter)
    );
    expect(diff.breaking.some((b) => b.reason.includes('optional'))).toBe(true);
    expect(diff.breaking.some((b) => b.reason.includes('tenantId'))).toBe(true);
  });

  it('flags narrowed input constraint (max 100 -> 50) and removed input property as breaking', () => {
    const narrowedRouter = router({
      projects: router({
        list: publicProcedure
          .input(
            z
              .object({
                limit: z.number().int().positive().max(50).optional(),
              })
              .optional()
          )
          .output(
            z.object({
              projects: z.array(z.object({ id: z.string(), name: z.string() })),
            })
          )
          .query(() => ({ projects: [] })),
      }),
    });
    const diff = detectBreakingContractChanges(
      snapshotFrom(baseRouter),
      snapshotFrom(narrowedRouter)
    );
    expect(diff.breaking.some((b) => b.path.includes('workspaceName'))).toBe(true);
    expect(diff.breaking.some((b) => b.path.includes('limit'))).toBe(true);
  });

  it('flags removed output property and non-nullable -> nullable output as breaking', () => {
    const brokenOutputRouter = router({
      projects: router({
        list: publicProcedure
          .input(
            z
              .object({
                workspaceName: z.string().optional(),
                limit: z.number().int().positive().max(100).optional(),
              })
              .optional()
          )
          .output(
            z.object({
              projects: z.array(z.object({ id: z.string().nullable() })),
            })
          )
          .query(() => ({ projects: [] })),
      }),
    });
    const diff = detectBreakingContractChanges(
      snapshotFrom(baseRouter),
      snapshotFrom(brokenOutputRouter)
    );
    expect(diff.breaking.some((b) => b.path.includes('name'))).toBe(true);
    expect(diff.breaking.some((b) => b.path.includes('id'))).toBe(true);
  });

  it('covers input/output bounds, enums, arrays, nullability, and missing schemas', () => {
    const richBase = router({
      items: router({
        search: publicProcedure
          .input(
            z.object({
              q: z.string().min(2).max(20),
              tags: z.array(z.string().min(1)).min(1).max(5),
              kind: z.enum(['a', 'b']),
              count: z.number().int().min(1),
              tag: z.string().nullable(),
            })
          )
          .output(
            z.object({
              status: z.enum(['ok']),
              reqField: z.string(),
              items: z.array(z.object({ code: z.string() })),
            })
          )
          .query(() => ({ status: 'ok' as const, reqField: 'x', items: [] })),
        ping: publicProcedure.input(z.object({ x: z.string() })).query(() => ({ ok: true })),
        pong: publicProcedure.query(() => ({ ok: true })),
      }),
    });

    const richBreakingHead = router({
      items: router({
        search: publicProcedure
          .input(
            z.object({
              q: z.string().min(4).max(10),
              tags: z.array(z.string().min(2)).min(2).max(3),
              kind: z.enum(['a']),
              count: z.number().min(5),
              tag: z.string(),
            })
          )
          .output(
            z.object({
              status: z.enum(['ok', 'warn']),
              reqField: z.string().optional(),
              items: z.array(z.object({ code: z.number() })),
            })
          )
          .query(() => ({ status: 'ok' as const, items: [] })),
        ping: publicProcedure.query(() => ({ ok: true })),
        pong: publicProcedure
          .input(z.object({ note: z.string().optional() }).optional())
          .query(() => ({ ok: true })),
      }),
    });

    const diff = detectBreakingContractChanges(
      snapshotFrom(richBase),
      snapshotFrom(richBreakingHead)
    );
    expect(diff.breaking.some((b) => b.path === 'input.q' && b.reason.includes('minLength'))).toBe(
      true
    );
    expect(diff.breaking.some((b) => b.path === 'input.q' && b.reason.includes('maxLength'))).toBe(
      true
    );
    expect(diff.breaking.some((b) => b.path === 'input.tags[]')).toBe(true);
    expect(diff.breaking.some((b) => b.path === 'input.kind')).toBe(true);
    expect(
      diff.breaking.some((b) => b.path === 'input.count' && b.reason.includes('minimum'))
    ).toBe(true);
    expect(diff.breaking.some((b) => b.path === 'input.tag' && b.reason.includes('nullable'))).toBe(
      true
    );
    expect(diff.breaking.some((b) => b.path === 'output.status')).toBe(true);
    expect(diff.breaking.some((b) => b.path === 'output.reqField')).toBe(true);
    expect(diff.breaking.some((b) => b.path === 'output.items[].code')).toBe(true);
    expect(diff.nonBreaking.some((m) => m.includes('integer widened to number'))).toBe(true);
    expect(diff.nonBreaking.some((m) => m.includes('input constraint removed'))).toBe(true);
    expect(diff.nonBreaking.some((m) => m.includes('optional input schema added'))).toBe(true);
  });

  it('flags loosened/incompatible type changes, enum additions on input, and removed output schema', () => {
    const baseSnap: ApiContractSnapshot = {
      schemaVersion: 1,
      version: '0.0.0',
      procedures: {
        a: {
          type: 'query',
          inputOptional: false,
          input: {
            type: 'object',
            properties: {
              x: { type: 'string' },
              y: { type: 'number', minimum: 5, maximum: 50 },
            },
            additionalProperties: false,
          },
          output: { type: ['string', 'null'] },
        },
        b: {
          type: 'query',
          inputOptional: true,
          input: { type: 'string' },
          output: {
            oneOf: [{ type: 'string' }, { type: 'null' }],
          },
        },
      },
    };
    const headSnap: ApiContractSnapshot = {
      schemaVersion: 1,
      version: '0.0.0',
      procedures: {
        a: {
          type: 'query',
          inputOptional: false,
          input: {
            type: 'object',
            properties: {
              x: { type: 'number', enum: [1, 2] },
              y: { type: 'number', minimum: 1, maximum: 100 },
            },
            additionalProperties: false,
          },
          output: null,
        },
        b: {
          type: 'query',
          inputOptional: true,
          input: { type: 'string', enum: ['only'] },
          output: {
            oneOf: [{ type: 'string' }, { type: 'null' }],
          },
        },
      },
    };

    const diff = detectBreakingContractChanges(baseSnap, headSnap);
    expect(diff.breaking.some((b) => b.procedure === 'a' && b.path === 'input.x')).toBe(true);
    expect(diff.breaking.some((b) => b.procedure === 'a' && b.path === 'output')).toBe(true);
    expect(diff.breaking.some((b) => b.procedure === 'b' && b.reason.includes('enum'))).toBe(true);
    expect(diff.nonBreaking.some((m) => m.includes('minimum loosened'))).toBe(true);
    expect(diff.nonBreaking.some((m) => m.includes('maximum loosened'))).toBe(true);
  });
});
