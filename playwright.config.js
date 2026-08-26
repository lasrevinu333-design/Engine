const { defineConfig } = require('@playwright/test');

const testPort = Number(process.env.PORT || 4173);
const testBaseUrl = `http://127.0.0.1:${testPort}`;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: testBaseUrl,
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node tests/static-test-server.mjs',
    url: `${testBaseUrl}/start_page1.html`,
    reuseExistingServer: false,
    timeout: 15_000
  }
});
