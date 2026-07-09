// Repo-hygiene meta-tests (plan S2 field 7): the quality-gate configs must
// stay internally consistent, and the formatter gate must actually bite.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import commitlintConfig from '../commitlint.config.mjs';
import packageJson from '../package.json' with { type: 'json' };

const REPO_ROOT = resolve(import.meta.dirname, '..');

describe('commit-message contract (D-020(2,4))', () => {
  it('commitlint type-enum matches the .gitmessage type list exactly', () => {
    const rule = commitlintConfig.rules['type-enum'];
    expect(rule).toBeDefined();
    const commitlintTypes = rule[2];

    const gitmessage = readFileSync(join(REPO_ROOT, '.gitmessage'), 'utf8');
    const typesLine = gitmessage.split('\n').find((line) => line.startsWith('# Types:'));
    expect(typesLine).toBeDefined();
    const gitmessageTypes = typesLine!
      .replace('# Types:', '')
      .split(',')
      .map((t) => t.trim());

    // EXACT match — same members, same order (both lists are documentation
    // of one contract; drift here is the source repo's bug the port fixes).
    expect(gitmessageTypes).toEqual(commitlintTypes);
  });

  it('keeps the source 50/72 subject/body discipline', () => {
    expect(commitlintConfig.rules['header-max-length']).toEqual([2, 'always', 50]);
    expect(commitlintConfig.rules['body-max-line-length']).toEqual([2, 'always', 72]);
  });
});

