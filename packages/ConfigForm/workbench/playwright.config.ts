import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const serverPort = Number(process.env.CONFIG_FORM_WORKBENCH_E2E_PORT ?? 4331)
const serverUrl = `http://127.0.0.1:${serverPort}`

export default defineConfig({
  testDir: './e2e',
  testMatch: /(?:accessibility|interaction|json-import|template-management)\.spec\.ts/,
  outputDir: 'dist/test-results/config-form-workbench',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'dist/playwright-report/config-form-workbench' }],
  ],
  use: {
    actionTimeout: process.env.CI ? 30_000 : 10_000,
    baseURL: serverUrl,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm dev --host 127.0.0.1 --port ${serverPort} --strictPort`,
    url: serverUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
})
