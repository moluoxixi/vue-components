import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export type WorkbenchAdapter = 'antd' | 'element'

const templateNames: Record<WorkbenchAdapter, RegExp> = {
  antd: /Ant Design Vue profile/,
  element: /Element Plus profile/,
}

export async function createProject(page: Page, adapter: WorkbenchAdapter): Promise<void> {
  const workspace = page.getByRole('main', { name: 'Create project' })
  await expect(workspace).toBeVisible()
  await workspace.getByRole('option', { name: templateNames[adapter] }).click()
  const detailsTab = workspace.getByRole('tab', { name: 'Details' })
  if (await detailsTab.isVisible())
    await detailsTab.click()
  await expect(workspace.getByText('Registry compatible', { exact: true })).toBeVisible()
  await workspace.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Design editor' })).toBeVisible()
  await expect(page.locator(`[data-material-key="${adapter}.input"]`)).toBeEnabled()
  await expect(page
    .frameLocator('iframe[data-design-runtime-variant="canvas"]')
    .locator('[data-config-node-id^="profile-name-"]'))
    .toBeVisible()
}
