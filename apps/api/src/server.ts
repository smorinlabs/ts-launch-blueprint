// Process entry for the API (thin; excluded from coverage like the CLI's
// src/cli.ts, and exercised by the e2e test): config -> createCore -> serve.
// SIGTERM handling for Cloud Run comes with the deploy work (P2-4).
import { serve } from '@hono/node-server';
import { createCore } from '@ts-launch-blueprint/core';

import { createApp } from './app.js';
import { resolveApiConfig } from './config.js';

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
serve({ fetch: createApp({ core }).fetch, port }, () => {
  process.stdout.write(`ts-launch-blueprint api listening on :${port} (source: ${source})\n`);
});
