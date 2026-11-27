// The API's base URL for the tRPC client (D-054). Empty by default: the
// browser calls its own origin, and in dev Vite proxies /trpc to the API
// (vite.config.ts). Set VITE_API_URL at build time for an API on another
// origin; that also needs CORS on the API, which isn't set up yet.

/** The API's base URL without a trailing slash; '' means the same origin. */
export function apiBaseUrl(env: Readonly<Record<string, unknown>> = import.meta.env): string {
  const url = env['VITE_API_URL'];
  return typeof url === 'string' ? url.replace(/\/+$/, '') : '';
}
