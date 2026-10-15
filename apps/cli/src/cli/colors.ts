// Color surface (D-038, supersedes D-026): picocolors' createColors(enabled)
// wrapped behind semantic helpers. Enablement is computed HERE (per D-018(2)
// precedence: --no-color flag > NO_COLOR > FORCE_COLOR > stream isTTY) from
// injected inputs, and passed explicitly into createColors, which fully
// overrides picocolors' own module-load env/argv/TTY detection (verified in
// D-038) so the gate stays authoritative and deterministic in tests.
import pc from 'picocolors';

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
 * (D-018(2), gate shape retained by D-038). NO_COLOR/FORCE_COLOR follow the
 * informal spec: any non-empty value counts; FORCE_COLOR='0' disables
 * rather than forces.
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
  const paint = pc.createColors(enabled);
  return {
    error: paint.red,
    warn: paint.yellow,
    success: paint.green,
    dim: paint.dim,
  };
}
