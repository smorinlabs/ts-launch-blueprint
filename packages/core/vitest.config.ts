// Vitest project for the shared core library (D-040). The root vitest.config.ts finds it by
// glob; the explicit name keeps `vitest --project core` stable (the
// default would be the package name).
import { defineProject } from 'vitest/config';

// Explicit annotation required by isolatedDeclarations (D-025).
const config: ReturnType<typeof defineProject> = defineProject({
  test: { name: 'core', include: ['tests/**/*.test.ts'] },
});

export default config;
