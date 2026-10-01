import { defineConfig } from '@playwright/test';

const target = process.env.VOLT_WEBMCP_URL;
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/native-webmcp.spec.ts',
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: target || 'http://127.0.0.1:3018',
    channel: process.env.VOLT_WEBMCP_CHANNEL || 'chrome',
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--enable-features=WebMCP'],
      ignoreDefaultArgs: ['--disable-back-forward-cache'],
    },
  },
  webServer: target
    ? undefined
    : {
        command: 'node scripts/serve-build.mjs',
        url: 'http://127.0.0.1:3018',
        reuseExistingServer: false,
      },
});
