// Build config for the API app (D-048): one entry, the process entry
// src/server.ts. No .d.ts: nothing consumes this package's types (the web
// app will import the AppRouter type from source). EVERY dependency (hono,
// tRPC, the private workspace core) is bundled into dist/server.js, so the
// container's runtime stage needs only dist/: no node_modules, no pnpm
// (D-050). The only imports left are node:* built-ins.
import { defineConfig } from 'tsdown';

const config: ReturnType<typeof defineConfig> = defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  fixedExtension: false,
  dts: false,
  sourcemap: true,
  clean: true,
  deps: { alwaysBundle: [/.*/] },
});

export default config;
