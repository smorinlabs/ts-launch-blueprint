// Compare base vs. head API contract snapshots for semantic breaking changes (D-043).
// Usage: pnpm exec tsx scripts/check-contract-breaking.mjs <base.json> <head.json>
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT_MODULE_PATH = resolve(REPO_ROOT, 'apps/api/src/contract.ts');

const [basePath, headPath] = process.argv.slice(2);
if (basePath === undefined || headPath === undefined) {
  console.error('Usage: check-contract-breaking.mjs <base.json> <head.json>');
  process.exit(2);
}

const base = JSON.parse(readFileSync(basePath, 'utf8'));
const head = JSON.parse(readFileSync(headPath, 'utf8'));

const { detectBreakingContractChanges } = await import(CONTRACT_MODULE_PATH);
const { breaking, nonBreaking } = detectBreakingContractChanges(base, head);

for (const item of nonBreaking) {
  console.log(`non-breaking: ${item}`);
}

if (breaking.length > 0) {
  for (const err of breaking) {
    console.error(`BREAKING [${err.procedure} ${err.path}]: ${err.reason}`);
  }
  process.exit(1);
}

console.log('PASS: no breaking API contract changes detected.');
