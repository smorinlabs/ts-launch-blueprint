#!/usr/bin/env node
// CLI stub (S1): prints the version for --version/-V via a plain argv check.
// Commander-based command surface arrives in S3a.
import { VERSION } from './version.js';

const args = process.argv.slice(2);

if (args.includes('--version') || args.includes('-V')) {
  console.log(`ts-projects ${VERSION}`);
  process.exit(0);
}

process.stderr.write('ts-projects: CLI stub - commands arrive in a later slice (S3a)\n');
process.exit(0);
