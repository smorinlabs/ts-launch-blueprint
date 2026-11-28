// In-process tests for `projects list` and `projects get <id>` via
// runCli(argv, deps) with every boundary faked at CliDeps seams.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Project } from '@ts-launch-blueprint/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ClipboardWriter, Prompter, SpinnerFactory } from '../src/cli/adapters.js';
import { TOKEN_ENV_VAR } from '../src/cli/config.js';
import type { CliDeps } from '../src/cli/deps.js';
import { runCli } from '../src/cli/router.js';
import { configDir } from '../src/cli/xdg-paths.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ts-projects-cli-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const ALPHA: Project = { id: '1', name: 'Alpha', workspace: { name: 'Acme' } };
const BETA: Project = { id: '2', name: 'Beta, "quoted"', workspace: { name: 'Acme' } };
const PROJECTS: Project[] = [ALPHA, BETA];
const WORKSPACES = [{ gid: 'ws1', name: 'Acme' }];

interface FetchFake {
  fetchImpl: typeof fetch;
  urls: URL[];
}

/** Route-aware fetch fake serving workspaces, projects list, and project by id. */
function makeApiFetch(
  projects: Project[] = PROJECTS,
  overrides: Partial<Record<'/workspaces' | '/projects' | '/projects/:id', Response | Error>> = {}
): FetchFake {
  const urls: URL[] = [];
  const fetchImpl = ((input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    urls.push(url);
    if (url.pathname.endsWith('/workspaces')) {
      const override = overrides['/workspaces'];
      if (override instanceof Error) return Promise.reject(override);
      if (override !== undefined) return Promise.resolve(override);
      return Promise.resolve(new Response(JSON.stringify({ data: WORKSPACES }), { status: 200 }));
    }
    const itemMatch = url.pathname.match(/\/projects\/([^/]+)$/);
    if (itemMatch !== null) {
      const override = overrides['/projects/:id'];
      if (override instanceof Error) return Promise.reject(override);
      if (override !== undefined) return Promise.resolve(override);
      const id = decodeURIComponent(itemMatch[1]!);
      const found = projects.find((p) => p.id === id);
      if (found === undefined) {
        return Promise.resolve(
          new Response(JSON.stringify({ errors: [{ message: 'Not Found' }] }), { status: 404 })
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ data: found }), { status: 200 }));
    }
    const override = overrides['/projects'];
    if (override instanceof Error) return Promise.reject(override);
    if (override !== undefined) return Promise.resolve(override);
    return Promise.resolve(new Response(JSON.stringify({ data: projects }), { status: 200 }));
  }) as typeof fetch;
  return { fetchImpl, urls };
}

interface Harness {
  deps: CliDeps;
  stdout: () => string;
  stderr: () => string;
}

function makeHarness(overrides: Partial<CliDeps> = {}): Harness {
  const out: string[] = [];
  const err: string[] = [];
  const deps: CliDeps = {
    stdout: (text) => {
      out.push(text);
    },
    stderr: (text) => {
      err.push(text);
    },
    env: { [TOKEN_ENV_VAR]: 'test-token-1234' },
    homedir: () => makeTempDir(),
    stdoutIsTTY: false,
    stderrIsTTY: false,
    stdinIsTTY: false,
    fetchImpl: makeApiFetch().fetchImpl,
    prompter: () => Promise.resolve([]),
    clipboard: () => Promise.resolve(),
    spinner: () => ({ stop: () => undefined }),
    ...overrides,
  };
  return { deps, stdout: () => out.join(''), stderr: () => err.join('') };
}

function makeInteractiveHarness(
  selection: Project[],
  overrides: Partial<CliDeps> = {}
): Harness & { prompter: ReturnType<typeof vi.fn<Prompter>> } {
  const prompter = vi.fn<Prompter>(() => Promise.resolve(selection));
  const harness = makeHarness({
    stdinIsTTY: true,
    stderrIsTTY: true,
    prompter,
    ...overrides,
  });
  return { ...harness, prompter };
}

