import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  // Playwright 1.60 diff capture shallows full CI checkouts: microsoft/playwright#42203.
  // https://github.com/microsoft/playwright/issues/42203
  captureGitInfo: { diff: false },
  outputDir: './node_modules/.cache/playwright/test-results',
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        browserName: 'chromium',
        viewport: { height: 720, width: 1280 },
      },
    },
    {
      name: 'firefox-desktop',
      use: {
        browserName: 'firefox',
        viewport: { height: 720, width: 1280 },
      },
    },
    {
      name: 'webkit-desktop',
      use: {
        browserName: 'webkit',
        viewport: { height: 720, width: 1280 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
      },
    },
    {
      name: 'webkit-mobile',
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit',
      },
    },
  ],
  reporter: process.env.CI ? 'github' : 'list',
  testDir: './test/browser',
  timeout: 30000,
  use: {
    trace: 'retain-on-failure',
  },
  workers: 1,
})
