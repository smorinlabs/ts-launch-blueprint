// Zod/tRPC API contract snapshot builder and semantic breaking-change
// detector (D-043). Snapshot generation uses Zod v4's built-in `z.toJSONSchema`
// and explicitly records `inputOptional` per procedure because `z.toJSONSchema`
// unwraps `.optional()` at the root.
import type { AnyTRPCRouter } from '@trpc/server';
import { z } from 'zod';

import { appRouter } from './router.js';

export const CONTRACT_SCHEMA_VERSION = 1;
export const SNAPSHOT_VERSION_SENTINEL = '0.0.0';

export type JsonSchemaObject = Record<string, unknown>;

export interface ProcedureContract {
  type: 'query' | 'mutation' | 'subscription';
  inputOptional: boolean;
  input: JsonSchemaObject | null;
  output: JsonSchemaObject | null;
}

export interface ApiContractSnapshot {
  schemaVersion: number;
  version: string;
  procedures: Record<string, ProcedureContract>;
}

export interface BreakingChange {
  procedure: string;
  path: string;
  reason: string;
}

export interface ContractDiffResult {
  breaking: BreakingChange[];
  nonBreaking: string[];
}

interface ProcedureDefLike {
  type: 'query' | 'mutation' | 'subscription';
  inputs?: z.ZodType[];
  output?: z.ZodType;
}

function isOptionalZodSchema(schema: z.ZodType): boolean {
  const candidate = schema as { isOptional?: () => boolean };
  return typeof candidate.isOptional === 'function' ? candidate.isOptional() : false;
}

function toJsonSchema(schema: z.ZodType): JsonSchemaObject {
  return z.toJSONSchema(schema, { unrepresentable: 'any' }) as JsonSchemaObject;
}

/** Build a deterministic contract snapshot from a tRPC router (default: appRouter). */
export function buildApiContractSnapshot(router: AnyTRPCRouter = appRouter): ApiContractSnapshot {
  const rawProcedures = router._def.procedures as Record<string, { _def: ProcedureDefLike }>;
  const sortedNames = Object.keys(rawProcedures);
  sortedNames.sort();

  const procedures: Record<string, ProcedureContract> = {};
  for (const name of sortedNames) {
    const def = rawProcedures[name]!._def;
    const inputs = def.inputs ?? [];
    const inputSchema = inputs.at(-1);
    const inputOptional = inputSchema === undefined ? true : isOptionalZodSchema(inputSchema);
    procedures[name] = {
      type: def.type,
      inputOptional,
      input: inputSchema === undefined ? null : toJsonSchema(inputSchema),
      output: def.output === undefined ? null : toJsonSchema(def.output),
    };
  }

  return {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    version: SNAPSHOT_VERSION_SENTINEL,
    procedures,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isRecord(a) && isRecord(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    return (
      keysA.length === keysB.length &&
      keysA.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]))
    );
  }
  return false;
}

function isNullableSchema(schema: JsonSchemaObject): boolean {
  if (schema['type'] === 'null') {
    return true;
  }
  if (Array.isArray(schema['type']) && schema['type'].includes('null')) {
    return true;
  }
  for (const unionKey of ['anyOf', 'oneOf'] as const) {
    const branches = schema[unionKey];
    if (Array.isArray(branches) && branches.some((b) => isRecord(b) && b['type'] === 'null')) {
      return true;
    }
  }
  return false;
}

function unwrapNullableSchema(schema: JsonSchemaObject): JsonSchemaObject {
  for (const unionKey of ['anyOf', 'oneOf'] as const) {
    const branches = schema[unionKey];
    if (Array.isArray(branches)) {
      const nonNull = branches.filter((b) => !(isRecord(b) && b['type'] === 'null'));
      if (nonNull.length === 1 && isRecord(nonNull[0])) {
        return nonNull[0];
      }
      if (nonNull.length > 1 && nonNull.length < branches.length) {
        return { ...schema, [unionKey]: nonNull };
      }
    }
  }
  if (Array.isArray(schema['type'])) {
    const nonNull = schema['type'].filter((t) => t !== 'null');
    if (nonNull.length === 1) {
      return { ...schema, type: nonNull[0] };
    }
    if (nonNull.length > 1 && nonNull.length < schema['type'].length) {
      return { ...schema, type: nonNull };
    }
  }
  return schema;
}

