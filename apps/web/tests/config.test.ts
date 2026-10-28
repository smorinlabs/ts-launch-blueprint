// apiBaseUrl: same origin by default, VITE_API_URL without a trailing slash.
import { describe, expect, it } from 'vitest';

import { apiBaseUrl } from '../src/config.js';

describe('apiBaseUrl', () => {
  it('is empty (same origin) when VITE_API_URL is unset or not a string', () => {
    expect(apiBaseUrl({})).toBe('');
    expect(apiBaseUrl({ VITE_API_URL: 42 })).toBe('');
  });

  it('uses VITE_API_URL without trailing slashes', () => {
    expect(apiBaseUrl({ VITE_API_URL: 'https://api.example' })).toBe('https://api.example');
    expect(apiBaseUrl({ VITE_API_URL: 'https://api.example//' })).toBe('https://api.example');
  });

  it("reads Vite's import.meta.env by default", () => {
    expect(apiBaseUrl()).toBe('');
  });
});
