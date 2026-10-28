// The page through the real providers and typed client, with fetch mocked to
// return tRPC batch responses (the client batches, D-054): loading, the
// project list, an error message, and the exact request URL.
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import { App } from '../src/App.js';
import { Providers } from '../src/providers.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A fetch that answers every request with `body` (JSON) and `status`. */
function mockFetch(body: unknown, status = 200): Mock<typeof fetch> {
  const fetchMock = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderApp(): void {
  // No retries: an error shows at once.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <Providers queryClient={queryClient} apiBaseUrl="">
      <App />
    </Providers>
  );
}

describe('App', () => {
  it('shows loading, then the projects as name (workspace)', async () => {
    mockFetch([
      {
        result: {
          data: {
            projects: [
              { id: 'p-1', name: 'Apollo', workspace: { name: 'Engineering' } },
              { id: 'p-2', name: 'Hermes', workspace: { name: 'Design' } },
            ],
          },
        },
      },
    ]);
    renderApp();
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeDefined();
    expect(screen.getByText('Loading projects…')).toBeDefined();
    expect(await screen.findByText('Apollo (Engineering)')).toBeDefined();
    expect(screen.getByText('Hermes (Design)')).toBeDefined();
  });

  it('calls exactly /trpc/projects.list as a batch', async () => {
    const fetchMock = mockFetch([{ result: { data: { projects: [] } } }]);
    renderApp();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(decodeURIComponent(String(url))).toBe('/trpc/projects.list?batch=1&input={}');
  });

  it("shows the API's error message (a 502 envelope)", async () => {
    mockFetch(
      [
        {
          error: {
            message: 'Upstream projects API error',
            code: -32_603,
            data: { code: 'BAD_GATEWAY', httpStatus: 502, path: 'projects.list' },
          },
        },
      ],
      502
    );
    renderApp();
    expect((await screen.findByRole('alert')).textContent).toBe('Upstream projects API error');
  });
});
