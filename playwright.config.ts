import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/native-webmcp.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3018', trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/serve-build.mjs',
    url: 'http://127.0.0.1:3018',
    reuseExistingServer: false,
  },
});
