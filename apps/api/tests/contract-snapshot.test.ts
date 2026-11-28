// Contract snapshot freshness test (P10-TS05, D-043).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { type ApiContractSnapshot, buildApiContractSnapshot } from '../src/contract.js';
import { MAX_API_LIMIT } from '../src/router.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SNAPSHOT_PATH = resolve(REPO_ROOT, 'docs/api/contract.snapshot.json');

describe('API contract snapshot (D-043)', () => {
  it('committed docs/api/contract.snapshot.json matches live appRouter', () => {
    const committed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as ApiContractSnapshot;
    const live = buildApiContractSnapshot();
    expect(
      committed,
      'docs/api/contract.snapshot.json is stale — run `just export-contract` and commit'
    ).toEqual(live);
  });

  it('sorts procedures deterministically and captures inputOptional + MAX_API_LIMIT', () => {
    const snapshot = buildApiContractSnapshot();
    expect(snapshot.version).toBe('0.0.0');
    expect(snapshot.schemaVersion).toBe(1);
    const names = Object.keys(snapshot.procedures);
    for (let i = 1; i < names.length; i += 1) {
      expect(names[i - 1]! < names[i]!).toBe(true);
    }
    expect(names).toEqual(expect.arrayContaining(['projects.get', 'projects.list']));
    expect(snapshot.procedures['projects.list']?.inputOptional).toBe(true);
    expect(snapshot.procedures['projects.get']?.inputOptional).toBe(false);

    const listInput = snapshot.procedures['projects.list']?.input as {
      properties?: { limit?: { maximum?: number } };
    };
    expect(listInput.properties?.limit?.maximum).toBe(MAX_API_LIMIT);
  });
});
