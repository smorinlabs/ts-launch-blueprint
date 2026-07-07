// Repo-hygiene meta-tests (plan S2 field 7): the quality-gate configs must
// stay internally consistent, and the formatter gate must actually bite.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

  it('commit-msg runs commitlint', () => {
    const jobs = lefthook['commit-msg'].jobs;
    expect(jobs.some((job: { run: string }) => job.run.includes('commitlint'))).toBe(true);
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
