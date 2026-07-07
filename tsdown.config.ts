// Build config (D-012(1)): tsdown (exact-pinned 0.22.x) bundles the CLI and the
// library entry; dts via the fast oxc path (isolatedDeclarations, D-025).
// The shebang in src/cli.ts is preserved by tsdown and the output made
// executable. tsc --noEmit remains the separate typecheck gate.
import { defineConfig } from 'tsdown';

// Explicit annotation required by isolatedDeclarations (D-025).
const config: ReturnType<typeof defineConfig> = defineConfig({
  entry: ['src/cli.ts', 'src/lib.ts'],
  format: 'esm',
  // Emit .js/.d.ts (not .mjs/.d.mts): the package is "type": "module", and the
  // hand-authored exports map / bin point at dist/lib.js + dist/cli.js (D-012(3)).
  fixedExtension: false,
  dts: true,
  sourcemap: true,
  clean: true,
});

export default config;
