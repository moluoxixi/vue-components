import { expect, test } from '@playwright/test'
import { collectBrowserProblems } from './browser-problems'

test('mobile navigation stays accessible without horizontal overflow', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await page.goto('/')
  await expect(page).toHaveScreenshot('basic-mobile-light.png', { animations: 'disabled', fullPage: true })

  const toggle = page.getByRole('button', { name: 'Toggle navigation' })
  const controls = await toggle.getAttribute('aria-controls')
  expect(controls).toBe('full-screen')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator(`#${controls}`)).toHaveCount(1)
  await page.locator('#full-screen .el-switch__core').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page).toHaveScreenshot('basic-mobile-dark.png', { animations: 'disabled', fullPage: true })

  const widths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    root: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(widths.body).toBeLessThanOrEqual(widths.viewport)
  expect(widths.root).toBeLessThanOrEqual(widths.viewport)
  expect(browserProblems).toEqual([])
})
