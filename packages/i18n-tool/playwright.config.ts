import { defineConfig } from '@playwright/test'

export default defineConfig({
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
