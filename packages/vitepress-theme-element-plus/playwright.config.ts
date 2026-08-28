import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const fixtureURL = 'http://127.0.0.1:4314'
const docsURL = 'http://127.0.0.1:4315'

export default defineConfig({
  testDir: './e2e',
  outputDir: '.playwright/test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: '.playwright/report' }],
  ],
  use: {
    actionTimeout: 10_000,
    colorScheme: 'light',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node dist/element-plus-docs.js dev --config fixtures/basic/element-plus-docs.config.ts --host 127.0.0.1 --port 4314 --strictPort',
      url: fixtureURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @moluoxixi/docs dev --host 127.0.0.1 --port 4315 --strictPort',
      env: { VITE_DOCS_REPOSITORY_METADATA_PROVIDER: 'local' },
      url: docsURL,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
  ],
  projects: [
    {
      name: 'basic-desktop',
      testMatch: /basic-desktop\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: fixtureURL,
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'basic-mobile',
      testMatch: /basic-mobile\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        baseURL: fixtureURL,
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'docs-desktop',
      testMatch: /docs-runtime\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: docsURL,
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'docs-mobile',
      testMatch: /docs-mobile\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        baseURL: docsURL,
        viewport: { width: 390, height: 844 },
      },
    },
  ],
})