describe('token handling (projects list & projects get)', () => {
  it('missing token everywhere -> exit 4, no network call', async () => {
    const { fetchImpl, urls } = makeApiFetch();
    const h = makeHarness({ env: {}, fetchImpl });
    expect(await runCli(['projects', 'list'], h.deps)).toBe(4);
    expect(h.stderr()).toContain('No TS_PROJECTS_TOKEN found');
    expect(h.stderr()).toContain('TS002');
    expect(h.stderr()).toContain('hint:');
    expect(h.stdout()).toBe('');
    expect(urls).toHaveLength(0);
  });

  it('token provided via --token -> exit 0 even when nothing is selected', async () => {
    const h = makeInteractiveHarness([]);
    expect(await runCli(['projects', 'list', '--token', 'test'], h.deps)).toBe(0);
  });

  it('API 401 (bad token) -> exit 4', async () => {
    const { fetchImpl } = makeApiFetch(PROJECTS, {
      '/projects': new Response(JSON.stringify({ errors: [{ message: 'Not authorized' }] }), {
        status: 401,
      }),
    });
    const h = makeHarness({ fetchImpl });
    expect(await runCli(['projects', 'list', '--no-input'], h.deps)).toBe(4);
    expect(h.stderr()).toContain('API authentication failed');
  });
});

describe('projects list selection paths', () => {
  it('populated selection flows into the formatter (json)', async () => {
    const h = makeInteractiveHarness([ALPHA]);
    expect(await runCli(['projects', 'list', '--json'], h.deps)).toBe(0);
    expect(JSON.parse(h.stdout())).toEqual({ projects: [ALPHA] });
    expect(h.prompter).toHaveBeenCalledTimes(1);
  });

  it('prompt choices carry "Name (Workspace)" labels and full values', async () => {
    const h = makeInteractiveHarness([ALPHA]);
    await runCli(['projects', 'list', '-o', 'json'], h.deps);
    expect(h.prompter).toHaveBeenCalledWith('Select projects:', [
      { name: 'Alpha (Acme)', value: ALPHA },
      { name: 'Beta, "quoted" (Acme)', value: BETA },
    ]);
  });

  it('empty selection -> "No projects selected" on stderr, exit 0', async () => {
    const h = makeInteractiveHarness([]);
    expect(await runCli(['projects', 'list', '--json'], h.deps)).toBe(0);
    expect(h.stdout()).toBe('');
    expect(h.stderr()).toContain('No projects selected');
  });

  it('--no-input skips the prompt and selects all', async () => {
    const h = makeInteractiveHarness([ALPHA]);
    expect(await runCli(['--no-input', 'projects', 'list', '--json'], h.deps)).toBe(0);
    expect(h.prompter).not.toHaveBeenCalled();
    expect(JSON.parse(h.stdout())).toEqual({ projects: PROJECTS });
  });

  it('non-TTY stdin skips the prompt and selects all', async () => {
    const prompter = vi.fn<Prompter>(() => Promise.resolve([ALPHA]));
    const h = makeHarness({ prompter });
    expect(await runCli(['projects', 'list', '-o', 'json'], h.deps)).toBe(0);
    expect(prompter).not.toHaveBeenCalled();
    expect(JSON.parse(h.stdout())).toEqual({ projects: PROJECTS });
  });

  it('empty fetch result -> "No projects found." in text/markdown and {"projects":[]} in json', async () => {
    const { fetchImpl } = makeApiFetch([]);
    const hText = makeHarness({ fetchImpl });
    expect(await runCli(['projects', 'list', '--no-input'], hText.deps)).toBe(0);
    expect(hText.stdout()).toContain('No projects found.');

    const hJson = makeHarness({ fetchImpl });
    expect(await runCli(['projects', 'list', '--no-input', '--json'], hJson.deps)).toBe(0);
    expect(JSON.parse(hJson.stdout())).toEqual({ projects: [] });
  });
});

