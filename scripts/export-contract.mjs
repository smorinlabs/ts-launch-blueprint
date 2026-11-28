// Export the deterministic Zod/tRPC API contract snapshot to
// docs/api/contract.snapshot.json (D-043). Run via `just export-contract`.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT_MODULE_PATH = resolve(REPO_ROOT, 'apps/api/src/contract.ts');
const OUT_PATH = resolve(REPO_ROOT, 'docs/api/contract.snapshot.json');

if (!existsSync(CONTRACT_MODULE_PATH)) {
  console.error('apps/api/src/contract.ts not found — skipping contract export.');
  process.exit(1);
}

const { buildApiContractSnapshot } = await import(pathToFileURL(CONTRACT_MODULE_PATH).href);
const snapshot = buildApiContractSnapshot();

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Wrote ${OUT_PATH}`);
