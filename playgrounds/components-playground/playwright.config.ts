import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const headedSlowMo = process.argv.includes('--headed') ? 500 : 0

export default defineConfig({
  testDir: './e2e',
  testMatch: /components-playground\.spec\.ts/,
  outputDir: 'dist/test-results/components-playground',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'dist/playwright-report/components-playground' }],
  ],
  use: {
    actionTimeout: 10_000,
    baseURL: 'http://127.0.0.1:4312',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    launchOptions: {
      slowMo: Number(process.env.PLAYGROUND_E2E_SLOW_MO ?? headedSlowMo),
    },
  },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4312',
    url: 'http://127.0.0.1:4312',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'components-playground',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
})
