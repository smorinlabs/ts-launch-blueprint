// Property-based round-trip tests for CLI formatting and TOML config (P08-TS02).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as fc from 'fast-check';
import type { Project } from 'ts-launch-blueprint-core';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CONFIG_COLOR_MODES,
  CONFIG_LOG_FORMATS,
  CONFIG_LOG_LEVELS,
  CONFIG_OUTPUT_FORMATS,
  type ConfigFileValues,
  readConfigForWrite,
  resolveConfig,
  writeConfigData,
  writeUserConfig,
} from '../src/cli/config.js';
import { formatOutput } from '../src/cli/format.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ts-projects-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Minimal RFC 4180 CSV parser matching formatOutput('csv'). */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

const projectArb: fc.Arbitrary<Project> = fc.record({
  id: fc.string(),
  name: fc.string(),
  workspace: fc.record({ name: fc.string() }),
});

// Printable well-formed strings without C0/DEL control characters or surrogates (not carried in config files).
function isPrintableConfigString(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f || (code >= 0xd800 && code <= 0xdfff)) {
      return false;
    }
  }
  return true;
}

const configStringArb = fc.string({ maxLength: 60 }).filter(isPrintableConfigString);

describe('CLI formatting and config properties', () => {
  it('formatOutput json round-trips any Project[] via JSON.parse', () => {
    fc.assert(
      fc.property(fc.array(projectArb, { maxLength: 15 }), (projects) => {
        const rendered = formatOutput(projects, 'json');
        expect(JSON.parse(rendered)).toEqual({ projects });
      }),
      { numRuns: 100 }
    );
  });

  it('formatOutput csv preserves exact id and name under RFC 4180 parsing', () => {
    fc.assert(
      fc.property(fc.array(projectArb, { maxLength: 15 }), (projects) => {
        const rendered = formatOutput(projects, 'csv');
        const rows = parseCsv(rendered);
        expect(rows[0]).toEqual(['id', 'name']);
        expect(rows.slice(1)).toEqual(projects.map((project) => [project.id, project.name]));
      }),
      { numRuns: 100 }
    );
  });

  it('formatOutput markdown emits valid GFM table with escaped pipes', () => {
    expect(formatOutput([], 'markdown')).toBe('No projects found.');
    fc.assert(
      fc.property(fc.array(projectArb, { minLength: 1, maxLength: 15 }), (projects) => {
        const rendered = formatOutput(projects, 'markdown');
        const lines = rendered.split('\n');
        expect(lines[0]).toBe(`## Projects (${projects.length})`);
        expect(lines[1]).toBe('');
        expect(lines[2]).toBe('| Name | Workspace | ID |');
        expect(lines[3]).toBe('| --- | --- | --- |');
        expect(lines).toHaveLength(projects.length + 4);
      }),
      { numRuns: 100 }
    );
  });

  it('formatOutput text joins newline-free project ids cleanly', () => {
    const lineIdProjectArb: fc.Arbitrary<Project> = fc.record({
      id: fc.string({ minLength: 1 }).filter((id) => !id.includes('\n')),
      name: fc.string(),
      workspace: fc.record({ name: fc.string() }),
    });

    expect(formatOutput([], 'text')).toBe('');
    fc.assert(
      fc.property(fc.array(lineIdProjectArb, { maxLength: 15 }), (projects) => {
        const rendered = formatOutput(projects, 'text');
        const actualIds = rendered === '' ? [] : rendered.split('\n');
        expect(actualIds).toEqual(projects.map((project) => project.id));
      }),
      { numRuns: 100 }
    );
  });

  it('writeUserConfig and resolveConfig round-trip TOML values losslessly (never token)', () => {
    const home = makeTempDir();
    const env: Record<string, string | undefined> = { XDG_CONFIG_HOME: join(home, '.config') };
    const configArb: fc.Arbitrary<ConfigFileValues> = fc.record(
      {
        workspace: configStringArb,
        limit: fc.integer({ min: 1, max: 1_000_000 }),
        output: fc.record(
          {
            format: fc.constantFrom(...CONFIG_OUTPUT_FORMATS),
            color: fc.constantFrom(...CONFIG_COLOR_MODES),
          },
          { requiredKeys: [] }
        ),
        logging: fc.record(
          {
            level: fc.constantFrom(...CONFIG_LOG_LEVELS),
            file: configStringArb,
            file_level: fc.constantFrom(...CONFIG_LOG_LEVELS),
            format: fc.constantFrom(...CONFIG_LOG_FORMATS),
          },
          { requiredKeys: [] }
        ),
      },
      { requiredKeys: [] }
    );

    fc.assert(
      fc.property(configArb, (values) => {
        const writtenPath = writeUserConfig(values, {
          env,
          homedir: () => home,
        });
        const resolved = resolveConfig({
          env,
          homedir: () => home,
          cwd: () => home,
        });

        expect(resolved.configPath).toBe(writtenPath);
        expect(resolved.token).toBeUndefined();
        expect(resolved.tokenSource).toBe('none');
        expect(resolved.workspace).toBe(values.workspace);
        expect(resolved.limit).toBe(values.limit);
        expect(resolved.settings.output).toEqual({
          format: values.output?.format ?? 'text',
          color: values.output?.color ?? 'auto',
        });
        expect(resolved.settings.logging).toEqual({
          level: values.logging?.level ?? 'warning',
          file: values.logging?.file ?? '',
          file_level: values.logging?.file_level ?? 'debug',
          format: values.logging?.format ?? 'text',
        });
      }),
      { numRuns: 50 }
    );
  });

  it('CFG-18: writeConfigData and readConfigForWrite round-trip arbitrary TOML section tables', () => {
    const dir = makeTempDir();
    const target = join(dir, 'roundtrip.toml');
    const safeKeyArb = fc
      .stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,12}$/)
      .filter((key) => key !== 'token');
    const scalarArb = fc.oneof(
      fc.boolean(),
      fc.integer({ min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }),
      configStringArb
    );
    const sectionTableArb = fc.dictionary(safeKeyArb, scalarArb, { minKeys: 1, maxKeys: 5 });
    const docArb = fc.dictionary(safeKeyArb, sectionTableArb, { maxKeys: 4 });

    fc.assert(
      fc.property(docArb, (doc) => {
        writeConfigData(target, doc);
        expect(readConfigForWrite(target)).toEqual(doc);
      }),
      { numRuns: 50 }
    );
  });
});
