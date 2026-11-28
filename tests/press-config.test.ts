// Press configuration, difftree retention, and version-reset contract tests.
// Ships to pressed child repositories as well: every assertion stays valid both
// in the source blueprint and after a press rebrand.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const REPO_ROOT = resolve(import.meta.dirname, '..');

function readText(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), 'utf8');
}

/** Extract `key = "value"` pairs from a single-section TOML file. */
function readSimpleTomlStrings(text: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('[')) continue;
    const match = line.match(/^([a-z_][a-z0-9_]*)\s*=\s*"([^"]*)"\s*$/);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      entries[match[1]] = match[2];
    }
  }
  return entries;
}

describe('template-press configuration contract', () => {
  const sourceToml = readText('press/press-source.toml');
  const rulesToml = readText('press/press-rules.toml');

  it('declares every required and Node/TS identity field in press/press-source.toml', () => {
    const identity = readSimpleTomlStrings(sourceToml);
    for (const field of [
      'package_name',
      'repo_name',
      'app_name',
      'author',
      'email',
      'owner',
      'display_name',
      'cli_name',
    ]) {
      expect(identity[field], `missing [identity].${field}`).toBeTruthy();
    }
  });

  it('declares Node language, pnpm-lock regeneration, and difftree/template-press keep_names', () => {
    expect(rulesToml).toMatch(/^\s*languages\s*=\s*\["node"\]/m);
    expect(rulesToml).toContain('"smorinlabs/difftree-action"');
    expect(rulesToml).toContain('"smorinlabs/template-press"');
    expect(rulesToml).toContain('"pnpm-lock.yaml"');
    expect(rulesToml).toContain('command = ["pnpm", "install", "--lockfile-only"]');
    expect(rulesToml).toContain('scan = "boundary"');
  });

  it('never removes .github/workflows/difftree-pr-comment.yml', () => {
    // Child repos MUST inherit difftree-pr-comment.yml intact via keep_names.
    const removeBlocks = rulesToml.split(/^\[\[remove\]\]/m).slice(1);
    const removedFiles = removeBlocks
      .map((block) => block.match(/^\s*file\s*=\s*"([^"]+)"/m)?.[1])
      .filter((file): file is string => file !== undefined);
    expect(removedFiles).not.toContain('.github/workflows/difftree-pr-comment.yml');
  });

  it('every [[reset]] stub_file exists on disk and contains no current source identity literals', () => {
    const identity = readSimpleTomlStrings(sourceToml);
    const stubMatches = [...rulesToml.matchAll(/^\s*stub_file\s*=\s*"([^"]+)"/gm)];
    expect(stubMatches.length).toBeGreaterThan(0);

    const leaked: string[] = [];
    const tokens = [
      identity['package_name'],
      identity['repo_name'],
      identity['app_name'],
      identity['cli_name'],
      identity['display_name'],
      identity['owner'],
    ].filter((token): token is string => Boolean(token));

    for (const match of stubMatches) {
      const stubRel = match[1]!;
      const stubAbs = join(REPO_ROOT, stubRel);
      expect(existsSync(stubAbs), `missing stub_file ${stubRel}`).toBe(true);
      const stubText = readFileSync(stubAbs, 'utf8');
      for (const token of tokens) {
        if (stubText.includes(token)) {
          leaked.push(`${stubRel} contains ${token}`);
        }
      }
    }
    expect(leaked).toEqual([]);
  });

  it('retains .github/workflows/difftree-pr-comment.yml with SHA-pinned smorinlabs/difftree-action', () => {
    const raw = readText('.github/workflows/difftree-pr-comment.yml');
    const parsed = parse(raw) as {
      jobs: Record<string, { steps?: { uses?: string }[] }>;
    };
    expect(parsed.jobs['difftree-pr-comment']).toBeDefined();
    expect(raw).toMatch(/uses:\s*actions\/checkout@v\d+/);
    // Use a plain string literal (no regex backslash) so keep_names protects
    // "smorinlabs/difftree-action" across presses too.
    const actionRef = 'smorinlabs/difftree-action';
    expect(raw).toContain(`uses: ${actionRef}@`);
    expect(raw).toMatch(new RegExp(`uses:\\s*${actionRef}@[0-9a-f]{40}\\s*#\\s*v\\d`));
  });

  it('ships .github/workflows/press-verify.yml with SHA-pinned setup-uv and press verify', () => {
    const raw = readText('.github/workflows/press-verify.yml');
    const parsed = parse(raw) as {
      permissions?: Record<string, string>;
      jobs: Record<string, { steps?: { uses?: string; run?: string }[] }>;
    };
    expect(parsed.permissions).toEqual({});
    expect(parsed.jobs['press-verify']).toBeDefined();
    expect(raw).toMatch(/astral-sh\/setup-uv@[0-9a-f]{40}\s*#\s*v\d/);
    expect(raw).toContain('uvx --from template-press==5.0.0 press verify');
    expect(raw).not.toContain('04769b24b7b5665d8932cac3a6c1ac876b8a98bb');
  });

  it('runs Justfile press-verify via PyPI template-press==5.0.0 without the old SHA pin', () => {
    const justfile = readText('Justfile');
    expect(justfile).toContain('uvx --from template-press==5.0.0 press verify');
    expect(justfile).not.toContain('04769b24b7b5665d8932cac3a6c1ac876b8a98bb');
  });

  it('keeps template-receipt-guard.yml only when no press receipt is committed', () => {
    const hasReceipt = existsSync(join(REPO_ROOT, 'press', 'press-receipt.toml'));
    const hasGuard = existsSync(
      join(REPO_ROOT, '.github', 'workflows', 'template-receipt-guard.yml')
    );
    expect(hasGuard).toBe(!hasReceipt);
  });
});

describe('scripts/reset-version.mjs', () => {
  const scriptPath = join(REPO_ROOT, 'scripts', 'reset-version.mjs');

  it('resets a manifest version to 0.1.0 while preserving other fields', () => {
    const dir = mkdtempSync(join(tmpdir(), 'reset-version-test-'));
    try {
      const manifestPath = join(dir, 'package.json');
      writeFileSync(
        manifestPath,
        `${JSON.stringify({ name: 'sample-pkg', version: '2.4.1', private: true }, null, 2)}\n`,
        'utf8'
      );
      const result = spawnSync(process.execPath, [scriptPath, manifestPath], {
        encoding: 'utf8',
      });
      expect(result.status).toBe(0);
      const updated = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        name: string;
        version: string;
        private: boolean;
      };
      expect(updated).toEqual({ name: 'sample-pkg', version: '0.1.0', private: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
