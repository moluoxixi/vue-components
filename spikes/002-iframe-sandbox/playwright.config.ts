import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: { baseURL: 'http://localhost:5200', headless: true },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5200',
    reuseExistingServer: false,
    timeout: 120000,
  },
})
