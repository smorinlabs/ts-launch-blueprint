// Guards for the weekly-audit triage bot (workflow shape + helper logic).
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const WORKFLOW_PATH = join(REPO_ROOT, '.github', 'workflows', 'audit-triage.yml');
const HELPER_PATH = join(REPO_ROOT, '.github', 'scripts', 'muse_audit_triage.py');
const POLICY_PATH = join(REPO_ROOT, '.github', 'muse-audit-triage', 'policy.json');
const SETTINGS_PATH = join(REPO_ROOT, '.github', 'muse-audit-triage', 'triage-settings.json');
const RUNTIME_PATH = join(REPO_ROOT, '.github', 'muse-audit-triage', 'runtime.py');
const NOTICE_PATH = join(REPO_ROOT, '.github', 'muse-audit-triage', 'NOTICE');

interface WorkflowStep {
  name: string;
  id?: string;
  if?: string;
  run?: string;
  uses?: string;
  'continue-on-error'?: boolean;
  env?: Record<string, string>;
  with?: Record<string, string>;
}

interface TriageWorkflow {
  name: string;
  on: Record<string, unknown>;
  permissions: Record<string, unknown>;
  concurrency: { group: string; 'cancel-in-progress': boolean };
  jobs: {
    triage: {
      if: string;
      'runs-on': string;
      permissions: Record<string, string>;
      steps: WorkflowStep[];
    };
  };
}

function loadWorkflow(): TriageWorkflow {
  return parse(readFileSync(WORKFLOW_PATH, 'utf8')) as TriageWorkflow;
}

function stepNamed(workflow: TriageWorkflow, name: string): WorkflowStep {
  const step = workflow.jobs.triage.steps.find((s) => s.name === name);
  if (!step) {
    throw new Error(`Missing step: ${name}`);
  }
  return step;
}

