// Color surface (D-026, supersedes D-016(3)): node:util styleText wrapped
// behind semantic helpers, zero dependencies. Enablement is computed HERE
// (per D-018(2) precedence: --no-color flag > NO_COLOR > FORCE_COLOR >
// stream isTTY) from injected inputs, and styleText is called with
// validateStream: false so the decision stays deterministic in tests.
import { styleText } from 'node:util';

/** Inputs for the color-enablement gate; all injected for testability. */
export interface ColorGate {
  /** True when the user passed --no-color (implemented for real; the
   * Python source declared it but never read it). */
  noColorFlag: boolean;
  /** Environment (injected, not process.env). */
  env: Record<string, string | undefined>;
  /** TTY-ness of the stream the colored text targets. */
  isTTY: boolean;
}

/**
 * enabled = !--no-color && !NO_COLOR && (FORCE_COLOR || isTTY)
 * (D-026/D-018(2)). NO_COLOR/FORCE_COLOR follow the informal spec: any
 * non-empty value counts; FORCE_COLOR='0' disables rather than forces.
 */
export function colorEnabled(gate: ColorGate): boolean {
  if (gate.noColorFlag) {
    return false;
  }
  const noColor = gate.env['NO_COLOR'];
  if (noColor !== undefined && noColor !== '') {
    return false;
  }
  const forceColor = gate.env['FORCE_COLOR'];
  if (forceColor !== undefined && forceColor !== '' && forceColor !== '0') {
    return true;
  }
  return gate.isTTY;
}

/** Semantic color helpers (source vocabulary: red/yellow/green/dim). */
export interface Colors {
  error: (text: string) => string;
  warn: (text: string) => string;
  success: (text: string) => string;
  dim: (text: string) => string;
}

/** Build the semantic helpers; identity functions when disabled. */
export function createColors(enabled: boolean): Colors {
  const paint =
    (format: Parameters<typeof styleText>[0]) =>
    (text: string): string =>
      enabled ? styleText(format, text, { validateStream: false }) : text;
  return {
    error: paint('red'),
    warn: paint('yellow'),
    success: paint('green'),
    dim: paint('dim'),
  };
}
