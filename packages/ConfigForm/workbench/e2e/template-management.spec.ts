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

async function openPageCreation(page: import('@playwright/test').Page): Promise<void> {
  const direct = page.locator('[data-create-trigger="topbar-new-page"]')
  if (await direct.isVisible()) {
    await direct.click()
  }
  else {
    await page.locator('[data-create-trigger="topbar-mobile-menu"]').click()
    await page.getByRole('menuitem', { name: 'New page' }).click()
  }
  await expect(page.getByRole('main', { name: 'Create page' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('browses, filters, keyboard-selects, and previews the built-in catalog', async ({ page }) => {
  const workspace = page.getByRole('main', { name: 'Create project' })
  await expect(workspace.getByRole('option')).toHaveCount(4)
  await workspace.getByRole('searchbox', { name: 'Search templates' }).fill('Ant Design Vue')
  await expect(workspace.getByRole('option')).toHaveCount(2)
  const first = workspace.getByRole('option').first()
  await first.focus()
  await first.press('End')
  await expect(workspace.getByRole('option', { name: /Ant Design Vue profile/ })).toHaveAttribute('aria-selected', 'true')
  await expect(workspace.locator('iframe[data-preview-runtime-host]')).toBeVisible()
  await expect(workspace.locator('iframe[data-preview-runtime-host]')).toHaveAttribute('title', /Runtime preview/)
  await expect(workspace.getByText('Registry compatible', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  const results = await new AxeBuilder({ page })
    .exclude('iframe[data-preview-runtime-host]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(results.violations).toEqual([])

  await workspace.getByRole('button', { name: 'Use light theme' }).click()
  await expect(workspace).toHaveAttribute('data-theme', 'light')
  await expect(workspace.locator('.template-catalog-filters .el-select__wrapper').first())
    .toHaveCSS('background-color', 'rgb(255, 255, 255)')
  const lightResults = await new AxeBuilder({ page })
    .exclude('iframe[data-preview-runtime-host]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(lightResults.violations).toEqual([])

  await page.getByRole('button', { name: 'Switch language' }).click()
  const localizedWorkspace = page.getByRole('main', { name: '创建项目' })
  await expect(localizedWorkspace.getByRole('option', { name: /Ant Design Vue 资料表单/ })).toBeVisible()
  await expect(localizedWorkspace.getByText('Registry 兼容', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  const localizedResults = await new AxeBuilder({ page })
    .exclude('iframe[data-preview-runtime-host]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(localizedResults.violations).toEqual([])
})

test('creates unique pages through one explicit page workspace and blocks cross-adapter templates', async ({ page }) => {
  await createProject(page, 'element')
  const firstPageId = await page.frameLocator('iframe[data-design-runtime-variant="canvas"]')
    .locator('[data-config-node-id]')
    .first()
    .getAttribute('data-config-node-id')

  await openPageCreation(page)
  const workspace = page.getByRole('main', { name: 'Create page' })
  await workspace.getByRole('option', { name: /Ant Design Vue profile/ }).click()
  await expect(workspace.getByText('Cannot create with this Registry', { exact: true })).toBeVisible()
  await expect(workspace.getByRole('button', { name: 'Create page', exact: true })).toBeDisabled()

  await workspace.getByRole('option', { name: /Element Plus profile/ }).click()
  await expect(workspace.getByText('Registry compatible', { exact: true })).toBeVisible()
  await workspace.getByRole('button', { name: 'Create page', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Design editor' })).toBeVisible()
  const secondPageId = await page.frameLocator('iframe[data-design-runtime-variant="canvas"]')
    .locator('[data-config-node-id]')
    .first()
    .getAttribute('data-config-node-id')
  expect(secondPageId).not.toBe(firstPageId)
})

test('creates an Ant Design Vue page as one undoable Project Command', async ({ page }) => {
  await createProject(page, 'antd')
  const runtime = page.frameLocator('iframe[data-design-runtime-variant="canvas"]')
  const firstPageNodeId = await runtime.locator('[data-config-node-id]').first().getAttribute('data-config-node-id')

  await openPageCreation(page)
  const workspace = page.getByRole('main', { name: 'Create page' })
  await workspace.getByRole('option', { name: /Ant Design Vue profile/ }).click()
  await expect(workspace.getByText('Registry compatible', { exact: true })).toBeVisible()
  await workspace.getByRole('button', { name: 'Create page', exact: true }).click()
  const createdPageNodeId = await runtime.locator('[data-config-node-id]').first().getAttribute('data-config-node-id')
  expect(createdPageNodeId).not.toBe(firstPageNodeId)

  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(runtime.locator(`[data-config-node-id="${createdPageNodeId}"]`)).toHaveCount(0)
  await expect(runtime.locator('[data-config-node-id]').first()).toHaveAttribute('data-config-node-id', firstPageNodeId!)

  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await page.getByRole('tab', { name: 'Pages', exact: true }).click()
  await page.getByRole('button', { name: 'Manage pages', exact: true }).click()
  const pages = page.getByRole('dialog', { name: 'Pages' })
  await expect(pages.locator('.page-manager__row')).toHaveCount(2)
})

test('restores Topbar and Pages triggers on cancel and closes Pages after success', async ({ page }) => {
  await createProject(page, 'element')
  const topbarNewPage = page.locator('[data-create-trigger="topbar-new-page"]')
  await topbarNewPage.click()
  let workspace = page.getByRole('main', { name: 'Create page' })
  await workspace.getByRole('button', { name: 'Back to Designer' }).click()
  await expect(topbarNewPage).toBeFocused()

  await page.getByRole('tab', { name: 'Pages' }).click()
  await page.getByRole('button', { name: 'Manage pages' }).click()
  const pages = page.getByRole('dialog', { name: 'Pages' })
  const newPage = pages.getByRole('button', { name: 'New page', exact: true })
  await newPage.click()

  workspace = page.getByRole('main', { name: 'Create page' })
  await expect(workspace).toBeVisible()
  await workspace.getByRole('button', { name: 'Back to Designer' }).click()
  await expect(pages).toBeVisible()
  await expect(newPage).toBeFocused()

  await newPage.click()
  await expect(workspace.getByText('Registry compatible', { exact: true })).toBeVisible()
  await workspace.getByRole('button', { name: 'Create page', exact: true }).click()
  await expect(pages).not.toBeVisible()
  await expect(page.locator('[data-designer-entry]')).toBeFocused()
})

test('keeps long Registry diagnostics and the create action visible at 390px', async ({ page }) => {
  await createProject(page, 'element')
  await page.setViewportSize({ width: 390, height: 844 })
  await openPageCreation(page)

  const workspace = page.getByRole('main', { name: 'Create page' })
  await workspace.getByRole('option', { name: /Ant Design Vue profile/ }).click()
  await workspace.getByRole('tab', { name: 'Details' }).click()
  const blocked = workspace.getByText('Cannot create with this Registry', { exact: true })
  await expect(blocked).toBeVisible()
  await expect(workspace.locator('.template-compatibility li')).toHaveCount(5)

  const geometry = await workspace.locator('.template-detail-pane').evaluate((pane) => {
    const footer = pane.querySelector<HTMLElement>('.template-create-footer')
    const preview = pane.querySelector<HTMLElement>('.template-runtime-preview')
    const button = footer?.querySelector<HTMLElement>('button')
    if (!footer || !preview || !button)
      throw new Error('Template detail action geometry is incomplete.')
    const footerRect = footer.getBoundingClientRect()
    const previewRect = preview.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    return {
      buttonBottom: buttonRect.bottom,
      footerBottom: footerRect.bottom,
      footerTop: footerRect.top,
      previewHeight: previewRect.height,
      viewportHeight: window.innerHeight,
    }
  })
  expect(geometry.previewHeight).toBeGreaterThan(0)
  expect(geometry.footerTop).toBeLessThan(geometry.viewportHeight)
  expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.viewportHeight)
  expect(geometry.buttonBottom).toBeLessThanOrEqual(geometry.viewportHeight)
  await expectNoHorizontalOverflow(page)
})

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 900, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`keeps the creation workspace usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const workspace = page.getByRole('main', { name: 'Create project' })
    await expect(workspace).toBeVisible()
    if (viewport.width === 390) {
      await workspace.getByRole('tab', { name: 'Details' }).click()
      await expect(workspace.getByRole('button', { name: 'Catalog', exact: true })).toBeVisible()
      await expect(workspace.getByRole('button', { name: 'Create project', exact: true })).toBeVisible()
    }
    else {
      await expect(workspace.getByRole('option')).toHaveCount(4)
      await expect(workspace.locator('iframe[data-preview-runtime-host]')).toBeVisible()
    }
    await expectNoHorizontalOverflow(page)
  })
}
