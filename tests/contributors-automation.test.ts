// Blueprint-only contributors-automation meta-tests (S6a: D-022(11), D-024(9)).
// Removed from pressed child repositories alongside .contributors.yml,
// CONTRIBUTORS.md, and .github/workflows/update-contributors.yml.
// cspell:ignore smorinlabs husnain
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

  it('update-contributors.yml triggers on push to main with paths-ignore and avoids [skip ci] deadlock', () => {
    const raw = readFileSync(
      join(REPO_ROOT, '.github', 'workflows', 'update-contributors.yml'),
      'utf8'
    );
    const parsed = parse(raw) as {
      on?: {
        push?: { branches?: string[]; 'paths-ignore'?: string[] };
        workflow_dispatch?: unknown;
      };
      jobs?: Record<
        string,
        {
          steps?: Array<{ uses?: string; with?: Record<string, unknown> }>;
        }
      >;
    };

    expect(parsed.on?.push?.branches).toEqual(['main']);
    expect(parsed.on?.push?.['paths-ignore']).toContain('CONTRIBUTORS.md');
    expect(parsed.on?.push?.['paths-ignore']).toContain('.contributors.jsonl');
    expect(Object.prototype.hasOwnProperty.call(parsed.on ?? {}, 'workflow_dispatch')).toBe(true);

    const steps = Object.values(parsed.jobs ?? {})[0]?.steps ?? [];
    const checkoutStep = steps.find((step) => step.uses?.startsWith('actions/checkout@'));
    expect(checkoutStep?.with?.['persist-credentials']).toBe(false);

    const contribStep = steps.find((step) =>
      step.uses?.startsWith('smorinlabs/contributors-please-action@')
    );
    expect(contribStep?.with?.['commit-message']).toBe('docs: update contributors');
    expect(contribStep?.with?.['commit-message']).not.toContain('[skip ci]');
  });

  it('.contributors.yml defines layout, bot ignores, docs/quality categories, project combination, and identity_map', () => {
    const parsed = parse(readFileSync(join(REPO_ROOT, '.contributors.yml'), 'utf8')) as {
      columns_per_row?: number;
      sort?: string;
      min_contributions?: number;
      ignore?: string[];
      classification?: {
        categories?: Array<{ id?: string; paths?: string[] }>;
        combinations?: Array<{ id?: string; when?: string[] }>;
        multi_category_resolution?: string;
      };
      identity_map?: Array<{ login?: string; emails?: string[] }>;
    };

    expect(parsed.columns_per_row).toBe(1);
    expect(parsed.sort).toBe('contributions');
    expect(parsed.min_contributions).toBe(1);
    expect(parsed.ignore).toEqual(
      expect.arrayContaining([
        'Copilot',
        'copilot-swe-agent[bot]',
        'claude',
        'github-actions[bot]',
        'dependabot[bot]',
        'release-please-smorinlabs[bot]',
        'blacksmith-sh[bot]',
      ])
    );

    const categoryIds = (parsed.classification?.categories ?? []).map((cat) => cat.id);
    expect(categoryIds).toContain('docs');
    expect(categoryIds).toContain('quality');
    const comboIds = (parsed.classification?.combinations ?? []).map((combo) => combo.id);
    expect(comboIds).toContain('project');
    expect(parsed.classification?.multi_category_resolution).toBe('priority');

    const logins = (parsed.identity_map ?? []).map((entry) => entry.login);
    expect(logins).toContain('smorin');
    expect(logins).toContain('husnain067');
  });
});
