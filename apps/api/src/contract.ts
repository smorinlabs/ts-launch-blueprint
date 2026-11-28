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

function toJsonSchema(schema: z.ZodType, io: 'input' | 'output'): JsonSchemaObject {
  return z.toJSONSchema(schema, { io, unrepresentable: 'any' }) as JsonSchemaObject;
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
    if (inputs.length > 1) {
      throw new Error(
        `Procedure "${name}" chains ${inputs.length} input validators; contract snapshot v1 supports at most 1 input validator`
      );
    }
    const inputSchema = inputs[0];
    const inputOptional = inputSchema === undefined ? true : isOptionalZodSchema(inputSchema);
    procedures[name] = {
      type: def.type,
      inputOptional,
      input: inputSchema === undefined ? null : toJsonSchema(inputSchema, 'input'),
      output: def.output === undefined ? null : toJsonSchema(def.output, 'output'),
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

interface UnionInfo {
  kind: 'anyOf' | 'oneOf';
  branches: JsonSchemaObject[];
}

function unionInfoOf(schema: JsonSchemaObject): UnionInfo | null {
  for (const unionKey of ['oneOf', 'anyOf'] as const) {
    const branches = schema[unionKey];
    if (Array.isArray(branches)) {
      const nonNull = branches.filter(
        (b): b is JsonSchemaObject => isRecord(b) && b['type'] !== 'null'
      );
      if (nonNull.length > 0) {
        return { kind: unionKey, branches: nonNull };
      }
    }
  }
  if (Array.isArray(schema['type'])) {
    const nonNull = schema['type'].filter(
      (t): t is string => typeof t === 'string' && t !== 'null'
    );
    if (nonNull.length > 1) {
      return { kind: 'anyOf', branches: nonNull.map((t) => ({ type: t })) };
    }
  }
  return null;
}

function unionBranchesOf(schema: JsonSchemaObject): JsonSchemaObject[] | null {
  return unionInfoOf(schema)?.branches ?? null;
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

interface EffectiveBound {
  value: number;
  inclusive: boolean;
}

function lowerNumericBound(
  schema: JsonSchemaObject,
  normalizeInt: boolean
): EffectiveBound | undefined {
  const min = numberOrUndefined(schema['minimum']);
  const exMin = numberOrUndefined(schema['exclusiveMinimum']);
  const candidates: EffectiveBound[] = [];
  if (min !== undefined) {
    candidates.push({ value: min, inclusive: true });
  }
  if (exMin !== undefined) {
    if (normalizeInt && Number.isInteger(exMin)) {
      candidates.push({ value: exMin + 1, inclusive: true });
    } else {
      candidates.push({ value: exMin, inclusive: false });
    }
  }
  if (candidates.length === 0) {
    return undefined;
  }
  return candidates.reduce((best, cur) => {
    if (cur.value > best.value) {
      return cur;
    }
    if (cur.value === best.value && !cur.inclusive) {
      return cur;
    }
    return best;
  });
}

function upperNumericBound(
  schema: JsonSchemaObject,
  normalizeInt: boolean
): EffectiveBound | undefined {
  const max = numberOrUndefined(schema['maximum']);
  const exMax = numberOrUndefined(schema['exclusiveMaximum']);
  const candidates: EffectiveBound[] = [];
  if (max !== undefined) {
    candidates.push({ value: max, inclusive: true });
  }
  if (exMax !== undefined) {
    if (normalizeInt && Number.isInteger(exMax)) {
      candidates.push({ value: exMax - 1, inclusive: true });
    } else {
      candidates.push({ value: exMax, inclusive: false });
    }
  }
  if (candidates.length === 0) {
    return undefined;
  }
  return candidates.reduce((best, cur) => {
    if (cur.value < best.value) {
      return cur;
    }
    if (cur.value === best.value && !cur.inclusive) {
      return cur;
    }
    return best;
  });
}

function isLowerStricter(
  head: EffectiveBound | undefined,
  base: EffectiveBound | undefined
): boolean {
  if (head === undefined) {
    return false;
  }
  if (base === undefined) {
    return true;
  }
  return (
    head.value > base.value || (head.value === base.value && !head.inclusive && base.inclusive)
  );
}

function isLowerLooser(
  head: EffectiveBound | undefined,
  base: EffectiveBound | undefined
): boolean {
  if (base === undefined) {
    return false;
  }
  if (head === undefined) {
    return true;
  }
  return (
    head.value < base.value || (head.value === base.value && head.inclusive && !base.inclusive)
  );
}

function isUpperStricter(
  head: EffectiveBound | undefined,
  base: EffectiveBound | undefined
): boolean {
  if (head === undefined) {
    return false;
  }
  if (base === undefined) {
    return true;
  }
  return (
    head.value < base.value || (head.value === base.value && !head.inclusive && base.inclusive)
  );
}

function isUpperLooser(
  head: EffectiveBound | undefined,
  base: EffectiveBound | undefined
): boolean {
  if (base === undefined) {
    return false;
  }
  if (head === undefined) {
    return true;
  }
  return (
    head.value > base.value || (head.value === base.value && head.inclusive && !base.inclusive)
  );
}

function formatBound(bound: EffectiveBound | undefined, kind: 'min' | 'max'): string {
  if (bound === undefined) {
    return 'none';
  }
  const op = kind === 'min' ? (bound.inclusive ? '>=' : '>') : bound.inclusive ? '<=' : '<';
  return `${op} ${bound.value}`;
}

function positiveMultipleOf(schema: JsonSchemaObject): number | undefined {
  const value = schema['multipleOf'];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function decimalParts(value: number): { digits: bigint; scale: number } {
  const str = value.toString().toLowerCase();
  const [mantissa, expPart] = str.split('e');
  const [intPart, fracPart = ''] = mantissa!.split('.');
  const exp = expPart === undefined ? 0 : Number.parseInt(expPart, 10);
  return {
    digits: BigInt(`${intPart}${fracPart}`),
    scale: exp - fracPart.length,
  };
}

function isDivisibleMultiple(dividend: number, divisor: number): boolean {
  const a = decimalParts(dividend);
  const b = decimalParts(divisor);
  const minScale = Math.min(a.scale, b.scale);
  const scaledA = a.digits * 10n ** BigInt(a.scale - minScale);
  const scaledB = b.digits * 10n ** BigInt(b.scale - minScale);
  return scaledA % scaledB === 0n;
}

function numericRangesOverlap(
  aLow: EffectiveBound | undefined,
  aHigh: EffectiveBound | undefined,
  bLow: EffectiveBound | undefined,
  bHigh: EffectiveBound | undefined
): boolean {
  const low = isLowerStricter(bLow, aLow) ? bLow : aLow;
  const high = isUpperStricter(bHigh, aHigh) ? bHigh : aHigh;
  if (low === undefined || high === undefined) {
    return true;
  }
  if (low.value > high.value) {
    return false;
  }
  return low.value < high.value || (low.inclusive && high.inclusive);
}

function lengthRangesOverlap(
  a: JsonSchemaObject,
  b: JsonSchemaObject,
  minKey: 'minLength' | 'minItems',
  maxKey: 'maxLength' | 'maxItems'
): boolean {
  const aMin = numberOrUndefined(a[minKey]);
  const aMax = numberOrUndefined(a[maxKey]);
  const bMin = numberOrUndefined(b[minKey]);
  const bMax = numberOrUndefined(b[maxKey]);
  if (aMin !== undefined && bMax !== undefined && aMin > bMax) {
    return false;
  }
  if (bMin !== undefined && aMax !== undefined && bMin > aMax) {
    return false;
  }
  return true;
}

function valueMatchesSchema(value: unknown, schemaRaw: JsonSchemaObject): boolean {
  if (value === null) {
    return isNullableSchema(schemaRaw);
  }
  const schema = unwrapNullableSchema(schemaRaw);
  const union = unionInfoOf(schema);
  if (union !== null) {
    const matches = union.branches.filter((b) => valueMatchesSchema(value, b)).length;
    return union.kind === 'oneOf' ? matches === 1 : matches >= 1;
  }
  if (Object.hasOwn(schema, 'const')) {
    return deepEqual(value, schema['const']);
  }
  if (Array.isArray(schema['enum'])) {
    return schema['enum'].some((v) => deepEqual(value, v));
  }
  const type = schema['type'];
  if (type === 'string') {
    if (typeof value !== 'string') {
      return false;
    }
    const minLen = numberOrUndefined(schema['minLength']);
    const maxLen = numberOrUndefined(schema['maxLength']);
    if (
      (minLen !== undefined && value.length < minLen) ||
      (maxLen !== undefined && value.length > maxLen)
    ) {
      return false;
    }
    if (typeof schema['pattern'] === 'string') {
      return new RegExp(schema['pattern']).test(value);
    }
    return true;
  }
  if (type === 'number' || type === 'integer') {
    if (typeof value !== 'number' || (type === 'integer' && !Number.isInteger(value))) {
      return false;
    }
    const low = lowerNumericBound(schema, type === 'integer');
    const high = upperNumericBound(schema, type === 'integer');
    if (low !== undefined && (value < low.value || (!low.inclusive && value === low.value))) {
      return false;
    }
    if (high !== undefined && (value > high.value || (!high.inclusive && value === high.value))) {
      return false;
    }
    const multiple = positiveMultipleOf(schema);
    return multiple === undefined || isDivisibleMultiple(value, multiple);
  }
  if (type === 'boolean') {
    return typeof value === 'boolean';
  }
  if (type === 'array') {
    return Array.isArray(value);
  }
  if (type === 'object') {
    if (!isRecord(value)) {
      return false;
    }
    const props = propertiesOf(schema);
    for (const req of stringList(schema['required'])) {
      if (!Object.hasOwn(value, req)) {
        return false;
      }
    }
    for (const [key, propVal] of Object.entries(value)) {
      const propSchema = props[key];
      if (propSchema !== undefined) {
        if (!valueMatchesSchema(propVal, propSchema)) {
          return false;
        }
      } else if (schema['additionalProperties'] === false) {
        return false;
      }
    }
    return true;
  }
  return true;
}

function requiredPropertiesCompatible(
  reqNames: string[],
  reqProps: Record<string, JsonSchemaObject>,
  other: JsonSchemaObject,
  otherProps: Record<string, JsonSchemaObject>
): boolean {
  for (const req of reqNames) {
    const reqSchema = reqProps[req];
    const otherSchema = otherProps[req];
    if (otherSchema !== undefined) {
      if (reqSchema !== undefined && !schemasCanOverlap(reqSchema, otherSchema)) {
        return false;
      }
    } else if (other['additionalProperties'] === false) {
      return false;
    } else if (
      isRecord(other['additionalProperties']) &&
      reqSchema !== undefined &&
      !schemasCanOverlap(reqSchema, other['additionalProperties'])
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Conservative overlap test for two JSON Schemas: returns `false` only when
 * the two schemas are provably disjoint (no value can match both), and `true`
 * otherwise. Used to detect breaking overlapping branches in `oneOf` unions.
 */
function schemasCanOverlap(aRaw: JsonSchemaObject, bRaw: JsonSchemaObject): boolean {
  if (aRaw['type'] === 'null') {
    return isNullableSchema(bRaw);
  }
  if (bRaw['type'] === 'null') {
    return isNullableSchema(aRaw);
  }
  if (isNullableSchema(aRaw) && isNullableSchema(bRaw)) {
    return true;
  }
  const a = unwrapNullableSchema(aRaw);
  const b = unwrapNullableSchema(bRaw);

  const aBranches = unionBranchesOf(a);
  const bBranches = unionBranchesOf(b);
  if (aBranches !== null || bBranches !== null) {
    const aList = aBranches ?? [a];
    const bList = bBranches ?? [b];
    return aList.some((ab) => bList.some((bb) => schemasCanOverlap(ab, bb)));
  }

  if (Object.hasOwn(a, 'const')) {
    return valueMatchesSchema(a['const'], b);
  }
  if (Object.hasOwn(b, 'const')) {
    return valueMatchesSchema(b['const'], a);
  }
  if (Array.isArray(a['enum'])) {
    return a['enum'].some((v) => valueMatchesSchema(v, b));
  }
  if (Array.isArray(b['enum'])) {
    return b['enum'].some((v) => valueMatchesSchema(v, a));
  }

  const aType = typeof a['type'] === 'string' ? a['type'] : undefined;
  const bType = typeof b['type'] === 'string' ? b['type'] : undefined;
  if (aType !== undefined && bType !== undefined && aType !== bType) {
    const bothNumeric =
      (aType === 'integer' && bType === 'number') || (aType === 'number' && bType === 'integer');
    if (!bothNumeric) {
      return false;
    }
  }

  if ((aType === 'number' || aType === 'integer') && (bType === 'number' || bType === 'integer')) {
    const normalizeInt = aType === 'integer' || bType === 'integer';
    return numericRangesOverlap(
      lowerNumericBound(a, normalizeInt),
      upperNumericBound(a, normalizeInt),
      lowerNumericBound(b, normalizeInt),
      upperNumericBound(b, normalizeInt)
    );
  }

  if (aType === 'string' && bType === 'string') {
    return lengthRangesOverlap(a, b, 'minLength', 'maxLength');
  }

  if (aType === 'array' && bType === 'array') {
    if (!lengthRangesOverlap(a, b, 'minItems', 'maxItems')) {
      return false;
    }
    const aPrefix = Array.isArray(a['prefixItems']) ? a['prefixItems'].filter(isRecord) : null;
    const bPrefix = Array.isArray(b['prefixItems']) ? b['prefixItems'].filter(isRecord) : null;
    if (aPrefix !== null && bPrefix !== null) {
      const shared = Math.min(aPrefix.length, bPrefix.length);
      for (let i = 0; i < shared; i += 1) {
        if (!schemasCanOverlap(aPrefix[i]!, bPrefix[i]!)) {
          return false;
        }
      }
    }
    return true;
  }

  if (aType === 'object' && bType === 'object') {
    const aProps = propertiesOf(a);
    const bProps = propertiesOf(b);
    return (
      requiredPropertiesCompatible(stringList(a['required']), aProps, b, bProps) &&
      requiredPropertiesCompatible(stringList(b['required']), bProps, a, aProps)
    );
  }

  return true;
}

function compareInputSchema(
  procedure: string,
  path: string,
  baseRaw: JsonSchemaObject,
  headRaw: JsonSchemaObject,
  breaking: BreakingChange[],
  nonBreaking: string[]
): void {
  if (deepEqual(baseRaw, headRaw)) {
    return;
  }
  if (baseRaw['type'] === 'null') {
    if (isNullableSchema(headRaw)) {
      if (headRaw['type'] !== 'null') {
        nonBreaking.push(`${procedure} ${path}: input widened from null to nullable`);
      }
      return;
    }
    breaking.push({
      procedure,
      path,
      reason: `Input type changed from null to ${String(headRaw['type'])}`,
    });
    return;
  }
  if (isNullableSchema(baseRaw) && !isNullableSchema(headRaw)) {
    breaking.push({ procedure, path, reason: 'Input is no longer nullable' });
  }
  const base = unwrapNullableSchema(baseRaw);
  const head = unwrapNullableSchema(headRaw);

  const baseUnion = unionInfoOf(base);
  const headUnion = unionInfoOf(head);
  if (baseUnion !== null || headUnion !== null) {
    const bList = baseUnion?.branches ?? [base];
    const hList = headUnion?.branches ?? [head];
    const isSubSchema = (sub: JsonSchemaObject, sup: JsonSchemaObject): boolean => {
      const probeBreaking: BreakingChange[] = [];
      compareInputSchema(procedure, path, sub, sup, probeBreaking, []);
      return probeBreaking.length === 0;
    };
    const matchedHeadIndices = bList.map((bBranch) =>
      hList.findIndex((hBranch) => isSubSchema(bBranch, hBranch))
    );
    const allBaseAccepted = matchedHeadIndices.every((idx) => idx !== -1);
    if (!allBaseAccepted) {
      breaking.push({
        procedure,
        path,
        reason: 'Input union narrowed or branch became incompatible',
      });
    } else if (headUnion?.kind === 'oneOf') {
      const hasNewOverlap = bList.some((bBranch, bIdx) => {
        const matchIdx = matchedHeadIndices[bIdx]!;
        return hList.some((hOther, hIdx) => {
          if (hIdx === matchIdx || !schemasCanOverlap(bBranch, hOther)) {
            return false;
          }
          if (
            baseUnion?.kind === 'oneOf' &&
            bList.some((bOther, bOtherIdx) => bOtherIdx !== bIdx && isSubSchema(hOther, bOther))
          ) {
            return false;
          }
          return true;
        });
      });
      if (hasNewOverlap) {
        breaking.push({
          procedure,
          path,
          reason:
            'Input oneOf union has overlapping branch that rejects previously accepted values',
        });
      } else if (hList.length > bList.length) {
        nonBreaking.push(`${procedure} ${path}: input union widened`);
      }
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

  const normalizeInt = base['type'] === 'integer' && head['type'] === 'integer';
  const bLower = lowerNumericBound(base, normalizeInt);
  const hLower = lowerNumericBound(head, normalizeInt);
  if (isLowerStricter(hLower, bLower)) {
    breaking.push({
      procedure,
      path,
      reason: `Input minimum narrowed (${formatBound(bLower, 'min')} -> ${formatBound(hLower, 'min')})`,
    });
  } else if (isLowerLooser(hLower, bLower)) {
    nonBreaking.push(`${procedure} ${path}: input minimum loosened`);
  }

  const bUpper = upperNumericBound(base, normalizeInt);
  const hUpper = upperNumericBound(head, normalizeInt);
  if (isUpperStricter(hUpper, bUpper)) {
    breaking.push({
      procedure,
      path,
      reason: `Input maximum narrowed (${formatBound(bUpper, 'max')} -> ${formatBound(hUpper, 'max')})`,
    });
  } else if (isUpperLooser(hUpper, bUpper)) {
    nonBreaking.push(`${procedure} ${path}: input maximum loosened`);
  }

  const baseMultiple = positiveMultipleOf(base);
  const headMultiple = positiveMultipleOf(head);
  if (headMultiple !== undefined) {
    if (baseMultiple === undefined) {
      breaking.push({
        procedure,
        path,
        reason: `Input multipleOf added (${headMultiple})`,
      });
    } else if (!isDivisibleMultiple(baseMultiple, headMultiple)) {
      breaking.push({
        procedure,
        path,
        reason: `Input multipleOf changed from ${baseMultiple} to ${headMultiple}`,
      });
    } else if (baseMultiple !== headMultiple) {
      nonBreaking.push(
        `${procedure} ${path}: input multipleOf loosened (${baseMultiple} -> ${headMultiple})`
      );
    }
  } else if (baseMultiple !== undefined) {
    nonBreaking.push(`${procedure} ${path}: input multipleOf removed`);
  }

  for (const bound of ['minLength', 'minItems'] as const) {
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

  for (const bound of ['maxLength', 'maxItems'] as const) {
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

  const basePattern = typeof base['pattern'] === 'string' ? base['pattern'] : undefined;
  const headPattern = typeof head['pattern'] === 'string' ? head['pattern'] : undefined;
  if (headPattern !== undefined && headPattern !== basePattern) {
    breaking.push({
      procedure,
      path,
      reason:
        basePattern === undefined
          ? `Input pattern added (${headPattern})`
          : `Input pattern changed from ${basePattern} to ${headPattern}`,
    });
  } else if (basePattern !== undefined && headPattern === undefined) {
    nonBreaking.push(`${procedure} ${path}: input pattern removed`);
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
    const baseAP = base['additionalProperties'];
    const headAP = head['additionalProperties'];
    if (baseAP !== false && headAP === false) {
      breaking.push({
        procedure,
        path,
        reason: 'Input no longer allows additional properties',
      });
    } else if (baseAP === false && headAP !== false) {
      nonBreaking.push(`${procedure} ${path}: input now allows additional properties`);
    } else if (isRecord(headAP)) {
      const effectiveBaseAP = isRecord(baseAP) ? baseAP : {};
      compareInputSchema(procedure, `${path}.*`, effectiveBaseAP, headAP, breaking, nonBreaking);
    } else if (isRecord(baseAP)) {
      nonBreaking.push(`${procedure} ${path}: input additionalProperties constraint loosened`);
    }

    if (isRecord(base['propertyNames']) || isRecord(head['propertyNames'])) {
      const effectiveBasePN = isRecord(base['propertyNames'])
        ? base['propertyNames']
        : { type: 'string' };
      const effectiveHeadPN = isRecord(head['propertyNames'])
        ? head['propertyNames']
        : { type: 'string' };
      compareInputSchema(
        procedure,
        `${path}.<key>`,
        effectiveBasePN,
        effectiveHeadPN,
        breaking,
        nonBreaking
      );
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

    const strictUnknown = headAP === false;
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

    const baseAllowsExtraExplicitly = baseAP === true || isRecord(baseAP);
    for (const [prop, hProp] of Object.entries(headProps)) {
      if (baseProps[prop] === undefined && !headReq.has(prop)) {
        if (baseAllowsExtraExplicitly) {
          const baseCatchall = isRecord(baseAP) ? baseAP : {};
          const probeBreaking: BreakingChange[] = [];
          compareInputSchema(procedure, `${path}.${prop}`, baseCatchall, hProp, probeBreaking, []);
          if (probeBreaking.length > 0) {
            breaking.push({
              procedure,
              path: `${path}.${prop}`,
              reason: `New optional input field "${prop}" narrows accepted extra properties`,
            });
            continue;
          }
        }
        nonBreaking.push(`${procedure} ${path}.${prop}: optional input field added`);
      }
    }
  }

  if (base['type'] === 'array' && head['type'] === 'array') {
    const basePrefix = Array.isArray(base['prefixItems'])
      ? base['prefixItems'].filter(isRecord)
      : null;
    const headPrefix = Array.isArray(head['prefixItems'])
      ? head['prefixItems'].filter(isRecord)
      : null;
    if (basePrefix !== null || headPrefix !== null) {
      const bTuple = basePrefix ?? [];
      const hTuple = headPrefix ?? [];
      const shared = Math.min(bTuple.length, hTuple.length);
      for (let i = 0; i < shared; i += 1) {
        compareInputSchema(
          procedure,
          `${path}[${i}]`,
          bTuple[i]!,
          hTuple[i]!,
          breaking,
          nonBreaking
        );
      }
      if (hTuple.length !== bTuple.length) {
        breaking.push({
          procedure,
          path,
          reason: `Input tuple arity changed from ${bTuple.length} to ${hTuple.length}`,
        });
      }
    }
    const baseItems = base['items'];
    const headItems = head['items'];
    const itemPath = basePrefix !== null || headPrefix !== null ? `${path}[...]` : `${path}[]`;
    if (baseItems !== false && headItems === false) {
      breaking.push({
        procedure,
        path,
        reason: 'Input array no longer allows additional items',
      });
    } else if (baseItems === false && headItems !== false) {
      nonBreaking.push(`${procedure} ${path}: input array now allows additional items`);
    } else if (isRecord(headItems)) {
      const effectiveBaseItems = isRecord(baseItems) ? baseItems : {};
      compareInputSchema(procedure, itemPath, effectiveBaseItems, headItems, breaking, nonBreaking);
    } else if (isRecord(baseItems)) {
      nonBreaking.push(`${procedure} ${path}: input items constraint loosened`);
    }
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
  if (headRaw['type'] === 'null') {
    if (isNullableSchema(baseRaw)) {
      if (baseRaw['type'] !== 'null') {
        nonBreaking.push(`${procedure} ${path}: output narrowed from nullable to null`);
      }
      return;
    }
    breaking.push({ procedure, path, reason: 'Output became nullable' });
    return;
  }
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

  const normalizeInt = base['type'] === 'integer' && head['type'] === 'integer';
  const bLower = lowerNumericBound(base, normalizeInt);
  const hLower = lowerNumericBound(head, normalizeInt);
  if (isLowerLooser(hLower, bLower)) {
    breaking.push({
      procedure,
      path,
      reason: `Output minimum weakened (${formatBound(bLower, 'min')} -> ${formatBound(hLower, 'min')})`,
    });
  } else if (isLowerStricter(hLower, bLower)) {
    nonBreaking.push(`${procedure} ${path}: output minimum tightened`);
  }

  const bUpper = upperNumericBound(base, normalizeInt);
  const hUpper = upperNumericBound(head, normalizeInt);
  if (isUpperLooser(hUpper, bUpper)) {
    breaking.push({
      procedure,
      path,
      reason: `Output maximum weakened (${formatBound(bUpper, 'max')} -> ${formatBound(hUpper, 'max')})`,
    });
  } else if (isUpperStricter(hUpper, bUpper)) {
    nonBreaking.push(`${procedure} ${path}: output maximum tightened`);
  }

  const baseMultiple = positiveMultipleOf(base);
  const headMultiple = positiveMultipleOf(head);
  if (baseMultiple !== undefined) {
    if (headMultiple === undefined) {
      breaking.push({
        procedure,
        path,
        reason: `Output multipleOf (${baseMultiple}) removed`,
      });
    } else if (!isDivisibleMultiple(headMultiple, baseMultiple)) {
      breaking.push({
        procedure,
        path,
        reason: `Output multipleOf changed from ${baseMultiple} to ${headMultiple}`,
      });
    } else if (headMultiple !== baseMultiple) {
      nonBreaking.push(
        `${procedure} ${path}: output multipleOf tightened (${baseMultiple} -> ${headMultiple})`
      );
    }
  } else if (headMultiple !== undefined) {
    nonBreaking.push(`${procedure} ${path}: output multipleOf added (${headMultiple})`);
  }

  for (const bound of ['minLength', 'minItems'] as const) {
    const bVal = numberOrUndefined(base[bound]);
    const hVal = numberOrUndefined(head[bound]);
    if (bVal !== undefined && (hVal === undefined || hVal < bVal)) {
      breaking.push({
        procedure,
        path,
        reason: `Output ${bound} weakened (${bVal} -> ${String(hVal)})`,
      });
    } else if (hVal !== undefined && (bVal === undefined || hVal > bVal)) {
      nonBreaking.push(`${procedure} ${path}: output ${bound} tightened`);
    }
  }

  for (const bound of ['maxLength', 'maxItems'] as const) {
    const bVal = numberOrUndefined(base[bound]);
    const hVal = numberOrUndefined(head[bound]);
    if (bVal !== undefined && (hVal === undefined || hVal > bVal)) {
      breaking.push({
        procedure,
        path,
        reason: `Output ${bound} weakened (${bVal} -> ${String(hVal)})`,
      });
    } else if (hVal !== undefined && (bVal === undefined || hVal < bVal)) {
      nonBreaking.push(`${procedure} ${path}: output ${bound} tightened`);
    }
  }

  const basePattern = typeof base['pattern'] === 'string' ? base['pattern'] : undefined;
  const headPattern = typeof head['pattern'] === 'string' ? head['pattern'] : undefined;
  if (basePattern !== undefined && headPattern !== basePattern) {
    breaking.push({
      procedure,
      path,
      reason:
        headPattern === undefined
          ? `Output pattern removed (${basePattern})`
          : `Output pattern changed from ${basePattern} to ${headPattern}`,
    });
  } else if (basePattern === undefined && headPattern !== undefined) {
    nonBreaking.push(`${procedure} ${path}: output pattern added`);
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
    const baseAP = base['additionalProperties'];
    const headAP = head['additionalProperties'];
    if (baseAP === false && headAP !== false) {
      breaking.push({
        procedure,
        path,
        reason: 'Output now allows additional properties',
      });
    } else if (baseAP !== false && headAP === false) {
      nonBreaking.push(`${procedure} ${path}: output no longer allows additional properties`);
    } else if (isRecord(baseAP)) {
      const effectiveHeadAP = isRecord(headAP) ? headAP : {};
      compareOutputSchema(procedure, `${path}.*`, baseAP, effectiveHeadAP, breaking, nonBreaking);
    } else if (isRecord(headAP)) {
      nonBreaking.push(`${procedure} ${path}: output additionalProperties constraint tightened`);
    }

    if (isRecord(base['propertyNames']) || isRecord(head['propertyNames'])) {
      const effectiveBasePN = isRecord(base['propertyNames'])
        ? base['propertyNames']
        : { type: 'string' };
      const effectiveHeadPN = isRecord(head['propertyNames'])
        ? head['propertyNames']
        : { type: 'string' };
      compareOutputSchema(
        procedure,
        `${path}.<key>`,
        effectiveBasePN,
        effectiveHeadPN,
        breaking,
        nonBreaking
      );
    }

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

  if (base['type'] === 'array' && head['type'] === 'array') {
    const basePrefix = Array.isArray(base['prefixItems'])
      ? base['prefixItems'].filter(isRecord)
      : null;
    const headPrefix = Array.isArray(head['prefixItems'])
      ? head['prefixItems'].filter(isRecord)
      : null;
    if (basePrefix !== null || headPrefix !== null) {
      const bTuple = basePrefix ?? [];
      const hTuple = headPrefix ?? [];
      const shared = Math.min(bTuple.length, hTuple.length);
      for (let i = 0; i < shared; i += 1) {
        compareOutputSchema(
          procedure,
          `${path}[${i}]`,
          bTuple[i]!,
          hTuple[i]!,
          breaking,
          nonBreaking
        );
      }
      if (hTuple.length !== bTuple.length) {
        breaking.push({
          procedure,
          path,
          reason: `Output tuple arity changed from ${bTuple.length} to ${hTuple.length}`,
        });
      }
    }
    const baseItems = base['items'];
    const headItems = head['items'];
    const itemPath = basePrefix !== null || headPrefix !== null ? `${path}[...]` : `${path}[]`;
    if (baseItems === false && headItems !== false) {
      breaking.push({
        procedure,
        path,
        reason: 'Output array now allows additional items',
      });
    } else if (baseItems !== false && headItems === false) {
      nonBreaking.push(`${procedure} ${path}: output array no longer allows additional items`);
    } else if (isRecord(baseItems)) {
      const effectiveHeadItems = isRecord(headItems) ? headItems : {};
      compareOutputSchema(
        procedure,
        itemPath,
        baseItems,
        effectiveHeadItems,
        breaking,
        nonBreaking
      );
    } else if (isRecord(headItems)) {
      nonBreaking.push(`${procedure} ${path}: output items constraint tightened`);
    }
  }
}

const VALID_PROCEDURE_TYPES = new Set(['query', 'mutation', 'subscription']);

/** Validate that a parsed JSON value conforms to the contract snapshot v1 schema. */
export function assertValidApiContractSnapshot(
  doc: unknown,
  label = 'snapshot'
): asserts doc is ApiContractSnapshot {
  if (!isRecord(doc)) {
    throw new Error(`Invalid API contract ${label}: expected JSON object`);
  }
  if (doc['schemaVersion'] !== CONTRACT_SCHEMA_VERSION) {
    throw new Error(
      `Invalid API contract ${label}: unsupported schemaVersion ${String(doc['schemaVersion'])}`
    );
  }
  if (typeof doc['version'] !== 'string') {
    throw new Error(`Invalid API contract ${label}: expected string version`);
  }
  if (!isRecord(doc['procedures'])) {
    throw new Error(`Invalid API contract ${label}: expected procedures object`);
  }
  for (const [name, proc] of Object.entries(doc['procedures'])) {
    if (!isRecord(proc)) {
      throw new Error(`Invalid API contract ${label}: procedure "${name}" must be an object`);
    }
    if (typeof proc['type'] !== 'string' || !VALID_PROCEDURE_TYPES.has(proc['type'])) {
      throw new Error(`Invalid API contract ${label}: procedure "${name}" has invalid type`);
    }
    if (typeof proc['inputOptional'] !== 'boolean') {
      throw new Error(
        `Invalid API contract ${label}: procedure "${name}" must have boolean inputOptional`
      );
    }
    if (proc['input'] !== null && !isRecord(proc['input'])) {
      throw new Error(
        `Invalid API contract ${label}: procedure "${name}" input must be an object or null`
      );
    }
    if (proc['output'] !== null && !isRecord(proc['output'])) {
      throw new Error(
        `Invalid API contract ${label}: procedure "${name}" output must be an object or null`
      );
    }
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
