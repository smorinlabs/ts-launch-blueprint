// Test helper: tracing enabled with an in-memory exporter (synchronous
// SimpleSpanProcessor), so spans are readable right after a request. Read
// them BEFORE shutdown(): shutting down clears the exporter.
import { InMemorySpanExporter, type ReadableSpan } from '@opentelemetry/sdk-trace';

import { DEFAULT_SERVICE_NAME } from '../src/config.js';
import { createTracing, type Tracing } from '../src/tracing.js';

/** Tracing that records spans in memory. */
export function captureTracing(sampleRatio = 1): {
  tracing: Tracing;
  spans: () => ReadableSpan[];
} {
  const exporter = new InMemorySpanExporter();
  const tracing = createTracing({ serviceName: DEFAULT_SERVICE_NAME, sampleRatio, exporter });
  return { tracing, spans: () => exporter.getFinishedSpans() };
}
