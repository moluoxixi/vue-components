import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const headedSlowMo = process.argv.includes('--headed') ? 500 : 0

export default defineConfig({
  testDir: './e2e',
  testMatch: /playground\.spec\.ts/,
  outputDir: 'dist/test-results/playground',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'dist/playwright-report/playground' }],
  ],
  use: {
    actionTimeout: 10_000,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    launchOptions: {
      slowMo: Number(process.env.PLAYGROUND_E2E_SLOW_MO ?? headedSlowMo),
    },
  },
  webServer: [
    {
      command: 'pnpm -C playgrounds/element-plus-playground dev --host 127.0.0.1 --port 4210',
      url: 'http://127.0.0.1:4210',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm -C playgrounds/antd-vue-playground dev --host 127.0.0.1 --port 4211',
      url: 'http://127.0.0.1:4211',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'element-plus',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4210',
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'antd-vue',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4211',
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
})
