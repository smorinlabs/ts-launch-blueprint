import Table from 'cli-table3';
// Pure output formatting, generic CliTableResult rendering (text, json, csv,
// markdown), JSON/human error envelopes (ADR 0006), and terminal string helpers
// (relativeTime, richLink per ADR 0010).
import type { Project } from 'ts-launch-blueprint-core';

import type { Colors } from './colors.js';
import type { ExitCode } from './exit-codes.js';

/** Constrained global output format set (`-o, --output`). */
export const OUTPUT_FORMATS: readonly ['text', 'json', 'csv', 'markdown'] = [
  'text',
  'json',
  'csv',
  'markdown',
] as const;

/** Output format union ('text' is the CLI default). */
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

/** Renderable command result contract (Py CLIResult parity). */
export interface CliTableResult {
  readonly tableTitle?: string | undefined;
  readonly tableColumns: () => string[];
  readonly tableRows: () => string[][];
  readonly tableRowsRich?: (() => string[][]) | undefined;
  readonly humanNote?: (() => string | undefined) | undefined;
  readonly toJson: () => unknown;
}

/** Quote a CSV field only when RFC 4180 requires it. */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

/** Wrap a Project[] list as a CliTableResult (`Projects (N)`). */
export function projectListResult(projects: Project[]): CliTableResult {
  return {
    tableTitle: `Projects (${projects.length})`,
    tableColumns: () => ['Name', 'Workspace', 'ID'],
    tableRows: () =>
      projects.map((project) => [project.name, project.workspace?.name ?? '-', project.id]),
    humanNote: () => (projects.length === 0 ? 'No projects found.' : undefined),
    toJson: () => ({ projects }),
  };
}

/** Render a CliTableResult as GitHub-Flavored Markdown (`## <title>` + escaped `\|`). */
export function renderMarkdown(result: CliTableResult): string {
  const columns = result.tableColumns();
  const rows = result.tableRows();
  if (columns.length === 0 || rows.length === 0) {
    return result.humanNote?.() ?? '';
  }
  const lines: string[] = [];
  if (result.tableTitle !== undefined && result.tableTitle !== '') {
    lines.push(`## ${result.tableTitle}`, '');
  }
  lines.push(`| ${columns.join(' | ')} |`);
  lines.push(`| ${columns.map(() => '---').join(' | ')} |`);
  for (const row of rows) {
    const cells = row.map((cell) => cell.replaceAll('|', '\\|').replace(/\r\n|\r|\n/g, '<br>'));
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

/** Render a CliTableResult as RFC 4180 CSV. */
export function renderCsv(result: CliTableResult): string {
  const columns = result.tableColumns();
  const rows = result.tableRows();
  if (columns.length === 0) {
    return result.humanNote?.() ?? '';
  }
  const lines = [columns.map(csvField).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvField).join(','));
  }
  return lines.join('\n');
}

/** Render a CliTableResult as a human-readable terminal table (or humanNote if empty). */
export function renderText(
  result: CliTableResult,
  useColor: boolean,
  useRich: boolean = useColor
): string {
  const columns = result.tableColumns();
  const rows = result.tableRows();
  if (columns.length === 0 || rows.length === 0) {
    return result.humanNote?.() ?? '';
  }
  const displayRows = useRich && result.tableRowsRich !== undefined ? result.tableRowsRich() : rows;
  const table = new Table({
    head: columns,
    style: { head: useColor ? ['cyan'] : [], border: [] },
  });
  for (const row of displayRows) {
    table.push(row);
  }
  const body = table.toString();
  if (result.tableTitle !== undefined && result.tableTitle !== '') {
    return `${result.tableTitle}\n${body}`;
  }
  return body;
}

/** Render any CliTableResult according to the resolved output mode. */
export function renderFormattedResult(
  result: CliTableResult,
  mode: OutputFormat,
  useColor: boolean,
  useRich: boolean = useColor
): string {
  if (mode === 'json') {
    return JSON.stringify(result.toJson(), null, 2);
  }
  if (mode === 'markdown') {
    return renderMarkdown(result);
  }
  if (mode === 'csv') {
    return renderCsv(result);
  }
  return renderText(result, useColor, useRich);
}

