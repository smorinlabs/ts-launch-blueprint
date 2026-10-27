// Process entry for the API (thin; excluded from coverage like the CLI's
// src/cli.ts, and exercised by the e2e test): config -> logger -> createCore
// -> metrics -> serve, plus graceful shutdown on SIGTERM/SIGINT (src/shutdown.ts, D-050).
// Everything after config is logged as JSON (D-051); a config error comes
// before the logger exists, so it is the one plain stderr line.
import { serve } from '@hono/node-server';
import { createCore } from '@ts-launch-blueprint/core';

import { createApp } from './app.js';
import { resolveApiConfig } from './config.js';
import { createLogger } from './logger.js';
import { createMetrics } from './metrics.js';
import { createShutdown } from './shutdown.js';

let config;
try {
  config = resolveApiConfig(process.env);
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

const logger = createLogger({ level: config.logLevel });
const core =
  config.source === 'memory'
    ? createCore({ source: 'memory' })
    : createCore({
        source: 'http',
        http: { token: config.token, fetchImpl: globalThis.fetch, baseUrl: config.baseUrl },
      });

const { port, source } = config;
const metrics = config.metricsEnabled ? createMetrics({ collectDefaults: true }) : undefined;
const app = createApp({ core, logger, gcpProjectId: config.gcpProjectId, metrics });
const server = serve({ fetch: app.fetch, port }, () => {
  logger.info(
    { port, source },
    `ts-launch-blueprint api listening on :${port} (source: ${source})`
  );
});

// A startup failure (e.g. the port is busy) is one CRITICAL line, not a stack.
server.on('error', (err: NodeJS.ErrnoException) => {
  const message =
    err.code === 'EADDRINUSE' ? `port ${port} is already in use` : `${err.name}: ${err.message}`;
  logger.fatal({ code: err.code }, message);
  process.exit(1);
});

const shutdown = createShutdown({
  close: (done) => server.close(done),
  exit: (code) => process.exit(code),
  log: (line) => logger.info(line),
});
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
