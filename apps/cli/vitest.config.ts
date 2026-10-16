// Vitest project for the ts-projects CLI (D-040). The root vitest.config.ts finds it by
// glob; the explicit name keeps `vitest --project cli` stable (the
// default would be the package name).
import { defineProject } from 'vitest/config';

// Explicit annotation required by isolatedDeclarations (D-025).
const config: ReturnType<typeof defineProject> = defineProject({
  test: { name: 'cli', include: ['tests/**/*.test.ts'] },
});

export default config;
