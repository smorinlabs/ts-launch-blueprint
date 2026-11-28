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

  it('detects multipleOf tightening, loosening, incompatibility, and decimal precision on input and output', () => {
    const base = router({
      items: router({
        op: publicProcedure
          .input(
            z.object({
              unconstrained: z.number(),
              step2: z.number().multipleOf(2),
              step4: z.number().multipleOf(4),
              step5: z.number().multipleOf(5),
              dec04: z.number().multipleOf(0.4),
              dec03: z.number().multipleOf(0.3),
              dec01: z.number().multipleOf(0.1),
              same: z.number().multipleOf(5),
            })
          )
          .output(
            z.object({
              unconstrained: z.number(),
              step2: z.number().multipleOf(2),
              step4: z.number().multipleOf(4),
              step5: z.number().multipleOf(5),
              dec02: z.number().multipleOf(0.2),
              dec01: z.number().multipleOf(0.1),
              dec03: z.number().multipleOf(0.3),
              same: z.number().multipleOf(5),
            })
          )
          .query(() => ({
            unconstrained: 1,
            step2: 2,
            step4: 4,
            step5: 5,
            dec02: 0.2,
            dec01: 0.1,
            dec03: 0.3,
            same: 5,
          })),
      }),
    });

    const compatHead = router({
      items: router({
        op: publicProcedure
          .input(
            z.object({
              unconstrained: z.number(),
              step2: z.number().multipleOf(2),
              step4: z.number().multipleOf(2),
              step5: z.number(),
              dec04: z.number().multipleOf(0.2),
              dec03: z.number().multipleOf(0.1),
              dec01: z.number().multipleOf(0.1),
              same: z.number().multipleOf(5),
            })
          )
          .output(
            z.object({
              unconstrained: z.number().multipleOf(5),
              step2: z.number().multipleOf(4),
              step4: z.number().multipleOf(4),
              step5: z.number().multipleOf(5),
              dec02: z.number().multipleOf(0.4),
              dec01: z.number().multipleOf(0.3),
              dec03: z.number().multipleOf(0.3),
              same: z.number().multipleOf(5),
            })
          )
          .query(() => ({
            unconstrained: 5,
            step2: 4,
            step4: 4,
            step5: 5,
            dec02: 0.4,
            dec01: 0.3,
            dec03: 0.3,
            same: 5,
          })),
      }),
    });

    const compatDiff = detectBreakingContractChanges(snapshotFrom(base), snapshotFrom(compatHead));
    expect(compatDiff.breaking).toEqual([]);
    expect(compatDiff.nonBreaking.some((m) => m.includes('input multipleOf loosened'))).toBe(true);
    expect(compatDiff.nonBreaking.some((m) => m.includes('input multipleOf removed'))).toBe(true);
    expect(compatDiff.nonBreaking.some((m) => m.includes('output multipleOf added'))).toBe(true);
    expect(compatDiff.nonBreaking.some((m) => m.includes('output multipleOf tightened'))).toBe(
      true
    );

    const breakingHead = router({
      items: router({
        op: publicProcedure
          .input(
            z.object({
              unconstrained: z.number().multipleOf(5),
              step2: z.number().multipleOf(3),
              step4: z.number().multipleOf(8),
              step5: z.number().multipleOf(5),
              dec04: z.number().multipleOf(0.4),
              dec03: z.number().multipleOf(0.3),
              dec01: z.number().multipleOf(0.3),
              same: z.number().multipleOf(5),
            })
          )
          .output(
            z.object({
              unconstrained: z.number(),
              step2: z.number().multipleOf(3),
              step4: z.number().multipleOf(2),
              step5: z.number(),
              dec02: z.number().multipleOf(0.2),
              dec01: z.number().multipleOf(0.1),
              dec03: z.number().multipleOf(0.1),
              same: z.number().multipleOf(5),
            })
          )
          .query(() => ({
            unconstrained: 1,
            step2: 3,
            step4: 2,
            step5: 5,
            dec02: 0.2,
            dec01: 0.1,
            dec03: 0.1,
            same: 5,
          })),
      }),
    });

    const badDiff = detectBreakingContractChanges(snapshotFrom(base), snapshotFrom(breakingHead));
    expect(
      badDiff.breaking.some(
        (b) => b.path === 'input.unconstrained' && b.reason.includes('multipleOf')
      )
    ).toBe(true);
    expect(
      badDiff.breaking.some((b) => b.path === 'input.step2' && b.reason.includes('multipleOf'))
    ).toBe(true);
    expect(
      badDiff.breaking.some((b) => b.path === 'input.step4' && b.reason.includes('multipleOf'))
    ).toBe(true);
    expect(
      badDiff.breaking.some((b) => b.path === 'input.dec01' && b.reason.includes('multipleOf'))
    ).toBe(true);
    expect(
      badDiff.breaking.some((b) => b.path === 'output.step2' && b.reason.includes('multipleOf'))
    ).toBe(true);
    expect(
      badDiff.breaking.some((b) => b.path === 'output.step4' && b.reason.includes('multipleOf'))
    ).toBe(true);
    expect(
      badDiff.breaking.some((b) => b.path === 'output.step5' && b.reason.includes('multipleOf'))
    ).toBe(true);
    expect(
      badDiff.breaking.some((b) => b.path === 'output.dec03' && b.reason.includes('multipleOf'))
    ).toBe(true);
  });

  it('handles scientific-notation and invalid multipleOf values cleanly', () => {
    const baseSnap: ApiContractSnapshot = {
      schemaVersion: 1,
      version: '0.0.0',
      procedures: {
        p: {
          type: 'query',
          inputOptional: false,
          input: {
            type: 'object',
            properties: {
              sci: { type: 'number', multipleOf: 1e-7 },
              zero: { type: 'number', multipleOf: 0 },
              neg: { type: 'number', multipleOf: -2 },
              str: { type: 'number', multipleOf: '5' as unknown as number },
              nan: { type: 'number', multipleOf: Number.NaN },
            },
          },
          output: { type: 'number', multipleOf: 5e-8 },
        },
      },
    };
    const compatSnap: ApiContractSnapshot = {
      schemaVersion: 1,
      version: '0.0.0',
      procedures: {
        p: {
          type: 'query',
          inputOptional: false,
          input: {
            type: 'object',
            properties: {
              sci: { type: 'number', multipleOf: 5e-8 },
              zero: { type: 'number' },
              neg: { type: 'number' },
              str: { type: 'number' },
              nan: { type: 'number' },
            },
          },
          output: { type: 'number', multipleOf: 1e-7 },
        },
      },
    };
    const compatDiff = detectBreakingContractChanges(baseSnap, compatSnap);
    expect(compatDiff.breaking).toEqual([]);
    expect(compatDiff.nonBreaking.some((m) => m.includes('input multipleOf loosened'))).toBe(true);
    expect(compatDiff.nonBreaking.some((m) => m.includes('output multipleOf tightened'))).toBe(
      true
    );

    const breakingSnap: ApiContractSnapshot = {
      schemaVersion: 1,
      version: '0.0.0',
      procedures: {
        p: {
          type: 'query',
          inputOptional: false,
          input: {
            type: 'object',
            properties: {
              sci: { type: 'number', multipleOf: 2e-7 },
              zero: { type: 'number' },
              neg: { type: 'number' },
              str: { type: 'number' },
              nan: { type: 'number' },
            },
          },
          output: { type: 'number', multipleOf: 2e-8 },
        },
      },
    };
    const badDiff = detectBreakingContractChanges(baseSnap, breakingSnap);
    expect(
      badDiff.breaking.some((b) => b.path === 'input.sci' && b.reason.includes('multipleOf'))
    ).toBe(true);
    expect(
      badDiff.breaking.some((b) => b.path === 'output' && b.reason.includes('multipleOf'))
    ).toBe(true);
  });

  it('detects output pattern removal, change, and addition', () => {
    const base = router({
      items: router({
        op: publicProcedure
          .output(
            z.object({
              removedPat: z.string().regex(/^[a-z]+$/),
              changedPat: z.string().regex(/^[a-z]+$/),
              samePat: z.string().regex(/^[a-z]+$/),
              addedPat: z.string(),
            })
          )
          .query(() => ({
            removedPat: 'abc',
            changedPat: 'abc',
            samePat: 'abc',
            addedPat: 'abc',
          })),
      }),
    });

    const compatHead = router({
      items: router({
        op: publicProcedure
          .output(
            z.object({
              removedPat: z.string().regex(/^[a-z]+$/),
              changedPat: z.string().regex(/^[a-z]+$/),
              samePat: z.string().regex(/^[a-z]+$/),
              addedPat: z.string().regex(/^[a-z]+$/),
            })
          )
          .query(() => ({
            removedPat: 'abc',
            changedPat: 'abc',
            samePat: 'abc',
            addedPat: 'abc',
          })),
      }),
    });
    const compatDiff = detectBreakingContractChanges(snapshotFrom(base), snapshotFrom(compatHead));
    expect(compatDiff.breaking).toEqual([]);
    expect(compatDiff.nonBreaking.some((m) => m.includes('output pattern added'))).toBe(true);

    const brokenHead = router({
      items: router({
        op: publicProcedure
          .output(
            z.object({
              removedPat: z.string(),
              changedPat: z.string().regex(/^[0-9]+$/),
              samePat: z.string().regex(/^[a-z]+$/),
              addedPat: z.string(),
            })
          )
          .query(() => ({
            removedPat: 'abc',
            changedPat: '123',
            samePat: 'abc',
            addedPat: 'abc',
          })),
      }),
    });
    const badDiff = detectBreakingContractChanges(snapshotFrom(base), snapshotFrom(brokenHead));
    expect(
      badDiff.breaking.some((b) => b.path === 'output.removedPat' && b.reason.includes('pattern'))
    ).toBe(true);
    expect(
      badDiff.breaking.some((b) => b.path === 'output.changedPat' && b.reason.includes('pattern'))
    ).toBe(true);
  });

  it('detects tuple .rest() items, raw array items transitions, and z.record propertyNames/additionalProperties', () => {
    const base = router({
      items: router({
        op: publicProcedure
          .input(
            z.object({
              restType: z.tuple([z.string()]).rest(z.number()),
              restBound: z.tuple([z.string()]).rest(z.number().min(0)),
              fixedToRest: z.tuple([z.string()]),
              restToFixed: z.tuple([z.string()]).rest(z.number()),
              recEnum: z.record(z.enum(['a', 'b']), z.number()),
              recStr: z.record(z.string(), z.number()),
              recMin: z.record(z.string().min(2), z.number()),
              plainObj: z.looseObject({}),
            })
          )
          .output(
            z.object({
              restType: z.tuple([z.string()]).rest(z.number()),
              fixedToRest: z.tuple([z.string()]),
              restToFixed: z.tuple([z.string()]).rest(z.number()),
              recEnum: z.record(z.enum(['a']), z.number()),
              recStr: z.record(z.string(), z.number()),
              recMin: z.record(z.string().min(2), z.number()),
              recVal: z.record(z.string(), z.number()),
              openObj: z.looseObject({ a: z.string() }),
              strictObj: z.strictObject({ a: z.string() }),
            })
          )
          .query(() => ({
            restType: ['x', 1] as [string, ...number[]],
            fixedToRest: ['x'] as [string],
            restToFixed: ['x', 1] as [string, ...number[]],
            recEnum: { a: 1 },
            recStr: {},
            recMin: {},
            recVal: {},
            openObj: { a: 'x' },
            strictObj: { a: 'x' },
          })),
      }),
    });

    const compatHead = router({
      items: router({
        op: publicProcedure
          .input(
            z.object({
              restType: z.tuple([z.string()]).rest(z.number()),
              restBound: z.tuple([z.string()]).rest(z.number().min(0)),
              fixedToRest: z.tuple([z.string()]).rest(z.number()),
              restToFixed: z.tuple([z.string()]).rest(z.number()),
              recEnum: z.record(z.enum(['a', 'b']), z.number()),
              recStr: z.record(z.string(), z.number()),
              recMin: z.record(z.string(), z.number()),
              plainObj: z.looseObject({}),
            })
          )
          .output(
            z.object({
              restType: z.tuple([z.string()]).rest(z.number()),
              fixedToRest: z.tuple([z.string()]),
              restToFixed: z.tuple([z.string()]),
              recEnum: z.record(z.enum(['a']), z.number()),
              recStr: z.record(z.string().min(2), z.number()),
              recMin: z.record(z.string().min(2), z.number()),
              recVal: z.record(z.string(), z.number()),
              openObj: z.strictObject({ a: z.string() }),
              strictObj: z.strictObject({ a: z.string() }),
            })
          )
          .query(() => ({
            restType: ['x', 1] as [string, ...number[]],
            fixedToRest: ['x'] as [string],
            restToFixed: ['x'] as [string],
            recEnum: { a: 1 },
            recStr: {},
            recMin: {},
            recVal: {},
            openObj: { a: 'x' },
            strictObj: { a: 'x' },
          })),
      }),
    });
    const compatDiff = detectBreakingContractChanges(snapshotFrom(base), snapshotFrom(compatHead));
    expect(compatDiff.breaking).toEqual([]);

    const breakingHead = router({
      items: router({
        op: publicProcedure
          .input(
            z.object({
              restType: z.tuple([z.string()]).rest(z.boolean()),
              restBound: z.tuple([z.string()]).rest(z.number().min(5)),
              fixedToRest: z.tuple([z.string()]),
              restToFixed: z.tuple([z.string()]),
              recEnum: z.record(z.enum(['a']), z.number()),
              recStr: z.record(z.string().min(2), z.number()),
              recMin: z.record(z.string().min(2), z.number()),
              plainObj: z.record(z.string().min(2), z.number()),
            })
          )
          .output(
            z.object({
              restType: z.tuple([z.string()]).rest(z.boolean()),
              fixedToRest: z.tuple([z.string()]).rest(z.number()),
              restToFixed: z.tuple([z.string()]).rest(z.number()),
              recEnum: z.record(z.enum(['a', 'b']), z.number()),
              recStr: z.record(z.string(), z.number()),
              recMin: z.record(z.string(), z.number()),
              recVal: z.record(z.string(), z.boolean()),
              openObj: z.looseObject({ a: z.string() }),
              strictObj: z.looseObject({ a: z.string() }),
            })
          )
          .query(() => ({
            restType: ['x', true] as [string, ...boolean[]],
            fixedToRest: ['x', 1] as [string, ...number[]],
            restToFixed: ['x', 1] as [string, ...number[]],
            recEnum: { a: 1, b: 2 },
            recStr: {},
            recMin: {},
            recVal: {},
            openObj: { a: 'x' },
            strictObj: { a: 'x' },
          })),
      }),
    });
    const badDiff = detectBreakingContractChanges(snapshotFrom(base), snapshotFrom(breakingHead));
    expect(badDiff.breaking.some((b) => b.path === 'input.restType[...]')).toBe(true);
    expect(badDiff.breaking.some((b) => b.path === 'input.restBound[...]')).toBe(true);
    expect(badDiff.breaking.some((b) => b.path === 'input.restToFixed')).toBe(true);
    expect(badDiff.breaking.some((b) => b.path === 'input.recEnum.<key>')).toBe(true);
    expect(badDiff.breaking.some((b) => b.path === 'input.recStr.<key>')).toBe(true);
    expect(badDiff.breaking.some((b) => b.path === 'input.plainObj.<key>')).toBe(true);
    expect(badDiff.breaking.some((b) => b.path === 'output.restType[...]')).toBe(true);
    expect(badDiff.breaking.some((b) => b.path === 'output.fixedToRest')).toBe(true);
    expect(badDiff.breaking.some((b) => b.path === 'output.recEnum.<key>')).toBe(true);
    expect(badDiff.breaking.some((b) => b.path === 'output.recMin.<key>')).toBe(true);
    expect(badDiff.breaking.some((b) => b.path === 'output.recVal.*')).toBe(true);
    expect(badDiff.breaking.some((b) => b.path === 'output.strictObj')).toBe(true);
  });

  it('handles raw array items and object additionalProperties schema transitions', () => {
    const baseSnap: ApiContractSnapshot = {
      schemaVersion: 1,
      version: '0.0.0',
      procedures: {
        compat: {
          type: 'query',
          inputOptional: false,
          input: {
            type: 'object',
            properties: {
              dropItemSchema: { type: 'array', items: { type: 'string' } },
              dropAPSchema: { type: 'object', additionalProperties: { type: 'string' } },
            },
          },
          output: {
            type: 'object',
            properties: {
              addItemSchema: { type: 'array' },
              addAPSchema: { type: 'object' },
            },
          },
        },
        broken: {
          type: 'query',
          inputOptional: false,
          input: {
            type: 'object',
            properties: {
              addItemSchema: { type: 'array' },
            },
          },
          output: {
            type: 'object',
            properties: {
              dropItemSchema: { type: 'array', items: { type: 'string' } },
              dropAPSchema: { type: 'object', additionalProperties: { type: 'string' } },
            },
          },
        },
      },
    };
    const headSnap: ApiContractSnapshot = {
      schemaVersion: 1,
      version: '0.0.0',
      procedures: {
        compat: {
          type: 'query',
          inputOptional: false,
          input: {
            type: 'object',
            properties: {
              dropItemSchema: { type: 'array' },
              dropAPSchema: { type: 'object' },
            },
          },
          output: {
            type: 'object',
            properties: {
              addItemSchema: { type: 'array', items: { type: 'string' } },
              addAPSchema: { type: 'object', additionalProperties: { type: 'string' } },
            },
          },
        },
        broken: {
          type: 'query',
          inputOptional: false,
          input: {
            type: 'object',
            properties: {
              addItemSchema: { type: 'array', items: { type: 'string' } },
            },
          },
          output: {
            type: 'object',
            properties: {
              dropItemSchema: { type: 'array' },
              dropAPSchema: { type: 'object' },
            },
          },
        },
      },
    };
    const diff = detectBreakingContractChanges(baseSnap, headSnap);
    expect(diff.breaking.some((b) => b.procedure === 'compat')).toBe(false);
    expect(
      diff.breaking.some((b) => b.procedure === 'broken' && b.path === 'input.addItemSchema[]')
    ).toBe(true);
    expect(
      diff.breaking.some((b) => b.procedure === 'broken' && b.path === 'output.dropItemSchema[]')
    ).toBe(true);
    expect(
      diff.breaking.some((b) => b.procedure === 'broken' && b.path === 'output.dropAPSchema.*')
    ).toBe(true);
  });

  it('distinguishes exclusive oneOf (z.xor) from inclusive anyOf on input union evolution (#97)', () => {
    const xorBaseRouter = router({
      items: router({
        byDisc: publicProcedure
          .input(
            z.xor([
              z.object({ kind: z.literal('a'), val: z.string() }),
              z.object({ kind: z.literal('b'), num: z.number() }),
            ])
          )
          .query(() => ({ ok: true })),
        byPrim: publicProcedure
          .input(z.xor([z.string().min(1).max(3), z.number().int().min(1).max(10)]))
          .query(() => ({ ok: true })),
        byTuple: publicProcedure
          .input(z.xor([z.tuple([z.string()]), z.tuple([z.number()])]))
          .query(() => ({ ok: true })),
        alreadyOverlapping: publicProcedure
          .input(z.xor([z.object({ a: z.string() }), z.object({ b: z.string() })]))
          .query(() => ({ ok: true })),
        inclusive: publicProcedure
          .input(z.union([z.string().min(1), z.number()]))
          .query(() => ({ ok: true })),
      }),
    });

    // Adding disjoint branches to z.xor (and reordering unchanged overlapping z.xor, or adding overlapping branch to z.union) is non-breaking.
    const disjointHead = router({
      items: router({
        byDisc: publicProcedure
          .input(
            z.xor([
              z.object({ kind: z.literal('a'), val: z.string() }),
              z.object({ kind: z.literal('b'), num: z.number() }),
              z.object({ kind: z.literal('c'), flag: z.boolean() }),
            ])
          )
          .query(() => ({ ok: true })),
        byPrim: publicProcedure
          .input(
            z.xor([
              z.string().min(1).max(3),
              z.number().int().min(1).max(10),
              z.string().min(5),
              z.number().int().min(20),
              z.boolean(),
            ])
          )
          .query(() => ({ ok: true })),
        byTuple: publicProcedure
          .input(z.xor([z.tuple([z.string()]), z.tuple([z.number()]), z.tuple([z.boolean()])]))
          .query(() => ({ ok: true })),
        alreadyOverlapping: publicProcedure
          .input(z.xor([z.object({ b: z.string() }), z.object({ a: z.string() })]))
          .query(() => ({ ok: true })),
        inclusive: publicProcedure
          .input(z.union([z.string().min(1), z.number(), z.string().max(10)]))
          .query(() => ({ ok: true })),
      }),
    });

    const compatDiff = detectBreakingContractChanges(
      snapshotFrom(xorBaseRouter),
      snapshotFrom(disjointHead)
    );
    expect(compatDiff.breaking).toEqual([]);

    // Adding overlapping branches to z.xor or switching overlapping anyOf -> oneOf breaks previously accepted inputs.
    const overlappingHead = router({
      items: router({
        byDisc: publicProcedure
          .input(
            z.xor([
              z.object({ kind: z.literal('a'), val: z.string() }),
              z.object({ kind: z.literal('b'), num: z.number() }),
              z.object({ val: z.string() }), // overlaps kind='a' branch!
            ])
          )
          .query(() => ({ ok: true })),
        byPrim: publicProcedure
          .input(
            z.xor([
              z.string().min(1).max(3),
              z.number().int().min(1).max(10),
              z.string().min(2), // overlaps length 2..3!
            ])
          )
          .query(() => ({ ok: true })),
        byTuple: publicProcedure
          .input(
            z.xor([
              z.tuple([z.string()]),
              z.tuple([z.number()]),
              z.array(z.string()).min(1).max(2), // overlaps [string] tuple!
            ])
          )
          .query(() => ({ ok: true })),
        alreadyOverlapping: publicProcedure
          .input(
            z.xor([
              z.object({ a: z.string() }),
              z.object({ b: z.string() }),
              z.object({ c: z.string().optional() }), // new branch overlapping both!
            ])
          )
          .query(() => ({ ok: true })),
        inclusive: publicProcedure
          .input(z.xor([z.string().min(1), z.number(), z.string().max(10)]))
          .query(() => ({ ok: true })),
      }),
    });

    const overlapDiff = detectBreakingContractChanges(
      snapshotFrom(xorBaseRouter),
      snapshotFrom(overlappingHead)
    );
    expect(new Set(overlapDiff.breaking.map((b) => b.procedure))).toEqual(
      new Set([
        'items.alreadyOverlapping',
        'items.byDisc',
        'items.byPrim',
        'items.byTuple',
        'items.inclusive',
      ])
    );
    for (const item of overlapDiff.breaking) {
      expect(item.reason).toContain('oneOf');
    }
  });

  it('handles additional oneOf overlap edge cases (enums, strict objects, nullability, numeric bounds, catchalls)', () => {
    const baseSnap: ApiContractSnapshot = {
      schemaVersion: 1,
      version: '0.0.0',
      procedures: {
        disjointStrict: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [
              {
                type: 'object',
                properties: { a: { type: 'string' } },
                required: ['a'],
                additionalProperties: false,
              },
              {
                type: 'object',
                properties: { b: { type: 'number' } },
                required: ['b'],
                additionalProperties: false,
              },
            ],
          },
          output: null,
        },
        disjointCatchall: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [
              {
                type: 'object',
                properties: { a: { type: 'number' } },
                required: ['a'],
                additionalProperties: { type: 'number' },
              },
            ],
          },
          output: null,
        },
        enumXor: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [
              { type: 'string', enum: ['red', 'blue'] },
              { type: 'integer', minimum: 1, maximum: 5, multipleOf: 2 },
            ],
          },
          output: null,
        },
        nullXor: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [{ type: 'null' }, { type: 'string', pattern: '^[a-z]+$' }],
          },
          output: null,
        },
        arrayLenXor: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [{ type: 'array', minItems: 1, maxItems: 2 }],
          },
          output: null,
        },
      },
    };

    const headSnap: ApiContractSnapshot = {
      schemaVersion: 1,
      version: '0.0.0',
      procedures: {
        disjointStrict: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [
              {
                type: 'object',
                properties: { a: { type: 'string' } },
                required: ['a'],
                additionalProperties: false,
              },
              {
                type: 'object',
                properties: { b: { type: 'number' } },
                required: ['b'],
                additionalProperties: false,
              },
              {
                type: 'object',
                properties: { c: { type: 'boolean' } },
                required: ['c'],
                additionalProperties: false,
              },
            ],
          },
          output: null,
        },
        disjointCatchall: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [
              {
                type: 'object',
                properties: { a: { type: 'number' } },
                required: ['a'],
                additionalProperties: { type: 'number' },
              },
              {
                type: 'object',
                properties: { tag: { type: 'string' } },
                required: ['tag'],
                additionalProperties: { type: 'string' },
              },
            ],
          },
          output: null,
        },
        enumXor: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [
              { type: 'string', enum: ['red', 'blue'] },
              { type: 'integer', minimum: 1, maximum: 5, multipleOf: 2 },
              { type: 'string', const: 'green' },
              { type: 'integer', const: 4 }, // overlaps 1..5 multipleOf 2!
            ],
          },
          output: null,
        },
        nullXor: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [
              { type: 'null' },
              { type: 'string', pattern: '^[a-z]+$' },
              { type: 'string', const: 'abc' }, // matches ^[a-z]+$!
              { type: 'string', const: '123' }, // disjoint from ^[a-z]+$
            ],
          },
          output: null,
        },
        arrayLenXor: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [
              { type: 'array', minItems: 1, maxItems: 2 },
              { type: 'array', minItems: 3, maxItems: 4 },
            ],
          },
          output: null,
        },
      },
    };

    const diff = detectBreakingContractChanges(baseSnap, headSnap);
    expect(new Set(diff.breaking.map((b) => b.procedure))).toEqual(new Set(['enumXor', 'nullXor']));
  });

  it('exercises valueMatchesSchema and schemasCanOverlap across const/enum/union/object/numeric edge cases', () => {
    const baseSnap: ApiContractSnapshot = {
      schemaVersion: 1,
      version: '0.0.0',
      procedures: {
        disjointConsts: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [
              { const: null },
              { const: true },
              { const: [1, 2] },
              { const: { a: 'ok' } },
              { type: 'string', minLength: 3, maxLength: 5 },
              { type: 'number', exclusiveMinimum: 10, exclusiveMaximum: 20 },
              {
                anyOf: [
                  { type: 'string', const: 'u1' },
                  { type: 'string', const: 'u2' },
                ],
              },
              {
                oneOf: [
                  { type: 'number', const: 100 },
                  { type: 'number', const: 200 },
                ],
              },
            ],
          },
          output: null,
        },
        overlappingConsts: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [
              { const: { a: 'ok' } },
              { const: 'hello' },
              { type: 'number', minimum: 5 },
              { type: ['string', 'null'] },
            ],
          },
          output: null,
        },
        nestedAndBounds: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [
              { type: 'integer', maximum: 5 },
              { type: 'string', enum: ['alpha'] },
              { anyOf: [{ type: 'boolean' }, { type: 'integer', minimum: 100, maximum: 110 }] },
            ],
          },
          output: null,
        },
      },
    };

    const headSnap: ApiContractSnapshot = {
      schemaVersion: 1,
      version: '0.0.0',
      procedures: {
        disjointConsts: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [
              { const: null },
              { const: true },
              { const: [1, 2] },
              { const: { a: 'ok' } },
              { type: 'string', minLength: 3, maxLength: 5 },
              { type: 'number', exclusiveMinimum: 10, exclusiveMaximum: 20 },
              {
                anyOf: [
                  { type: 'string', const: 'u1' },
                  { type: 'string', const: 'u2' },
                ],
              },
              {
                oneOf: [
                  { type: 'number', const: 100 },
                  { type: 'number', const: 200 },
                ],
              },
              // All disjoint additions exercising every valueMatchesSchema rejection branch:
              { const: 'x' }, // too short for 3..5, not in unions/objects/arrays/booleans/null
              { const: 'too-long' }, // too long for 3..5
              { const: 10 }, // fails exclusiveMinimum: 10
              { const: 20 }, // fails exclusiveMaximum: 20
              { const: 5.5 }, // non-integer and below 10
              { type: 'integer', minimum: 1, maximum: 5 }, // disjoint from 5.5 and 10..20
              {
                type: 'object',
                properties: { a: { type: 'number' }, b: { type: 'string' } },
                required: ['a', 'b'],
                additionalProperties: false,
              },
              {
                type: 'object',
                properties: { a: { type: 'string', const: 'nope' } },
                required: ['a'],
              },
              {
                type: 'object',
                properties: { z: { type: 'string' } },
                additionalProperties: false,
              },
              { type: 'string', enum: ['zz'] },
              { type: 'boolean', const: false },
              { type: 'array', minItems: 5 },
            ],
          },
          output: null,
        },
        overlappingConsts: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [
              { const: { a: 'ok' } },
              { const: 'hello' },
              { type: 'number', minimum: 5 },
              { type: ['string', 'null'] },
              {
                type: 'object',
                properties: { a: { type: 'string' } },
                required: ['a'],
              }, // matches { a: 'ok' }
              { type: 'number', minimum: 10 }, // overlaps unbounded minimum: 5
              { type: ['boolean', 'null'] }, // overlaps nullable string|null on null
              {}, // unconstrained matches everything
            ],
          },
          output: null,
        },
        nestedAndBounds: {
          type: 'query',
          inputOptional: false,
          input: {
            oneOf: [
              { type: 'integer', maximum: 5 },
              { type: 'string', enum: ['alpha'] },
              { anyOf: [{ type: 'boolean' }, { type: 'integer', minimum: 100, maximum: 110 }] },
              { type: 'number', exclusiveMinimum: 5, maximum: 50 }, // disjoint from <= 5 and 100..110
              { type: 'null' }, // disjoint from all non-null branches (hits bRaw.type === 'null')
              { type: 'string', enum: ['beta'] }, // hits b.enum path, disjoint from ['alpha']
            ],
          },
          output: null,
        },
      },
    };

    const diff = detectBreakingContractChanges(baseSnap, headSnap);
    expect(diff.breaking.map((b) => b.procedure)).toEqual(['overlappingConsts']);
  });
});
