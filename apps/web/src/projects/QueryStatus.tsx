// What a query shows when it has no data to render: loading, empty, or an
// error with the one action that can help (D-055). Reusable for any screen:
// pass the text, the error and the actions.
import type { ReactElement, ReactNode } from 'react';

import { errorKind } from './errors.js';

/** A polite status line: loading, or nothing found. `<output>` has the
 * implicit `status` role, so screen readers announce it. */
export function QueryMessage(props: { children: ReactNode }): ReactElement {
  return <output className="query-status">{props.children}</output>;
}

/** The API's message (already safe for clients, D-049), plus Try again for
 * server errors or Clear filter when what was asked for doesn't exist. A bad
 * request gets neither: the same input would fail the same way. */
export function QueryError(props: {
  error: unknown;
  onRetry: () => void;
  onClearFilter: () => void;
}): ReactElement {
  const kind = errorKind(props.error);
  const message = props.error instanceof Error ? props.error.message : 'Something went wrong.';
  return (
    <div className="query-status query-status--error" role="alert">
      <p>{message}</p>
      {kind === 'server' && (
        <button type="button" onClick={props.onRetry}>
          Try again
        </button>
      )}
      {kind === 'not-found' && (
        <button type="button" onClick={props.onClearFilter}>
          Clear filter
        </button>
      )}
    </div>
  );
}