describe('output formats (-o/--output & --json)', () => {
  it('json: stdout is exactly one parseable document', async () => {
    const h = makeHarness();
    expect(await runCli(['projects', 'list', '--no-input', '-o', 'json'], h.deps)).toBe(0);
    expect(h.stdout()).toBe(`${JSON.stringify({ projects: PROJECTS }, null, 2)}\n`);
    expect(h.stderr()).not.toContain('Fetching');
  });

  it('csv: RFC 4180 quoting with Name,Workspace,ID columns', async () => {
    const h = makeHarness();
    expect(await runCli(['projects', 'list', '--no-input', '-o', 'csv'], h.deps)).toBe(0);
    expect(h.stdout()).toBe('Name,Workspace,ID\nAlpha,Acme,1\n"Beta, ""quoted""",Acme,2\n');
  });

  it('markdown: GFM heading and table', async () => {
    const h = makeHarness();
    expect(await runCli(['projects', 'list', '--no-input', '-o', 'markdown'], h.deps)).toBe(0);
    const out = h.stdout();
    expect(out).toContain('## Projects (2)');
    expect(out).toContain('| Name | Workspace | ID |');
    expect(out).toContain('| --- | --- | --- |');
    expect(out).toContain('| Alpha | Acme | 1 |');
  });

  it('text (default): renders Projects (N) table with Name, Workspace, ID', async () => {
    const h = makeHarness();
    expect(await runCli(['projects', 'list', '--no-input'], h.deps)).toBe(0);
    expect(h.stdout()).toContain('Projects (2)');
    expect(h.stdout()).toContain('Alpha');
    expect(h.stdout()).toContain('Acme');
  });

  it('--json overrides -o csv without conflict error', async () => {
    const h = makeHarness();
    expect(await runCli(['projects', 'list', '--no-input', '-o', 'csv', '--json'], h.deps)).toBe(0);
    expect(JSON.parse(h.stdout())).toEqual({ projects: PROJECTS });
  });
});

describe('projects get <id>', () => {
  it('fetches single project by ID and renders in json, text, and markdown', async () => {
    const hJson = makeHarness();
    expect(await runCli(['projects', 'get', '1', '--json'], hJson.deps)).toBe(0);
    expect(JSON.parse(hJson.stdout())).toEqual({ projects: [ALPHA] });

    const hText = makeHarness();
    expect(await runCli(['projects', 'get', '1'], hText.deps)).toBe(0);
    expect(hText.stdout()).toContain('Projects (1)');
    expect(hText.stdout()).toContain('Alpha');

    const hMd = makeHarness();
    expect(await runCli(['projects', 'get', '1', '-o', 'markdown'], hMd.deps)).toBe(0);
    expect(hMd.stdout()).toContain('## Projects (1)');
    expect(hMd.stdout()).toContain('| Alpha | Acme | 1 |');
  });

  it('supports --source memory, --output-file, and --copy', async () => {
    const dir = makeTempDir();
    const outFile = join(dir, 'project.json');
    const clipboard = vi.fn<ClipboardWriter>(() => Promise.resolve());
    const h = makeHarness({ env: {}, clipboard });
    expect(
      await runCli(
        [
          'projects',
          'get',
          'p-1',
          '--source',
          'memory',
          '--json',
          '--output-file',
          outFile,
          '--copy',
        ],
        h.deps
      )
    ).toBe(0);
    expect(h.stdout()).toBe('');
    const parsed = JSON.parse(readFileSync(outFile, 'utf8')) as { projects: Project[] };
    expect(parsed.projects[0]?.id).toBe('p-1');
    expect(clipboard).toHaveBeenCalledTimes(1);
  });

  it('unknown project ID -> ProjectNotFoundError TS005 exit 3', async () => {
    const h = makeHarness();
    expect(await runCli(['projects', 'get', '999', '--json'], h.deps)).toBe(3);
    const envelope = JSON.parse(h.stderr()) as {
      error: { code: number; name: string; message: string; error_code?: string };
    };
    expect(envelope.error).toEqual({
      code: 3,
      name: 'NOT_FOUND',
      message: 'Project not found: 999',
      error_code: 'TS005',
    });
  });

  it('rejects dot-segment IDs (. and ..) as usage error exit 2', async () => {
    const hDot = makeHarness();
    expect(await runCli(['projects', 'get', '.'], hDot.deps)).toBe(2);

    const hDotDot = makeHarness();
    expect(await runCli(['projects', 'get', '..'], hDotDot.deps)).toBe(2);
  });
});

