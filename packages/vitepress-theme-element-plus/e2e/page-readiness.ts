import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const coldStartTimeout = 30_000

export async function openBasicHome(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Basic documentation' }))
    .toBeVisible({ timeout: coldStartTimeout })
  await expect(page.locator('.logo-container'))
    .toContainText('Basic docs', { timeout: coldStartTimeout })
}
