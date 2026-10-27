// createShutdown: graceful close on a signal, exit 0 when closed, exit 1 when
// closing fails or hangs past the safety timeout, and one shutdown at a time.
import { describe, expect, it, vi } from 'vitest';

import { createShutdown, SHUTDOWN_TIMEOUT_MS } from '../src/shutdown.js';

/** A shutdown with fake close/exit/log/timer, plus what it recorded. */
function harness(closeWith: 'ok' | 'error' | 'hang'): {
  shutdown: (signal: string) => void;
  exits: number[];
  logs: string[];
  fireTimer: () => void;
  timerMs: () => number | undefined;
  unref: ReturnType<typeof vi.fn<() => void>>;
} {
  const exits: number[] = [];
  const logs: string[] = [];
  const unref = vi.fn<() => void>();
  let timer: { callback: () => void; ms: number } | undefined;
  const shutdown = createShutdown({
    close: (done) => {
      if (closeWith === 'ok') {
        done();
      } else if (closeWith === 'error') {
        done(new Error('close failed'));
      }
    },
    exit: (code) => exits.push(code),
    log: (line) => logs.push(line),
    setTimer: (callback, ms) => {
      timer = { callback, ms };
      return { unref };
    },
  });
  return {
    shutdown,
    exits,
    logs,
    fireTimer: () => timer?.callback(),
    timerMs: () => timer?.ms,
    unref,
  };
}

describe('createShutdown', () => {
  it('logs the signal, closes, and exits 0', () => {
    const h = harness('ok');
    h.shutdown('SIGTERM');
    expect(h.logs).toEqual(['shutting down (SIGTERM)']);
    expect(h.exits).toEqual([0]);
  });

  it('arms an unref-ed safety timer of SHUTDOWN_TIMEOUT_MS', () => {
    const h = harness('ok');
    h.shutdown('SIGINT');
    expect(h.timerMs()).toBe(SHUTDOWN_TIMEOUT_MS);
    expect(h.unref).toHaveBeenCalledOnce();
  });

  it('exits 1 when closing fails', () => {
    const h = harness('error');
    h.shutdown('SIGTERM');
    expect(h.exits).toEqual([1]);
  });

  it('exits 1 when closing hangs past the timeout', () => {
    const h = harness('hang');
    h.shutdown('SIGTERM');
    expect(h.exits).toEqual([]);
    h.fireTimer();
    expect(h.exits).toEqual([1]);
    expect(h.logs).toContain(`shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms`);
  });

  it('ignores a second signal while already shutting down', () => {
    const h = harness('hang');
    h.shutdown('SIGTERM');
    h.shutdown('SIGINT');
    expect(h.logs).toEqual(['shutting down (SIGTERM)']);
  });

  it('defaults to a real setTimeout timer', () => {
    vi.useFakeTimers();
    try {
      const exits: number[] = [];
      createShutdown({ close: () => undefined, exit: (code) => exits.push(code), log: () => {} })(
        'SIGTERM'
      );
      vi.advanceTimersByTime(SHUTDOWN_TIMEOUT_MS);
      expect(exits).toEqual([1]);
    } finally {
      vi.useRealTimers();
    }
  });
});

/** A shutdown whose close succeeds (or fails) and whose flush is `flush`,
 * recording the order of close, flush and exit. */
function flushHarness(
  flush: () => Promise<void>,
  closeError?: Error
): { shutdown: (signal: string) => void; events: string[]; fireTimer: () => void } {
  const events: string[] = [];
  let timer: (() => void) | undefined;
  const shutdown = createShutdown({
    close: (done) => {
      events.push('close');
      done(closeError);
    },
    flush: async () => {
      events.push('flush');
      await flush();
    },
    exit: (code) => events.push(`exit ${code}`),
    log: (line) => events.push(line),
    setTimer: (callback) => {
      timer = callback;
      return { unref: () => {} };
    },
  });
  return { shutdown, events, fireTimer: () => timer?.() };
}

describe('createShutdown with a flush (D-053)', () => {
  it('closes, then flushes, then exits 0', async () => {
    const h = flushHarness(async () => {});
    h.shutdown('SIGTERM');
    await vi.waitFor(() => expect(h.events).toContain('exit 0'));
    expect(h.events).toEqual(['shutting down (SIGTERM)', 'close', 'flush', 'exit 0']);
  });

  it('exits 1 when the flush rejects', async () => {
    const h = flushHarness(async () => {
      throw new Error('collector unreachable');
    });
    h.shutdown('SIGTERM');
    await vi.waitFor(() => expect(h.events).toContain('exit 1'));
    expect(h.events).toContain('shutdown flush failed: collector unreachable');
  });

  it('still flushes when closing failed, then exits 1', async () => {
    const h = flushHarness(async () => {}, new Error('close failed'));
    h.shutdown('SIGTERM');
    await vi.waitFor(() => expect(h.events).toContain('exit 1'));
    expect(h.events).toEqual(['shutting down (SIGTERM)', 'close', 'flush', 'exit 1']);
  });

  it('a hanging flush still hits the safety timer', () => {
    const h = flushHarness(() => new Promise<void>(() => {}));
    h.shutdown('SIGTERM');
    expect(h.events).not.toContain('exit 0');
    h.fireTimer();
    expect(h.events).toContain('exit 1');
    expect(h.events).toContain(`shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms`);
  });
});
