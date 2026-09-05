import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export type WorkbenchAdapter = 'antd' | 'element'
export type WorkbenchPalette = 'catppuccin' | 'gruvbox' | 'kanagawa' | 'rose-pine'
export type WorkbenchThemeMode = 'dark' | 'light' | 'system'

const templateNames: Record<WorkbenchAdapter, RegExp> = {
  antd: /Ant Design Vue profile/,
  element: /Element Plus profile/,
}

export async function createProject(page: Page, adapter: WorkbenchAdapter): Promise<void> {
  const workspace = page.getByRole('main', { name: 'Create project' })
  await expect(workspace).toBeVisible()
  const catalogOpener = workspace.locator('[data-template-catalog-open]')
  if (await catalogOpener.isVisible()) {
    await catalogOpener.click()
    const catalog = page.getByRole('dialog', { name: 'Catalog' })
    await expect(catalog).toBeVisible()
    await catalog.getByRole('option', { name: templateNames[adapter] }).click()
    await expect(catalog).not.toBeVisible()
  }
  else {
    await workspace.getByRole('option', { name: templateNames[adapter] }).click()
  }
  await expect(workspace.getByText('Registry requirements met', { exact: true })).toBeVisible()
  await workspace.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Design editor' })).toBeVisible()
  await expect(page.locator(`[data-material-key="${adapter}.input"]`)).toBeEnabled({ timeout: 15_000 })
  await expect(page
    .frameLocator('iframe[data-design-runtime-variant="canvas"]')
    .locator('[data-config-node-id^="profile-name-"]'))
    .toBeVisible({ timeout: 15_000 })
}

const appearanceLabels: Record<WorkbenchPalette | WorkbenchThemeMode, string> = {
  'catppuccin': 'Catppuccin',
  'dark': 'Dark',
  'gruvbox': 'Gruvbox',
  'kanagawa': 'Kanagawa',
  'light': 'Light',
  'rose-pine': 'Rosé Pine',
  'system': 'System',
}

export async function openAppearance(page: Page): Promise<void> {
  const direct = page.getByRole('button', { name: 'Open appearance settings' })
  const opensPopover = await direct.isVisible()
  if (opensPopover) {
    await direct.click()
  }
  else {
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Open appearance settings' }).click()
  }
  await expect(page.locator('.appearance-panel:visible')).toBeVisible()
  if (opensPopover)
    await expect(page.locator('.workbench-appearance-popover:visible')).toHaveCSS('opacity', '1')
}

export async function setAppearance(
  page: Page,
  themePreference: WorkbenchThemeMode,
  paletteFamily: WorkbenchPalette,
): Promise<void> {
  await openAppearance(page)
  const panel = page.locator('.appearance-panel:visible')
  await panel.locator('.appearance-mode-control .el-segmented__item', {
    hasText: appearanceLabels[themePreference],
  }).click()
  await panel.locator('.appearance-palette-option', {
    hasText: appearanceLabels[paletteFamily],
  }).click()
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(page.locator('.workbench-app, .template-creation-workspace')).toHaveAttribute('data-palette', paletteFamily)
  if (themePreference !== 'system')
    await expect(page.locator('.workbench-app, .template-creation-workspace')).toHaveAttribute('data-theme', themePreference)
}

export async function restoreAppearance(
  page: Page,
  themePreference: Exclude<WorkbenchThemeMode, 'system'>,
  paletteFamily: WorkbenchPalette,
): Promise<void> {
  await page.evaluate(({ paletteFamily, themePreference }) => {
    localStorage.setItem('moluoxixi.config-form.workbench.appearance', JSON.stringify({
      version: 1,
      themePreference,
      paletteFamily,
    }))
  }, { paletteFamily, themePreference })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', themePreference)
  await expect(page.locator('html')).toHaveAttribute('data-palette', paletteFamily)
}
