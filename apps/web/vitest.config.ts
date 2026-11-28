// Vitest project for the web app: component tests in a jsdom DOM.
import { defineProject } from 'vitest/config';

const config: ReturnType<typeof defineProject> = defineProject({
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});

export default config;
