import { expect, test } from '@playwright/test'
import { collectBrowserProblems } from './browser-problems'

test('current docs expose localized mobile controls and valid relationships', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await page.goto('/guide/documentation-theme.html')
  const navigation = page.getByRole('button', { name: '切换导航' })
  await expect(navigation).toHaveAttribute('aria-controls', 'full-screen')
  await navigation.click()
  await expect(navigation).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#full-screen')).toHaveCount(1)

  const language = page.getByRole('button', { name: '语言' })
  await expect(language).toHaveAttribute('aria-controls', 'translation-items')
  await language.click()
  await expect(page.locator('#translation-items')).toHaveCount(1)
  await expect(language).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('button', { name: '菜单' })).toBeVisible()

  const widths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    root: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(widths.body).toBeLessThanOrEqual(widths.viewport)
  expect(widths.root).toBeLessThanOrEqual(widths.viewport)
  expect(browserProblems).toEqual([])
})

test('current component page remains usable in light and dark mobile layouts', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await page.goto('/components/copy-text.html')
  await expect(page.getByRole('heading', { level: 1, name: 'CopyText' })).toBeVisible()
  await expect(page.locator('.component-doc-meta')).toHaveCSS('border-bottom-style', 'solid')
  await expect(page).toHaveScreenshot('docs-component-mobile-light.png', { animations: 'disabled' })

  const navigation = page.getByRole('button', { name: '切换导航' })
  await navigation.click()
  await page.locator('#full-screen .el-switch__core').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.locator('#full-screen .full-screen-menu__item a').first().click()
  await page.goto('/components/copy-text.html')
  await expect(navigation).toHaveAttribute('aria-expanded', 'false')
  await expect(page).toHaveScreenshot('docs-component-mobile-dark.png', { animations: 'disabled' })

  const widths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    root: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(widths.body).toBeLessThanOrEqual(widths.viewport)
  expect(widths.root).toBeLessThanOrEqual(widths.viewport)
  expect(browserProblems).toEqual([])
})
