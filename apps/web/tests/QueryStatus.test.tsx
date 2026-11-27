// The small pieces on their own: the count's singular, and QueryError's
// fallback text when what failed isn't an Error.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { projectCount } from '../src/projects/ProjectsTable.js';
import { QueryError } from '../src/projects/QueryStatus.js';

afterEach(cleanup);

describe('projectCount', () => {
  it.each([
    [0, '0 projects'],
    [1, '1 project'],
    [4, '4 projects'],
  ])('%d -> %s', (count, text) => {
    expect(projectCount(count)).toBe(text);
  });
});

describe('QueryError', () => {
  it('shows a generic message for a non-Error value, never the raw value', () => {
    render(<QueryError error="raw detail" onRetry={() => {}} onClearFilter={() => {}} />);
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong.');
    expect(screen.getByRole('alert').textContent).not.toContain('raw detail');
  });
});
