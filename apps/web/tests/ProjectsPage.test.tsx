// The projects screen through the real providers, typed client and retry
// policy, against a mocked API that answers tRPC batch requests like the
// real one: every state, the URL filter, and fetch counts for the retries.
import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import { App } from '../src/App.js';
import { Providers } from '../src/providers.js';
import { createQueryClient } from '../src/query-client.js';

const DEMO = [
  { id: 'p-1', name: 'API Platform', workspace: { name: 'Engineering' } },
  { id: 'p-2', name: 'Mobile App', workspace: { name: 'Engineering' } },
  { id: 'p-3', name: 'Website Redesign', workspace: { name: 'Marketing' } },
  { id: 'p-4', name: 'Launch Campaign', workspace: { name: 'Marketing' } },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

/** A tRPC batch response with one result or error. */
function envelope(body: unknown, status = 200): Response {
  return new Response(JSON.stringify([body]), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const errorEnvelope = (message: string, code: string, httpStatus: number): Response =>
  envelope({ error: { message, code: -32_000, data: { code, httpStatus } } }, httpStatus);

/** The decoded request URL of fetch call `index`. */
const requestUrl = (fetchMock: Mock<typeof fetch>, index: number): string =>
  decodeURIComponent(String(fetchMock.mock.calls[index]?.[0]));

/** A fetch answering like the API over the demo data: filters by workspace
 * (case-insensitive), 404 for an unknown one. */
function mockApi(): Mock<typeof fetch> {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const raw = new URL(String(input), 'http://localhost').searchParams.get('input') ?? '{}';
    const workspace = (JSON.parse(raw) as { 0?: { workspaceName?: string } })[0]?.workspaceName;
    if (workspace === undefined) {
      return envelope({ result: { data: { projects: DEMO, nextCursor: null } } });
    }
    const projects = DEMO.filter(
      (project) => project.workspace?.name.toLowerCase() === workspace.toLowerCase()
    );
    return projects.length === 0
      ? errorEnvelope(`Workspace not found: ${workspace}`, 'NOT_FOUND', 404)
      : envelope({ result: { data: { projects, nextCursor: null } } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** A fetch answering with each response in turn (the last one repeats). */
function mockResponses(...responses: (() => Response)[]): Mock<typeof fetch> {
  let call = 0;
  const fetchMock = vi.fn<typeof fetch>(async () => {
    const respond = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return respond!();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderApp(): void {
  render(
    <Providers queryClient={createQueryClient({ retryDelay: 0 })} apiBaseUrl="">
      <App />
    </Providers>
  );
}

/** The project names in the table, in order. */
function rowNames(): string[] {
  const table = screen.getByRole('table', { name: 'Projects' });
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '');
}

const failure = (): Response => errorEnvelope('Upstream projects API error', 'BAD_GATEWAY', 502);

describe('projects screen', () => {
  it('shows loading, then the table and the count', async () => {
    const fetchMock = mockApi();
    renderApp();
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('Loading projects…');
    expect(await screen.findByText('4 projects')).toBeDefined();
    expect(rowNames()).toEqual([
      'API Platform',
      'Mobile App',
      'Website Redesign',
      'Launch Campaign',
    ]);
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Project',
      'Workspace',
    ]);
    expect(requestUrl(fetchMock, 0)).toBe('/trpc/projects.list?batch=1&input={}');
  });

  it('filters on Enter: the batched input, 2 rows, the count and the URL', async () => {
    const fetchMock = mockApi();
    renderApp();
    await screen.findByText('4 projects');
    await userEvent.type(screen.getByLabelText('Workspace'), 'engineering{Enter}');
    expect(await screen.findByText('2 projects')).toBeDefined();
    expect(rowNames()).toEqual(['API Platform', 'Mobile App']);
    expect(requestUrl(fetchMock, 1)).toBe(
      '/trpc/projects.list?batch=1&input={"0":{"workspaceName":"engineering"}}'
    );
    expect(window.location.search).toBe('?workspace=engineering');
  });

  it('Apply works too, and a blank filter means no filter', async () => {
    const fetchMock = mockApi();
    renderApp();
    await screen.findByText('4 projects');
    await userEvent.type(screen.getByLabelText('Workspace'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(window.location.search).toBe('');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('loads the filter from the URL (a linked or reloaded view)', async () => {
    window.history.replaceState(null, '', '/?workspace=marketing');
    const fetchMock = mockApi();
    renderApp();
    expect(await screen.findByText('2 projects')).toBeDefined();
    expect(rowNames()).toEqual(['Website Redesign', 'Launch Campaign']);
    expect((screen.getByLabelText('Workspace') as HTMLInputElement).value).toBe('marketing');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('Clear resets the input, the URL and the full list', async () => {
    window.history.replaceState(null, '', '/?workspace=marketing');
    mockApi();
    renderApp();
    await screen.findByText('2 projects');
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(await screen.findByText('4 projects')).toBeDefined();
    expect((screen.getByLabelText('Workspace') as HTMLInputElement).value).toBe('');
    expect(window.location.search).toBe('');
  });

  it('renders an em dash when a project has null workspace', async () => {
    mockResponses(() =>
      envelope({
        result: {
          data: {
            projects: [{ id: 'p-5', name: 'Solo', workspace: null }],
            nextCursor: null,
          },
        },
      })
    );
    renderApp();
    expect(await screen.findByText('1 project')).toBeDefined();
    const cells = within(screen.getByRole('table', { name: 'Projects' })).getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent)).toEqual(['Solo', '—']);
  });

  it('empty: "No projects found." (with the workspace when filtered)', async () => {
    window.history.replaceState(null, '', '/?workspace=ops');
    mockResponses(() => envelope({ result: { data: { projects: [], nextCursor: null } } }));
    renderApp();
    expect(await screen.findByText('No projects found in workspace "ops".')).toBeDefined();
    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('empty with no filter: just "No projects found."', async () => {
    mockResponses(() => envelope({ result: { data: { projects: [], nextCursor: null } } }));
    renderApp();
    expect(await screen.findByText('No projects found.')).toBeDefined();
  });

  it('404: the message at once with Clear filter, no Try again, and no retry', async () => {
    const fetchMock = mockApi();
    renderApp();
    await screen.findByText('4 projects');
    await userEvent.type(screen.getByLabelText('Workspace'), 'nope{Enter}');
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Workspace not found: nope')).toBeDefined();
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2); // the full list, then nope once
    await userEvent.click(within(alert).getByRole('button', { name: 'Clear filter' }));
    expect(await screen.findByText('4 projects')).toBeDefined();
    expect(window.location.search).toBe('');
    expect((screen.getByLabelText('Workspace') as HTMLInputElement).value).toBe('');
  });

  it('400: the validation message, with neither Try again nor Clear filter', async () => {
    const fetchMock = mockResponses(() =>
      errorEnvelope('limit: Too small: expected number to be >0', 'BAD_REQUEST', 400)
    );
    renderApp();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('limit: Too small');
    expect(within(alert).queryAllByRole('button')).toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('502: 3 requests (1 + 2 retries), then Try again refetches and shows the table', async () => {
    const fetchMock = mockResponses(failure, failure, failure, () =>
      envelope({ result: { data: { projects: DEMO, nextCursor: null } } })
    );
    renderApp();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Upstream projects API error')).toBeDefined();
    expect(within(alert).queryByRole('button', { name: 'Clear filter' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('4 projects')).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('a non-tRPC failure (a network error) is a server error with Try again', async () => {
    mockResponses(() => {
      throw new TypeError('Failed to fetch');
    });
    renderApp();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it('keyboard only: Tab to the input, type, Enter to apply', async () => {
    mockApi();
    renderApp();
    await screen.findByText('4 projects');
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByLabelText('Workspace'));
    await userEvent.keyboard('marketing{Enter}');
    expect(await screen.findByText('2 projects')).toBeDefined();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Apply' }));
  });
});
