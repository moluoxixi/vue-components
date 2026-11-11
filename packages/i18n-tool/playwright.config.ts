import { defineConfig } from '@playwright/test'

export default defineConfig({
  // Playwright 1.60 diff capture shallows full CI checkouts: microsoft/playwright#42203.
  // https://github.com/microsoft/playwright/issues/42203
  captureGitInfo: { diff: false },
  testDir: './__e2e__',
  outputDir: './dist/test-results',
  reporter: [['list']],
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    browserName: 'chromium',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
