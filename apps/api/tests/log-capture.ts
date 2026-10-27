// Test helper: a logger whose JSON lines are captured in memory (parsed), so
// tests assert on fields instead of text.
import type { LogLevel } from '../src/config.js';
import { createLogger, type Logger } from '../src/logger.js';

/** One captured log line. */
export type LogLine = Record<string, unknown> & { severity: string; message: string };

/** A logger plus the lines it wrote. */
export function captureLogger(level: LogLevel = 'debug'): { logger: Logger; lines: LogLine[] } {
  const lines: LogLine[] = [];
  const logger = createLogger({
    level,
    destination: {
      write(chunk: string): void {
        for (const text of chunk.split('\n')) {
          if (text !== '') {
            lines.push(JSON.parse(text) as LogLine);
          }
        }
      },
    },
  });
  return { logger, lines };
}
