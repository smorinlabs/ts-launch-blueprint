// Process entry for the API (thin; excluded from coverage like the CLI's
// src/cli.ts, and exercised by the e2e test): config -> createCore -> serve,
// plus graceful shutdown on SIGTERM/SIGINT (src/shutdown.ts, D-050).
import { serve } from '@hono/node-server';
import { createCore } from '@ts-launch-blueprint/core';

import { createApp } from './app.js';
import { resolveApiConfig } from './config.js';
import { createShutdown } from './shutdown.js';

let config;
try {
  config = resolveApiConfig(process.env);
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

const core =
  config.source === 'memory'
    ? createCore({ source: 'memory' })
    : createCore({
        source: 'http',
        http: { token: config.token, fetchImpl: globalThis.fetch, baseUrl: config.baseUrl },
      });

const port = config.port;
const source = config.source;
const server = serve({ fetch: createApp({ core }).fetch, port }, () => {
  process.stdout.write(`ts-launch-blueprint api listening on :${port} (source: ${source})\n`);
});

const shutdown = createShutdown({
  close: (done) => server.close(done),
  exit: (code) => process.exit(code),
  log: (line) => process.stdout.write(`${line}\n`),
});
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
