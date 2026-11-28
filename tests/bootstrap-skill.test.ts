// Contract tests for the blueprint-only new-ts-project bootstrap skill.
// [[remove]]d on `press rebrand` alongside .claude/skills/new-ts-project/SKILL.md.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const SKILL_DIR = join(REPO_ROOT, '.claude', 'skills', 'new-ts-project');
const SKILL_MD = join(SKILL_DIR, 'SKILL.md');
const SKILL_README = join(SKILL_DIR, 'README.md');
const AGENTS_SYMLINK = join(REPO_ROOT, '.agents', 'skills', 'new-ts-project');
const SKILL_DOC = join(REPO_ROOT, 'docs', 'skills', 'new-ts-project.md');

function parseSkillFrontmatter(text: string): { name?: unknown; description?: unknown } {
  const normalized = text.replaceAll('\r\n', '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n/);
  expect(match?.[1], 'SKILL.md must begin with YAML frontmatter').toBeTruthy();
  return parse(match![1]!) as { name?: unknown; description?: unknown };
}

function readPressIdentityKeys(): string[] {
  const raw = readFileSync(join(REPO_ROOT, 'press', 'press-source.toml'), 'utf8');
  const keys: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) continue;
    const match = trimmed.match(/^([a-z_][a-z0-9_]*)\s*=/);
    if (match?.[1]) keys.push(match[1]);
  }
  return keys;
}

describe('new-ts-project bootstrap skill (P07)', () => {
  it('declares valid YAML frontmatter with Codex-compatible <=1024 char description', () => {
    const skillText = readFileSync(SKILL_MD, 'utf8');
    const fm = parseSkillFrontmatter(skillText);
    expect(fm.name).toBe('new-ts-project');
    expect(typeof fm.description).toBe('string');
    const desc = fm.description as string;
    expect(desc.length).toBeGreaterThan(0);
    expect(desc.length).toBeLessThanOrEqual(1024);
  });

  it('collects all 8 [identity] keys (including cli_name) and documents the TS bootstrap workflow', () => {
    const skillText = readFileSync(SKILL_MD, 'utf8');
    const identityKeys = readPressIdentityKeys();
    expect(identityKeys).toEqual(
      expect.arrayContaining([
        'package_name',
        'repo_name',
        'app_name',
        'author',
        'email',
        'owner',
        'display_name',
        'cli_name',
      ])
    );
    for (const key of identityKeys) {
      expect(skillText, `SKILL.md missing identity key ${key}`).toContain(`${key} = `);
    }
    expect(skillText).toContain('uvx --from template-press==5.0.0 press');
    expect(skillText).toContain('make bootstrap');
    expect(skillText).toContain('just setup');
    expect(skillText).toContain('pnpm exec oxfmt');
    expect(skillText).toContain('scripts/smoke-api.sh');
  });

  it('never references nonexistent P13 docs (PROJECT_SETUP.md / POST_INIT.md)', () => {
    for (const filePath of [SKILL_MD, SKILL_README, SKILL_DOC]) {
      const content = readFileSync(filePath, 'utf8');
      expect(content).not.toContain('PROJECT_SETUP.md');
      expect(content).not.toContain('POST_INIT.md');
    }
  });

  it('commits .agents/skills/new-ts-project as a git symlink (120000)', () => {
    const stageLine = execFileSync(
      'git',
      ['ls-files', '--stage', '.agents/skills/new-ts-project'],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    ).trim();
    expect(stageLine).toMatch(/^120000\s/);
  });

  it.skipIf(process.platform === 'win32')(
    'resolves .agents/skills/new-ts-project symlink to .claude/skills/new-ts-project',
    () => {
      expect(lstatSync(AGENTS_SYMLINK).isSymbolicLink()).toBe(true);
      expect(readlinkSync(AGENTS_SYMLINK)).toBe('../../.claude/skills/new-ts-project');
      expect(realpathSync(AGENTS_SYMLINK)).toBe(realpathSync(SKILL_DIR));
      expect(existsSync(join(AGENTS_SYMLINK, 'SKILL.md'))).toBe(true);
      expect(existsSync(join(AGENTS_SYMLINK, 'README.md'))).toBe(true);
    }
  );

  it('declares press retirement rules for SKILL.md, README.md, docs, test, and workflow', () => {
    const rules = readFileSync(join(REPO_ROOT, 'press', 'press-rules.toml'), 'utf8');
    expect(rules).toContain('".claude/skills/new-ts-project/README.md"');
    expect(rules).toContain('"docs/skills/new-ts-project.md"');
    expect(rules).toContain('stub_file = "press/stubs/retired-bootstrap.md"');
    expect(rules).toContain('stub_file = "press/stubs/bootstrap-provenance.md"');
    expect(rules).toContain('file = ".claude/skills/new-ts-project/SKILL.md"');
    expect(rules).toContain('file = "tests/bootstrap-skill.test.ts"');
    expect(rules).toContain('file = ".github/workflows/bootstrap-acceptance.yml"');
  });
});