describe('lefthook configuration (D-020(6))', () => {
  const lefthook = parse(readFileSync(join(REPO_ROOT, 'lefthook.yml'), 'utf8'));

  it('parses as YAML with pre-commit and commit-msg hooks', () => {
    expect(lefthook).toBeTypeOf('object');
    expect(lefthook['pre-commit']).toBeDefined();
    expect(lefthook['commit-msg']).toBeDefined();
  });

  it('pre-commit runs format (stage_fixed), lint, and full typecheck', () => {
    const jobs = lefthook['pre-commit'].jobs;
    const names = jobs.map((job: { name: string }) => job.name);
    expect(names).toContain('format');
    expect(names).toContain('lint');
    expect(names).toContain('typecheck');
    const format = jobs.find((job: { name: string }) => job.name === 'format');
    expect(format.stage_fixed).toBe(true);
  });

  it('pre-commit includes the large-file hygiene check (D-020(6))', () => {
    const jobs = lefthook['pre-commit'].jobs;
    const largeFiles = jobs.find((job: { name: string }) => job.name === 'check-large-files');
    expect(largeFiles).toBeDefined();
    // Runs over staged files and enforces the 500KB (512000-byte) ceiling.
    expect(largeFiles.run).toContain('{staged_files}');
    expect(largeFiles.run).toContain('512000');
  });

  it('commit-msg runs commitlint', () => {
    const jobs = lefthook['commit-msg'].jobs;
    expect(jobs.some((job: { run: string }) => job.run.includes('commitlint'))).toBe(true);
  });

  // Regression: oxfmt exits 2 (and oxlint exits 1) when EVERY path passed to
  // it is ignore-listed, which used to fail commits staging only port
  // artifacts (e.g. TS_PORT_LOG.md). The jobs' lefthook `exclude` lists must
  // mirror the tools' ignorePatterns so excluded files never reach the tools
  // and lefthook skips when no staged files remain.
  it('format/lint excludes mirror the tools ignorePatterns', () => {
    // Both configs are JSONC with full-line comments only.
    const readJsonc = (file: string): { ignorePatterns: string[] } => {
      const text = readFileSync(join(REPO_ROOT, file), 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n');
      return JSON.parse(text);
    };
    const jobs = lefthook['pre-commit'].jobs;
    const jobExclude = (name: string): string[] =>
      jobs.find((job: { name: string }) => job.name === name).exclude;

    expect(new Set(jobExclude('format'))).toEqual(
      new Set(readJsonc('.oxfmtrc.json').ignorePatterns)
    );
    expect(new Set(jobExclude('lint'))).toEqual(
      new Set(readJsonc('.oxlintrc.json').ignorePatterns)
    );
  });
});

describe('Node version pin consistency (D-011(3))', () => {
  it('.nvmrc major equals the engines.node floor major', () => {
    const nvmrcMajor = Number.parseInt(readFileSync(join(REPO_ROOT, '.nvmrc'), 'utf8').trim(), 10);
    const enginesMatch = packageJson.engines.node.match(/>=\s*(\d+)/);
    expect(enginesMatch).not.toBeNull();
    const enginesMajor = Number.parseInt(enginesMatch![1]!, 10);
    expect(nvmrcMajor).toBe(enginesMajor);
  });
});

describe('formatter gate is real (D-014)', () => {
  const oxfmtBin = join(REPO_ROOT, 'node_modules', '.bin', 'oxfmt');
  const configPath = join(REPO_ROOT, '.oxfmtrc.json');

  const checkSnippet = (source: string): number | null => {
    const dir = mkdtempSync(join(tmpdir(), 'oxfmt-gate-'));
    try {
      const file = join(dir, 'snippet.ts');
      writeFileSync(file, source);
      const result = spawnSync(oxfmtBin, ['-c', configPath, '--check', file], {
        cwd: dir,
        encoding: 'utf8',
      });
      return result.status;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('fails oxfmt --check for a misformatted snippet', () => {
    const status = checkSnippet('const   x = "double quoted"   ;;\nexport {x}\n');
    expect(status).not.toBe(0);
    expect(status).not.toBeNull();
  });

  it('passes oxfmt --check for a well-formatted snippet', () => {
    const status = checkSnippet("const x = 'single quoted';\nexport { x };\n");
    expect(status).toBe(0);
  });
});

describe('GitHub Actions workflows & Dependabot (S4: D-022, D-027)', () => {
  const WORKFLOW_DIR = join(REPO_ROOT, '.github', 'workflows');
  const workflowFiles = readdirSync(WORKFLOW_DIR).filter(
    (name) => name.endsWith('.yml') || name.endsWith('.yaml')
  );

  it('has the four expected S4 workflow files', () => {
    // ci, codeql, dependency-review, manual-pr-security-scan (+ any future).
    expect(workflowFiles.length).toBeGreaterThanOrEqual(4);
    expect(workflowFiles).toContain('ci.yml');
    expect(workflowFiles).toContain('codeql.yml');
    expect(workflowFiles).toContain('dependency-review.yml');
    expect(workflowFiles).toContain('manual-pr-security-scan.yml');
  });

  it.each(workflowFiles)('%s parses as YAML', (file) => {
    const parsed = parse(readFileSync(join(WORKFLOW_DIR, file), 'utf8'));
    expect(parsed).toBeTypeOf('object');
    expect(parsed).not.toBeNull();
  });

  it.each(workflowFiles)(
    '%s declares an explicit top-level permissions key (D-022(10))',
    (file) => {
      const parsed = parse(readFileSync(join(WORKFLOW_DIR, file), 'utf8')) as Record<
        string,
        unknown
      >;
      expect(Object.prototype.hasOwnProperty.call(parsed, 'permissions')).toBe(true);
    }
  );

  it('ci.yml Node matrix equals the D-027 values ["24.x","26.x"]', () => {
    const ci = parse(readFileSync(join(WORKFLOW_DIR, 'ci.yml'), 'utf8')) as {
      jobs: { ci: { strategy: { matrix: { 'node-version': string[] } } } };
    };
    expect(ci.jobs.ci.strategy.matrix['node-version']).toEqual(['24.x', '26.x']);
  });

  // Hybrid pinning policy (D-022(9)): official actions/* and github/* pin to a
  // major tag; every third-party action must be full-SHA-pinned with a trailing
  // version comment so Dependabot's github-actions ecosystem can refresh it.
  it('third-party actions are SHA-pinned with a version comment; official actions use tags', () => {
    const usesLineRe = /^\s*(?:-\s*)?uses:\s*(\S+)(?:\s*#\s*(.+?))?\s*$/;
    const shaRe = /^[0-9a-f]{40}$/;
    const majorTagRe = /^v\d/;
    // Collect violations (asserted once, outside the loop) so there is no
    // conditional expect, and count the third-party pins we verified.
    const violations: string[] = [];
    let thirdPartyChecked = 0;

    for (const file of workflowFiles) {
      const lines = readFileSync(join(WORKFLOW_DIR, file), 'utf8').split('\n');
      for (const line of lines) {
        // Skip commented-out scaffolding (first non-space char is '#').
        if (line.trimStart().startsWith('#')) continue;
        const match = line.match(usesLineRe);
        if (!match) continue;
        const [, spec, comment] = match;
        const atIndex = spec!.lastIndexOf('@');
        const repoPath = spec!.slice(0, Math.max(atIndex, 0));
        const ref = atIndex > 0 ? spec!.slice(atIndex + 1) : '';
        const org = repoPath.split('/')[0];

        if (atIndex <= 0) {
          violations.push(`${spec}: missing @ref`);
        } else if (org === 'actions' || org === 'github') {
          // Official actions: major-tag pin (e.g. v7), never a bare SHA.
          if (!majorTagRe.test(ref))
            violations.push(`${spec}: official action should use a vN tag`);
        } else {
          // Third-party: full 40-hex SHA + a trailing version comment.
          thirdPartyChecked += 1;
          if (!shaRe.test(ref)) violations.push(`${spec}: third-party action must be SHA-pinned`);
          if (!comment) violations.push(`${spec}: third-party action needs a version comment`);
        }
      }
    }

    expect(violations).toEqual([]);
    // The port pins at least setup-just and osv-scanner-action by SHA.
    expect(thirdPartyChecked).toBeGreaterThanOrEqual(2);
  });

  it('dependabot.yml lists both the github-actions and npm ecosystems (D-022(8))', () => {
    const dependabot = parse(
      readFileSync(join(REPO_ROOT, '.github', 'dependabot.yml'), 'utf8')
    ) as { version: number; updates: { 'package-ecosystem': string }[] };
    expect(dependabot.version).toBe(2);
    const ecosystems = dependabot.updates.map((u) => u['package-ecosystem']);
    expect(ecosystems).toContain('github-actions');
    expect(ecosystems).toContain('npm');
  });
});
