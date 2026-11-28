// `ts-projects doctor [--bundle]` command.
import type { Command } from 'commander';

import type { CliContext, CliDeps } from '../deps.js';
import { buildDiagnosticsBundle, runDiagnostics } from '../diagnostics.js';
import { EXIT_CODES } from '../exit-codes.js';
import { deliverResult } from '../pager.js';
import { SilentExitError } from './config.js';

interface DoctorOptions {
  bundle: boolean;
}

/** Register the `doctor [--bundle]` command. */
export function registerDoctorCommand(
  program: Command,
  deps: CliDeps,
  initContext: (commandPath: string) => CliContext
): void {
  program
    .command('doctor')
    .description('check environment and configuration health')
    .option('--bundle', 'collect a redacted diagnostics bundle for bug reports', false)
    .action((cmdOpts: DoctorOptions) => {
      const ctx = initContext('doctor');
      const report = runDiagnostics(ctx.resolvedConfig, deps);
      const result = cmdOpts.bundle
        ? buildDiagnosticsBundle(ctx.resolvedConfig, deps, report)
        : report;
      deliverResult(result, ctx, deps);
      if (report.hasError()) {
        throw new SilentExitError(EXIT_CODES.error);
      }
    });
}
