#!/usr/bin/env node
// scripts/reset-version.mjs
//
// Reset a package.json manifest's "version" field to "0.1.0" during a
// template-press [[edit]] pass so pressed child repositories start at 0.1.0
// with root package.json, apps/cli/package.json, and
// .release-please-manifest.json aligned.
//
// Usage: node scripts/reset-version.mjs <path-to-package.json>

import { readFileSync, writeFileSync } from 'node:fs';

const targetPath = process.argv[2];
if (!targetPath) {
  console.error('usage: node scripts/reset-version.mjs <package.json>');
  process.exit(2);
}

let parsed;
try {
  parsed = JSON.parse(readFileSync(targetPath, 'utf8'));
} catch (error) {
  console.error(
    `${targetPath} must contain valid JSON: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
  console.error(`${targetPath} must contain a JSON object`);
  process.exit(1);
}

parsed.version = '0.1.0';
writeFileSync(targetPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
