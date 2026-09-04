import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createProject, restoreAppearance, setAppearance } from './helpers'

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
  const search = workspace.getByRole('searchbox', { name: 'Search templates' })
  await expect(workspace.getByRole('option')).toHaveCount(4)
  await search.fill('no-such-template')
  await expect(workspace.getByText('No templates match these filters', { exact: true })).toBeVisible()
  await expect(workspace.getByText('No template selected', { exact: true })).toBeVisible()
  await workspace.getByRole('button', { name: 'Browse templates', exact: true }).click()
  await expect(search).toBeFocused()
  await search.fill('Ant Design Vue')
  await expect(workspace.getByRole('option')).toHaveCount(2)
  const first = workspace.getByRole('option').first()
  await first.focus()
  await first.press('End')
  await expect(workspace.getByRole('option', { name: /Ant Design Vue profile/ })).toHaveAttribute('aria-selected', 'true')
  await expect(workspace.locator('iframe[data-preview-runtime-host]')).toBeVisible()
  await expect(workspace.locator('iframe[data-preview-runtime-host]')).toHaveAttribute('title', /Runtime preview/)
  await expect(workspace.getByText('Registry requirements met', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  const results = await new AxeBuilder({ page })
    .exclude('iframe[data-preview-runtime-host]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(results.violations).toEqual([])

  await setAppearance(page, 'dark', 'kanagawa')
  await expect(workspace).toHaveAttribute('data-theme', 'dark')
  await expect(workspace).toHaveAttribute('data-palette', 'kanagawa')
  await expect(workspace.locator('.template-catalog-filters .el-select__wrapper').first())
    .toHaveCSS('background-color', 'rgb(42, 42, 55)')
  const lightResults = await new AxeBuilder({ page })
    .exclude('iframe[data-preview-runtime-host]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(lightResults.violations).toEqual([])

  await page.getByRole('button', { name: 'Switch language' }).click()
  const localizedWorkspace = page.getByRole('main', { name: '创建项目' })
  await expect(localizedWorkspace.getByRole('option', { name: /Ant Design Vue 资料表单/ })).toBeVisible()
  await expect(localizedWorkspace.getByText('Registry 要求已满足', { exact: true })).toBeVisible()
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
  await expect(workspace.getByText('Registry requirements met', { exact: true })).toBeVisible()
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
  await expect(workspace.getByText('Registry requirements met', { exact: true })).toBeVisible()
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
  await expect(workspace.getByText('Registry requirements met', { exact: true })).toBeVisible()
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
  await workspace.locator('.template-mobile-panes .el-segmented__item').filter({ hasText: 'Details' }).click()
  const blocked = workspace.getByText('Cannot create with this Registry', { exact: true })
  await expect(blocked).toBeVisible()
  await expect(workspace.locator('.template-eligibility li')).toHaveCount(5)

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

test('keeps the Runtime preview dominant and restores focus after the 900px catalog Drawer closes', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 })
  const workspace = page.getByRole('main', { name: 'Create project' })
  const rail = workspace.locator('.template-category-rail')
  const detail = workspace.locator('.template-detail-pane')
  const opener = workspace.locator('[data-template-catalog-open]')

  await expect(rail).toBeVisible()
  await expect(workspace.locator('.template-catalog-pane')).not.toBeVisible()
  const geometry = await workspace.locator('.template-workspace-layout').evaluate((layout) => {
    const rail = layout.querySelector<HTMLElement>('.template-category-rail')
    const detail = layout.querySelector<HTMLElement>('.template-detail-pane')
    if (!rail || !detail)
      throw new Error('Template medium layout is incomplete.')
    return {
      detailWidth: detail.getBoundingClientRect().width,
      railWidth: rail.getBoundingClientRect().width,
    }
  })
  expect(geometry.railWidth).toBeGreaterThanOrEqual(52)
  expect(geometry.railWidth).toBeLessThanOrEqual(56)
  expect(geometry.detailWidth).toBeGreaterThan(800)
  await expect(detail.locator('iframe[data-preview-runtime-host]')).toBeVisible()

  await workspace.getByRole('button', { name: 'Open appearance settings', exact: true }).click()
  await expect(page.locator('.appearance-panel:visible')).toBeVisible()
  await opener.click()
  const drawer = page.getByRole('dialog', { name: 'Catalog' })
  await expect(page.locator('.appearance-panel:visible')).toHaveCount(0)
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('searchbox', { name: 'Search templates' })).toBeFocused()
  await expect(page.locator('#workbench-overlays').getByRole('dialog', { name: 'Catalog' })).toBeVisible()

  await drawer.locator('.template-catalog-filters .el-select__wrapper').first().click()
  const categoryPopup = page.locator('.el-select__popper:visible')
  await expect(categoryPopup).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(categoryPopup).not.toBeVisible()
  await expect(drawer).toBeVisible()
  for (let index = 0; index < 6; index += 1)
    await page.keyboard.press('Tab')
  expect(await drawer.evaluate(element => element.contains(document.activeElement))).toBe(true)

  await page.keyboard.press('Escape')
  await expect(drawer).not.toBeVisible()
  await expect(opener).toBeFocused()

  await opener.click()
  await expect(drawer).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(drawer).not.toBeVisible()
  await expect(workspace.locator('.template-mobile-panes')).toBeVisible()

  await page.setViewportSize({ width: 900, height: 900 })
  await expect(opener).toBeVisible()
  await opener.click()
  await expect(drawer).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(drawer).not.toBeVisible()
  await expect(workspace.locator('.template-catalog-pane')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('uses one Element Plus segmented window at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const workspace = page.getByRole('main', { name: 'Create project' })
  const segmented = workspace.locator('.template-mobile-panes')
  const details = segmented.locator('.el-segmented__item').filter({ hasText: 'Details' })

  await expect(segmented).toBeVisible()
  await expect(workspace.locator('.template-catalog-pane')).toBeVisible()
  await expect(workspace.locator('.template-detail-pane')).not.toBeVisible()
  await details.click()
  await expect(workspace.locator('.template-detail-pane')).toBeVisible()
  await expect(workspace.locator('.template-catalog-pane')).not.toBeVisible()
  await workspace.locator('.template-mobile-back').click()
  await expect(workspace.getByRole('radiogroup', { name: 'Template workspace view' })
    .getByRole('radio', { name: 'Catalog', exact: true })).toBeChecked()
  await expect(workspace.locator('.template-catalog-pane')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

const templateVisualCases = [
  { height: 900, locale: 'zh', overlay: true, palette: 'catppuccin', theme: 'light', width: 900 },
  { height: 900, locale: 'en', overlay: false, palette: 'kanagawa', theme: 'dark', width: 900 },
  { height: 844, locale: 'en', overlay: false, palette: 'gruvbox', theme: 'light', width: 390 },
  { height: 844, locale: 'zh', overlay: false, palette: 'rose-pine', theme: 'dark', width: 390 },
] as const

for (const visualCase of templateVisualCases) {
  const { height, locale, overlay, palette, theme, width } = visualCase
  test(`matches the ${width}px ${palette} ${theme} ${locale} template visual contract @visual`, async ({ page }) => {
    await page.setViewportSize({ height, width })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await restoreAppearance(page, theme, palette)
    let workspace = page.getByRole('main', { name: 'Create project' })

    if (locale === 'zh') {
      if (width > 640) {
        await workspace.getByRole('button', { name: 'Switch language', exact: true }).click()
      }
      else {
        await workspace.getByRole('button', { name: 'More actions', exact: true }).click()
        await page.getByRole('menuitem', { name: 'Switch language', exact: true }).click()
      }
      workspace = page.getByRole('main', { name: '创建项目' })
    }

    if (overlay) {
      await workspace.locator('[data-template-catalog-open]').click()
      await expect(page.locator('.template-catalog-drawer')).toBeVisible()
    }
    else if (width === 390 && locale === 'zh') {
      await workspace.locator('.template-mobile-panes .el-segmented__item').last().click()
      await expect(workspace.locator('.template-detail-pane')).toBeVisible()
    }

    await expectNoHorizontalOverflow(page)
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await expect(page).toHaveScreenshot(
      `template-${width}-${palette}-${theme}-${locale}${overlay ? '-drawer' : ''}.png`,
      { animations: 'disabled' },
    )
  })
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 900, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`keeps the creation workspace usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const workspace = page.getByRole('main', { name: 'Create project' })
    await expect(workspace).toBeVisible()
    if (viewport.width === 390) {
      await workspace.locator('.template-mobile-panes .el-segmented__item').filter({ hasText: 'Details' }).click()
      await expect(workspace.getByRole('button', { name: 'Catalog', exact: true })).toBeVisible()
      await expect(workspace.getByRole('button', { name: 'Create project', exact: true })).toBeVisible()
    }
    else if (viewport.width === 900) {
      await expect(workspace.locator('.template-category-rail')).toBeVisible()
      await expect(workspace.locator('iframe[data-preview-runtime-host]')).toBeVisible()
    }
    else {
      await expect(workspace.getByRole('option')).toHaveCount(4)
      await expect(workspace.locator('iframe[data-preview-runtime-host]')).toBeVisible()
      const catalogWidth = await workspace.locator('.template-catalog-pane').evaluate(element => element.getBoundingClientRect().width)
      expect(catalogWidth).toBeGreaterThanOrEqual(280)
      expect(catalogWidth).toBeLessThanOrEqual(340)
    }
    await expectNoHorizontalOverflow(page)
  })
}
