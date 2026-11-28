// Standalone library build config (ADR 0017): tsdown bundles packages/core
// into ESM-only dist/ outputs with .d.ts generated via oxc isolatedDeclarations
// and JS sourcemaps. Runtime dependencies (zod) stay external and are never
// bundled into the library artifact.
import { defineConfig } from 'tsdown';

// Explicit annotation required by isolatedDeclarations (D-025).
const config: ReturnType<typeof defineConfig> = defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  // Emit .js/.d.ts (not .mjs/.d.mts): the package is "type": "module", and
  // publishConfig.exports points at ./dist/index.js + ./dist/index.d.ts.
  fixedExtension: false,
  dts: true,
  sourcemap: true,
  treeshake: true,
  clean: true,
  deps: {
    neverBundle: ['zod'],
  },
});

export default config;
