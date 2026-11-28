import Table from 'cli-table3';
import { type Command, InvalidArgumentError } from 'commander';
// `ts-projects projects` noun group: `list` and `get <id>` (Q3.A, Q4.A).
// Clean noun-verb cutover: no `{ isDefault: true }`.
import {
  type Core,
  createCore,
  DEFAULT_LIMIT,
  GetProjectInputSchema,
  type Project,
} from 'ts-launch-blueprint-core';

import { requireToken } from '../config.js';
import type { CliContext, CliDeps } from '../deps.js';
import { CliError, UsageError } from '../exit-codes.js';
import { projectListResult } from '../format.js';
import { deliverResult } from '../pager.js';
import { resolveSource, SOURCE_ENV_VAR } from '../source.js';

/** Env var overriding the API root. */
export const API_URL_ENV_VAR = 'TS_PROJECTS_API_URL';

interface ProjectsListOptions {
  workspace?: string | undefined;
  limit: number;
  copy: boolean;
  source?: string | undefined;
}

interface ProjectsGetOptions {
  copy: boolean;
  source?: string | undefined;
}

function parseLimit(value: string): number {
  if (!/^\d+$/.test(value.trim()) || Number.parseInt(value, 10) < 1) {
    throw new InvalidArgumentError('expected a positive integer');
  }
  return Number.parseInt(value, 10);
}

function renderPreviewTable(projects: Project[], verbose: boolean): string {
  const head = verbose ? ['Project Name', 'Workspace', 'ID'] : ['Project Name', 'Workspace'];
  const table = new Table({ head, style: { head: [], border: [] } });
  for (const project of projects) {
    const workspaceName = project.workspace?.name ?? '';
    const row = verbose ? [project.name, workspaceName, project.id] : [project.name, workspaceName];
    table.push(row);
  }
  return table.toString();
}

function createServiceCore(sourceFlag: string | undefined, ctx: CliContext, deps: CliDeps): Core {
  const { source, origin } = resolveSource({ flag: sourceFlag, env: deps.env });
  if (source === 'memory') {
    if (!ctx.opts.quiet) {
      const originLabel = origin === 'flag' ? '--source memory' : `${SOURCE_ENV_VAR}=memory`;
      deps.stderr(`Using in-memory demo data (${originLabel})\n`);
    }
    return createCore({ source: 'memory' });
  }
  const token = requireToken(ctx.resolvedConfig, deps.env, deps.homedir);
  return createCore({
    source: 'http',
    http: { token, fetchImpl: deps.fetchImpl, baseUrl: deps.env[API_URL_ENV_VAR] },
  });
}

async function copyIfRequested(
  copy: boolean,
  rendered: string,
  ctx: CliContext,
  deps: CliDeps
): Promise<void> {
  if (!copy) {
    return;
  }
  try {
    await deps.clipboard(rendered);
  } catch (err) {
    throw new CliError(
      `Could not copy to clipboard: ${err instanceof Error ? err.message : String(err)} ` +
        '(clipboard access needs a display; on headless Linux install xsel or wl-clipboard)'
    );
  }
  ctx.message(ctx.colors.success('Results copied to clipboard'));
}

/** Register the `projects` noun group (`list`, `get <id>`). */
export function registerProjectsCommand(
  program: Command,
  deps: CliDeps,
  initContext: (commandPath: string) => CliContext
): void {
  const projectsGroup = program.command('projects').description('list and inspect projects');

  projectsGroup
    .command('list')
    .description('search and select projects')
    .option('--workspace <name>', 'filter projects by workspace name')
    .option('--limit <n>', 'maximum number of projects to retrieve', parseLimit, DEFAULT_LIMIT)
    .option('--copy', 'copy results to clipboard', false)
    .option('--source <name>', 'data source: http (default) or memory (demo data, no token)')
    .action(async (cmdOpts: ProjectsListOptions, command: Command) => {
      await runProjectsList(cmdOpts, command, deps, initContext('projects list'));
    });

  projectsGroup
    .command('get')
    .description('fetch a single project by ID')
    .argument('<id>', 'project ID')
    .option('--copy', 'copy results to clipboard', false)
    .option('--source <name>', 'data source: http (default) or memory (demo data, no token)')
    .action(async (id: string, cmdOpts: ProjectsGetOptions) => {
      await runProjectsGet(id, cmdOpts, deps, initContext('projects get'));
    });
}

async function runProjectsList(
  cmdOpts: ProjectsListOptions,
  command: Command,
  deps: CliDeps,
  ctx: CliContext
): Promise<void> {
  const { opts } = ctx;
  const core = createServiceCore(cmdOpts.source, ctx, deps);

  const workspace = cmdOpts.workspace ?? ctx.resolvedConfig.workspace;
  const limit =
    command.getOptionValueSource('limit') === 'default' && ctx.resolvedConfig.limit !== undefined
      ? ctx.resolvedConfig.limit
      : cmdOpts.limit;

  const ci = deps.env['CI'];
  const spinnerEnabled = deps.stderrIsTTY && (ci === undefined || ci === '');
  const spinner = spinnerEnabled ? deps.spinner('Fetching projects...') : undefined;
  let projects: Project[];
  try {
    projects = (await core.projects.listProjects({ workspaceName: workspace, limit })).projects;
  } finally {
    spinner?.stop();
  }

  if (projects.length === 0) {
    deliverResult(projectListResult([]), ctx, deps);
    return;
  }

  const interactive = opts.input !== false && deps.stdinIsTTY && deps.stderrIsTTY;

  if (ctx.outputMode === 'text' && interactive) {
    deps.stderr(`${renderPreviewTable(projects, opts.verbose >= 1 || opts.debug)}\n`);
  }

  let selected: Project[];
  if (interactive) {
    selected = await deps.prompter(
      'Select projects:',
      projects.map((project) => ({
        name:
          project.workspace === null ? project.name : `${project.name} (${project.workspace.name})`,
        value: project,
      }))
    );
  } else {
    selected = projects;
  }

  if (selected.length === 0) {
    deps.stderr(`${ctx.colors.warn('No projects selected')}\n`);
    return;
  }

  const rendered = deliverResult(projectListResult(selected), ctx, deps);
  await copyIfRequested(cmdOpts.copy, rendered, ctx, deps);
}

async function runProjectsGet(
  id: string,
  cmdOpts: ProjectsGetOptions,
  deps: CliDeps,
  ctx: CliContext
): Promise<void> {
  const parsed = GetProjectInputSchema.safeParse({ id });
  if (!parsed.success) {
    throw new UsageError(parsed.error.issues[0]?.message ?? `Invalid project ID: '${id}'`);
  }

  const core = createServiceCore(cmdOpts.source, ctx, deps);

  const ci = deps.env['CI'];
  const spinnerEnabled = deps.stderrIsTTY && (ci === undefined || ci === '');
  const spinner = spinnerEnabled ? deps.spinner('Fetching project...') : undefined;
  let project: Project;
  try {
    project = await core.projects.getProject(parsed.data.id);
  } finally {
    spinner?.stop();
  }

  const rendered = deliverResult(projectListResult([project]), ctx, deps);
  await copyIfRequested(cmdOpts.copy, rendered, ctx, deps);
}
