// Structured JSON logger for the API (D-051): one object per line on stdout,
// in Cloud Logging's field names (`severity`, `message`, `time`), so Cloud Run
// parses it natively. Pino's default synchronous stdout is kept on purpose:
// no transport (worker threads don't survive the all-in-one bundle) and no
// async destination (a line written just before process.exit would be lost).
// Locally: `just api | pnpm exec pino-pretty`.
import { type DestinationStream, type Logger as PinoLogger, pino } from 'pino';

import type { LogLevel } from './config.js';

/** The app's logger (pino's, narrowed to what the app uses). */
export type Logger = PinoLogger;

const SEVERITY: Record<string, string> = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
};

/** Build the JSON logger; `destination` is injectable so tests capture lines. */
export function createLogger(options: {
  level: LogLevel;
  destination?: DestinationStream;
}): Logger {
  return pino(
    {
      level: options.level,
      messageKey: 'message',
      base: { service: 'ts-launch-blueprint-api' },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ severity: SEVERITY[label] ?? 'DEFAULT' }) },
      // A safety net: these fields are never logged on purpose.
      redact: ['authorization', 'cookie', 'token', '*.authorization', '*.cookie', '*.token'],
    },
    options.destination
  );
}
