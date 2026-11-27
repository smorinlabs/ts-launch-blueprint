// The filter in the URL: read on load, written with replaceState (no new
// history entry), removed when cleared or blank.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  readWorkspace,
  useWorkspaceParam,
  withWorkspace,
} from '../src/projects/workspace-param.js';

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('readWorkspace / withWorkspace', () => {
  it('reads and trims ?workspace=, and treats blank as none', () => {
    expect(readWorkspace('?workspace=marketing')).toBe('marketing');
    expect(readWorkspace('?workspace=%20eng%20')).toBe('eng');
    expect(readWorkspace('?workspace=%20%20')).toBe('');
    expect(readWorkspace('')).toBe('');
  });

  it('sets, replaces and removes the param, keeping the rest of the URL', () => {
    expect(withWorkspace('http://x/?a=1', ' eng ')).toBe('http://x/?a=1&workspace=eng');
    expect(withWorkspace('http://x/?workspace=eng#top', 'ops')).toBe('http://x/?workspace=ops#top');
    expect(withWorkspace('http://x/?workspace=eng', '  ')).toBe('http://x/');
  });
});

describe('useWorkspaceParam', () => {
  it('starts from the URL', () => {
    window.history.replaceState(null, '', '/?workspace=marketing');
    const { result } = renderHook(() => useWorkspaceParam());
    expect(result.current[0]).toBe('marketing');
  });

  it('Apply and Clear update the URL with replaceState, not a new history entry', () => {
    const { result } = renderHook(() => useWorkspaceParam());
    const entries = window.history.length;
    act(() => result.current[1](' engineering '));
    expect(result.current[0]).toBe('engineering');
    expect(window.location.search).toBe('?workspace=engineering');
    act(() => result.current[1](''));
    expect(result.current[0]).toBe('');
    expect(window.location.search).toBe('');
    expect(window.history.length).toBe(entries);
  });
});
