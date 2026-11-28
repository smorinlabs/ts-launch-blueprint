import { defineConfig, devices } from '@playwright/test';

const API_PORT = 18_080;
const WEB_PORT = 14_173;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const SERVER_START_TIMEOUT_MS = 30_000;
const isCI = Boolean(process.env['CI']);

const config: ReturnType<typeof defineConfig> = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(isCI ? { workers: 1 } : {}),
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node ../api/dist/server.js',
      url: `${API_URL}/healthz`,
      env: {
        PORT: String(API_PORT),
        TS_PROJECTS_SOURCE: 'memory',
        LOG_LEVEL: 'warn',
      },
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
    },
    {
      command: `pnpm exec vite preview --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      env: {
        E2E_API_URL: API_URL,
      },
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
    },
  ],
});

export default config;
