import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export type WorkbenchAdapter = 'antd' | 'element'

const templateNames: Record<WorkbenchAdapter, RegExp> = {
  antd: /Ant Design Vue profile/,
  element: /Element Plus profile/,
}

export async function createProject(page: Page, adapter: WorkbenchAdapter): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'New page' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: templateNames[adapter] }).click()
  await expect(page.getByRole('region', { name: 'Design editor' })).toBeVisible()
}
