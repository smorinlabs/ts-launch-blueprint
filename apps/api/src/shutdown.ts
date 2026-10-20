// Graceful shutdown (D-050): on SIGTERM (Cloud Run, `docker stop`) or SIGINT,
// stop accepting connections, let in-flight requests finish, then exit 0. A
// safety timer exits 1 if closing hangs; it is unref'd so it never keeps the
// process alive on its own. Node runs as PID 1 in a container, where default
// signal handling doesn't apply, so this explicit handler is what makes the
// stop graceful.

/** What shutdown needs from the server, the process and the clock. */
export interface ShutdownDeps {
  /** Stop accepting connections; calls back once in-flight requests finish. */
  close: (done: (err?: Error) => void) => void;
  exit: (code: number) => void;
  log: (line: string) => void;
  /** Schedules the safety exit; returns a handle with `unref`. */
  setTimer?: (callback: () => void, ms: number) => { unref: () => void };
}

/** How long closing may take before the process exits 1. */
export const SHUTDOWN_TIMEOUT_MS = 10_000;

/** Build the signal handler: call it with the signal name. */
export function createShutdown(deps: ShutdownDeps): (signal: string) => void {
  const setTimer = deps.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  let shuttingDown = false;
  return (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    deps.log(`shutting down (${signal})`);
    setTimer(() => {
      deps.log(`shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms`);
      deps.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
    deps.close((err) => {
      deps.exit(err === undefined ? 0 : 1);
    });
  };
}
