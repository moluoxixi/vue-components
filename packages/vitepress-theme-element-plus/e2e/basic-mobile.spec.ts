import { expect, test } from '@playwright/test'
import { collectBrowserProblems } from './browser-problems'

test('mobile navigation stays accessible without horizontal overflow', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await page.goto('/')
  const tocTrigger = page.getByRole('button', { name: 'On this page', exact: true })
  await expect(tocTrigger).toBeVisible()
  await expect(tocTrigger).toHaveAttribute('aria-expanded', 'false')
  await expect(tocTrigger).toHaveAttribute('aria-haspopup', 'dialog')
  await expect(tocTrigger).not.toHaveAttribute('aria-controls', /.+/)
  const tocPanel = page.locator('#toc-compact-panel')
  await expect(tocPanel).toHaveCount(0)
  await tocTrigger.click()
  await expect(tocTrigger).toHaveAttribute('aria-expanded', 'true')
  await expect(tocTrigger).toHaveAttribute('aria-controls', 'toc-compact-panel')
  await expect(tocPanel).toBeVisible()
  await expect(tocPanel).toHaveAttribute('aria-label', 'On this page')
  await expect(tocPanel.locator('a[href^="#"]')).toHaveText([
    'Navigation',
  ])
  await tocPanel.getByRole('link', { name: 'Navigation', exact: true }).click()
  await expect(tocTrigger).toHaveAttribute('aria-expanded', 'false')
  await expect(tocTrigger).not.toHaveAttribute('aria-controls', /.+/)
  await expect(tocPanel).toHaveCount(0)
  await tocTrigger.focus()
  await tocTrigger.press('Enter')
  await expect(tocPanel).toBeVisible()
  await tocPanel.press('Escape')
  await expect(tocPanel).toHaveCount(0)
  await expect(tocTrigger).toBeFocused()
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
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
