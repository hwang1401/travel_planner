// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    storageState: 'tests/auth/user-a.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'user-a',
      use: {
        storageState: 'tests/auth/user-a.json',
        viewport: { width: 390, height: 844 }, // iPhone 14 size
      },
    },
  ],

  /* No webServer — dev server is started manually */
});
