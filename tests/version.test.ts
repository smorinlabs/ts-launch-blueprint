import { describe, expect, it } from 'vitest';

import packageJson from '../package.json' with { type: 'json' };
import { VERSION as LIB_VERSION, type Project } from '../src/lib.js';
import { VERSION } from '../src/version.js';

// SemVer 2.0.0 shape (https://semver.org), no prerelease/build expected here.
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

describe('VERSION', () => {
  it('matches the package.json version', () => {
    expect(VERSION).toBe(packageJson.version);
  });

  it('has a semver shape', () => {
    expect(VERSION).toMatch(SEMVER_RE);
  });

  it('is re-exported unchanged from the library root', () => {
    expect(LIB_VERSION).toBe(VERSION);
  });

  it('library exposes the Project type stub', () => {
    const project: Project = { id: 'p1', name: 'example' };
    expect(project.name).toBe('example');
  });
});