function runPython(script: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync('python3', ['-B', '-c', script], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: '1',
      MUSE_HELPER_PATH: HELPER_PATH,
    },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('audit-triage workflow & policy contracts', () => {
  it('ships all required muse-audit-triage files', () => {
    expect(existsSync(WORKFLOW_PATH)).toBe(true);
    expect(existsSync(HELPER_PATH)).toBe(true);
    expect(existsSync(POLICY_PATH)).toBe(true);
    expect(existsSync(SETTINGS_PATH)).toBe(true);
    expect(existsSync(RUNTIME_PATH)).toBe(true);
    expect(existsSync(NOTICE_PATH)).toBe(true);
  });

  it('triage job gates on MUSE_CI_ENABLED, Organization ownership, and schedule failures / dispatch', () => {
    const workflow = loadWorkflow();
    expect(workflow.permissions).toEqual({});
    const condition = workflow.jobs.triage.if;
    expect(condition).toContain("vars.MUSE_CI_ENABLED == 'true'");
    expect(condition).toContain("owner.type == 'Organization'");
    expect(condition).toContain("github.event_name == 'workflow_dispatch'");
    expect(condition).toContain("github.event.workflow_run.conclusion == 'failure'");
    expect(condition).toContain("github.event.workflow_run.event == 'schedule'");
  });

  it('triage job permissions are minimal', () => {
    const workflow = loadWorkflow();
    expect(workflow.jobs.triage.permissions).toEqual({
      contents: 'write',
      'pull-requests': 'write',
      actions: 'read',
    });
  });

  it('META_MUSE_CI_API_KEY is scoped strictly to the agent and credential presence check', () => {
    const workflow = loadWorkflow();
    const holders = new Set([
      'Diagnose and repair with Muse Spark',
      'Check Meta credential is configured',
    ]);
    const mismatches = workflow.jobs.triage.steps
      .filter((step) => {
        const values = [...Object.values(step.env ?? {}), ...Object.values(step.with ?? {})];
        const usesMeta = values.some((v) => String(v).includes('secrets.META_MUSE_CI_API_KEY'));
        return usesMeta !== holders.has(step.name);
      })
      .map((s) => s.name);
    expect(mismatches).toEqual([]);
  });

  it('no step sets continue-on-error', () => {
    const workflow = loadWorkflow();
    const failing = workflow.jobs.triage.steps
      .filter((step) => Boolean(step['continue-on-error']))
      .map((s) => s.name);
    expect(failing).toEqual([]);
  });

  it('validation runs even when the agent fails, and precedes commit / PR creation', () => {
    const workflow = loadWorkflow();
    const validate = stepNamed(workflow, 'Validate repair before publication');
    expect(validate.if).toBe("always() && steps.prepare.outputs.should_run == 'true'");
    expect(validate.env?.MUSE_ACTION_OUTCOME).toBe('${{ steps.muse.outcome }}');
    expect(validate.env?.MUSE_ACTION_CONCLUSION).toBe('${{ steps.muse.outputs.conclusion }}');

    const finish = stepNamed(workflow, 'Verify scope and touched URLs');
    expect(finish.if).toContain("steps.create-pr.outcome == 'success'");
    expect(finish.if).toContain("steps.prepare.outputs.resume_mode == 'finish'");
    expect(finish.env?.MUSE_CI_PR).toContain('steps.prepare.outputs.resume_pr');

    const createPr = stepNamed(workflow, 'Create triage PR');
    expect(createPr.if).toContain("steps.prepare.outputs.resume_mode == 'create_pr'");

    const names = workflow.jobs.triage.steps.map((s) => s.name);
    expect(names.indexOf('Validate repair before publication')).toBeLessThan(
      names.indexOf('Commit repair')
    );
    expect(names.indexOf('Commit repair')).toBeLessThan(names.indexOf('Create triage PR'));

    const commit = stepNamed(workflow, 'Commit repair');
    expect(commit.if).toContain("steps.validate.outcome == 'success'");
    expect(commit.if).toContain("steps.validate.outputs.has_changes == 'true'");
    expect(commit.run).not.toContain('git add');
  });

  it('trusted checkout precedes prepare, prompt uses action input, and dispatch input stays out of shell', () => {
    const workflow = loadWorkflow();
    const names = workflow.jobs.triage.steps.map((s) => s.name);
    expect(names.indexOf('Check out trusted triage configuration')).toBeLessThan(
      names.indexOf('Authorize trigger and prepare frozen failure bundle')
    );

    const checkout = stepNamed(workflow, 'Check out trusted triage configuration');
    expect(checkout.with?.ref).toBe('${{ github.event.repository.default_branch }}');

    const prepare = stepNamed(workflow, 'Authorize trigger and prepare frozen failure bundle');
    expect(prepare.run).toBe('python3 .github/scripts/muse_audit_triage.py prepare triage');
    expect(prepare.env?.MUSE_TRIAGE_TRUSTED_SHA).toBe('${{ steps.checkout.outputs.commit }}');

    const rawWorkflow = readFileSync(WORKFLOW_PATH, 'utf8');
    expect(rawWorkflow).not.toContain('inputs.run_id');

    const agent = stepNamed(workflow, 'Diagnose and repair with Muse Spark');
    expect(agent.with?.prompt).toBe('${{ steps.prepare.outputs.prompt }}');
    expect(agent.run).toBeUndefined();
    expect(agent.uses).toMatch(/^anthropics\/claude-code-action@[0-9a-f]{40}(\s|$)/);
    for (const envVar of [
      'ANTHROPIC_MODEL',
      'ANTHROPIC_DEFAULT_OPUS_MODEL',
      'ANTHROPIC_DEFAULT_SONNET_MODEL',
      'ANTHROPIC_DEFAULT_HAIKU_MODEL',
      'ANTHROPIC_SMALL_FAST_MODEL',
      'CLAUDE_CODE_SUBAGENT_MODEL',
    ]) {
      expect(agent.env?.[envVar]).toBe('${{ steps.prepare.outputs.model }}');
    }
    expect(agent.with?.track_progress).toBe('false');
    expect(agent.with?.classify_inline_comments).toBe('false');
  });

  it('triage-settings.json and policy.json enforce docs-only lockdown and pinned model/org', () => {
    const profile = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) as {
      permissions: {
        defaultMode: string;
        allow: string[];
        deny: string[];
        denyInsteadOfPrompting: boolean;
      };
      disableAllHooks: boolean;
      autoMemoryEnabled: boolean;
      claudeMdExcludes: string[];
    };
    expect(profile.permissions.defaultMode).toBe('dontAsk');
    expect(profile.permissions.denyInsteadOfPrompting).toBe(true);
    expect(profile.permissions.allow).not.toContain('Edit');
    expect(profile.permissions.allow).not.toContain('Write');
    expect(profile.permissions.deny).toEqual(
      expect.arrayContaining(['Bash', 'PowerShell', 'Agent', 'Skill'])
    );
    expect(profile.disableAllHooks).toBe(true);
    expect(profile.autoMemoryEnabled).toBe(false);
    expect(profile.claudeMdExcludes).toEqual(['**']);

    const policy = JSON.parse(readFileSync(POLICY_PATH, 'utf8')) as {
      schema_version: number;
      model: string;
      organization: string;
      max_findings_bytes: number;
      activation_variable: string;
    };
    expect(policy.schema_version).toBe(2);
    expect(policy.model).toBe('muse-spark-1.3-contributor');
    expect(policy.organization).toBe('smorinlabs');
    expect(policy.max_findings_bytes).toBe(20000);
    expect(policy.activation_variable).toBe('MUSE_CI_ENABLED');
  });
});

