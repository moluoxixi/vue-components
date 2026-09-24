import { Buffer } from 'node:buffer'
import AxeBuilder from '@axe-core/playwright'
import { PROJECT_DOCUMENT_VERSION, SURFACE_GRAPH_VERSION } from '@moluoxixi/config-form-model'
import { expect, test } from '@playwright/test'
import { createProject, readDownloadText, setAppearance } from './helpers'

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void> {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))
  expect(width.scroll).toBe(width.client)
}

async function exportJson(
  page: import('@playwright/test').Page,
  scope: 'project' | 'surface',
): Promise<string> {
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', {
      name: scope === 'project' ? 'Export project JSON' : 'Export current Surface JSON',
      exact: true,
    }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(
    scope === 'project' ? /\.project\.json$/ : /\.surface\.json$/,
  )
  return readDownloadText(download)
}

async function openProjectCreation(page: import('@playwright/test').Page): Promise<void> {
  // Project creation is a project-management action: page management only creates pages.
  await page.getByRole('button', { name: 'Back to projects', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Projects', exact: true })).toBeVisible()
  // The command lives in the project-management topbar, not in the list region.
  await page.getByRole('main').getByRole('button', { name: 'New project', exact: true }).click()
  await expect(page.getByRole('main', { name: 'Create project' })).toBeVisible()
}

async function openSurfaceCreation(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('[data-create-trigger="topbar-new-surface"]').click()
  await expect(page.getByRole('main', { name: 'Create page' })).toBeVisible()
}

async function chooseJsonImport(workspace: import('@playwright/test').Locator): Promise<void> {
  await workspace.locator('.creation-mode-switch .el-segmented__item').filter({ hasText: 'JSON import' }).click()
  await expect(workspace.getByRole('navigation', { name: 'Import stages' })).toBeVisible()
}

async function switchTemplateLanguage(
  page: import('@playwright/test').Page,
  workspace: import('@playwright/test').Locator,
): Promise<void> {
  const direct = workspace.getByRole('button', { name: 'Switch language' })
  if (await direct.isVisible()) {
    await direct.click()
    return
  }
  await workspace.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Switch language' }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('round-trips an Element Plus Project JSON export through paste and isolated preview', async ({ page }) => {
  await createProject(page, 'element')
  await setAppearance(page, 'dark', 'ink')
  await expect(page.locator('.workbench-topbar .revision-state')).toContainText(/v0 · /)
  const source = await exportJson(page, 'project')
  const exportedProject = JSON.parse(source)
  expect(exportedProject).toMatchObject({
    kind: 'config-form-project',
    version: 1,
    document: {
      version: PROJECT_DOCUMENT_VERSION,
      registryLock: { adapter: 'element-plus' },
    },
  })
  expect(JSON.stringify(exportedProject)).not.toMatch(/"(?:appearance|paletteFamily|resolvedTheme|themePreference)"/)
  await openProjectCreation(page)
  const workspace = page.getByRole('main', { name: 'Create project' })
  await chooseJsonImport(workspace)
  await workspace.getByRole('textbox', { name: 'Config Model JSON' }).fill(source)
  await workspace.getByRole('button', { name: 'Analyze JSON' }).click()

  await expect(workspace.getByText('Ready', { exact: true })).toBeVisible()
  await expect(workspace.getByText('Project version', { exact: true })).toBeVisible()
  await expect(workspace.getByText(`v${PROJECT_DOCUMENT_VERSION}`, { exact: true })).toBeVisible()
  await expect(workspace.locator('iframe[data-design-runtime-host]')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  const axe = await new AxeBuilder({ page })
    .exclude('iframe[data-design-runtime-host]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(axe.violations).toEqual([])

  await workspace.getByRole('button', { name: 'Create imported project' }).click()
  await expect(page.getByRole('region', { name: 'Design editor' })).toBeVisible()
  await page.getByRole('tab', { name: 'Components', exact: true }).click()
  await expect(page.locator('[data-material-key="element.input"]')).toBeEnabled()
})

test('imports an Ant Design Vue Surface JSON file as one undoable command', async ({ page }) => {
  await createProject(page, 'antd')
  const runtime = page.frameLocator('iframe[data-design-runtime-variant="canvas"]')
  const originalNodeId = await runtime.locator('[data-config-node-id]').first().getAttribute('data-config-node-id')
  const source = await exportJson(page, 'surface')
  const exportedSurface = JSON.parse(source)
  expect(exportedSurface).toMatchObject({
    kind: 'config-form-surface',
    version: 1,
    rootSurfaceId: expect.any(String),
    surfaceOrder: [expect.any(String)],
  })
  expect(exportedSurface.surfacesById[exportedSurface.rootSurfaceId]).toMatchObject({
    graph: { version: SURFACE_GRAPH_VERSION },
  })
  exportedSurface.surfacesById[exportedSurface.rootSurfaceId].route = '/imported-profile'
  const importSource = JSON.stringify(exportedSurface)
  await openSurfaceCreation(page)
  const workspace = page.getByRole('main', { name: 'Create page' })
  await chooseJsonImport(workspace)
  await workspace.locator('.json-import-source .el-segmented__item').filter({ hasText: 'JSON file' }).click()
  await workspace.locator('input[type="file"]').setInputFiles({
    name: 'profile.surface.json',
    mimeType: 'application/json',
    buffer: Buffer.from(importSource),
  })
  await expect(workspace.getByText('profile.surface.json', { exact: true })).toBeVisible()
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
    await page.getByRole('button', { name: 'Import JSON', exact: true }).click()
    let workspace = page.getByRole('main', { name: 'Create project' })
    await expect(workspace).toBeVisible()
    await chooseJsonImport(workspace)
    await workspace.getByRole('textbox', { name: 'Config Model JSON' }).fill('{')
    await workspace.getByRole('button', { name: 'Analyze JSON' }).click()
    await expect(workspace.getByRole('alert')).toContainText('IMPORT_JSON_INVALID')
    await expect(workspace.getByRole('button', { name: 'Diagnostics' })).toHaveAttribute('aria-current', 'step')
    await expectNoHorizontalOverflow(page)

    await switchTemplateLanguage(page, workspace)
    workspace = page.getByRole('main', { name: '创建项目' })
    await expect(workspace.getByRole('navigation', { name: '导入步骤' })).toBeVisible()
    await expect(workspace.getByRole('button', { name: '来源' })).toBeVisible()
    await expect(workspace.getByRole('button', { name: '检查' })).toBeVisible()
    await expect(workspace.getByRole('button', { name: '预览' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
}
