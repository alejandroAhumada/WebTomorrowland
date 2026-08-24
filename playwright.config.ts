import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e', outputDir: 'test-results', fullyParallel: false,
  forbidOnly: Boolean(process.env.CI), retries: process.env.CI ? 1 : 0, workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]], timeout: 45_000, expect: { timeout: 10_000 },
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173', browserName: 'chromium', channel: 'chrome', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : { command: 'npm run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI, timeout: 120_000 },
})
