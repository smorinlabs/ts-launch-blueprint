// Semantic breaking-change detector tests (P10-TS05, D-043).
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  type ApiContractSnapshot,
  assertValidApiContractSnapshot,
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
              .strictObject({
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

  it('flags output enum removal and input additionalProperties tightening as breaking', () => {
    const base = router({
      items: router({
        op: publicProcedure
          .input(z.looseObject({ a: z.string() }))
          .output(z.object({ role: z.enum(['admin', 'user']) }))
          .query(() => ({ role: 'admin' as const })),
      }),
    });
    const head = router({
      items: router({
        op: publicProcedure
          .input(z.strictObject({ a: z.string() }))
          .output(z.object({ role: z.string() }))
          .query(() => ({ role: 'admin' })),
      }),
    });
    const diff = detectBreakingContractChanges(snapshotFrom(base), snapshotFrom(head));
    expect(diff.breaking.some((b) => b.path === 'input' && b.reason.includes('additional'))).toBe(
      true
    );
    expect(diff.breaking.some((b) => b.path === 'output.role' && b.reason.includes('enum'))).toBe(
      true
    );
  });

  it('flags const literal changes on input and output as breaking', () => {
    const base = router({
      items: router({
        op: publicProcedure
          .input(z.object({ kind: z.literal('v1'), tag: z.string() }))
          .output(z.object({ version: z.literal(1) }))
          .query(() => ({ version: 1 as const })),
      }),
    });
    const head = router({
      items: router({
        op: publicProcedure
          .input(z.object({ kind: z.literal('v2'), tag: z.literal('fixed') }))
          .output(z.object({ version: z.number() }))
          .query(() => ({ version: 2 })),
      }),
    });
    const diff = detectBreakingContractChanges(snapshotFrom(base), snapshotFrom(head));
    expect(diff.breaking.some((b) => b.path === 'input.kind' && b.reason.includes('const'))).toBe(
      true
    );
    expect(diff.breaking.some((b) => b.path === 'input.tag' && b.reason.includes('const'))).toBe(
      true
    );
    expect(
      diff.breaking.some((b) => b.path === 'output.version' && b.reason.includes('const'))
    ).toBe(true);
  });

  it('detects breaking vs non-breaking changes in non-nullable anyOf/oneOf and primitive unions', () => {
    const base = router({
      items: router({
        op: publicProcedure
          .input(
            z.object({
              objUnion: z.union([z.object({ a: z.string() }), z.object({ b: z.number() })]),
              primUnion: z.union([z.string(), z.number()]),
              discUnion: z.discriminatedUnion('k', [
                z.object({ k: z.literal('a'), v: z.string() }),
                z.object({ k: z.literal('b'), n: z.number() }),
              ]),
              widenedInput: z.string(),
            })
          )
          .output(
            z.object({
              objUnion: z.union([z.object({ a: z.string() }), z.object({ b: z.number() })]),
              primUnion: z.union([z.string(), z.number()]),
              narrowedOutput: z.union([z.string(), z.number()]),
            })
          )
          .query(() => ({
            objUnion: { a: 'x' },
            primUnion: 'x',
            narrowedOutput: 'x',
          })),
      }),
    });

    const compatibleHead = router({
      items: router({
        op: publicProcedure
          .input(
            z.object({
              objUnion: z.union([
                z.object({ a: z.string() }),
                z.object({ b: z.number() }),
                z.object({ c: z.boolean() }),
              ]),
              primUnion: z.union([z.string(), z.number(), z.boolean()]),
              discUnion: z.discriminatedUnion('k', [
                z.object({ k: z.literal('a'), v: z.string() }),
                z.object({ k: z.literal('b'), n: z.number() }),
              ]),
              widenedInput: z.union([z.string(), z.number()]),
            })
          )
          .output(
            z.object({
              objUnion: z.object({ a: z.string() }),
              primUnion: z.string(),
              narrowedOutput: z.string(),
            })
          )
          .query(() => ({
            objUnion: { a: 'x' },
            primUnion: 'x',
            narrowedOutput: 'x',
          })),
      }),
    });
    expect(
      detectBreakingContractChanges(snapshotFrom(base), snapshotFrom(compatibleHead)).breaking
    ).toEqual([]);

    const breakingHead = router({
      items: router({
        op: publicProcedure
          .input(
            z.object({
              objUnion: z.union([z.object({ a: z.string() }), z.object({ c: z.boolean() })]),
              primUnion: z.string(),
              discUnion: z.discriminatedUnion('k', [
                z.object({ k: z.literal('a'), v: z.string().min(3) }),
                z.object({ k: z.literal('b'), n: z.number() }),
              ]),
              widenedInput: z.string(),
            })
          )
          .output(
            z.object({
              objUnion: z.union([z.object({ a: z.string() }), z.object({ b: z.string() })]),
              primUnion: z.union([z.string(), z.boolean()]),
              narrowedOutput: z.union([z.string(), z.number()]),
            })
          )
          .query(() => ({
            objUnion: { a: 'x' },
            primUnion: 'x',
            narrowedOutput: 'x',
          })),
      }),
    });

    const diff = detectBreakingContractChanges(snapshotFrom(base), snapshotFrom(breakingHead));
    expect(diff.breaking.some((b) => b.path === 'input.objUnion')).toBe(true);
    expect(diff.breaking.some((b) => b.path === 'input.primUnion')).toBe(true);
    expect(diff.breaking.some((b) => b.path === 'input.discUnion')).toBe(true);
    expect(diff.breaking.some((b) => b.path === 'output.objUnion')).toBe(true);
    expect(diff.breaking.some((b) => b.path === 'output.primUnion')).toBe(true);
  });

  it('handles const/enum transitions, additionalProperties loosening, nullable unions, and deep const values', () => {
    const baseSnap: ApiContractSnapshot = {
      schemaVersion: 1,
      version: '0.0.0',
      procedures: {
        okTransitions: {
          type: 'query',
          inputOptional: false,
          input: {
            type: 'object',
            additionalProperties: false,
            properties: {
              fromLitToEnum: { type: 'string', const: 'a' },
              fromLitToAny: { type: 'string', const: 'a' },
              fromEnumToLit: { type: 'string', enum: ['a'] },
              nullableMulti: { type: ['string', 'number', 'null'] },
              anyOfNull: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }] },
            },
          },
          output: {
            type: 'object',
            properties: {
              toEnum: { type: 'string' },
              fromLitToSingleEnum: { type: 'string', const: 'a' },
              fromEnumToLit: { type: 'string', enum: ['a', 'b'] },
              toLit: { type: 'string' },
              objConst: { type: 'object', const: { nested: [1, 2] } },
            },
          },
        },
        badTransitions: {
          type: 'query',
          inputOptional: false,
          input: {
            type: 'object',
            properties: {
              fromLitToDisjointEnum: { type: 'string', const: 'a' },
              objConst: { type: 'object', const: { nested: [1, 2] } },
            },
          },
          output: {
            type: 'object',
            properties: {
              fromEnumToOutsideLit: { type: 'string', enum: ['a', 'b'] },
            },
          },
        },
      },
    };

    const headSnap: ApiContractSnapshot = {
      schemaVersion: 1,
      version: '0.0.0',
      procedures: {
        okTransitions: {
          type: 'query',
          inputOptional: false,
          input: {
            type: 'object',
            additionalProperties: {},
            properties: {
              fromLitToEnum: { type: 'string', enum: ['a', 'b'] },
              fromLitToAny: { type: 'string' },
              fromEnumToLit: { type: 'string', const: 'a' },
              nullableMulti: { type: ['string', 'number', 'null'] },
              anyOfNull: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }] },
            },
          },
          output: {
            type: 'object',
            properties: {
              toEnum: { type: 'string', enum: ['x', 'y'] },
              fromLitToSingleEnum: { type: 'string', enum: ['a'] },
              fromEnumToLit: { type: 'string', const: 'a' },
              toLit: { type: 'string', const: 'fixed' },
              objConst: { type: 'object', const: { nested: [1, 2] } },
            },
          },
        },
        badTransitions: {
          type: 'query',
          inputOptional: false,
          input: {
            type: 'object',
            properties: {
              fromLitToDisjointEnum: { type: 'string', enum: ['b', 'c'] },
              objConst: { type: 'object', const: { nested: [1, 3] } },
            },
          },
          output: {
            type: 'object',
            properties: {
              fromEnumToOutsideLit: { type: 'string', const: 'z' },
            },
          },
        },
      },
    };

    const diff = detectBreakingContractChanges(baseSnap, headSnap);
    expect(diff.breaking).toEqual([
      {
        procedure: 'badTransitions',
        path: 'input.fromLitToDisjointEnum',
        reason: 'Input const value no longer allowed by enum',
      },
      {
        procedure: 'badTransitions',
        path: 'input.objConst',
        reason: 'Input const literal changed from {"nested":[1,2]} to {"nested":[1,3]}',
      },
      {
        procedure: 'badTransitions',
        path: 'output.fromEnumToOutsideLit',
        reason: 'Output const literal outside previous enum',
      },
    ]);
    expect(diff.nonBreaking.some((m) => m.includes('allows additional properties'))).toBe(true);
    expect(diff.nonBreaking.some((m) => m.includes('output narrowed to enum'))).toBe(true);
    expect(diff.nonBreaking.some((m) => m.includes('output narrowed to const literal'))).toBe(true);
  });

  it('rejects chained input validators and exports request schemas in Zod input mode', () => {
    const chained = router({
      items: router({
        op: publicProcedure
          .input(z.object({ tenantId: z.string() }))
          .input(z.object({ id: z.string() }))
          .query(() => ({ ok: true })),
      }),
    });
    expect(() => snapshotFrom(chained)).toThrow(/chains 2 input validators/);

    const basePlain = router({
      items: router({
        op: publicProcedure
          .input(z.object({ id: z.string(), count: z.number().default(1) }))
          .query(() => ({ ok: true })),
      }),
    });
    const headStrict = router({
      items: router({
        op: publicProcedure
          .input(z.strictObject({ id: z.string(), count: z.number().default(1) }))
          .query(() => ({ ok: true })),
      }),
    });
    const baseSnap = snapshotFrom(basePlain);
    expect(baseSnap.procedures['items.op']?.input).not.toHaveProperty(
      'additionalProperties',
      false
    );
    expect(baseSnap.procedures['items.op']?.input?.['required']).toEqual(['id']);
    const diff = detectBreakingContractChanges(baseSnap, snapshotFrom(headStrict));
    expect(diff.breaking.some((b) => b.reason.includes('additional properties'))).toBe(true);
  });

  it('handles null-only schemas, integer bound equivalence, patterns, catchalls, tuples, and output bounds', () => {
    const base = router({
      items: router({
        op: publicProcedure
          .input(
            z.object({
              nullIn: z.null(),
              intMin: z.number().int().positive(),
              floatMin: z.number().positive(),
              idStr: z.string(),
              samePattern: z.string().regex(/^[a-z]+$/),
              tuple: z.tuple([z.string(), z.number()]),
              loose: z.looseObject({ a: z.string() }),
              catchall: z.object({ a: z.string() }).catchall(z.string()),
            })
          )
          .output(
            z.object({
              nullOut: z.string().nullable(),
              tags: z.array(z.string()).min(1).max(5),
              label: z.string().min(2),
              score: z.number().int().min(1),
              tuple: z.tuple([z.string()]),
            })
          )
          .query(() => ({
            nullOut: null,
            tags: ['a'],
            label: 'ok',
            score: 1,
            tuple: ['x'],
          })),
      }),
    });

    const compatHead = router({
      items: router({
        op: publicProcedure
          .input(
            z.object({
              nullIn: z.string().nullable(),
              intMin: z.number().int().min(1),
              floatMin: z.number().positive(),
              idStr: z.string(),
              samePattern: z.string().regex(/^[a-z]+$/),
              tuple: z.tuple([z.string(), z.number()]),
              loose: z.looseObject({ a: z.string() }),
              catchall: z.object({ a: z.string() }).catchall(z.string()),
            })
          )
          .output(
            z.object({
              nullOut: z.null(),
              tags: z.array(z.string()).min(2).max(4),
              label: z.string().min(3),
              score: z.number().int().min(2),
              tuple: z.tuple([z.string()]),
            })
          )
          .query(() => ({
            nullOut: null,
            tags: ['a', 'b'],
            label: 'abc',
            score: 2,
            tuple: ['x'],
          })),
      }),
    });
    expect(
      detectBreakingContractChanges(snapshotFrom(base), snapshotFrom(compatHead)).breaking
    ).toEqual([]);

    const breakingHead = router({
      items: router({
        op: publicProcedure
          .input(
            z.object({
              nullIn: z.string(),
              intMin: z.number().int().min(2),
              floatMin: z.number().min(1),
              idStr: z.string().regex(/^[0-9]+$/),
              samePattern: z.string().regex(/^[a-z]+$/),
              tuple: z.tuple([z.number(), z.number()]),
              loose: z.looseObject({ a: z.string(), note: z.string().optional() }),
              catchall: z.object({ a: z.string() }).catchall(z.number()),
            })
          )
          .output(
            z.object({
              nullOut: z.string().nullable(),
              tags: z.array(z.string()),
              label: z.string().min(1),
              score: z.number().int().min(0),
              tuple: z.tuple([z.number()]),
            })
          )
          .query(() => ({
            nullOut: null,
            tags: [],
            label: 'a',
            score: 0,
            tuple: [1],
          })),
      }),
    });
    const bad = detectBreakingContractChanges(snapshotFrom(base), snapshotFrom(breakingHead));
    expect(bad.breaking.some((b) => b.path === 'input.nullIn')).toBe(true);
    expect(bad.breaking.some((b) => b.path === 'input.intMin')).toBe(true);
    expect(bad.breaking.some((b) => b.path === 'input.floatMin')).toBe(true);
    expect(bad.breaking.some((b) => b.path === 'input.idStr' && b.reason.includes('pattern'))).toBe(
      true
    );
    expect(bad.breaking.some((b) => b.path === 'input.tuple[0]')).toBe(true);
    expect(bad.breaking.some((b) => b.path === 'input.loose.note')).toBe(true);
    expect(bad.breaking.some((b) => b.path === 'input.catchall.*')).toBe(true);
    expect(
      bad.breaking.some((b) => b.path === 'output.tags' && b.reason.includes('minItems'))
    ).toBe(true);
    expect(
      bad.breaking.some((b) => b.path === 'output.label' && b.reason.includes('minLength'))
    ).toBe(true);
    expect(
      bad.breaking.some((b) => b.path === 'output.score' && b.reason.includes('minimum'))
    ).toBe(true);
    expect(bad.breaking.some((b) => b.path === 'output.tuple[0]')).toBe(true);
  });

  it('validates snapshot document structure before comparison', () => {
    expect(() =>
      assertValidApiContractSnapshot(
        { schemaVersion: 1, version: '0.0.0', procedures: {} },
        'empty'
      )
    ).not.toThrow();
    expect(() =>
      assertValidApiContractSnapshot({ schemaVersion: 1, version: 1, procedures: {} }, 'bad')
    ).toThrow(/expected string version/);
    expect(() =>
      assertValidApiContractSnapshot({ schemaVersion: 1, version: '0.0.0', procedures: [] }, 'bad')
    ).toThrow(/expected procedures object/);
    expect(() =>
      assertValidApiContractSnapshot({ schemaVersion: 2, version: '0.0.0', procedures: {} }, 'bad')
    ).toThrow(/unsupported schemaVersion/);
    expect(() => assertValidApiContractSnapshot(null, 'bad')).toThrow(/expected JSON object/);
    expect(() =>
      assertValidApiContractSnapshot(
        { schemaVersion: 1, version: '0.0.0', procedures: { p: null } },
        'bad'
      )
    ).toThrow(/must be an object/);
    expect(() =>
      assertValidApiContractSnapshot(
        { schemaVersion: 1, version: '0.0.0', procedures: { p: { type: 'rpc' } } },
        'bad'
      )
    ).toThrow(/invalid type/);
    expect(() =>
      assertValidApiContractSnapshot(
        {
          schemaVersion: 1,
          version: '0.0.0',
          procedures: { p: { type: 'query', inputOptional: 'no' } },
        },
        'bad'
      )
    ).toThrow(/boolean inputOptional/);
    expect(() =>
      assertValidApiContractSnapshot(
        {
          schemaVersion: 1,
          version: '0.0.0',
          procedures: { p: { type: 'query', inputOptional: true, input: [] } },
        },
        'bad'
      )
    ).toThrow(/input must be an object or null/);
    expect(() =>
      assertValidApiContractSnapshot(
        {
          schemaVersion: 1,
          version: '0.0.0',
          procedures: { p: { type: 'query', inputOptional: true, input: null, output: 'bad' } },
        },
        'bad'
      )
    ).toThrow(/output must be an object or null/);
  });

  it('covers exclusiveMaximum integer equivalence, pattern removal, tuple arity, and output upper bounds', () => {
    const base = router({
      items: router({
        op: publicProcedure
          .input(
            z.object({
              intMax: z.number().int().lt(10),
              pat: z.string().regex(/^[a-z]+$/),
              tuple: z.tuple([z.string()]),
            })
          )
          .output(
            z.object({
              intMax: z.number().int().max(10),
              strMax: z.string().max(10),
              arrMax: z.array(z.string()).max(5),
              tuple: z.tuple([z.string()]),
            })
          )
          .query(() => ({ intMax: 1, strMax: 'a', arrMax: [], tuple: ['x'] })),
      }),
    });

    const compat = router({
      items: router({
        op: publicProcedure
          .input(
            z.object({
              intMax: z.number().int().max(9),
              pat: z.string(),
              tuple: z.tuple([z.string()]),
            })
          )
          .output(
            z.object({
              intMax: z.number().int().lt(10),
              strMax: z.string().max(8),
              arrMax: z.array(z.string()).max(4),
              tuple: z.tuple([z.string()]),
            })
          )
          .query(() => ({ intMax: 1, strMax: 'a', arrMax: [], tuple: ['x'] })),
      }),
    });
    const compatDiff = detectBreakingContractChanges(snapshotFrom(base), snapshotFrom(compat));
    expect(compatDiff.breaking).toEqual([]);
    expect(compatDiff.nonBreaking.some((m) => m.includes('pattern removed'))).toBe(true);
    expect(compatDiff.nonBreaking.some((m) => m.includes('output maximum tightened'))).toBe(true);

    const broken = router({
      items: router({
        op: publicProcedure
          .input(
            z.object({
              intMax: z.number().int().max(8),
              pat: z.string().regex(/^[0-9]+$/),
              tuple: z.tuple([z.string(), z.number()]),
            })
          )
          .output(
            z.object({
              intMax: z.number().int().max(20),
              strMax: z.string().max(20),
              arrMax: z.array(z.string()),
              tuple: z.tuple([z.string(), z.number()]),
            })
          )
          .query(() => ({ intMax: 1, strMax: 'a', arrMax: [], tuple: ['x', 1] })),
      }),
    });
    const brokenDiff = detectBreakingContractChanges(snapshotFrom(base), snapshotFrom(broken));
    expect(brokenDiff.breaking.some((b) => b.path === 'input.intMax')).toBe(true);
    expect(brokenDiff.breaking.some((b) => b.path === 'input.pat')).toBe(true);
    expect(brokenDiff.breaking.some((b) => b.path === 'input.tuple')).toBe(true);
    expect(brokenDiff.breaking.some((b) => b.path === 'output.intMax')).toBe(true);
    expect(brokenDiff.breaking.some((b) => b.path === 'output.strMax')).toBe(true);
    expect(brokenDiff.breaking.some((b) => b.path === 'output.arrMax')).toBe(true);
    expect(brokenDiff.breaking.some((b) => b.path === 'output.tuple')).toBe(true);
  });
});
