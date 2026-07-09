// The default `projects` command — port of the source command body
// (projects.py:317-408): resolve config, fetch with a spinner, preview
// table, interactive multi-select, format, route to stdout/file sinks,
// optional clipboard copy.
//
// Stream contract (D-018(4,5)): stdout carries ONLY the formatted result
// document; the spinner, preview table, prompt, and every notice render
// on stderr. The source's progress-on-stdout wart is deliberately not
// preserved.
import { writeFileSync } from 'node:fs';

import Table from 'cli-table3';
import type { Command } from 'commander';
import { InvalidArgumentError, Option } from 'commander';

import { createApiClient, DEFAULT_LIMIT, type Project } from '../lib/api.js';
import { requireToken, resolveConfig } from '../lib/config.js';
import { CliError } from '../lib/errors.js';
import { formatOutput, type OutputFormat, OUTPUT_FORMATS } from '../lib/format.js';
import type { CliContext, CliDeps } from '../router.js';

/** Env var overriding the API root — exists so e2e tests (and users of
 * a self-hosted API) can point the CLI at another server. Documented in
 * EXAMPLECLI.md. */
export const API_URL_ENV_VAR = 'TS_PROJECTS_API_URL';

interface ProjectsOptions {
  workspace?: string;
  limit: number;
  format: OutputFormat;
  /** --json alias (cli-standards R4.2): json output when true. */
  json?: boolean;
  output?: string;
  copy: boolean;
}

/** click-style strict positive-integer parser for --limit; rejection is
 * a usage error (exit 2). */
function parseLimit(value: string): number {
  if (!/^\d+$/.test(value.trim()) || Number.parseInt(value, 10) < 1) {
    throw new InvalidArgumentError('expected a positive integer');
  }
  return Number.parseInt(value, 10);
}

/** Pre-selection preview table (display_projects parity,
 * projects.py:294-314): Project Name + Workspace, ID added under
 * --verbose. Rendered plain (no ANSI) so the color gate stays the single
 * color authority. */
function renderTable(projects: Project[], verbose: boolean): string {
  const head = verbose ? ['Project Name', 'Workspace', 'ID'] : ['Project Name', 'Workspace'];
  const table = new Table({ head, style: { head: [], border: [] } });
  for (const project of projects) {
    const row = verbose
      ? [project.name, project.workspace.name, project.id]
      : [project.name, project.workspace.name];
    table.push(row);
  }
  return table.toString();
}

/** Register the projects command as the program default, so bare
 * `ts-projects` runs it exactly like bare `py-projects` did. */
export function registerProjectsCommand(
  program: Command,
  deps: CliDeps,
  getContext: () => CliContext
): void {
  program
    .command('projects', { isDefault: true })
    .description('search and select projects')
    .option('--workspace <name>', 'filter projects by workspace name')
    .option('--limit <n>', 'maximum number of projects to retrieve', parseLimit, DEFAULT_LIMIT)
    .addOption(
      new Option('--format <format>', 'output format').choices(OUTPUT_FORMATS).default('text')
    )
    // --json ≡ --format json (cli-standards R4.2 alias, D-018(4)/D-033);
    // conflicting explicit --format values are a usage error. Note the
    // recorded divergence (EXAMPLECLI.md): --output remains the FILE
    // sink for source parity, so the standard's -o/--output format enum
    // is deliberately not adopted.
    .addOption(new Option('--json', 'output json (alias for --format json)').conflicts('format'))
    .option('--output <file>', 'write results to file')
    .option('--copy', 'copy results to clipboard', false)
    .action(async (cmdOpts: ProjectsOptions, command: Command) => {
      await runProjects(cmdOpts, command, deps, getContext());
    });
}