describe('audit-triage helper & shell step execution (POSIX)', () => {
  it.skipIf(process.platform === 'win32')(
    'Create triage PR step uses gh REST safely and validates PR number',
    () => {
      const workflow = loadWorkflow();
      const createPrRun = stepNamed(workflow, 'Create triage PR').run!;
      const dir = mkdtempSync(join(tmpdir(), 'audit-triage-pr-'));
      try {
        const ghPath = join(dir, 'gh');
        writeFileSync(
          ghPath,
          [
            '#!/usr/bin/env python3',
            'import json, os, sys',
            'from pathlib import Path',
            'args = sys.argv[1:]',
            "with Path(os.environ['GH_RECORD']).open('a') as f:",
            "    f.write(json.dumps(args) + '\\n')",
            "if args[:2] == ['api', 'repos/owner/repository']:",
            "    op, resp = 'read', 'pilot-main'",
            "elif args[:4] == ['api', '--method', 'POST', 'repos/owner/repository/pulls']:",
            "    op, resp = 'create', os.environ['PR_NUMBER']",
            'else:',
            "    sys.exit('unsupported gh command')",
            "if op == os.environ['FAIL_OPERATION']:",
            "    print('simulated API failure', file=sys.stderr)",
            '    sys.exit(23)',
            'print(resp)',
          ].join('\n'),
          'utf8'
        );
        chmodSync(ghPath, 0o755);

        const runCase = (opts: { repo?: string; fail?: string; prNumber?: string }) => {
          const output = join(dir, `output-${Math.random()}`);
          const record = join(dir, `record-${Math.random()}.jsonl`);
          const res = spawnSync('/bin/bash', ['-e', '-o', 'pipefail', '-c', createPrRun], {
            cwd: dir,
            encoding: 'utf8',
            env: {
              PATH: `${dir}:/usr/bin:/bin`,
              GH_REPO: 'owner/repository',
              GITHUB_REPOSITORY: opts.repo ?? 'owner/repository',
              BRANCH: 'bot/weekly-audit-987654',
              GITHUB_OUTPUT: output,
              GH_RECORD: record,
              FAIL_OPERATION: opts.fail ?? '',
              PR_NUMBER: opts.prNumber ?? '417',
            },
          });
          const calls = existsSync(record)
            ? readFileSync(record, 'utf8')
                .trim()
                .split('\n')
                .filter(Boolean)
                .map((l) => JSON.parse(l) as string[])
            : [];
          const outText = existsSync(output) ? readFileSync(output, 'utf8') : '';
          return { res, calls, outText };
        };

        const maliciousRepo = 'owner/repo "quoted"\\path\n$(touch evaluated)`touch evaluated`';
        const ok = runCase({ repo: maliciousRepo });
        expect(ok.res.status).toBe(0);
        expect(ok.outText).toBe('number=417\n');
        expect(ok.calls.length).toBe(2);
        expect(existsSync(join(dir, 'evaluated'))).toBe(false);

        const failRead = runCase({ fail: 'read' });
        expect(failRead.res.status).toBe(23);
        expect(failRead.calls.length).toBe(1);
        expect(failRead.outText).toBe('');

        const badNumber = runCase({ prNumber: '0' });
        expect(badNumber.res.status).not.toBe(0);
        expect(badNumber.outText).toBe('');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  );

  it.skipIf(process.platform === 'win32')(
    'muse_audit_triage.py helper enforces scope, URL safety, broken-line parsing, and run gating',
    () => {
      const pyScript = `
import importlib.util, json, os, sys
spec = importlib.util.spec_from_file_location("audit_triage", os.environ["MUSE_HELPER_PATH"])
mod = importlib.util.module_from_spec(spec)
sys.modules["audit_triage"] = mod
spec.loader.exec_module(mod)

log = (
    "2026-09-21T10:14:50.01Z (docs/x: line 1) \\x1b[91mbroken    \\x1b[39;49;00m"
    "https://example.invalid/dead - 404 Client Error\\n"
    "2026-09-21T10:14:50.02Z (docs/x: line 2) \\x1b[32mok        \\x1b[39;49;00m"
    "https://example.invalid/ok\\n"
)
broken = mod.extract_broken_lines(log)
assert len(broken) == 1 and broken[0].startswith("(docs/x") and "\\x1b" not in broken[0]

diff = (
    "+++ b/docs/a.md\\n--- a/docs/a.md\\n"
    "+see [x](https://example.invalid/one) and https://example.invalid/two.\\n"
    "-old https://example.invalid/gone\\n"
    "+again https://example.invalid/one\\n"
)
assert mod.touched_urls(diff) == ["https://example.invalid/one", "https://example.invalid/two"]

assert mod.scope_ok(["docs/a.md", "docs/sub/b.md"]) is True
assert mod.scope_ok(["docs/a.md", "src/x.ts"]) is False
assert mod.scope_ok(["/etc/passwd"]) is False
assert mod.scope_ok(["docs/../package.json"]) is False
assert mod.scope_ok([""]) is False

assert mod.verdict_for_status(200)[0] == "pass"
assert mod.verdict_for_status(404)[0] == "fail"
assert mod.verdict_for_status(410)[0] == "fail"
assert mod.verdict_for_status(403)[0] == "warn"

for bad in ("http://127.0.0.1/", "https://169.254.169.254/latest", "http://10.0.0.5/x", "ftp://example.invalid/x"):
    try:
        mod.assert_public_url(bad)
        raise AssertionError(f"Expected refusal for {bad}")
    except mod.RefusalError:
        pass
mod.assert_public_url("https://93.184.216.34/")

class FakeAPI:
    def __init__(self, runs):
        self.runs = runs
    def get(self, path):
        return self.runs[path]

base_run = {
    "id": 1,
    "name": "weekly-audit",
    "conclusion": "failure",
    "head_branch": "main",
    "head_sha": "abc",
    "event": "schedule",
}
event = {"repository": {"full_name": "o/r", "default_branch": "main"}, "workflow_run": base_run}
assert mod.resolve_target_run(FakeAPI({}), event, "workflow_run", "o/r")["id"] == 1

for override in ({"name": "ci"}, {"conclusion": "success"}, {"head_branch": "feat"}, {"event": "push"}):
    bad_event = {"repository": {"full_name": "o/r", "default_branch": "main"}, "workflow_run": base_run | override}
    try:
        mod.resolve_target_run(FakeAPI({}), bad_event, "workflow_run", "o/r")
        raise AssertionError(f"Expected refusal for {override}")
    except mod.RefusalError:
        pass

assert mod.jobs_path_for_run("o/r", {"id": 42, "run_attempt": 3}) == "repos/o/r/actions/runs/42/attempts/3/jobs?per_page=100"
assert mod.jobs_path_for_run("o/r", {"id": 42}) == "repos/o/r/actions/runs/42/jobs?per_page=100"

summary_text = mod.summarize_url_checks(
    [("https://example.invalid/ok", "pass", "HTTP 200"), ("https://example.invalid/skip", "skip", "DNS failed")],
    "99",
)
assert "1 pass" in summary_text and "1 skip" in summary_text and "manual verification" in summary_text

# P14: check-links.mjs broken-link format & finding target extraction
check_links_log = (
    "2026-11-28T05:00:01Z broken link: docs/guide.md -> ./missing.md (resolved: /repo/docs/missing.md)\\n"
    "2026-11-28T05:00:02Z docs-check: 10 file(s) scanned, 20 relative link(s) checked, 1 broken\\n"
)
cl_broken = mod.extract_broken_lines(check_links_log)
assert cl_broken == ["broken link: docs/guide.md -> ./missing.md (resolved: /repo/docs/missing.md)"]
files, targets = mod.extract_finding_targets(broken + cl_broken)
assert "docs/x" in files and "docs/guide.md" in files
assert "https://example.invalid/dead" in targets and "./missing.md" in targets

# P14: diff validation rejects unrelated docs edits and accepts link fixes or created targets
assert mod.diff_addresses_findings(["docs/other.md"], "--- a/docs/other.md\\n+++ b/docs/other.md\\n-unrelated\\n+changed\\n", ["docs/guide.md"], ["./missing.md"]) is False
assert mod.diff_addresses_findings(["docs/guide.md"], "--- a/docs/guide.md\\n+++ b/docs/guide.md\\n-see [x](./missing.md)\\n+see [x](./real.md)\\n", ["docs/guide.md"], ["./missing.md"]) is True
assert mod.diff_addresses_findings(["docs/missing.md"], "--- /dev/null\\n+++ b/docs/missing.md\\n+# New\\n", ["docs/guide.md"], ["./missing.md"]) is True
assert mod.diff_addresses_findings(["docs/x.md"], "--- a/docs/x.md\\n+++ b/docs/x.md\\n-old https://example.invalid/dead\\n+new https://example.invalid/ok\\n", ["docs/x"], ["https://example.invalid/dead"]) is True

# P14: safe root .npmrc allowed while secret-bearing or nested .npmrc is rejected
import tempfile, subprocess
from pathlib import Path
with tempfile.TemporaryDirectory() as td:
    tmp = Path(td)
    (tmp / ".npmrc").write_text("managePackageManagerVersions=true\\npackageManagerStrict=true\\npublic-hoist-pattern[]=@typescript/typescript-*\\n")
    assert mod.is_safe_tracked_npmrc(tmp, ".npmrc") is True
    assert mod.is_safe_tracked_npmrc(tmp, "sub/.npmrc") is False
    (tmp / ".npmrc").write_text("//registry.npmjs.org/:_authToken=secret\\n")
    assert mod.is_safe_tracked_npmrc(tmp, ".npmrc") is False
    (tmp / ".npmrc").write_text("token=\${NPM_TOKEN}\\n")
    assert mod.is_safe_tracked_npmrc(tmp, ".npmrc") is False

# P14: validate_triage_tree allows safe tracked .npmrc and rejects secret .npmrc or untracked .env
guard = mod.guard_module()
with tempfile.TemporaryDirectory() as td:
    t_repo = Path(td)
    subprocess.run(["git", "init", "-q", "--initial-branch=main", str(t_repo)], check=True)
    subprocess.run(["git", "-C", str(t_repo), "config", "user.name", "Test"], check=True)
    subprocess.run(["git", "-C", str(t_repo), "config", "user.email", "t@example.com"], check=True)
    (t_repo / ".npmrc").write_text("managePackageManagerVersions=true\\npackageManagerStrict=true\\n")
    (t_repo / "README.md").write_text("# hi\\n")
    subprocess.run(["git", "-C", str(t_repo), "add", "."], check=True)
    subprocess.run(["git", "-C", str(t_repo), "commit", "-q", "-m", "init"], check=True)
    mod.validate_triage_tree(guard, t_repo)
    # Untracked .env must be refused
    (t_repo / ".env").write_text("SECRET=1\\n")
    try:
        mod.validate_triage_tree(guard, t_repo)
        raise AssertionError("expected refusal for untracked .env")
    except mod.RefusalError:
        pass
    (t_repo / ".env").unlink()
    # Secret-bearing tracked .npmrc must be refused
    (t_repo / ".npmrc").write_text("//registry.npmjs.org/:_authToken=secret\\n")
    try:
        mod.validate_triage_tree(guard, t_repo)
        raise AssertionError("expected refusal for secret .npmrc")
    except mod.RefusalError:
        pass

# P14: partial-run resume (branch-only -> create_pr, PR-without-table -> finish, completed PR -> refuse, foreign branch -> refuse)
with tempfile.TemporaryDirectory() as td:
    td_path = Path(td)
    remote = td_path / "remote.git"
    repo = td_path / "repo"
    runner_tmp = td_path / "tmp"
    runner_tmp.mkdir()
    subprocess.run(["git", "init", "-q", "--bare", str(remote)], check=True)
    subprocess.run(["git", "init", "-q", "--initial-branch=main", str(repo)], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.name", "Maintainer"], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.email", "m@example.com"], check=True)
    (repo / "docs").mkdir()
    (repo / "docs" / "a.md").write_text("hello\\n")
    subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-q", "-m", "init"], check=True)
    base_sha = subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    subprocess.run(["git", "-C", str(repo), "remote", "add", "origin", str(remote)], check=True)
    subprocess.run(["git", "-C", str(repo), "push", "-q", "origin", "main"], check=True)

    # Create a bot-authored triage branch pushed to origin
    branch = "bot/weekly-audit-77"
    subprocess.run(["git", "-C", str(repo), "checkout", "-q", "-b", branch], check=True)
    (repo / "docs" / "a.md").write_text("fixed\\n")
    subprocess.run(["git", "-C", str(repo), "add", "docs/a.md"], check=True)
    subprocess.run(["git", "-C", str(repo), "-c", "user.name=github-actions[bot]", "-c", f"user.email={mod.BOT_EMAIL}", "commit", "-q", "-m", "fix(docs): triage weekly-audit run 77"], check=True)
    subprocess.run(["git", "-C", str(repo), "push", "-q", "origin", branch], check=True)
    subprocess.run(["git", "-C", str(repo), "checkout", "-q", "main"], check=True)
    subprocess.run(["git", "-C", str(repo), "branch", "-q", "-D", branch], check=True)

    gh_out = td_path / "out"
    gh_env = td_path / "env"
    env_map = {"RUNNER_TEMP": str(runner_tmp), "GITHUB_OUTPUT": str(gh_out), "GITHUB_ENV": str(gh_env)}

    class ResumeAPI:
        def __init__(self, pulls, refs, comments=None):
            self.pulls, self.refs, self.comments = pulls, refs, comments or []
        def get(self, path):
            if "/pulls?" in path:
                return self.pulls
            if "/matching-refs/" in path:
                return self.refs
            if "/comments" in path:
                return self.comments
            raise AssertionError(f"unexpected path {path}")

    # 1. Branch exists without PR -> resumes create_pr
    mode = mod.prepare_resume(repo, ResumeAPI([], [{"ref": f"refs/heads/{branch}"}]), "o/r", "o", "main", "77", base_sha, base_sha, branch, env_map)
    assert mode == "create_pr" and "resume_mode" in gh_out.read_text()

    # 2. PR exists without verification table -> resumes finish
    pr_obj = {"number": 501, "user": {"login": mod.BOT_LOGIN, "type": "Bot"}, "head": {"ref": branch}, "base": {"ref": "main"}}
    mode2 = mod.prepare_resume(repo, ResumeAPI([pr_obj], [], comments=[]), "o/r", "o", "main", "77", base_sha, base_sha, branch, env_map)
    assert mode2 == "finish"

    # 3. PR exists WITH verification table -> refuses
    try:
        mod.prepare_resume(repo, ResumeAPI([pr_obj], [], comments=[{"user": {"login": mod.BOT_LOGIN}, "body": "## Triage URL verification\\n| URL |"}]), "o/r", "o", "main", "77", base_sha, base_sha, branch, env_map)
        raise AssertionError("expected refusal for completed PR")
    except mod.RefusalError:
        pass

    # 4. PR owned by non-bot user -> refuses
    foreign_pr = {"number": 502, "user": {"login": "mallory", "type": "User"}, "head": {"ref": branch}, "base": {"ref": "main"}}
    try:
        mod.prepare_resume(repo, ResumeAPI([foreign_pr], []), "o/r", "o", "main", "77", base_sha, base_sha, branch, env_map)
        raise AssertionError("expected refusal for non-bot PR")
    except mod.RefusalError:
        pass

print("OK")
`;
      const result = runPython(pyScript);
      expect(result.status).toBe(0);
      expect(result.stdout.trim().split('\n').at(-1)).toBe('OK');
    }
  );
});
