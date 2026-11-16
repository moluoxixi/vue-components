import { defineConfig } from '@playwright/test'

/**
 * Playwright 真实浏览器 E2E 配置。
 * 仅匹配 __e2e__ 下的 *.e2e.test.ts；server 由 spec 内自起（含 stub 上游），故无 webServer。
 */
export default defineConfig({
  testDir: './__e2e__',
  testMatch: '**/*.e2e.test.ts',
  fullyParallel: false,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})
