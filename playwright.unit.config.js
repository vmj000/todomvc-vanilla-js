import { defineConfig } from '@playwright/test';

// These tests use only Node.js APIs, with no browser fixtures or web server.
export default defineConfig({
  testDir: './tests',
  testMatch: '*.test.js',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 5_000,
  reporter: 'list',
  outputDir: 'test-results/unit',
});
