import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser',
  timeout: 60000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'msedge',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
