import { expect, test } from '@playwright/test'
import { collectBrowserProblems } from './browser-problems'

test('built theme renders and searches fixture content in light and dark modes', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Basic documentation' })).toBeVisible()
  await expect(page.getByText('The reusable Element Plus documentation theme is active.')).toBeVisible()
  await expect(page).toHaveScreenshot('basic-desktop-light.png', { animations: 'disabled', fullPage: true })

  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByRole('searchbox').fill('Navigation')
  const result = page.getByRole('option', { name: 'Basic documentation > Navigation' })
  await expect(result).toBeVisible()
  await result.click()
  await expect(page).toHaveURL(/#navigation$/)

  await page.locator('.theme-toggler-content .el-switch__core').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.goto('/')
  await expect(page).toHaveScreenshot('basic-desktop-dark.png', { animations: 'disabled', fullPage: true })
  expect(browserProblems).toEqual([])
})
