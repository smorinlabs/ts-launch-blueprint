// Repo-hygiene meta-tests (plan S2 field 7): the quality-gate configs must
// stay internally consistent, and the formatter gate must actually bite.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';
import type { ViteUserConfig } from 'vitest/config';
import { parse } from 'yaml';

import releasePleaseManifest from '../.release-please-manifest.json' with { type: 'json' };
import commitlintConfig from '../commitlint.config.mjs';
import packageJson from '../package.json' with { type: 'json' };
import releasePleaseConfig from '../release-please-config.json' with { type: 'json' };
import vitestConfig from '../vitest.config.js';

const REPO_ROOT = resolve(import.meta.dirname, '..');

// Both configs are JSONC with full-line comments only.
const readJsonc = (file: string): { ignorePatterns: string[] } => {
  const text = readFileSync(join(REPO_ROOT, file), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  return JSON.parse(text);
};

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

  it('enforces relaxed 100/200/200 header/body/footer line-length limits (Q9.A)', () => {
    const rules = commitlintConfig.rules as Record<string, unknown>;
    expect(rules['header-max-length']).toEqual([2, 'always', 100]);
    expect(rules['body-max-line-length']).toEqual([2, 'always', 200]);
    expect(rules['footer-max-line-length']).toEqual([2, 'always', 200]);
  });

  it('commitlint.dependabot.config.mjs extends config-conventional and disables body/footer line-length limits', async () => {
    const dependabotConfigPath = join(REPO_ROOT, 'commitlint.dependabot.config.mjs');
    expect(existsSync(dependabotConfigPath)).toBe(true);
    const mod = (await import(pathToFileURL(dependabotConfigPath).href)) as {
      default: { extends: string[]; rules: Record<string, unknown> };
    };
    expect(mod.default.extends).toEqual(['@commitlint/config-conventional']);
    expect(mod.default.rules['body-max-line-length']).toEqual([0, 'always']);
    expect(mod.default.rules['footer-max-line-length']).toEqual([0, 'always']);
  });
});

