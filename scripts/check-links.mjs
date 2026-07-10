#!/usr/bin/env node
// scripts/check-links.mjs
//
// Dependency-free, OFFLINE relative-link checker for the CommonMark docs
// tree (docs-check, D-023(5)). Chosen over lychee (not installed on this
// machine/CI image) and npx markdown-link-check (adds a network-capable
// dependency and still needs config to skip external URLs) because a plain
// Node script has zero install cost and is maximally portable for a
// template repo — anywhere `node` runs, `just docs-check` works.
//
// What it does: walks the given files/directories for *.md files, extracts
// markdown link targets `[text](target)` (and image targets `![alt](target)`),
// skips anything that isn't a same-repo relative link (external URLs with a
// `scheme:` prefix such as http:/https:/mailto:, and pure in-page anchors
// like `#section`), and verifies every remaining target resolves to a file
// or directory that exists on disk relative to the linking file's directory.
// A `path.md#section` fragment is stripped before the existence check —
// this script validates link TARGETS exist, not that anchors inside the
// target resolve (anchor-level checking is out of scope by design).
//
// Usage: node scripts/check-links.mjs <file-or-dir> [<file-or-dir> ...]
// Exit code: 0 if every checkable link resolves, 1 if any are broken,
// 2 on usage error. Never makes a network call.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

const LINK_TARGET_RE = /!?\[[^\]]*\]\(([^)]+)\)/g;
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const SKIP_DIR_NAMES = new Set(['node_modules', '.git', 'dist', 'coverage']);

function collectMarkdownFiles(inputPaths) {
  const files = [];
  function walk(path) {
    const st = statSync(path);
    if (st.isDirectory()) {
      for (const entry of readdirSync(path)) {
        if (SKIP_DIR_NAMES.has(entry)) continue;
        walk(join(path, entry));
      }
    } else if (st.isFile() && extname(path) === '.md') {
      files.push(path);
    }
  }
  for (const inputPath of inputPaths) walk(inputPath);
  return files;
}

function extractLinkTargets(content) {
  const targets = [];
  for (const match of content.matchAll(LINK_TARGET_RE)) {
    targets.push(match[1].trim());
  }
  return targets;
}

function isCheckableRelativeLink(target) {
  if (target === '') return false;
  if (target.startsWith('#')) return false; // in-page anchor
  if (SCHEME_RE.test(target)) return false; // http:, https:, mailto:, etc.
  return true;
}

function stripAngleBrackets(target) {
  // CommonMark allows <a target with spaces> link destinations.
  if (target.startsWith('<') && target.endsWith('>')) return target.slice(1, -1);
  return target;
}

function checkFile(file) {
  const content = readFileSync(file, 'utf8');
  const dir = dirname(file);
  const results = [];
  for (const rawTarget of extractLinkTargets(content)) {
    const target = stripAngleBrackets(rawTarget);
    if (!isCheckableRelativeLink(target)) continue;

    const [pathPart] = target.split('#');
    if (pathPart === '') continue; // e.g. a bare "#foo" already filtered; guard anyway

    const resolved = resolve(dir, pathPart);
    let exists = true;
    try {
      statSync(resolved);
    } catch {
      exists = false;
    }
    results.push({ file, rawTarget, resolved, exists });
  }
  return results;
}

function main() {
  const inputPaths = process.argv.slice(2);
  if (inputPaths.length === 0) {
    console.error('usage: node scripts/check-links.mjs <file-or-dir> [<file-or-dir> ...]');
    process.exit(2);
  }

  const files = collectMarkdownFiles(inputPaths);
  let checkedCount = 0;
  let brokenCount = 0;

  for (const file of files) {
    for (const result of checkFile(file)) {
      checkedCount += 1;
      if (!result.exists) {
        brokenCount += 1;
        console.error(
          `broken link: ${result.file} -> ${result.rawTarget} (resolved: ${result.resolved})`
        );
      }
    }
  }

  console.log(
    `docs-check: ${files.length} file(s) scanned, ${checkedCount} relative link(s) checked, ${brokenCount} broken`
  );
  process.exit(brokenCount > 0 ? 1 : 0);
}

main();