describe('limit and workspace forwarding', () => {
  it('default limit 200 reaches the API request', async () => {
    const { fetchImpl, urls } = makeApiFetch();
    const h = makeHarness({ fetchImpl });
    await runCli(['projects', 'list', '--no-input'], h.deps);
    expect(urls[0]!.searchParams.get('limit')).toBe('200');
  });

  it('--limit is forwarded', async () => {
    const { fetchImpl, urls } = makeApiFetch();
    const h = makeHarness({ fetchImpl });
    await runCli(['projects', 'list', '--no-input', '--limit', '50'], h.deps);
    expect(urls[0]!.searchParams.get('limit')).toBe('50');
  });

  it('--workspace resolves through /workspaces to the gid param', async () => {
    const { fetchImpl, urls } = makeApiFetch();
    const h = makeHarness({ fetchImpl });
    expect(await runCli(['projects', 'list', '--no-input', '--workspace', 'acme'], h.deps)).toBe(0);
    expect(urls[0]!.pathname.endsWith('/workspaces')).toBe(true);
    expect(urls[1]!.searchParams.get('workspace')).toBe('ws1');
  });

  it('unknown --workspace -> exit 3 (TS006)', async () => {
    const { fetchImpl } = makeApiFetch();
    const h = makeHarness({ fetchImpl });
    expect(
      await runCli(['projects', 'list', '--no-input', '--workspace', 'Nope', '--json'], h.deps)
    ).toBe(3);
    const envelope = JSON.parse(h.stderr()) as {
      error: { code: number; name: string; error_code?: string; message: string };
    };
    expect(envelope.error.code).toBe(3);
    expect(envelope.error.name).toBe('NOT_FOUND');
    expect(envelope.error.error_code).toBe('TS006');
  });

  it('config-file workspace and limit act as defaults; flags win', async () => {
    const home = makeTempDir();
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const dir = configDir({}, () => home);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'ts-projects_config.toml'),
      'token = "ignored-file-token"\nworkspace = "Acme"\nlimit = 25\n',
      { mode: 0o600 }
    );
    const noToken = makeHarness({ env: {}, homedir: () => home });
    expect(await runCli(['projects', 'list', '--no-input'], noToken.deps)).toBe(4);

    const first = makeApiFetch();
    const h = makeHarness({ homedir: () => home, fetchImpl: first.fetchImpl });
    expect(await runCli(['projects', 'list', '--no-input'], h.deps)).toBe(0);
    expect(first.urls[1]!.searchParams.get('limit')).toBe('25');

    const second = makeApiFetch();
    const h2 = makeHarness({ homedir: () => home, fetchImpl: second.fetchImpl });
    await runCli(['projects', 'list', '--no-input', '--limit', '7'], h2.deps);
    expect(second.urls[1]!.searchParams.get('limit')).toBe('7');
  });
});

describe('sinks (--output-file & --copy)', () => {
  it('--output-file writes the result file; stdout stays empty', async () => {
    const dir = makeTempDir();
    const file = join(dir, 'output.csv');
    const h = makeHarness();
    expect(
      await runCli(['projects', 'list', '--no-input', '-o', 'csv', '--output-file', file], h.deps)
    ).toBe(0);
    expect(readFileSync(file, 'utf8')).toContain('Name,Workspace,ID\nAlpha,Acme,1');
    expect(h.stdout()).toBe('');
    expect(h.stderr()).toContain(`Results written to ${file}`);
  });

  it('--copy hands the exact formatted result to the clipboard', async () => {
    const clipboard = vi.fn<ClipboardWriter>(() => Promise.resolve());
    const h = makeHarness({ clipboard });
    expect(await runCli(['projects', 'list', '--no-input', '-o', 'csv', '--copy'], h.deps)).toBe(0);
    expect(clipboard).toHaveBeenCalledWith(
      'Name,Workspace,ID\nAlpha,Acme,1\n"Beta, ""quoted""",Acme,2'
    );
    expect(h.stderr()).toContain('Results copied to clipboard');
  });

  it('clipboard failure degrades: clear stderr error, exit 1, no crash', async () => {
    const clipboard = vi.fn<ClipboardWriter>(() =>
      Promise.reject(new Error("Couldn't find the `xsel` binary"))
    );
    const h = makeHarness({ clipboard });
    const code = await runCli(['projects', 'list', '--no-input', '--copy'], h.deps);
    expect(code).toBe(1);
    expect(h.stdout()).toContain('Alpha');
    expect(h.stderr()).toContain('Could not copy to clipboard');
    expect(h.stderr()).toContain('xsel');
  });
});

