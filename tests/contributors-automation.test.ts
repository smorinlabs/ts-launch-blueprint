// Blueprint-only contributors-automation meta-tests (S6a: D-022(11), D-024(9)).
// Removed from pressed child repositories alongside .contributors.yml,
// CONTRIBUTORS.md, and .github/workflows/update-contributors.yml.
// cspell:ignore smorinlabs
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const REPO_ROOT = resolve(import.meta.dirname, '..');

describe('template contributors automation (blueprint-only)', () => {
  it('CONTRIBUTORS.md contains the contributors-please marker comments', () => {
    const contributors = readFileSync(join(REPO_ROOT, 'CONTRIBUTORS.md'), 'utf8');
    expect(contributors).toContain('<!-- contributors-please:start -->');
    expect(contributors).toContain('<!-- contributors-please:end -->');
  });

  it('.contributors.yml marker config matches the markers actually in CONTRIBUTORS.md', () => {
    const config = parse(readFileSync(join(REPO_ROOT, '.contributors.yml'), 'utf8')) as {
      in_place_marker_start: string;
      in_place_marker_end: string;
    };
    const contributors = readFileSync(join(REPO_ROOT, 'CONTRIBUTORS.md'), 'utf8');
    expect(contributors).toContain(config.in_place_marker_start);
    expect(contributors).toContain(config.in_place_marker_end);
  });

  it('update-contributors.yml parses, declares explicit permissions, and calls contributors-please-action', () => {
    const file = join(REPO_ROOT, '.github', 'workflows', 'update-contributors.yml');
    const raw = readFileSync(file, 'utf8');
    const parsed = parse(raw) as {
      permissions: Record<string, string>;
      jobs: Record<string, { permissions?: Record<string, string> }>;
    };
    expect(Object.prototype.hasOwnProperty.call(parsed, 'permissions')).toBe(true);
    const jobPermissions = Object.values(parsed.jobs)[0]?.permissions;
    expect(jobPermissions).toBeDefined();
    expect(raw).toContain('smorinlabs/contributors-please-action@');
  });

  it('contributor automation files never reference the replaced update_contributors.py script', () => {
    const files = [
      'CONTRIBUTORS.md',
      '.contributors.yml',
      '.github/workflows/update-contributors.yml',
    ];
    for (const relPath of files) {
      const content = readFileSync(join(REPO_ROOT, relPath), 'utf8');
      expect(content).not.toContain('update_contributors.py');
    }
  });
});
