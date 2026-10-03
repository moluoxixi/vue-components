import type { Download, Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { expect } from '@playwright/test'

export type WorkbenchAdapter = 'antd' | 'element'
export type WorkbenchPalette = 'cyber' | 'glass' | 'ink' | 'morandi'
export type WorkbenchThemeMode = 'dark' | 'light' | 'system'

const templateNames: Record<WorkbenchAdapter, string> = {
  antd: 'Ant Design Vue profile form',
  element: 'Element Plus profile form',
}

export async function readDownloadText(download: Download): Promise<string> {
  const path = await download.path()
  if (!path)
    throw new Error('The browser download did not produce a local file.')
  return readFile(path, 'utf8')
}

export async function createProject(page: Page, adapter: WorkbenchAdapter): Promise<void> {
  const dialog = page.locator('.project-creation-dialog:visible')
  const newProject = page.locator('[data-project-create]').first()
  if (!await dialog.isVisible()) {
    await expect(newProject).toBeVisible({ timeout: 15_000 })
    await newProject.click()
  }
  await expect(dialog).toBeVisible({ timeout: 15_000 })

  await dialog.getByRole('textbox', { name: 'Project name', exact: true }).fill(templateNames[adapter])
  await dialog.locator('.project-creation-adapter').filter({ hasText: adapter === 'antd' ? 'Ant Design Vue' : 'Element Plus' }).click()
  const submit = dialog.locator('[data-project-create-submit]')
  await expect(submit).toBeEnabled({ timeout: 15_000 })
  await submit.click()
  await expect(page.locator('.page-manager')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.page-manager__row')).toHaveCount(0)

  // Create the profile page explicitly inside the empty project.
  await page.locator('.page-manager__create-actions').getByRole('button', { name: 'New page', exact: true }).click()
  const pageCreation = page.locator('.page-creation-dialog .template-creation-workspace')
  await pageCreation.locator('.template-workspace-layout').waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const root = document.querySelector('.template-creation-workspace')
    if (!root)
      return false
    return [root.querySelector('[data-template-catalog-open]'), root.querySelector('.template-catalog-pane')]
      .some(element => element instanceof HTMLElement && element.offsetParent !== null)
  })
  const templateName = adapter === 'antd' ? /Ant Design Vue profile/ : /Element Plus profile/
  const catalogOpener = pageCreation.locator('[data-template-catalog-open]')
  if (await catalogOpener.isVisible()) {
    await expect(catalogOpener).toBeVisible()
    await catalogOpener.click()
    const catalog = page.getByRole('dialog', { name: 'Catalog', exact: true })
    await expect(catalog).toBeVisible()
    await catalog.getByRole('option', { name: templateName }).click()
    await expect(catalog).not.toBeVisible()
  }
  else {
    await pageCreation.getByRole('option', { name: templateName }).click()
    const mobileDetails = pageCreation.locator('.template-mobile-panes .el-segmented__item').filter({ hasText: 'Details' })
    if (await mobileDetails.isVisible())
      await mobileDetails.click()
  }
  await expect(pageCreation.getByText('Registry requirements met', { exact: true })).toBeVisible({ timeout: 15_000 })
  await pageCreation.getByRole('button', { name: 'Create form page', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Design editor' })).toBeVisible()

  await expect(page.locator('.revision-state')).toContainText(/Saved|Autosaved/, { timeout: 15_000 })

  // Reopen the persisted project so setup operations do not become part of the
  // local designer history observed by the interaction scenarios.
  await page.reload()
  await expect(page.getByRole('region', { name: 'Design editor' })).toBeVisible()
  await expect(page.locator(`[data-material-key="${adapter}.input"]`)).toBeEnabled({ timeout: 15_000 })
  await expect(page
    .frameLocator('iframe[data-design-runtime-variant="canvas"]')
    .locator('[data-config-node-id^="profile-name-"]'))
    .toBeVisible({ timeout: 15_000 })
}

/** Open the page-management console from the designer at any supported width. */
export async function openPageManagement(page: Page): Promise<void> {
  const sourcePane = page.locator('.source-pane')
  if (await sourcePane.isVisible())
    await page.getByRole('button', { name: 'Design', exact: true }).click()
  const direct = page.getByRole('button', { name: 'Manage pages', exact: true })
  if (await direct.isVisible()) {
    await direct.click()
  }
  else {
    await page.getByRole('tab', { name: 'Pages', exact: true }).click()
    await page.getByRole('button', { name: 'Manage pages', exact: true }).click()
  }
  await expect(page.locator('.page-manager')).toBeVisible()
}

/** Open the page creation dialog and optionally choose its surface kind. */
export async function openPageCreation(
  page: Page,
  kind: 'form' | 'dialog' | 'drawer' = 'form',
): Promise<import('@playwright/test').Locator> {
  await openPageManagement(page)
  const manager = page.locator('.page-manager')
  await manager.getByRole('button', { name: 'New page', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create page', exact: true })
  await expect(dialog).toBeVisible()
  if (kind !== 'form') {
    const label = kind === 'dialog' ? 'Dialog' : 'Drawer'
    await dialog.locator('.page-creation-dialog__toolbar .el-segmented__item').filter({ hasText: label }).click()
  }
  const workspace = dialog.locator('.template-creation-workspace')
  await expect(workspace).toBeVisible()
  return workspace
}

/** Open the JSON page-import workspace from page management. */
export async function openPageImport(page: Page): Promise<import('@playwright/test').Locator> {
  await openPageManagement(page)
  const manager = page.locator('.page-manager')
  await manager.getByRole('button', { name: 'Import page', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Import page', exact: true })
  await expect(dialog).toBeVisible()
  const workspace = dialog.locator('.template-creation-workspace')
  await expect(workspace).toBeVisible()
  return workspace
}

const appearanceLabels: Record<WorkbenchPalette | WorkbenchThemeMode, string> = {
  cyber: 'Cyber Tech',
  dark: 'Dark',
  glass: 'Glassmorphism',
  ink: 'Ink Wash',
  light: 'Light',
  morandi: 'Morandi Cream',
  system: 'System',
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
    await expect(page.locator('.workbench-appearance-popover:visible')).toHaveCSS('opacity', '1', { timeout: 15_000 })
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
