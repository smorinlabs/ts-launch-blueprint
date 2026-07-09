// Pure output formatter — port of format_output (projects.py:273-291).
// Side-effect free by design (INDEX "Constrained machine-readable output
// formats with a pure formatter"); table rendering stays out of here.
//
// Shapes mirror the source byte-for-byte for clean values:
//   json -> {"projects": [...]} wrapper, 2-space indent
//   csv  -> literal `id,name` header, one `id,name` row per project
//   text -> newline-joined project IDs (not names — shell composability)
// Deliberate divergence (documented in docs/port-parity-s3b.md): the
// source's CSV was naive-by-design (no escaping, projects.py:287-289);
// the port applies minimal RFC 4180 quoting, which is byte-identical
// unless a value contains a comma, quote, or newline.
import type { Project } from './api.js';

/** The source's constrained format set (click.Choice parity). */
export const OUTPUT_FORMATS = ['text', 'json', 'csv'] as const;

/** Output format union ('text' is the CLI default). */
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

/** Quote a CSV field only when RFC 4180 requires it. */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

/** Format the selected projects as a single result document string. */
export function formatOutput(projects: Project[], format: OutputFormat): string {
  if (format === 'json') {
    return JSON.stringify({ projects }, null, 2);
  }
  if (format === 'csv') {
    const rows = projects.map((project) => `${csvField(project.id)},${csvField(project.name)}`);
    return ['id,name', ...rows].join('\n');
  }
  // text format
  return projects.map((project) => project.id).join('\n');
}
