// In-process tests for the projects command — port of tests/test_cli.py
// via runCli(argv, deps) with every boundary faked at the CliDeps seams
// (D-019(4,5)). The source's three mis-mocked prompt tests
// (test_cli.py:82,100,155 set mock_checkbox.ask instead of
// mock_checkbox.return_value.ask, silently exercising the empty-
// selection path) are ported with CORRECT seams and BOTH paths pinned:
// populated selection -> format/sink path, empty selection -> exit 0.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ClipboardWriter, Prompter, SpinnerFactory } from '../src/lib/adapters.js';
import type { Project } from '../src/lib/api.js';
import { TOKEN_ENV_VAR } from '../src/lib/config.js';
import { type CliDeps, runCli } from '../src/router.js';

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

/** Route-aware fetch fake serving the canned workspace/project data. */
function makeApiFetch(
  projects: Project[] = PROJECTS,
  overrides: Partial<Record<'/workspaces' | '/projects', Response | Error>> = {}
): FetchFake {
  const urls: URL[] = [];
  const fetchImpl = ((input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    urls.push(url);
    const route = url.pathname.endsWith('/workspaces') ? '/workspaces' : '/projects';
    const override = overrides[route];
    if (override instanceof Error) {
      return Promise.reject(override);
    }
    if (override !== undefined) {
      return Promise.resolve(override);
    }
    const body = route === '/workspaces' ? { data: WORKSPACES } : { data: projects };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
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

/** Interactive TTY harness with a canned selection (correct-seam port
 * of the source's mock_checkbox.return_value.ask pattern). */
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

describe('token handling (test_cli_no_token / test_cli_with_token parity)', () => {
  it('missing token everywhere -> exit 4, no network call', async () => {
    const { fetchImpl, urls } = makeApiFetch();
    const h = makeHarness({ env: {}, fetchImpl });
    expect(await runCli(['projects'], h.deps)).toBe(4);
    expect(h.stderr()).toContain('No TS_PROJECTS_TOKEN found');
    expect(h.stdout()).toBe('');
    expect(urls).toHaveLength(0);
  });

  it('token provided -> exit 0 even when nothing is selected', async () => {
    const h = makeInteractiveHarness([]);
    expect(await runCli(['--token', 'test', 'projects'], h.deps)).toBe(0);
  });

  it('API 401 (bad token) -> exit 4', async () => {
    const { fetchImpl } = makeApiFetch(PROJECTS, {
      '/projects': new Response(JSON.stringify({ errors: [{ message: 'Not authorized' }] }), {
        status: 401,
      }),
    });
    const h = makeHarness({ fetchImpl });
    expect(await runCli(['projects', '--no-input'], h.deps)).toBe(4);
    expect(h.stderr()).toContain('API authentication failed');
  });
});

describe('selection paths (BOTH pinned, correcting the source mis-mock)', () => {
  it('populated selection flows into the formatter (json)', async () => {
    const h = makeInteractiveHarness([ALPHA]);
    expect(await runCli(['projects', '--format', 'json'], h.deps)).toBe(0);
    expect(JSON.parse(h.stdout())).toEqual({ projects: [ALPHA] });
    expect(h.prompter).toHaveBeenCalledTimes(1);
  });

  it('prompt choices carry "Name (Workspace)" labels and full values', async () => {
    const h = makeInteractiveHarness([ALPHA]);
    await runCli(['projects', '--format', 'json'], h.deps);
    expect(h.prompter).toHaveBeenCalledWith('Select projects:', [
      { name: 'Alpha (Acme)', value: ALPHA },
      { name: 'Beta, "quoted" (Acme)', value: BETA },
    ]);
  });

  it('empty selection -> "No projects selected" on stderr, exit 0', async () => {
    const h = makeInteractiveHarness([]);
    expect(await runCli(['projects', '--format', 'json'], h.deps)).toBe(0);
    expect(h.stdout()).toBe('');
    expect(h.stderr()).toContain('No projects selected');
  });

  it('--no-input skips the prompt and selects all', async () => {
    const h = makeInteractiveHarness([ALPHA]);
    expect(await runCli(['--no-input', 'projects', '--format', 'json'], h.deps)).toBe(0);
    expect(h.prompter).not.toHaveBeenCalled();
    expect(JSON.parse(h.stdout())).toEqual({ projects: PROJECTS });
  });

  it('non-TTY stdin skips the prompt and selects all (documented path)', async () => {
    const prompter = vi.fn<Prompter>(() => Promise.resolve([ALPHA]));
    const h = makeHarness({ prompter });
    expect(await runCli(['projects', '--format', 'json'], h.deps)).toBe(0);
    expect(prompter).not.toHaveBeenCalled();
    expect(JSON.parse(h.stdout())).toEqual({ projects: PROJECTS });
  });

  it('empty fetch result -> "No projects found." on stderr, exit 0', async () => {
    const { fetchImpl } = makeApiFetch([]);
    const h = makeHarness({ fetchImpl });
    expect(await runCli(['projects', '--no-input'], h.deps)).toBe(0);
    expect(h.stdout()).toBe('');
    expect(h.stderr()).toContain('No projects found.');
  });
});

describe('output formats (test_cli_output_formats parity, clean stdout)', () => {
  it('json: stdout is exactly one parseable document (no stripping)', async () => {
    const h = makeHarness();
    expect(await runCli(['projects', '--no-input', '--format', 'json'], h.deps)).toBe(0);
    expect(h.stdout()).toBe(`${JSON.stringify({ projects: PROJECTS }, null, 2)}\n`);
    expect(h.stderr()).not.toContain('Fetching');
  });

  it('csv: literal id,name header; RFC 4180 quoting only when needed', async () => {
    const h = makeHarness();
    expect(await runCli(['projects', '--no-input', '--format', 'csv'], h.deps)).toBe(0);
    expect(h.stdout()).toBe('id,name\n1,Alpha\n2,"Beta, ""quoted"""\n');
  });

  it('text: newline-joined project IDs (source format_output parity)', async () => {
    const h = makeHarness();
    expect(await runCli(['projects', '--no-input', '--format', 'text'], h.deps)).toBe(0);
    expect(h.stdout()).toBe('1\n2\n');
  });

  it('format defaults to text', async () => {
    const h = makeHarness();
    expect(await runCli(['projects', '--no-input'], h.deps)).toBe(0);
    expect(h.stdout()).toBe('1\n2\n');
  });
});

describe('limit and workspace forwarding (test_cli_workspace_filter parity)', () => {
  it('default limit 200 reaches the API request', async () => {
    const { fetchImpl, urls } = makeApiFetch();
    const h = makeHarness({ fetchImpl });
    await runCli(['projects', '--no-input'], h.deps);
    expect(urls[0]!.searchParams.get('limit')).toBe('200');
  });

  it('--limit is forwarded', async () => {
    const { fetchImpl, urls } = makeApiFetch();
    const h = makeHarness({ fetchImpl });
    await runCli(['projects', '--no-input', '--limit', '50'], h.deps);
    expect(urls[0]!.searchParams.get('limit')).toBe('50');
  });

  it('--workspace resolves through /workspaces to the gid param', async () => {
    const { fetchImpl, urls } = makeApiFetch();
    const h = makeHarness({ fetchImpl });
    expect(await runCli(['projects', '--no-input', '--workspace', 'acme'], h.deps)).toBe(0);
    expect(urls[0]!.pathname.endsWith('/workspaces')).toBe(true);
    expect(urls[1]!.searchParams.get('workspace')).toBe('ws1');
  });

  it('unknown --workspace -> exit 3 (not-found)', async () => {
    const { fetchImpl } = makeApiFetch();
    const h = makeHarness({ fetchImpl });
    expect(await runCli(['projects', '--no-input', '--workspace', 'Nope'], h.deps)).toBe(3);
    expect(h.stderr()).toContain('Workspace not found: Nope');
  });

  it('config-file workspace and limit act as defaults; flags win', async () => {
    const home = makeTempDir();
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const dir = join(home, '.config', 'ts-projects');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'ts-projects_config.toml'),
      'token = "file-token-999"\nworkspace = "Acme"\nlimit = 25\n',
      { mode: 0o600 }
    );
    const first = makeApiFetch();
    const h = makeHarness({ env: {}, homedir: () => home, fetchImpl: first.fetchImpl });
    expect(await runCli(['projects', '--no-input'], h.deps)).toBe(0);
    expect(first.urls[0]!.pathname.endsWith('/workspaces')).toBe(true);
    expect(first.urls[1]!.searchParams.get('limit')).toBe('25');
    expect(first.urls[1]!.searchParams.get('workspace')).toBe('ws1');

    const second = makeApiFetch();
    const h2 = makeHarness({ env: {}, homedir: () => home, fetchImpl: second.fetchImpl });
    await runCli(['projects', '--no-input', '--limit', '7'], h2.deps);
    expect(second.urls[1]!.searchParams.get('limit')).toBe('7');
  });
});

describe('sinks (test_cli_output_file / test_cli_copy_to_clipboard parity)', () => {
  it('--output writes the result file; stdout stays empty', async () => {
    const dir = makeTempDir();
    const file = join(dir, 'output.txt');
    const h = makeHarness();
    expect(await runCli(['projects', '--no-input', '--output', file], h.deps)).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe('1\n2');
    expect(h.stdout()).toBe('');
    expect(h.stderr()).toContain(`Results written to ${file}`);
  });

  it('--copy hands the exact formatted result to the clipboard', async () => {
    const clipboard = vi.fn<ClipboardWriter>(() => Promise.resolve());
    const h = makeHarness({ clipboard });
    expect(await runCli(['projects', '--no-input', '--format', 'csv', '--copy'], h.deps)).toBe(0);
    expect(clipboard).toHaveBeenCalledWith('id,name\n1,Alpha\n2,"Beta, ""quoted"""');
    expect(h.stderr()).toContain('Results copied to clipboard');
  });

  it('clipboard failure degrades: clear stderr error, exit 1, no crash', async () => {
    const clipboard = vi.fn<ClipboardWriter>(() =>
      Promise.reject(new Error("Couldn't find the `xsel` binary"))
    );
    const h = makeHarness({ clipboard });
    const code = await runCli(['projects', '--no-input', '--copy'], h.deps);
    expect(code).toBe(1);
    // The result already reached stdout before the copy was attempted.
    expect(h.stdout()).toBe('1\n2\n');
    expect(h.stderr()).toContain('Could not copy to clipboard');
    expect(h.stderr()).toContain('xsel');
    expect(h.stderr()).not.toContain('Results copied');
  });
});

describe('spinner gating (D-016(5), D-018(5))', () => {
  it('suppressed when stderr is not a TTY', async () => {
    const spinner = vi.fn<SpinnerFactory>(() => ({ stop: vi.fn<() => void>() }));
    const h = makeHarness({ spinner });
    await runCli(['projects', '--no-input'], h.deps);
    expect(spinner).not.toHaveBeenCalled();
  });

  it('runs (and stops) on a TTY stderr outside CI', async () => {
    const stop = vi.fn<() => void>();
    const spinner = vi.fn<SpinnerFactory>(() => ({ stop }));
    const h = makeInteractiveHarness([ALPHA], { spinner });
    await runCli(['projects', '--format', 'json'], h.deps);
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
    await runCli(['projects', '--no-input'], h.deps);
    expect(spinner).not.toHaveBeenCalled();
  });

  it('stops the spinner even when the fetch fails', async () => {
    const stop = vi.fn<() => void>();
    const spinner = vi.fn<SpinnerFactory>(() => ({ stop }));
    const { fetchImpl } = makeApiFetch(PROJECTS, { '/projects': new TypeError('fetch failed') });
    const h = makeHarness({ spinner, stderrIsTTY: true, fetchImpl });
    expect(await runCli(['projects', '--no-input'], h.deps)).toBe(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('preview table (display_projects parity, stderr-only)', () => {
  it('text mode + interactive: table on stderr, never stdout', async () => {
    const h = makeInteractiveHarness([ALPHA]);
    await runCli(['projects'], h.deps);
    expect(h.stderr()).toContain('Project Name');
    expect(h.stderr()).toContain('Workspace');
    expect(h.stderr()).toContain('Alpha');
    expect(h.stdout()).toBe('1\n');
    expect(h.stderr()).not.toContain(' ID ');
  });

  it('--verbose adds the ID column', async () => {
    const h = makeInteractiveHarness([ALPHA]);
    await runCli(['-v', 'projects'], h.deps);
    expect(h.stderr()).toContain('ID');
  });

  it('json mode shows no table (source format == "text" gate)', async () => {
    const h = makeInteractiveHarness([ALPHA]);
    await runCli(['projects', '--format', 'json'], h.deps);
    expect(h.stderr()).not.toContain('Project Name');
  });

  it('non-interactive runs show no table', async () => {
    const h = makeHarness();
    await runCli(['projects', '--no-input'], h.deps);
    expect(h.stderr()).not.toContain('Project Name');
  });
});

describe('API failure classes (source exit-3 gap closure, remapped)', () => {
  it('HTTP 500 API error -> exit 1 with the API message', async () => {
    const { fetchImpl } = makeApiFetch(PROJECTS, {
      '/projects': new Response(JSON.stringify({ errors: [{ message: 'boom' }] }), {
        status: 500,
      }),
    });
    const h = makeHarness({ fetchImpl });
    expect(await runCli(['projects', '--no-input'], h.deps)).toBe(1);
    expect(h.stderr()).toContain('API request failed: boom');
    expect(h.stdout()).toBe('');
  });

  it('network failure -> exit 1 (D-016(2): API/network -> 1, was 3)', async () => {
    const { fetchImpl } = makeApiFetch(PROJECTS, { '/projects': new TypeError('fetch failed') });
    const h = makeHarness({ fetchImpl });
    expect(await runCli(['projects', '--no-input'], h.deps)).toBe(1);
    expect(h.stderr()).toContain('API request failed');
  });
});

/** @inquirer/prompts rejects with ExitPromptError on ^C and on
 * stdin-close mid-prompt; the router detects it by name so the prompt
 * stack stays a dynamic import. */
function exitPromptError(message: string): Error {
  const err = new Error(message);
  err.name = 'ExitPromptError';
  return err;
}

describe('prompt interrupt -> 130 (D-033)', () => {
  it('^C during the checkbox -> clean "Cancelled." on stderr, exit 130', async () => {
    const prompter = vi.fn<Prompter>(() =>
      Promise.reject(exitPromptError('User force closed the prompt with SIGINT'))
    );
    const h = makeInteractiveHarness([], { prompter });
    const code = await runCli(['projects'], h.deps);
    expect(code).toBe(130);
    expect(h.stdout()).toBe('');
    expect(h.stderr()).toContain('Cancelled.');
    // No leaked library internals (the validator-observed message).
    expect(h.stderr()).not.toContain('force closed');
  });

  it('stdin-close during the prompt -> same clean 130', async () => {
    const prompter = vi.fn<Prompter>(() =>
      Promise.reject(exitPromptError('User force closed the prompt with 13 null'))
    );
    const h = makeInteractiveHarness([], { prompter });
    expect(await runCli(['projects'], h.deps)).toBe(130);
    expect(h.stderr()).toContain('Cancelled.');
    expect(h.stderr()).not.toContain('13 null');
  });

  it('interrupt wins over the json error envelope', async () => {
    const prompter = vi.fn<Prompter>(() =>
      Promise.reject(exitPromptError('User force closed the prompt with SIGINT'))
    );
    const h = makeInteractiveHarness([], { prompter });
    expect(await runCli(['projects', '--format', 'json'], h.deps)).toBe(130);
    expect(h.stderr()).toBe('Cancelled.\n');
  });
});

describe('machine-mode error envelope (D-018(4)/D-033, R7.8)', () => {
  it('auth error under --format json -> single {"error":{code,message}} object', async () => {
    const h = makeHarness({ env: {} });
    const code = await runCli(['projects', '--no-input', '--format', 'json'], h.deps);
    expect(code).toBe(4);
    expect(h.stdout()).toBe('');
    const envelope = JSON.parse(h.stderr()) as { error: { code: string; message: string } };
    expect(envelope.error.code).toBe('AuthError');
    // Concise single-line message: the multi-remedy tutorial stays
    // human-mode only.
    expect(envelope.error.message).toBe(
      'No TS_PROJECTS_TOKEN found in environment or config file.'
    );
  });

  it('API error under --json -> ApiError envelope, exit 1', async () => {
    const { fetchImpl } = makeApiFetch(PROJECTS, {
      '/projects': new Response(JSON.stringify({ errors: [{ message: 'boom' }] }), {
        status: 500,
      }),
    });
    const h = makeHarness({ fetchImpl });
    const code = await runCli(['projects', '--no-input', '--json'], h.deps);
    expect(code).toBe(1);
    const envelope = JSON.parse(h.stderr()) as { error: { code: string; message: string } };
    expect(envelope.error).toEqual({ code: 'ApiError', message: 'API request failed: boom' });
  });

  it('json-mode errors never carry a stack trace, even under -v', async () => {
    const h = makeHarness({ env: {} });
    await runCli(['-v', 'projects', '--no-input', '--format', 'json'], h.deps);
    expect(() => JSON.parse(h.stderr())).not.toThrow();
  });

  it('text mode keeps the human error text (no envelope)', async () => {
    const h = makeHarness({ env: {} });
    expect(await runCli(['projects', '--no-input'], h.deps)).toBe(4);
    expect(h.stderr()).toContain('Error:');
    expect(() => JSON.parse(h.stderr())).toThrow(SyntaxError);
  });
});

describe('--json alias (cli-standards R4.2, D-033)', () => {
  it('--json output is byte-identical to --format json', async () => {
    const first = makeHarness();
    await runCli(['projects', '--no-input', '--format', 'json'], first.deps);
    const second = makeHarness();
    await runCli(['projects', '--no-input', '--json'], second.deps);
    expect(second.stdout()).toBe(first.stdout());
    expect(JSON.parse(second.stdout())).toEqual({ projects: PROJECTS });
  });

  it('--json suppresses the text-mode preview table', async () => {
    const h = makeInteractiveHarness([ALPHA]);
    await runCli(['projects', '--json'], h.deps);
    expect(h.stderr()).not.toContain('Project Name');
    expect(JSON.parse(h.stdout())).toEqual({ projects: [ALPHA] });
  });

  it('--json conflicting with an explicit --format is a usage error', async () => {
    const h = makeHarness();
    expect(await runCli(['projects', '--no-input', '--json', '--format', 'csv'], h.deps)).toBe(2);
    expect(h.stderr()).toContain('cannot be used with');
  });
});

describe('default command dispatch (bare py-projects parity)', () => {
  it('bare invocation with flags runs projects', async () => {
    const h = makeHarness();
    expect(await runCli(['--no-input', '--format', 'json'], h.deps)).toBe(0);
    expect(JSON.parse(h.stdout())).toEqual({ projects: PROJECTS });
  });

  it('usage error inside the default command exits 2', async () => {
    const h = makeHarness();
    expect(await runCli(['--no-input', '--limit', 'abc'], h.deps)).toBe(2);
    expect(h.stderr()).toContain('positive integer');
  });
});
