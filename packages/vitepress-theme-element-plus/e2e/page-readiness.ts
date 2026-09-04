import type { Locator, Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'

export const coldStartTimeout = 30_000
export const docsVisualStylePath = fileURLToPath(new URL('./docs-visual-snapshot.css', import.meta.url))

export async function openBasicHome(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Basic documentation' }))
    .toBeVisible({ timeout: coldStartTimeout })
  await expect(page.locator('.logo-container'))
    .toContainText('Basic docs', { timeout: coldStartTimeout })
}

export async function waitForCompiledDemos(
  page: Page,
  expectedFirstDemoText = 'Hello, World!',
): Promise<Locator> {
  const firstDemo = page.locator('.demo-block').first()
  await expect(firstDemo).toBeVisible({ timeout: coldStartTimeout })
  await expect(page.locator('.demo-loading')).toHaveCount(0, { timeout: coldStartTimeout })
  await expect(firstDemo.locator('.demo-error')).toHaveCount(0)
  await expect(firstDemo.getByText(expectedFirstDemoText, { exact: true }))
    .toBeVisible({ timeout: coldStartTimeout })
  return firstDemo
}