/**
 * Format a selected Project[] list as a single result document string (public
 * library API preserved for `json`, `csv`, `text`, plus v4 `markdown`).
 */
export function formatOutput(projects: Project[], format: OutputFormat): string {
  if (format === 'json') {
    return JSON.stringify({ projects }, null, 2);
  }
  if (format === 'csv') {
    const rows = projects.map((project) => `${csvField(project.id)},${csvField(project.name)}`);
    return ['id,name', ...rows].join('\n');
  }
  if (format === 'markdown') {
    return renderMarkdown(projectListResult(projects));
  }
  return projects.map((project) => project.id).join('\n');
}

const EXIT_CODE_NAMES: Record<ExitCode, string> = {
  0: 'SUCCESS',
  1: 'ERROR',
  2: 'USAGE',
  3: 'NOT_FOUND',
  4: 'AUTH',
  5: 'CONFLICT',
  130: 'SIGINT',
  143: 'SIGTERM',
};

/** Structured JSON error payload (`error` inner object per ADR 0006). */
export interface JsonErrorDetail {
  code: number;
  name: string;
  message: string;
  error_code?: string;
  hint?: string;
  traceback_path?: string;
}

/** Format a structured JSON error envelope line (`{"error":{...}}`), omitting undefined fields. */
export function formatJsonError(input: {
  exitCode: ExitCode;
  message: string;
  errorCode?: string | undefined;
  hint?: string | undefined;
  tracebackPath?: string | undefined;
}): string {
  const detail: JsonErrorDetail = {
    code: input.exitCode,
    name: EXIT_CODE_NAMES[input.exitCode],
    message: input.message,
  };
  if (input.errorCode !== undefined && input.errorCode !== '') {
    detail.error_code = input.errorCode;
  }
  if (input.hint !== undefined && input.hint !== '') {
    detail.hint = input.hint;
  }
  if (input.tracebackPath !== undefined && input.tracebackPath !== '') {
    detail.traceback_path = input.tracebackPath;
  }
  return JSON.stringify({ error: detail });
}

/** Format a human-readable stderr error block with optional error code, hint, and traceback path. */
export function formatHumanError(input: {
  message: string;
  colors: Colors;
  errorCode?: string | undefined;
  hint?: string | undefined;
  tracebackPath?: string | undefined;
}): string {
  const codeSuffix =
    input.errorCode !== undefined && input.errorCode !== ''
      ? ` ${input.colors.dim(`(${input.errorCode})`)}`
      : '';
  const lines = [`${input.colors.error('Error:')} ${input.message}${codeSuffix}`];
  if (input.hint !== undefined && input.hint !== '') {
    lines.push(`${input.colors.warn('hint:')} ${input.hint}`);
  }
  if (input.tracebackPath !== undefined && input.tracebackPath !== '') {
    lines.push(`full traceback: ${input.tracebackPath}`);
  }
  return `${lines.join('\n')}\n`;
}

const RELATIVE_TIME_UNITS: ReadonlyArray<readonly [number, string]> = [
  [365 * 86400, 'year'],
  [30 * 86400, 'month'],
  [86400, 'day'],
  [3600, 'hour'],
  [60, 'minute'],
];

/** Coarse human delta (`"just now"`, `"2 days ago"`, `"in 3 hours"`). */
export function relativeTime(moment: Date, now: Date = new Date()): string {
  const deltaSeconds = (now.getTime() - moment.getTime()) / 1000;
  const future = deltaSeconds < 0;
  const absSeconds = Math.abs(deltaSeconds);

  if (absSeconds < 60) {
    return 'just now';
  }
  for (const [unitSeconds, unitName] of RELATIVE_TIME_UNITS) {
    const count = Math.floor(absSeconds / unitSeconds);
    if (count >= 1) {
      const phrase = `${count} ${unitName}${count === 1 ? '' : 's'}`;
      return future ? `in ${phrase}` : `${phrase} ago`;
    }
  }
  return 'just now';
}

/** Wrap `text` in an OSC-8 clickable terminal hyperlink when `enabled` is true. */
export function richLink(text: string, url: string, enabled: boolean = true): string {
  if (!enabled) {
    return text;
  }
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}
