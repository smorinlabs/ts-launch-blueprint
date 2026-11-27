// The workspace filter lives in the URL (`?workspace=<name>`), so a filtered
// view can be linked and reloaded, with no router (D-055). Updates use
// history.replaceState: changing the filter isn't a new page to go back to.
import { useCallback, useState } from 'react';

/** The query-string parameter holding the filter. */
export const WORKSPACE_PARAM = 'workspace';

/** The trimmed filter in a query string; '' means no filter. */
export function readWorkspace(search: string): string {
  return (new URLSearchParams(search).get(WORKSPACE_PARAM) ?? '').trim();
}

/** `href` with the filter set to `workspace` (trimmed), or removed when empty. */
export function withWorkspace(href: string, workspace: string): string {
  const url = new URL(href);
  const trimmed = workspace.trim();
  if (trimmed === '') {
    url.searchParams.delete(WORKSPACE_PARAM);
  } else {
    url.searchParams.set(WORKSPACE_PARAM, trimmed);
  }
  return url.toString();
}

/** The current filter and a setter that also updates the URL (replaceState). */
export function useWorkspaceParam(): [string, (workspace: string) => void] {
  const [workspace, setState] = useState(() => readWorkspace(window.location.search));
  const setWorkspace = useCallback((next: string) => {
    window.history.replaceState(
      window.history.state,
      '',
      withWorkspace(window.location.href, next)
    );
    setState(next.trim());
  }, []);
  return [workspace, setWorkspace];
}