function unionBranchesOf(schema: JsonSchemaObject): JsonSchemaObject[] | null {
  for (const unionKey of ['anyOf', 'oneOf'] as const) {
    const branches = schema[unionKey];
    if (Array.isArray(branches)) {
      const nonNull = branches.filter(
        (b): b is JsonSchemaObject => isRecord(b) && b['type'] !== 'null'
      );
      if (nonNull.length > 0) {
        return nonNull;
      }
    }
  }
  if (Array.isArray(schema['type'])) {
    const nonNull = schema['type'].filter(
      (t): t is string => typeof t === 'string' && t !== 'null'
    );
    if (nonNull.length > 1) {
      return nonNull.map((t) => ({ type: t }));
    }
  }
  return null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function propertiesOf(schema: JsonSchemaObject): Record<string, JsonSchemaObject> {
  const props = schema['properties'];
  if (!isRecord(props)) {
    return {};
  }
  const out: Record<string, JsonSchemaObject> = {};
  for (const [k, v] of Object.entries(props)) {
    if (isRecord(v)) {
      out[k] = v;
    }
  }
  return out;
}

function compareInputSchema(
  procedure: string,
  path: string,
  baseRaw: JsonSchemaObject,
  headRaw: JsonSchemaObject,
  breaking: BreakingChange[],
  nonBreaking: string[]
): void {
  if (isNullableSchema(baseRaw) && !isNullableSchema(headRaw)) {
    breaking.push({ procedure, path, reason: 'Input is no longer nullable' });
  }
  const base = unwrapNullableSchema(baseRaw);
  const head = unwrapNullableSchema(headRaw);

  const baseBranches = unionBranchesOf(base);
  const headBranches = unionBranchesOf(head);
  if (baseBranches !== null || headBranches !== null) {
    const bList = baseBranches ?? [base];
    const hList = headBranches ?? [head];
    const allBaseAccepted = bList.every((bBranch) =>
      hList.some((hBranch) => {
        const probeBreaking: BreakingChange[] = [];
        compareInputSchema(procedure, path, bBranch, hBranch, probeBreaking, []);
        return probeBreaking.length === 0;
      })
    );
    if (!allBaseAccepted) {
      breaking.push({
        procedure,
        path,
        reason: 'Input union narrowed or branch became incompatible',
      });
    } else if (hList.length > bList.length) {
      nonBreaking.push(`${procedure} ${path}: input union widened`);
    }
    return;
  }

  if (base['type'] !== head['type']) {
    const widenedToNumber = base['type'] === 'integer' && head['type'] === 'number';
    if (!widenedToNumber) {
      breaking.push({
        procedure,
        path,
        reason: `Input type changed from ${String(base['type'])} to ${String(head['type'])}`,
      });
      return;
    }
    nonBreaking.push(`${procedure} ${path}: input integer widened to number`);
  }

  for (const bound of ['minimum', 'exclusiveMinimum', 'minLength', 'minItems'] as const) {
    const bVal = numberOrUndefined(base[bound]);
    const hVal = numberOrUndefined(head[bound]);
    if (hVal !== undefined && (bVal === undefined || hVal > bVal)) {
      breaking.push({
        procedure,
        path,
        reason: `Input ${bound} narrowed (${String(bVal)} -> ${hVal})`,
      });
    } else if (bVal !== undefined && (hVal === undefined || hVal < bVal)) {
      nonBreaking.push(`${procedure} ${path}: input ${bound} loosened`);
    }
  }

  for (const bound of ['maximum', 'exclusiveMaximum', 'maxLength', 'maxItems'] as const) {
    const bVal = numberOrUndefined(base[bound]);
    const hVal = numberOrUndefined(head[bound]);
    if (hVal !== undefined && (bVal === undefined || hVal < bVal)) {
      breaking.push({
        procedure,
        path,
        reason: `Input ${bound} narrowed (${String(bVal)} -> ${hVal})`,
      });
    } else if (bVal !== undefined && (hVal === undefined || hVal > bVal)) {
      nonBreaking.push(`${procedure} ${path}: input ${bound} loosened`);
    }
  }

  const hasBaseConst = Object.hasOwn(base, 'const');
  const hasHeadConst = Object.hasOwn(head, 'const');
  if (hasBaseConst && hasHeadConst) {
    if (!deepEqual(base['const'], head['const'])) {
      breaking.push({
        procedure,
        path,
        reason: `Input const literal changed from ${JSON.stringify(base['const'])} to ${JSON.stringify(head['const'])}`,
      });
    }
  } else if (!hasBaseConst && hasHeadConst) {
    const sameSingleEnum =
      Array.isArray(base['enum']) &&
      base['enum'].length === 1 &&
      deepEqual(base['enum'][0], head['const']);
    if (!sameSingleEnum) {
      breaking.push({
        procedure,
        path,
        reason: `Input restricted to const literal ${JSON.stringify(head['const'])}`,
      });
    }
  } else if (hasBaseConst && !hasHeadConst) {
    if (Array.isArray(head['enum']) && !head['enum'].some((v) => deepEqual(v, base['const']))) {
      breaking.push({
        procedure,
        path,
        reason: 'Input const value no longer allowed by enum',
      });
    } else {
      nonBreaking.push(`${procedure} ${path}: input const constraint loosened`);
    }
  } else if (Array.isArray(head['enum'])) {
    if (!Array.isArray(base['enum'])) {
      breaking.push({ procedure, path, reason: 'Input restricted to enum values' });
    } else {
      const allowed = new Set(head['enum']);
      for (const val of base['enum']) {
        if (!allowed.has(val)) {
          breaking.push({ procedure, path, reason: 'Input enum value removed' });
          break;
        }
      }
    }
  }

  if (base['type'] === 'object' && head['type'] === 'object') {
    if (base['additionalProperties'] !== false && head['additionalProperties'] === false) {
      breaking.push({
        procedure,
        path,
        reason: 'Input no longer allows additional properties',
      });
    } else if (base['additionalProperties'] === false && head['additionalProperties'] !== false) {
      nonBreaking.push(`${procedure} ${path}: input now allows additional properties`);
    }

    const baseProps = propertiesOf(base);
    const headProps = propertiesOf(head);
    const baseReq = new Set(stringList(base['required']));
    const headReq = new Set(stringList(head['required']));

    for (const req of headReq) {
      if (!baseReq.has(req)) {
        breaking.push({
          procedure,
          path: `${path}.${req}`,
          reason: `New required input field "${req}"`,
        });
      }
    }

    const strictUnknown = head['additionalProperties'] === false;
    for (const [prop, bProp] of Object.entries(baseProps)) {
      const hProp = headProps[prop];
      if (hProp === undefined) {
        if (strictUnknown) {
          breaking.push({
            procedure,
            path: `${path}.${prop}`,
            reason: `Input property "${prop}" removed`,
          });
        }
      } else {
        compareInputSchema(procedure, `${path}.${prop}`, bProp, hProp, breaking, nonBreaking);
      }
    }

    for (const prop of Object.keys(headProps)) {
      if (baseProps[prop] === undefined && !headReq.has(prop)) {
        nonBreaking.push(`${procedure} ${path}.${prop}: optional input field added`);
      }
    }
  }

  if (
    base['type'] === 'array' &&
    head['type'] === 'array' &&
    isRecord(base['items']) &&
    isRecord(head['items'])
  ) {
    compareInputSchema(procedure, `${path}[]`, base['items'], head['items'], breaking, nonBreaking);
  }
}

function compareOutputSchema(
  procedure: string,
  path: string,
  baseRaw: JsonSchemaObject,
  headRaw: JsonSchemaObject,
  breaking: BreakingChange[],
  nonBreaking: string[]
): void {
  if (!isNullableSchema(baseRaw) && isNullableSchema(headRaw)) {
    breaking.push({ procedure, path, reason: 'Output became nullable' });
  }
  const base = unwrapNullableSchema(baseRaw);
  const head = unwrapNullableSchema(headRaw);

  const baseBranches = unionBranchesOf(base);
  const headBranches = unionBranchesOf(head);
  if (baseBranches !== null || headBranches !== null) {
    const bList = baseBranches ?? [base];
    const hList = headBranches ?? [head];
    const allHeadCompatible = hList.every((hBranch) =>
      bList.some((bBranch) => {
        const probeBreaking: BreakingChange[] = [];
        compareOutputSchema(procedure, path, bBranch, hBranch, probeBreaking, []);
        return probeBreaking.length === 0;
      })
    );
    if (!allHeadCompatible) {
      breaking.push({
        procedure,
        path,
        reason: 'Output union widened or branch became incompatible',
      });
    } else if (hList.length < bList.length) {
      nonBreaking.push(`${procedure} ${path}: output union narrowed`);
    }
    return;
  }

  if (base['type'] !== head['type']) {
    breaking.push({
      procedure,
      path,
      reason: `Output type changed from ${String(base['type'])} to ${String(head['type'])}`,
    });
    return;
  }

  const hasBaseConst = Object.hasOwn(base, 'const');
  const hasHeadConst = Object.hasOwn(head, 'const');
  if (hasBaseConst && hasHeadConst) {
    if (!deepEqual(base['const'], head['const'])) {
      breaking.push({
        procedure,
        path,
        reason: `Output const literal changed from ${JSON.stringify(base['const'])} to ${JSON.stringify(head['const'])}`,
      });
    }
  } else if (hasBaseConst && !hasHeadConst) {
    const sameSingleEnum =
      Array.isArray(head['enum']) &&
      head['enum'].length === 1 &&
      deepEqual(head['enum'][0], base['const']);
    if (!sameSingleEnum) {
      breaking.push({
        procedure,
        path,
        reason: `Output const literal ${JSON.stringify(base['const'])} removed`,
      });
    }
  } else if (!hasBaseConst && hasHeadConst) {
    if (Array.isArray(base['enum']) && !base['enum'].some((v) => deepEqual(v, head['const']))) {
      breaking.push({
        procedure,
        path,
        reason: 'Output const literal outside previous enum',
      });
    } else {
      nonBreaking.push(`${procedure} ${path}: output narrowed to const literal`);
    }
  } else if (Array.isArray(base['enum'])) {
    if (!Array.isArray(head['enum'])) {
      breaking.push({ procedure, path, reason: 'Output enum constraint removed' });
    } else {
      const baseAllowed = new Set(base['enum']);
      for (const val of head['enum']) {
        if (!baseAllowed.has(val)) {
          breaking.push({ procedure, path, reason: 'Output enum widened with new value' });
          break;
        }
      }
    }
  } else if (Array.isArray(head['enum'])) {
    nonBreaking.push(`${procedure} ${path}: output narrowed to enum`);
  }

  if (base['type'] === 'object' && head['type'] === 'object') {
    const baseProps = propertiesOf(base);
    const headProps = propertiesOf(head);
    const baseReq = stringList(base['required']);
    const headReq = new Set(stringList(head['required']));

    for (const [prop, bProp] of Object.entries(baseProps)) {
      const hProp = headProps[prop];
      if (hProp === undefined) {
        breaking.push({
          procedure,
          path: `${path}.${prop}`,
          reason: `Output property "${prop}" removed`,
        });
      } else {
        compareOutputSchema(procedure, `${path}.${prop}`, bProp, hProp, breaking, nonBreaking);
      }
    }

    for (const req of baseReq) {
      if (!headReq.has(req)) {
        breaking.push({
          procedure,
          path: `${path}.${req}`,
          reason: `Output property "${req}" became optional`,
        });
      }
    }

    for (const prop of Object.keys(headProps)) {
      if (baseProps[prop] === undefined) {
        nonBreaking.push(`${procedure} ${path}.${prop}: output property added`);
      }
    }
  }

  if (
    base['type'] === 'array' &&
    head['type'] === 'array' &&
    isRecord(base['items']) &&
    isRecord(head['items'])
  ) {
    compareOutputSchema(
      procedure,
      `${path}[]`,
      base['items'],
      head['items'],
      breaking,
      nonBreaking
    );
  }
}

/** Compare base vs. head API contract snapshots and classify breaking changes. */
export function detectBreakingContractChanges(
  base: ApiContractSnapshot,
  head: ApiContractSnapshot
): ContractDiffResult {
  const breaking: BreakingChange[] = [];
  const nonBreaking: string[] = [];

  for (const [name, baseProc] of Object.entries(base.procedures)) {
    const headProc = head.procedures[name];
    if (headProc === undefined) {
      breaking.push({ procedure: name, path: name, reason: 'Procedure removed' });
      continue;
    }
    if (baseProc.type !== headProc.type) {
      breaking.push({
        procedure: name,
        path: name,
        reason: `Procedure type changed from ${baseProc.type} to ${headProc.type}`,
      });
    }
    if (baseProc.inputOptional && !headProc.inputOptional) {
      breaking.push({
        procedure: name,
        path: 'input',
        reason: 'Procedure input is no longer optional',
      });
    }
    if (baseProc.input !== null && headProc.input !== null) {
      compareInputSchema(name, 'input', baseProc.input, headProc.input, breaking, nonBreaking);
    } else if (baseProc.input !== null && headProc.input === null) {
      nonBreaking.push(`${name}: input constraint removed`);
    } else if (baseProc.input === null && headProc.input !== null && headProc.inputOptional) {
      nonBreaking.push(`${name}: optional input schema added`);
    }

    if (baseProc.output !== null && headProc.output === null) {
      breaking.push({ procedure: name, path: 'output', reason: 'Output schema removed' });
    } else if (baseProc.output !== null && headProc.output !== null) {
      compareOutputSchema(name, 'output', baseProc.output, headProc.output, breaking, nonBreaking);
    }
  }

  for (const name of Object.keys(head.procedures)) {
    if (base.procedures[name] === undefined) {
      nonBreaking.push(`${name}: procedure added`);
    }
  }

  return { breaking, nonBreaking };
}
