import { describe, expect, it } from 'vitest';

import packageJson from '../package.json' with { type: 'json' };
import { VERSION as INDEX_VERSION } from '../src/index.js';
import { VERSION } from '../src/version.js';

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

describe('core VERSION', () => {
  it('matches packages/core/package.json version', () => {
    expect(VERSION).toBe(packageJson.version);
  });

  it('has a valid SemVer 2.0.0 shape', () => {
    expect(VERSION).toMatch(SEMVER_RE);
  });

  it('is re-exported unchanged from src/index.ts', () => {
    expect(INDEX_VERSION).toBe(VERSION);
  });
});
