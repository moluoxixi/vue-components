import { Buffer } from 'node:buffer'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createProject } from './helpers'

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void> {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))
  expect(width.scroll).toBe(width.client)
}

async function exportJson(
  page: import('@playwright/test').Page,
  scope: 'page' | 'project',
): Promise<string> {
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Export config' }).click()
  const dialog = page.getByRole('dialog', { name: 'Config model' })
  await dialog.getByRole('tab', { name: 'JSON' }).click()
  if (scope === 'page')
    await dialog.locator('.config-json-scope .el-segmented__item').filter({ hasText: 'Current page' }).click()
  const source = await dialog.locator('.config-json-view').textContent()
  await dialog.getByRole('button', { name: 'Close export' }).click()
  return source ?? ''
}

async function openProjectCreation(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('tab', { name: 'Pages', exact: true }).click()
  await page.getByRole('button', { name: 'Manage pages', exact: true }).click()
  await page.getByRole('dialog', { name: 'Pages' }).getByRole('button', { name: 'New project' }).click()
  await expect(page.getByRole('main', { name: 'Create project' })).toBeVisible()
}

async function openPageCreation(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('[data-create-trigger="topbar-new-page"]').click()
  await expect(page.getByRole('main', { name: 'Create page' })).toBeVisible()
}

async function chooseJsonImport(workspace: import('@playwright/test').Locator): Promise<void> {
  await workspace.locator('.creation-mode-switch .el-segmented__item').filter({ hasText: 'JSON import' }).click()
  await expect(workspace.getByRole('navigation', { name: 'Import stages' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('round-trips an Element Plus Project JSON export through paste and isolated preview', async ({ page }) => {
  await createProject(page, 'element')
  const source = await exportJson(page, 'project')
  expect(JSON.parse(source)).toMatchObject({ schemaVersion: 4, registryLock: { adapter: 'element-plus' } })
  await openProjectCreation(page)
  const workspace = page.getByRole('main', { name: 'Create project' })
  await chooseJsonImport(workspace)
  await workspace.getByRole('textbox', { name: 'Config Model JSON' }).fill(source)
  await workspace.getByRole('button', { name: 'Analyze JSON' }).click()

  await expect(workspace.getByText('Ready', { exact: true })).toBeVisible()
  await expect(workspace.getByText('Project schema', { exact: true })).toBeVisible()
  await expect(workspace.getByText('No migration required', { exact: true })).toBeVisible()
  await expect(workspace.locator('iframe[data-preview-runtime-host]')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  const axe = await new AxeBuilder({ page })
    .exclude('iframe[data-preview-runtime-host]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(axe.violations).toEqual([])

  await workspace.getByRole('button', { name: 'Create imported project' }).click()
  await expect(page.getByRole('region', { name: 'Design editor' })).toBeVisible()
  await page.getByRole('tab', { name: 'Components', exact: true }).click()
  await expect(page.locator('[data-material-key="element.input"]')).toBeEnabled()
})

test('imports an Ant Design Vue Page JSON file as one undoable command', async ({ page }) => {
  await createProject(page, 'antd')
  const runtime = page.frameLocator('iframe[data-design-runtime-variant="canvas"]')
  const originalNodeId = await runtime.locator('[data-config-node-id]').first().getAttribute('data-config-node-id')
  const source = await exportJson(page, 'page')
  expect(JSON.parse(source)).toMatchObject({ graph: { version: 2 } })
  await openPageCreation(page)
  const workspace = page.getByRole('main', { name: 'Create page' })
  await chooseJsonImport(workspace)
  await workspace.locator('.json-import-source .el-segmented__item').filter({ hasText: 'JSON file' }).click()
  await workspace.locator('input[type="file"]').setInputFiles({
    name: 'profile.page.json',
    mimeType: 'application/json',
    buffer: Buffer.from(source),
  })
  await expect(workspace.getByText('profile.page.json', { exact: true })).toBeVisible()
  await workspace.getByRole('button', { name: 'Analyze JSON' }).click()
  await expect(workspace.getByText('Ready', { exact: true })).toBeVisible()
  await workspace.getByRole('button', { name: 'Create imported page' }).click()

  const importedNodeId = await runtime.locator('[data-config-node-id]').first().getAttribute('data-config-node-id')
  expect(importedNodeId).not.toBe(originalNodeId)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(runtime.locator('[data-config-node-id]').first()).toHaveAttribute('data-config-node-id', originalNodeId!)
})

for (const viewport of [
  { width: 900, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`keeps invalid diagnostics localized and usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    let workspace = page.getByRole('main', { name: 'Create project' })
    await chooseJsonImport(workspace)
    await workspace.getByRole('textbox', { name: 'Config Model JSON' }).fill('{')
    await workspace.getByRole('button', { name: 'Analyze JSON' }).click()
    await expect(workspace.getByRole('alert')).toContainText('IMPORT_JSON_INVALID')
    await expect(workspace.getByRole('button', { name: 'Diagnostics' })).toHaveAttribute('aria-current', 'step')
    await expectNoHorizontalOverflow(page)

    await workspace.getByRole('button', { name: 'Switch language' }).click()
    workspace = page.getByRole('main', { name: '创建项目' })
    await expect(workspace.getByRole('navigation', { name: '导入步骤' })).toBeVisible()
    await expect(workspace.getByRole('button', { name: '来源' })).toBeVisible()
    await expect(workspace.getByRole('button', { name: '检查' })).toBeVisible()
    await expect(workspace.getByRole('button', { name: '预览' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
}
