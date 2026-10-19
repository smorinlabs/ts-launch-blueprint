// Vitest project for the Hono + tRPC API (D-043). The root vitest.config.ts
// finds it by glob; the explicit name keeps `vitest --project api` stable (the
// default would be the package name).
import { defineProject } from 'vitest/config';

const config: ReturnType<typeof defineProject> = defineProject({
  test: { name: 'api', include: ['tests/**/*.test.ts'] },
});

export default config;