describe('spinner gating', () => {
  it('suppressed when stderr is not a TTY', async () => {
    const spinner = vi.fn<SpinnerFactory>(() => ({ stop: vi.fn<() => void>() }));
    const h = makeHarness({ spinner });
    await runCli(['projects', 'list', '--no-input'], h.deps);
    expect(spinner).not.toHaveBeenCalled();
  });

  it('runs (and stops) on a TTY stderr outside CI', async () => {
    const stop = vi.fn<() => void>();
    const spinner = vi.fn<SpinnerFactory>(() => ({ stop }));
    const h = makeInteractiveHarness([ALPHA], { spinner });
    await runCli(['projects', 'list', '--json'], h.deps);
    expect(spinner).toHaveBeenCalledWith('Fetching projects...');
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('suppressed under CI even on a TTY', async () => {
    const spinner = vi.fn<SpinnerFactory>(() => ({ stop: vi.fn<() => void>() }));
    const h = makeHarness({
      spinner,
      stderrIsTTY: true,
      env: { [TOKEN_ENV_VAR]: 'test-token-1234', CI: 'true' },
    });
    await runCli(['projects', 'list', '--no-input'], h.deps);
    expect(spinner).not.toHaveBeenCalled();
  });

  it('stops the spinner even when the fetch fails', async () => {
    const stop = vi.fn<() => void>();
    const spinner = vi.fn<SpinnerFactory>(() => ({ stop }));
    const { fetchImpl } = makeApiFetch(PROJECTS, { '/projects': new TypeError('fetch failed') });
    const h = makeHarness({ spinner, stderrIsTTY: true, fetchImpl });
    expect(await runCli(['projects', 'list', '--no-input'], h.deps)).toBe(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('preview table (stderr-only in interactive text mode)', () => {
  it('text mode + interactive: table on stderr, never stdout', async () => {
    const h = makeInteractiveHarness([ALPHA]);
    await runCli(['projects', 'list'], h.deps);
    expect(h.stderr()).toContain('Project Name');
    expect(h.stderr()).toContain('Workspace');
    expect(h.stderr()).toContain('Alpha');
    expect(h.stdout()).toContain('Projects (1)');
    expect(h.stderr()).not.toContain(' ID ');
  });

  it('--verbose adds the ID column to preview table', async () => {
    const h = makeInteractiveHarness([ALPHA]);
    await runCli(['-v', 'projects', 'list'], h.deps);
    expect(h.stderr()).toContain('ID');
  });

  it('json mode shows no preview table', async () => {
    const h = makeInteractiveHarness([ALPHA]);
    await runCli(['projects', 'list', '--json'], h.deps);
    expect(h.stderr()).not.toContain('Project Name');
  });
});

describe('API failure classes', () => {
  it('HTTP 500 API error -> exit 1 with the API message', async () => {
    const { fetchImpl } = makeApiFetch(PROJECTS, {
      '/projects': new Response(JSON.stringify({ errors: [{ message: 'boom' }] }), {
        status: 500,
      }),
    });
    const h = makeHarness({ fetchImpl });
    expect(await runCli(['projects', 'list', '--no-input'], h.deps)).toBe(1);
    expect(h.stderr()).toContain('API request failed: boom');
    expect(h.stdout()).toBe('');
  });
});

function exitPromptError(message: string): Error {
  const err = new Error(message);
  err.name = 'ExitPromptError';
  return err;
}

describe('prompt interrupt -> 130', () => {
  it('^C during the checkbox -> clean "Cancelled." on stderr, exit 130', async () => {
    const prompter = vi.fn<Prompter>(() =>
      Promise.reject(exitPromptError('User force closed the prompt with SIGINT'))
    );
    const h = makeInteractiveHarness([], { prompter });
    const code = await runCli(['projects', 'list'], h.deps);
    expect(code).toBe(130);
    expect(h.stdout()).toBe('');
    expect(h.stderr()).toContain('Cancelled.');
    expect(h.stderr()).not.toContain('force closed');
  });

  it('interrupt wins over the json error envelope', async () => {
    const prompter = vi.fn<Prompter>(() =>
      Promise.reject(exitPromptError('User force closed the prompt with SIGINT'))
    );
    const h = makeInteractiveHarness([], { prompter });
    expect(await runCli(['projects', 'list', '--json'], h.deps)).toBe(130);
    expect(h.stderr()).toBe('Cancelled.\n');
  });
});

describe('machine-mode JSON error envelope (ADR 0006)', () => {
  it('auth error under -o json -> {"error":{code,name,message,error_code,hint}}', async () => {
    const h = makeHarness({ env: {} });
    const code = await runCli(['projects', 'list', '--no-input', '-o', 'json'], h.deps);
    expect(code).toBe(4);
    expect(h.stdout()).toBe('');
    const envelope = JSON.parse(h.stderr()) as {
      error: {
        code: number;
        name: string;
        message: string;
        error_code?: string;
        hint?: string;
        traceback_path?: string;
      };
    };
    expect(envelope.error.code).toBe(4);
    expect(envelope.error.name).toBe('AUTH');
    expect(envelope.error.message).toBe(
      'No TS_PROJECTS_TOKEN found (never stored in the config file).'
    );
    expect(envelope.error.error_code).toBe('TS002');
    expect(envelope.error.hint).toContain('TS_PROJECTS_TOKEN');
    expect('traceback_path' in envelope.error).toBe(false);
  });

  it('API error under --json -> code:1, name:"ERROR", error_code:"TS003", omits undefined hint', async () => {
    const { fetchImpl } = makeApiFetch(PROJECTS, {
      '/projects': new Response(JSON.stringify({ errors: [{ message: 'boom' }] }), {
        status: 500,
      }),
    });
    const h = makeHarness({ fetchImpl });
    const code = await runCli(['projects', 'list', '--no-input', '--json'], h.deps);
    expect(code).toBe(1);
    const envelope = JSON.parse(h.stderr()) as {
      error: { code: number; name: string; message: string; error_code?: string; hint?: string };
    };
    expect(envelope.error).toEqual({
      code: 1,
      name: 'ERROR',
      message: 'API request failed: boom',
      error_code: 'TS003',
    });
    expect('hint' in envelope.error).toBe(false);
  });

  it('json-mode errors never carry a stack trace, even under -v', async () => {
    const h = makeHarness({ env: {} });
    await runCli(['-v', 'projects', 'list', '--no-input', '--json'], h.deps);
    expect(() => JSON.parse(h.stderr())).not.toThrow();
  });

  it('text mode keeps human Error: + (TS002) + hint:', async () => {
    const h = makeHarness({ env: {} });
    expect(await runCli(['projects', 'list', '--no-input'], h.deps)).toBe(4);
    expect(h.stderr()).toContain('Error:');
    expect(h.stderr()).toContain('TS002');
    expect(h.stderr()).toContain('hint:');
    expect(() => JSON.parse(h.stderr())).toThrow(SyntaxError);
  });

  it('Commander usage errors under --json emit valid JSON error envelope on stderr (exit 2)', async () => {
    const hMissingArg = makeHarness();
    expect(await runCli(['--json', 'projects', 'get'], hMissingArg.deps)).toBe(2);
    expect(hMissingArg.stdout()).toBe('');
    const missingEnv = JSON.parse(hMissingArg.stderr()) as {
      error: { code: number; name: string; message: string };
    };
    expect(missingEnv.error.code).toBe(2);
    expect(missingEnv.error.name).toBe('USAGE');
    expect(missingEnv.error.message).toContain("missing required argument 'id'");

    const hSub = makeHarness();
    expect(await runCli(['--json', 'projects', 'lst'], hSub.deps)).toBe(2);
    const subEnv = JSON.parse(hSub.stderr()) as {
      error: { code: number; name: string; message: string };
    };
    expect(subEnv.error.code).toBe(2);
    expect(subEnv.error.name).toBe('USAGE');
    expect(subEnv.error.message).toContain("unknown command 'lst'");
  });
});