describe('lefthook configuration (D-020(6), P05)', () => {
  const lefthook = parse(readFileSync(join(REPO_ROOT, 'lefthook.yml'), 'utf8'));

  it('parses as YAML with pre-commit, commit-msg, and pre-push hooks', () => {
    expect(lefthook).toBeTypeOf('object');
    expect(lefthook['pre-commit']).toBeDefined();
    expect(lefthook['commit-msg']).toBeDefined();
    expect(lefthook['pre-push']).toBeDefined();
  });

  it('pre-commit runs format (stage_fixed + toml), lint, typecheck, editorconfig-checker, cspell, and pnpm-lock-check', () => {
    const jobs = lefthook['pre-commit'].jobs as Array<{
      name: string;
      glob?: string;
      run: string;
      stage_fixed?: boolean;
    }>;
    const names = jobs.map((job) => job.name);
    expect(names).toContain('format');
    expect(names).toContain('lint');
    expect(names).toContain('typecheck');
    expect(names).toContain('editorconfig-checker');
    expect(names).toContain('cspell');
    expect(names).toContain('pnpm-lock-check');

    const format = jobs.find((job) => job.name === 'format')!;
    expect(format.stage_fixed).toBe(true);
    expect(format.glob).toContain('toml');

    const ecJob = jobs.find((job) => job.name === 'editorconfig-checker')!;
    expect(ecJob.run).toContain('editorconfig-checker');
    expect(ecJob.run).toContain('.editorconfig-checker.json');
    expect(ecJob.run).toContain('{staged_files}');

    const cspellJob = jobs.find((job) => job.name === 'cspell')!;
    expect(cspellJob.run).toContain('cspell lint');
    expect(cspellJob.run).toContain('--no-must-find-files');
    expect(cspellJob.run).toContain('--files {staged_files}');

    const lockJob = jobs.find((job) => job.name === 'pnpm-lock-check')!;
    expect(lockJob.glob).toContain('**/package.json');
    expect(lockJob.glob).toContain('pnpm-lock.yaml');
    expect(lockJob.run).toContain(
      'pnpm install --frozen-lockfile --lockfile-only --ignore-scripts'
    );
  });

  it('actionlint pre-commit job includes missing-binary hints for actionlint and shellcheck', () => {
    const jobs = lefthook['pre-commit'].jobs as Array<{ name: string; run: string }>;
    const actionlintJob = jobs.find((job) => job.name === 'actionlint')!;
    expect(actionlintJob).toBeDefined();
    expect(actionlintJob.run).toContain('command -v actionlint');
    expect(actionlintJob.run).toContain('command -v shellcheck');
    expect(actionlintJob.run).toContain('just install-shell-tools');
  });

  it('pre-commit includes the 1MB large-file hygiene check with docs/assets/ allowlist (P05)', () => {
    const jobs = lefthook['pre-commit'].jobs;
    const largeFiles = jobs.find((job: { name: string }) => job.name === 'check-large-files');
    expect(largeFiles).toBeDefined();
    // Runs over staged files and enforces the 1MB (1048576-byte) ceiling outside docs/assets/.
    expect(largeFiles.run).toContain('{staged_files}');
    expect(largeFiles.run).toContain('1048576');
    expect(largeFiles.run).toContain('docs/assets/');
  });

  it('pre-push includes press-verify', () => {
    const jobs = lefthook['pre-push'].jobs as Array<{ name: string; run: string }>;
    const pressVerify = jobs.find((job) => job.name === 'press-verify');
    expect(pressVerify).toBeDefined();
    expect(pressVerify!.run).toContain('just press-verify');
  });

  it('commit-msg runs commitlint', () => {
    const jobs = lefthook['commit-msg'].jobs;
    expect(jobs.some((job: { run: string }) => job.run.includes('commitlint'))).toBe(true);
  });

  // Regression: oxfmt exits 2 (and oxlint exits 1) when EVERY path passed to
  // it is ignore-listed, which used to fail commits staging only port
  // artifacts (e.g. docs/port/TS_PORT_LOG.md). The jobs' lefthook `exclude`
  // lists must mirror the tools' ignorePatterns so excluded files never
  // reach the tools and lefthook skips when no staged files remain.
  it('format/lint excludes mirror the tools ignorePatterns', () => {
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

describe('package manager: pnpm 10 (D-035)', () => {
  it('commits pnpm-lock.yaml and no package-lock.json', () => {
    expect(existsSync(join(REPO_ROOT, 'pnpm-lock.yaml'))).toBe(true);
    expect(existsSync(join(REPO_ROOT, 'package-lock.json'))).toBe(false);
  });

  it('package.json pins pnpm 10 via packageManager and drops the npm devEngines entry', () => {
    // packageManager: pnpm@10.x with the Corepack integrity suffix.
    expect(packageJson.packageManager).toMatch(/^pnpm@10\.\d+\.\d+\+sha512\./);
    // pnpm 10 does not read devEngines for the package manager, so the npm
    // entry is removed; only the Node runtime floor stays (D-035).
    expect('packageManager' in packageJson.devEngines).toBe(false);
    expect(packageJson.devEngines.runtime.name).toBe('node');
  });

  it('.npmrc turns on pnpm strict package-manager enforcement', () => {
    const npmrc = readFileSync(join(REPO_ROOT, '.npmrc'), 'utf8').replaceAll('\r\n', '\n');
    expect(npmrc).toMatch(/^managePackageManagerVersions\s*=\s*true$/m);
    expect(npmrc).toMatch(/^packageManagerStrict\s*=\s*true$/m);
    expect(npmrc).toMatch(/^packageManagerStrictVersion\s*=\s*true$/m);
  });
});

describe('formatter gate is real (D-014)', () => {
  const oxfmtBin = join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'oxfmt.cmd' : 'oxfmt'
  );
  const configPath = join(REPO_ROOT, '.oxfmtrc.json');

  const checkSnippet = (source: string): number | null => {
    const dir = mkdtempSync(join(tmpdir(), 'oxfmt-gate-'));
    try {
      const file = join(dir, 'snippet.ts');
      writeFileSync(file, source);
      const result = spawnSync(oxfmtBin, ['-c', configPath, '--check', file], {
        cwd: dir,
        encoding: 'utf8',
        shell: process.platform === 'win32',
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
  const PULL_REQUEST_PUBLIC_CONDITION = "${{ github.event.repository.visibility == 'public' }}";
  const CODEQL_PUBLIC_CONDITION = "${{ needs.repository-visibility.outputs.is-public == 'true' }}";
  const workflowFiles = readdirSync(WORKFLOW_DIR).filter(
    (name) => name.endsWith('.yml') || name.endsWith('.yaml')
  );

  it('has the four expected S4 workflow files', () => {
    // ci, codeql, dependency-review, manual-pr-security-scan (+ any future).
    expect(workflowFiles.length).toBeGreaterThanOrEqual(4);
    expect(workflowFiles).toContain('ci.yml');
    expect(workflowFiles).toContain('codeql.yml');
    expect(workflowFiles).toContain('commitlint.yml');
    expect(workflowFiles).toContain('dependency-review.yml');
    expect(workflowFiles).toContain('large-file-guard.yml');
    expect(workflowFiles).toContain('manual-pr-security-scan.yml');
  });

  it.each(workflowFiles)('%s parses as YAML', (file) => {
    const parsed = parse(readFileSync(join(WORKFLOW_DIR, file), 'utf8'));
    expect(parsed).toBeTypeOf('object');
    expect(parsed).not.toBeNull();
  });

  it('dependency-review.yml skips unavailable products in private repositories', () => {
    const workflow = parse(readFileSync(join(WORKFLOW_DIR, 'dependency-review.yml'), 'utf8')) as {
      jobs: Record<string, { if?: string }>;
    };

    expect(workflow.jobs['dependency-review']?.if).toBe(PULL_REQUEST_PUBLIC_CONDITION);
  });

  it('codeql.yml uses trigger-independent repository visibility', () => {
    const workflow = parse(readFileSync(join(WORKFLOW_DIR, 'codeql.yml'), 'utf8')) as {
      jobs: Record<
        string,
        {
          if?: string;
          needs?: string;
          steps?: Array<{ run?: string; uses?: string; with?: { script?: string } }>;
        }
      >;
    };

    const visibilityStep = workflow.jobs['repository-visibility']?.steps?.[0];
    expect(visibilityStep?.uses).toBe('actions/github-script@v9');
    expect(visibilityStep?.with?.script).toContain('repository.visibility === "public"');
    expect(workflow.jobs.analyze?.needs).toBe('repository-visibility');
    expect(workflow.jobs.analyze?.if).toBe(CODEQL_PUBLIC_CONDITION);
  });

  it('codeql.yml runs when a private repository becomes public', () => {
    const workflow = parse(readFileSync(join(WORKFLOW_DIR, 'codeql.yml'), 'utf8')) as {
      on: Record<string, unknown>;
    };

    expect(workflow.on).toHaveProperty('public');
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

  it('ci.yml test matrix covers ubuntu/macos/windows on 24.x and ubuntu on 26.x with runner overrides', () => {
    const ci = parse(readFileSync(join(WORKFLOW_DIR, 'ci.yml'), 'utf8')) as {
      jobs: {
        test: {
          'runs-on': string;
          strategy: {
            'fail-fast': boolean;
            matrix: {
              os: string[];
              'node-version': string[];
              include: Array<{ os: string; 'node-version': string }>;
            };
          };
        };
      };
    };
    const testJob = ci.jobs.test;
    expect(testJob.strategy['fail-fast']).toBe(false);
    expect(testJob.strategy.matrix.os).toEqual(['ubuntu', 'macos', 'windows']);
    expect(testJob.strategy.matrix['node-version']).toEqual(['24.x']);
    expect(testJob.strategy.matrix.include).toEqual([{ os: 'ubuntu', 'node-version': '26.x' }]);
    expect(testJob['runs-on']).toContain("vars.RUNNER_UBUNTU || 'ubuntu-latest'");
    expect(testJob['runs-on']).toContain("vars.RUNNER_MACOS || 'macos-latest'");
    expect(testJob['runs-on']).toContain("vars.RUNNER_WINDOWS || 'windows-latest'");
  });

  // D-035: the CI + publish workflows install with pnpm — pnpm/action-setup
  // (SHA-pinned) BEFORE setup-node's cache:'pnpm', then frozen-lockfile.
  it.each(['ci.yml', 'publish.yml'])(
    '%s sets up pnpm before setup-node with cache:pnpm + frozen-lockfile (D-035)',
    (file) => {
      const raw = readFileSync(join(WORKFLOW_DIR, file), 'utf8');
      expect(raw).toMatch(/pnpm\/action-setup@[0-9a-f]{40}\s*#\s*v\d/);
      expect(raw).toContain('version: 10.34.3');
      expect(raw).toMatch(/cache:\s*'?pnpm'?/);
      expect(raw).toContain('pnpm install --frozen-lockfile');
      // pnpm must be on PATH before setup-node so its cache can find the
      // store. Collect ordering per node-setup job, assert once (the vitest
      // no-conditional-expect rule forbids expect() inside the loop).
      const parsed = parse(raw) as {
        jobs: Record<string, { steps: { uses?: string }[] }>;
      };
      const orderingOk: boolean[] = [];
      for (const job of Object.values(parsed.jobs)) {
        const uses = job.steps.map((s) => s.uses ?? '');
        const pnpmIdx = uses.findIndex((u) => u.startsWith('pnpm/action-setup@'));
        const nodeIdx = uses.findIndex((u) => u.startsWith('actions/setup-node@'));
        if (nodeIdx !== -1) orderingOk.push(pnpmIdx !== -1 && pnpmIdx < nodeIdx);
      }
      expect(orderingOk.length).toBeGreaterThan(0);
      expect(orderingOk.every(Boolean)).toBe(true);
    }
  );

  // S6b field 9: docs-check must run in CI on every PR (including docs-only PRs).
  it('ci.yml runs `just docs-check` inside the always-running lint job', () => {
    const ci = parse(readFileSync(join(WORKFLOW_DIR, 'ci.yml'), 'utf8')) as {
      jobs: {
        lint: {
          if?: string;
          'runs-on'?: string;
          steps: { name?: string; run?: string }[];
        };
      };
    };
    const lintJob = ci.jobs.lint;
    expect(lintJob).toBeDefined();
    expect(lintJob.if).toBeUndefined();
    expect(lintJob['runs-on']).toContain('RUNNER_UBUNTU');
    const docsCheckStep = lintJob.steps.find((step) => step.run?.trim() === 'just docs-check');
    expect(docsCheckStep).toBeDefined();
  });

  // Hybrid pinning policy (D-022(9)): official actions/* and github/* pin to a
  // major tag; every third-party action must be full-SHA-pinned with a trailing
  // version comment so Dependabot's github-actions ecosystem can refresh it.
  // Official actions may ALSO be SHA-pinned (with a version comment): some
  // official actions publish no floating major tag at all (e.g.
  // actions/dependency-review-action has only exact tags like v5.0.0 — a
  // `@v5` ref would fail to resolve), so a SHA pin is the only safe ref.
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
          // Official actions: a vN major-tag pin, OR a full SHA with a
          // version comment (for official actions without floating majors).
          if (shaRe.test(ref)) {
            if (!comment) violations.push(`${spec}: SHA pin needs a version comment`);
          } else if (!majorTagRe.test(ref)) {
            violations.push(`${spec}: official action should use a vN tag or SHA+comment`);
          }
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

  it('commitlint.yml enforces Conventional Commits on PRs and merge_group with dependabot split (P05)', () => {
    const raw = readFileSync(join(WORKFLOW_DIR, 'commitlint.yml'), 'utf8');
    const parsed = parse(raw) as {
      on: { push?: { branches?: string[] }; pull_request?: unknown; merge_group?: unknown };
      permissions: Record<string, unknown>;
      concurrency: { group: string; 'cancel-in-progress': string };
      jobs: Record<
        string,
        {
          if?: string;
          permissions?: Record<string, string>;
          steps?: Array<{
            if?: string;
            uses?: string;
            with?: Record<string, unknown>;
          }>;
        }
      >;
    };

    expect(parsed.on.push?.branches).toEqual(['main']);
    expect(Object.prototype.hasOwnProperty.call(parsed.on, 'pull_request')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(parsed.on, 'merge_group')).toBe(true);
    expect(parsed.permissions).toEqual({});
    expect(parsed.concurrency['cancel-in-progress']).toContain(
      "github.event_name == 'pull_request'"
    );

    const humans = parsed.jobs['commitlint-humans'];
    const dependabot = parsed.jobs['commitlint-dependabot'];
    expect(humans).toBeDefined();
    expect(dependabot).toBeDefined();
    expect(humans?.if).toContain('dependabot[bot]');
    expect(dependabot?.if).toContain('dependabot[bot]');
    expect(humans?.permissions).toEqual({ contents: 'read', 'pull-requests': 'read' });
    expect(dependabot?.permissions).toEqual({ contents: 'read', 'pull-requests': 'read' });

    const humanCheckout = humans?.steps?.find((s) => s.uses?.startsWith('actions/checkout@'));
    expect(humanCheckout?.with?.['fetch-depth']).toBe(0);
    expect(humanCheckout?.with?.['persist-credentials']).toBe(false);

    const humanLint = humans?.steps?.find((s) =>
      s.uses?.startsWith('wagoid/commitlint-github-action@')
    );
    expect(humanLint).toBeDefined();
    expect(humanLint?.if).toContain("github.event_name != 'merge_group'");
    expect(humanLint?.with?.configFile).toBe('commitlint.config.mjs');

    const botLint = dependabot?.steps?.find((s) =>
      s.uses?.startsWith('wagoid/commitlint-github-action@')
    );
    expect(botLint).toBeDefined();
    expect(botLint?.with?.configFile).toBe('commitlint.dependabot.config.mjs');
    expect(raw).toMatch(/wagoid\/commitlint-github-action@[0-9a-f]{40}\s*#\s*v\d/);
  });

  it('large-file-guard.yml enforces 1MB limit outside docs/assets/ on push, PR, and merge_group (P05)', () => {
    const raw = readFileSync(join(WORKFLOW_DIR, 'large-file-guard.yml'), 'utf8');
    const parsed = parse(raw) as {
      on: { push?: { branches?: string[] }; pull_request?: unknown; merge_group?: unknown };
      permissions: Record<string, unknown>;
      concurrency: { group: string; 'cancel-in-progress': string };
      jobs: Record<
        string,
        {
          permissions?: Record<string, string>;
          steps?: Array<{
            uses?: string;
            with?: Record<string, unknown>;
            env?: Record<string, unknown>;
            run?: string;
          }>;
        }
      >;
    };

    expect(parsed.on.push?.branches).toEqual(['main']);
    expect(Object.prototype.hasOwnProperty.call(parsed.on, 'pull_request')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(parsed.on, 'merge_group')).toBe(true);
    expect(parsed.permissions).toEqual({});
    expect(parsed.concurrency['cancel-in-progress']).toContain(
      "github.event_name == 'pull_request'"
    );
    expect(raw).toContain('1048576');
    expect(raw).toContain('docs/assets/');
  });

  it('ci.yml installs editorconfig-checker before pre-commit hooks and runs check-editorconfig + check-spelling (P05)', () => {
    const ci = parse(readFileSync(join(WORKFLOW_DIR, 'ci.yml'), 'utf8')) as {
      jobs: { lint: { steps: Array<{ run?: string }> } };
    };
    const steps = ci.jobs.lint.steps;
    const installEcIdx = steps.findIndex((s) =>
      s.run?.includes('just install-editorconfig-checker')
    );
    const lefthookIdx = steps.findIndex((s) =>
      s.run?.includes('lefthook run pre-commit --all-files')
    );
    const checkEcIdx = steps.findIndex((s) => s.run?.includes('just check-editorconfig'));
    const checkSpellingIdx = steps.findIndex((s) => s.run?.includes('just check-spelling'));

    expect(installEcIdx).toBeGreaterThanOrEqual(0);
    expect(lefthookIdx).toBeGreaterThan(installEcIdx);
    expect(checkEcIdx).toBeGreaterThanOrEqual(0);
    expect(checkSpellingIdx).toBeGreaterThanOrEqual(0);
  });

  it('zero files under .github/ carry the 18-line MIT header and updated/new YAML files use SPDX (D-024(7), P05)', () => {
    const githubYamlFiles: string[] = [];
    const walkGithub = (dir: string, relBase: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const rel = `${relBase}/${entry.name}`;
        if (entry.isDirectory()) {
          walkGithub(join(dir, entry.name), rel);
        } else if (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')) {
          githubYamlFiles.push(rel);
        }
      }
    };
    walkGithub(join(REPO_ROOT, '.github'), '.github');

    const mitMatches = githubYamlFiles.filter((rel) =>
      readFileSync(join(REPO_ROOT, rel), 'utf8').includes(
        'Permission is hereby granted, free of charge'
      )
    );
    expect(mitMatches).toEqual([]);

    const spdxRequired = [
      '.github/dependabot.yml',
      '.github/ISSUE_TEMPLATE/01-feature-request.yml',
      '.github/ISSUE_TEMPLATE/02-documentation-request.yml',
      '.github/ISSUE_TEMPLATE/03-bug-report.yml',
      '.github/ISSUE_TEMPLATE/config.yml',
      '.github/workflows/ci.yml',
      '.github/workflows/codeql.yml',
      '.github/workflows/commitlint.yml',
      '.github/workflows/dependency-review.yml',
      '.github/workflows/large-file-guard.yml',
      '.github/workflows/manual-pr-security-scan.yml',
      '.github/workflows/publish.yml',
      '.github/workflows/release-please.yml',
    ];
    for (const rel of spdxRequired) {
      const firstLine = readFileSync(join(REPO_ROOT, rel), 'utf8').split(/\r?\n/)[0];
      expect({ file: rel, firstLine }).toEqual({
        file: rel,
        firstLine: '# SPDX-License-Identifier: MIT',
      });
    }

    // difftree-pr-comment.yml must stay byte-for-byte canonical without an SPDX rewrite.
    const difftreeFirstLine = readFileSync(
      join(WORKFLOW_DIR, 'difftree-pr-comment.yml'),
      'utf8'
    ).split(/\r?\n/)[0];
    expect(difftreeFirstLine).toBe('# Canonical consumer workflow for smorinlabs/difftree-action.');
  });

  const UPDATE_CONTRIBUTORS_PATH = join(WORKFLOW_DIR, 'update-contributors.yml');
  it.skipIf(!existsSync(UPDATE_CONTRIBUTORS_PATH))(
    'update-contributors.yml carries the SPDX one-liner header (D-024(7), P05)',
    () => {
      const firstLine = readFileSync(UPDATE_CONTRIBUTORS_PATH, 'utf8').split(/\r?\n/)[0];
      expect(firstLine).toBe('# SPDX-License-Identifier: MIT');
    }
  );
});

describe('Bun advisory dev/test lane (D-036)', () => {
  const WORKFLOW_DIR = join(REPO_ROOT, '.github', 'workflows');
  const ciRaw = readFileSync(join(WORKFLOW_DIR, 'ci.yml'), 'utf8');
  const ci = parse(ciRaw) as {
    jobs: Record<string, { 'continue-on-error'?: boolean }>;
  };

  it('ci.yml defines a bun-lane job that is advisory (continue-on-error: true)', () => {
    expect(ci.jobs['bun-lane']).toBeDefined();
    // Advisory-only: it must never gate a PR (Bun tracks Node v23 parity, one
    // major behind the >=24 floor).
    expect(ci.jobs['bun-lane']!['continue-on-error']).toBe(true);
  });

  it('ci.yml SHA-pins oven-sh/setup-bun with a version comment (D-022(9))', () => {
    const line = ciRaw
      .split('\n')
      .find((l) => l.includes('oven-sh/setup-bun@') && !l.trimStart().startsWith('#'));
    expect(line).toBeDefined();
    expect(line).toMatch(/oven-sh\/setup-bun@[0-9a-f]{40}\s*#\s*v\d/);
  });

  it("ci.yml pins bun-version to exactly '1.3.14' (D-036)", () => {
    expect(ciRaw).toMatch(/bun-version:\s*1\.3\.14\s*$/m);
  });

  it('Justfile has a test-bun recipe that runs Vitest under Bun and excludes e2e', () => {
    const justfile = readFileSync(join(REPO_ROOT, 'Justfile'), 'utf8');
    expect(justfile).toMatch(/^test-bun:/m);
    // Vitest is the driver (never bare `bun test`); e2e tier stays Node-only.
    expect(justfile).toContain('bun run vitest run --exclude tests/e2e.test.ts');
  });
});

describe('release, versioning & packaging (S5: D-021, D-012)', () => {
  const WORKFLOW_DIR = join(REPO_ROOT, '.github', 'workflows');
  const readWorkflow = (file: string): string => readFileSync(join(WORKFLOW_DIR, file), 'utf8');

  it('release-please-config changelog-sections types are all commitlint types (D-021(3))', () => {
    const commitlintTypes = new Set<string>(commitlintConfig.rules['type-enum'][2]);
    const sections = releasePleaseConfig.packages['.']['changelog-sections'] as {
      type: string;
    }[];
    expect(Array.isArray(sections)).toBe(true);
    expect(sections.length).toBeGreaterThan(0);
    const sectionTypes = sections.map((s) => s.type);
    for (const type of sectionTypes) {
      expect(commitlintTypes.has(type)).toBe(true);
    }
    // Ports cog.toml's taxonomy: feat/fix/perf/docs/test/refactor visible.
    for (const visible of ['feat', 'fix', 'perf', 'docs', 'test', 'refactor']) {
      expect(sectionTypes).toContain(visible);
    }
  });

  it('release-please uses pre-1.0 bump semantics (D-021(1))', () => {
    expect(releasePleaseConfig['bump-minor-pre-major']).toBe(true);
    expect(releasePleaseConfig['bump-patch-for-minor-pre-major']).toBe(true);
    expect(releasePleaseConfig['release-type']).toBe('node');
    expect(releasePleaseConfig['include-v-in-tag']).toBe(true);
  });

  it('manifest version equals package.json version (D-021(1,2))', () => {
    expect(releasePleaseManifest['.']).toBe(packageJson.version);
  });

  // Read at runtime (not a static JSON import) and skipped when apps/cli is
  // absent, so `just check-removable cli` can typecheck and test the repo
  // without the CLI (docs/reference/boundary-rules.md, "Removing the CLI").
  const CLI_PACKAGE_JSON = join(REPO_ROOT, 'apps', 'cli', 'package.json');
  it.skipIf(!existsSync(CLI_PACKAGE_JSON))(
    'root, apps/cli and manifest versions move together (D-040)',
    () => {
      // apps/cli is the published package; release-please bumps it through
      // extra-files so its version never drifts from the root and the manifest.
      const cliPackageJson = JSON.parse(readFileSync(CLI_PACKAGE_JSON, 'utf8')) as {
        version: string;
      };
      expect(cliPackageJson.version).toBe(packageJson.version);
      expect(cliPackageJson.version).toBe(releasePleaseManifest['.']);
      const extraFiles = (
        releasePleaseConfig.packages['.'] as {
          'extra-files'?: { path: string; jsonpath: string }[];
        }
      )['extra-files'];
      expect(extraFiles).toContainEqual(
        expect.objectContaining({ path: 'apps/cli/package.json', jsonpath: '$.version' })
      );
    }
  );

  it('release PR version surfaces are atomic and need no lockfile repair', () => {
    const pnpmLock = parse(readFileSync(join(REPO_ROOT, 'pnpm-lock.yaml'), 'utf8')) as {
      importers?: Record<string, Record<string, unknown>>;
    };
    expect(pnpmLock.importers).toBeDefined();
    expect(pnpmLock.importers).toHaveProperty('.');
    expect(pnpmLock.importers?.['.']).not.toHaveProperty('version');

    const releaseWorkflow = readWorkflow('release-please.yml');
    expect(releaseWorkflow).not.toMatch(/sync-(?:pnpm|npm|bun)-lock/);
    expect(releaseWorkflow).not.toMatch(/\bgit push\b/);
    expect(releaseWorkflow).not.toContain('pnpm install --lockfile-only');
  });

  it('publish.yml gates publish behind a verify job with id-token + npm env (D-012(5))', () => {
    const publish = parse(readWorkflow('publish.yml')) as {
      jobs: Record<
        string,
        { needs?: string | string[]; environment?: string; permissions?: Record<string, string> }
      >;
    };
    const verifyJob = publish.jobs.verify;
    const publishJob = publish.jobs.publish;
    expect(verifyJob).toBeDefined();
    expect(publishJob).toBeDefined();

    const needs = publishJob!.needs;
    const needsList = Array.isArray(needs) ? needs : [needs];
    expect(needsList).toContain('verify');

    expect(publishJob!.environment).toBe('npm');
    expect(publishJob!.permissions?.['id-token']).toBe('write');
  });

  it('publish.yml never references NPM_TOKEN (Trusted Publishing only, D-021(5))', () => {
    expect(readWorkflow('publish.yml')).not.toContain('NPM_TOKEN');
  });

  it('publish.yml publishes with the npm CLI, not pnpm (D-035)', () => {
    // pnpm install/build, but `npm publish` for reliable OIDC Trusted
    // Publishing (pnpm 10's delegation is unresolved, pnpm#9812).
    const raw = readWorkflow('publish.yml');
    expect(raw).toMatch(/run:\s*npm publish/);
    expect(raw).not.toMatch(/run:\s*pnpm publish/);
  });

  it('release-please.yml SHA-pins release-please-action with a version comment (D-022(9))', () => {
    const line = readWorkflow('release-please.yml')
      .split('\n')
      .find(
        (l) => l.includes('googleapis/release-please-action@') && !l.trimStart().startsWith('#')
      );
    expect(line).toBeDefined();
    expect(line).toMatch(/googleapis\/release-please-action@[0-9a-f]{40}\s*#\s*v\d/);
  });
});

describe('coverage & pack-check CI contract (P02)', () => {
  const WORKFLOW_DIR = join(REPO_ROOT, '.github', 'workflows');

  it('vitest.config.ts sets text/html/lcov reporters and 95/95/90/95 thresholds', () => {
    const coverage = (vitestConfig as ViteUserConfig).test?.coverage as
      | { reporter?: unknown; thresholds?: unknown }
      | undefined;
    expect(coverage?.reporter).toEqual(['text', 'html', 'lcov']);
    expect(coverage?.thresholds).toEqual({
      lines: 95,
      functions: 95,
      branches: 90,
      statements: 95,
    });
  });

  it('Justfile provides open-coverage-report and keeps pack-check Linux-portable', () => {
    const justfile = readFileSync(join(REPO_ROOT, 'Justfile'), 'utf8');
    expect(justfile).toMatch(/^@?open-coverage-report:/m);
    expect(justfile).toContain('coverage/index.html');
    expect(justfile).not.toContain('/private/tmp');
  });

  it('.codecov.yml enforces CI pass, auto±1% project, 80% patch, and TS package paths', () => {
    const codecovPath = join(REPO_ROOT, '.codecov.yml');
    expect(existsSync(codecovPath)).toBe(true);
    const codecov = parse(readFileSync(codecovPath, 'utf8')) as {
      codecov?: { require_ci_to_pass?: boolean };
      coverage?: {
        status?: {
          project?: { default?: { target?: string; threshold?: string } };
          patch?: { default?: { target?: string } };
        };
      };
      flags?: { unittests?: { paths?: string[] } };
    };
    expect(codecov.codecov?.require_ci_to_pass).toBe(true);
    expect(codecov.coverage?.status?.project?.default).toEqual({
      target: 'auto',
      threshold: '1%',
    });
    expect(codecov.coverage?.status?.patch?.default).toEqual({
      target: '80%',
    });
    expect(codecov.flags?.unittests?.paths).toEqual(['packages/', 'apps/']);
  });

  it('ci.yml wires just coverage, ubuntu/24.x Codecov v7 OIDC upload, and Linux-only pack-check', () => {
    const ciRaw = readFileSync(join(WORKFLOW_DIR, 'ci.yml'), 'utf8');
    const ci = parse(ciRaw) as {
      jobs: {
        test: {
          permissions?: Record<string, string>;
          steps: Array<{
            name?: string;
            if?: string;
            run?: string;
            uses?: string;
            with?: Record<string, unknown>;
          }>;
        };
        'pack-check': {
          'runs-on'?: string;
          needs?: string | string[];
          if?: string;
          steps: Array<{ name?: string; run?: string }>;
        };
      };
    };

    expect(ci.jobs.test.permissions).toEqual({
      contents: 'read',
      'id-token': 'write',
    });

    const ubuntu24Cond = "matrix.os == 'ubuntu' && matrix.node-version == '24.x'";
    const steps = ci.jobs.test.steps;
    const coverageStep = steps.find((step) => step.run?.trim() === 'just coverage');
    expect(coverageStep).toBeDefined();
    expect(coverageStep?.if).toContain(ubuntu24Cond);

    const testFallbackStep = steps.find((step) => step.run?.trim() === 'just test');
    expect(testFallbackStep).toBeDefined();
    expect(testFallbackStep?.if).toContain(`!(${ubuntu24Cond})`);

    const codecovStep = steps.find((step) => step.uses?.startsWith('codecov/codecov-action@'));
    expect(codecovStep).toBeDefined();
    expect(codecovStep?.if).toContain(ubuntu24Cond);
    expect(codecovStep?.with).toEqual({
      use_oidc: true,
      files: './coverage/lcov.info',
      flags: 'unittests',
      fail_ci_if_error: false,
    });

    const codecovLine = ciRaw
      .split('\n')
      .find((l) => l.includes('codecov/codecov-action@') && !l.trimStart().startsWith('#'));
    expect(codecovLine).toBeDefined();
    expect(codecovLine).toMatch(/codecov\/codecov-action@[0-9a-f]{40}\s*#\s*v7\./);

    const packJob = ci.jobs['pack-check'];
    expect(packJob).toBeDefined();
    expect(packJob['runs-on']).toContain('RUNNER_UBUNTU');
    expect(packJob.if).toContain("needs.changes.outputs.code == 'true'");
    expect(packJob.if).toContain("needs.changes.outputs.release == 'true'");
    const packCheckStep = packJob.steps.find((step) => step.run?.trim() === 'just pack-check');
    expect(packCheckStep).toBeDefined();
  });

  it('publish.yml verify job runs just pack-check', () => {
    const publish = parse(readFileSync(join(WORKFLOW_DIR, 'publish.yml'), 'utf8')) as {
      jobs: {
        verify: {
          steps: Array<{ run?: string }>;
        };
      };
    };
    const packCheckStep = publish.jobs.verify.steps.find(
      (step) => step.run?.trim() === 'just pack-check'
    );
    expect(packCheckStep).toBeDefined();
  });
});

describe('community files (S6a: D-022(11), D-024(9))', () => {
  const ISSUE_TEMPLATE_DIR = join(REPO_ROOT, '.github', 'ISSUE_TEMPLATE');
  const issueTemplateFiles = readdirSync(ISSUE_TEMPLATE_DIR).filter((name) =>
    name.endsWith('.yml')
  );

  it('has all 4 issue-template files (3 templates + config)', () => {
    expect(issueTemplateFiles).toContain('01-feature-request.yml');
    expect(issueTemplateFiles).toContain('02-documentation-request.yml');
    expect(issueTemplateFiles).toContain('03-bug-report.yml');
    expect(issueTemplateFiles).toContain('config.yml');
  });

  it.each(issueTemplateFiles)('%s parses as YAML', (file) => {
    const parsed = parse(readFileSync(join(ISSUE_TEMPLATE_DIR, file), 'utf8'));
    expect(parsed).toBeTypeOf('object');
    expect(parsed).not.toBeNull();
  });

  it('FUNDING.yml contains a github funding entry', () => {
    const funding = parse(readFileSync(join(REPO_ROOT, '.github', 'FUNDING.yml'), 'utf8')) as {
      github: string;
    };
    expect(funding.github).toBeTypeOf('string');
    expect(funding.github.length).toBeGreaterThan(0);
  });

  it('no shipped file references the replaced update_contributors.py script', () => {
    const candidateFiles = [
      'Justfile',
      'package.json',
      '.github/CONTRIBUTING.md',
      '.github/SECURITY.md',
      '.github/pull_request_template.md',
      ...issueTemplateFiles.map((f) => `.github/ISSUE_TEMPLATE/${f}`),
    ];
    for (const relPath of candidateFiles) {
      const content = readFileSync(join(REPO_ROOT, relPath), 'utf8');
      expect(content).not.toContain('update_contributors.py');
    }
  });
});

/** Every tsconfig*.json in the repo, skipping installed and generated trees. */
function tsconfigs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return ['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)
        ? []
        : tsconfigs(join(dir, entry.name));
    }
    return /^tsconfig.*\.json$/.test(entry.name) ? [join(dir, entry.name)] : [];
  });
}

describe('architecture boundaries (D-042)', () => {
  it('[no-path-alias] no tsconfig defines compilerOptions.paths', () => {
    // One import style: relative inside a package, the package name across
    // packages. A path alias could route around the boundary rules.
    const files = tsconfigs(REPO_ROOT);
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const file of files) {
      // tsconfig files are JSONC with full-line comments only (same as above).
      const text = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n')
        .replace(/\/\/[^"\n]*$/gm, '');
      const config = JSON.parse(text) as { compilerOptions?: { paths?: unknown } };
      expect({ file, paths: config.compilerOptions?.paths }).toEqual({ file, paths: undefined });
    }
  });
});

describe('slim PR CI, merge_group, concurrency, and parallel Justfile (P03)', () => {
  const WORKFLOW_DIR = join(REPO_ROOT, '.github', 'workflows');
  const PR_ONLY_CANCEL = "${{ github.event_name == 'pull_request' }}";
  const isPressedChild = existsSync(join(REPO_ROOT, 'press', 'press-receipt.toml'));

  const mergeGroupWorkflows = [
    'ci.yml',
    'codeql.yml',
    'press-verify.yml',
    ...(isPressedChild ? [] : ['template-receipt-guard.yml']),
  ];

  const prConcurrencyWorkflows = [
    'ci.yml',
    'codeql.yml',
    'dependency-review.yml',
    'press-verify.yml',
    ...(isPressedChild ? [] : ['template-receipt-guard.yml']),
  ];

  it.each(mergeGroupWorkflows)('%s subscribes to merge_group events', (file) => {
    const parsed = parse(readFileSync(join(WORKFLOW_DIR, file), 'utf8')) as {
      on: Record<string, unknown>;
    };
    expect(Object.prototype.hasOwnProperty.call(parsed.on, 'merge_group')).toBe(true);
  });

  it.each(prConcurrencyWorkflows)(
    '%s cancels superseded pull_request runs without cancelling main or merge_group',
    (file) => {
      const parsed = parse(readFileSync(join(WORKFLOW_DIR, file), 'utf8')) as {
        concurrency?: { group?: string; 'cancel-in-progress'?: unknown };
      };
      expect(parsed.concurrency).toBeDefined();
      expect(parsed.concurrency?.group).toContain('github.event.pull_request.number || github.sha');
      expect(parsed.concurrency?.['cancel-in-progress']).toBe(PR_ONLY_CANCEL);
    }
  );

  it.each(['publish.yml', 'release-please.yml'])(
    '%s serializes runs without cancelling in-progress releases',
    (file) => {
      const parsed = parse(readFileSync(join(WORKFLOW_DIR, file), 'utf8')) as {
        concurrency?: { group?: string; 'cancel-in-progress'?: unknown };
      };
      expect(parsed.concurrency?.group).toBeTruthy();
      expect(parsed.concurrency?.['cancel-in-progress']).toBe(false);
    }
  );

  it('ci.yml ci-ok aggregate gate depends on every other job and always runs', () => {
    const ci = parse(readFileSync(join(WORKFLOW_DIR, 'ci.yml'), 'utf8')) as {
      jobs: Record<
        string,
        {
          needs?: string[];
          if?: string;
          permissions?: Record<string, unknown>;
          'runs-on'?: string;
        }
      >;
    };
    const allOtherJobs = Object.keys(ci.jobs).filter((name) => name !== 'ci-ok');
    const ciOk = ci.jobs['ci-ok'];
    expect(ciOk).toBeDefined();
    expect(ciOk?.['runs-on']).toContain('RUNNER_UBUNTU');
    expect(ciOk?.if).toBe('always()');
    expect(ciOk?.permissions).toEqual({});
    expect(new Set(ciOk?.needs)).toEqual(new Set(allOtherJobs));
  });

  it('ci.yml gates heavy code jobs on changes.outputs.code and keeps lint always-on', () => {
    const ci = parse(readFileSync(join(WORKFLOW_DIR, 'ci.yml'), 'utf8')) as {
      jobs: Record<
        string,
        {
          if?: string;
          needs?: string | string[];
          'runs-on'?: string;
          outputs?: Record<string, string>;
        }
      >;
    };
    expect(ci.jobs['changes']?.outputs).toEqual({
      code: '${{ steps.detect.outputs.code }}',
      release: '${{ steps.detect.outputs.release }}',
    });
    expect(ci.jobs['lint']?.if).toBeUndefined();
    expect(ci.jobs['lint']?.['runs-on']).toContain('RUNNER_UBUNTU');

    const codeCond = "needs.changes.outputs.code == 'true'";
    for (const jobName of ['typecheck', 'test', 'check-removable', 'api-image', 'bun-lane']) {
      expect(ci.jobs[jobName]?.needs).toBe('changes');
      expect(ci.jobs[jobName]?.if).toBe(codeCond);
    }
    for (const linuxJob of ['typecheck', 'check-removable', 'api-image', 'bun-lane']) {
      expect(ci.jobs[linuxJob]?.['runs-on']).toContain('RUNNER_UBUNTU');
    }
  });

  it('.github/actionlint.yaml declares RUNNER_UBUNTU, RUNNER_MACOS, and RUNNER_WINDOWS', () => {
    const actionlint = parse(
      readFileSync(join(REPO_ROOT, '.github', 'actionlint.yaml'), 'utf8')
    ) as {
      'config-variables'?: string[];
    };
    expect(actionlint['config-variables']).toEqual(
      expect.arrayContaining(['RUNNER_UBUNTU', 'RUNNER_MACOS', 'RUNNER_WINDOWS'])
    );
  });

  it('Justfile marks @all with [parallel]', () => {
    const justfile = readFileSync(join(REPO_ROOT, 'Justfile'), 'utf8').replaceAll('\r\n', '\n');
    expect(justfile).toMatch(/\[parallel\]\n@all:/);
  });
});

describe('EditorConfig, cspell, and Justfile quality gates (P05)', () => {
  it('.editorconfig and .editorconfig-checker.json exist with expected rules and exclusions', () => {
    const editorconfigPath = join(REPO_ROOT, '.editorconfig');
    const ecCheckerPath = join(REPO_ROOT, '.editorconfig-checker.json');
    expect(existsSync(editorconfigPath)).toBe(true);
    expect(existsSync(ecCheckerPath)).toBe(true);

    const ec = readFileSync(editorconfigPath, 'utf8');
    expect(ec).toMatch(/^root\s*=\s*true$/m);
    expect(ec).toContain('charset = utf-8');
    expect(ec).toContain('end_of_line = lf');
    expect(ec).toContain('insert_final_newline = true');
    expect(ec).toContain('trim_trailing_whitespace = false');
    expect(ec).toContain('indent_style = tab');

    const ecConfig = JSON.parse(readFileSync(ecCheckerPath, 'utf8')) as {
      Exclude: string[];
      Disable: Record<string, boolean>;
    };
    expect(ecConfig.Disable.Indentation).toBe(true);
    expect(ecConfig.Disable.IndentSize).toBe(true);
    expect(ecConfig.Exclude).toContain('docs/port/');
    expect(ecConfig.Exclude).toContain('pnpm-lock\\.yaml');
    expect(ecConfig.Exclude).toContain('node_modules');
  });

  it('scripts/install-editorconfig-checker.sh is executable and checksum-verified', () => {
    const installerRelPath = 'scripts/install-editorconfig-checker.sh';
    const installerPath = join(REPO_ROOT, installerRelPath);
    expect(existsSync(installerPath)).toBe(true);
    const gitStageLine = execFileSync('git', ['ls-files', '--stage', installerRelPath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
    expect(gitStageLine).toMatch(/^100755\s/);
    // NTFS does not store POSIX execute bits, so check working-tree mode on POSIX only.
    const workingTreeExecMode =
      process.platform === 'win32' ? 0o111 : statSync(installerPath).mode & 0o111;
    expect(workingTreeExecMode).not.toBe(0);
    const script = readFileSync(installerPath, 'utf8');
    expect(script).toContain('EC_VERSION');
    expect(script).toContain('checksums.txt');
  });

  it('package.json devDependencies, cspell.json, and .vscode/extensions.json configure Node-native cspell (Q9.A)', () => {
    const devDeps = packageJson.devDependencies as Record<string, string>;
    expect(devDeps.cspell).toBeDefined();

    const extensions = JSON.parse(
      readFileSync(join(REPO_ROOT, '.vscode', 'extensions.json'), 'utf8')
    ) as { recommendations: string[] };
    expect(extensions.recommendations).toContain('streetsidesoftware.code-spell-checker');

    const cspellPath = join(REPO_ROOT, 'cspell.json');
    expect(existsSync(cspellPath)).toBe(true);
    const cspell = JSON.parse(readFileSync(cspellPath, 'utf8')) as {
      enableGlobDot?: boolean;
      words?: string[];
      ignoreRegExpList?: string[];
    };
    expect(cspell.enableGlobDot).toBe(true);
    expect(cspell.words).toContain('smorinlabs');
    const regexList = cspell.ignoreRegExpList ?? [];
    const matchesAction = (target: string): boolean =>
      regexList.some((pattern) => new RegExp(pattern.replace(/^\/|\/[a-z]*$/g, '')).test(target));
    expect(matchesAction('smorinlabs/difftree-action')).toBe(true);
    expect(matchesAction('smorinlabs/template-press')).toBe(true);
  });

  it('Justfile provides install-editorconfig-checker, check-editorconfig, and check-spelling wired into all and pre-commit-run', () => {
    const justfile = readFileSync(join(REPO_ROOT, 'Justfile'), 'utf8');
    expect(justfile).toMatch(/^@?install-editorconfig-checker:/m);
    expect(justfile).toMatch(/^@?check-editorconfig:/m);
    expect(justfile).toMatch(/^@?check-spelling:/m);

    const allLine = justfile.split(/\r?\n/).find((l) => l.startsWith('@all:')) ?? '';
    const preCommitLine =
      justfile.split(/\r?\n/).find((l) => l.startsWith('@pre-commit-run:')) ?? '';
    expect(allLine).toContain('check-editorconfig');
    expect(allLine).toContain('check-spelling');
    expect(preCommitLine).toContain('check-editorconfig');
    expect(preCommitLine).toContain('check-spelling');
  });
});
