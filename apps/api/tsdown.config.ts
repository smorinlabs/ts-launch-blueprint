// Build config for the API app (D-048): one entry, the process entry
// src/server.ts. No .d.ts: nothing consumes this package's types (the web
// app will import the AppRouter type from source). The private workspace core
// exports TypeScript source, so it is bundled into dist/, as for the CLI.
import { defineConfig } from 'tsdown';

const config: ReturnType<typeof defineConfig> = defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  fixedExtension: false,
  dts: false,
  sourcemap: true,
  clean: true,
  deps: { alwaysBundle: ['@ts-launch-blueprint/core'] },
});

export default config;