async function runProjects(
  cmdOpts: ProjectsOptions,
  command: Command,
  deps: CliDeps,
  ctx: CliContext
): Promise<void> {
  const { opts, colors, logger } = ctx;
  const format: OutputFormat = cmdOpts.json === true ? 'json' : cmdOpts.format;

  // Token required before any network call; missing -> AuthError exit 4
  // (D-016(2); the source exited 1 here).
  const resolved = resolveConfig({
    flagToken: opts.token,
    configPathFlag: opts.config,
    env: deps.env,
    homedir: deps.homedir,
    fs: deps.fs,
    warn: (message) => logger.warn(message),
  });
  const token = requireToken(resolved, deps.env, deps.homedir);

  // Config-file workspace/limit act as defaults; explicit flags win
  // (cli-standards R5.1 flags > file).
  const workspace = cmdOpts.workspace ?? resolved.workspace;
  const limit =
    command.getOptionValueSource('limit') === 'default' && resolved.limit !== undefined
      ? resolved.limit
      : cmdOpts.limit;

  const client = createApiClient({
    token,
    fetchImpl: deps.fetchImpl,
    baseUrl: deps.env[API_URL_ENV_VAR],
  });

  // Spinner on stderr, gated on stderr TTY-ness and CI (D-016(5)); when
  // suppressed the fetch is silent and piped stdout stays clean.
  const ci = deps.env['CI'];
  const spinnerEnabled = deps.stderrIsTTY && (ci === undefined || ci === '');
  const spinner = spinnerEnabled ? deps.spinner('Fetching projects...') : undefined;
  let projects: Project[];
  try {
    projects = await client.getProjects({ workspaceName: workspace, limit });
  } finally {
    spinner?.stop();
  }

  // Benign empty result -> notice + exit 0 (projects.py:364-366; notice
  // moved from stdout to stderr per D-018(4)).
  if (projects.length === 0) {
    deps.stderr(`${colors.warn('No projects found.')}\n`);
    return;
  }

  // The source prompted unconditionally (undefined on non-TTY); the port
  // documents the non-interactive path: --no-input or a non-TTY
  // stdin/stderr skips the prompt and selects all (D-016(6)).
  const interactive = opts.input !== false && deps.stdinIsTTY && deps.stderrIsTTY;

  // Text-mode preview table (projects.py:368-370), on stderr and only
  // when interactive so redirected output never carries it.
  if (format === 'text' && interactive) {
    deps.stderr(`${renderTable(projects, opts.verbose >= 1)}\n`);
  }

  let selected: Project[];
  if (interactive) {
    selected = await deps.prompter(
      'Select projects:',
      projects.map((project) => ({
        name: `${project.name} (${project.workspace.name})`,
        value: project,
      }))
    );
  } else {
    selected = projects;
  }

  // Empty selection is a graceful no-op -> exit 0 (projects.py:383-385;
  // notice moved to stderr per D-018(4)).
  if (selected.length === 0) {
    deps.stderr(`${colors.warn('No projects selected')}\n`);
    return;
  }

  const result = formatOutput(selected, format);

  // Result routing (projects.py:390-395): file sink replaces stdout;
  // confirmations are stderr notices.
  if (cmdOpts.output !== undefined) {
    if (deps.fs !== undefined) {
      deps.fs.writeFileSync(cmdOpts.output, result, {});
    } else {
      writeFileSync(cmdOpts.output, result);
    }
    deps.stderr(`${colors.success(`Results written to ${cmdOpts.output}`)}\n`);
  } else {
    deps.stdout(`${result}\n`);
  }

  // Clipboard is orthogonal and additive (projects.py:397-399). Headless
  // environments have no clipboard: degrade with a clear error instead
  // of a crash (D-016(7)); the result has already reached its sink.
  if (cmdOpts.copy) {
    try {
      await deps.clipboard(result);
    } catch (err) {
      throw new CliError(
        `Could not copy to clipboard: ${err instanceof Error ? err.message : String(err)} ` +
          '(clipboard access needs a display; on headless Linux install xsel or wl-clipboard)'
      );
    }
    deps.stderr(`${colors.success('Results copied to clipboard')}\n`);
  }
}
