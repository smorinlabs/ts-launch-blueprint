#!/usr/bin/env node
// Thin process entry (S3a): signal/EPIPE handling plus the exit-code
// bridge. All real logic lives in runCli (src/router.ts) behind DI so it
// is testable in-process; this file is excluded from coverage as a thin
// adapter (D-019(3)) and exercised by the S3b subprocess tier.
import { EXIT_CODES } from './lib/errors.js';
import { realDeps, runCli } from './router.js';

// Graceful EPIPE (cli-standards R9.6): `ts-projects ... | head` must not
// crash when the reader closes the pipe early.
const ignoreEpipe = (err: NodeJS.ErrnoException): void => {
  if (err.code === 'EPIPE') {
    process.exit(EXIT_CODES.success);
  }
  throw err;
};
process.stdout.on('error', ignoreEpipe);
process.stderr.on('error', ignoreEpipe);

// Signal contract (D-016(2)): SIGINT -> 130, SIGTERM -> 143.
process.on('SIGINT', () => {
  process.exit(EXIT_CODES.sigint);
});
process.on('SIGTERM', () => {
  process.exit(EXIT_CODES.sigterm);
});

process.exitCode = await runCli(process.argv.slice(2), realDeps());
