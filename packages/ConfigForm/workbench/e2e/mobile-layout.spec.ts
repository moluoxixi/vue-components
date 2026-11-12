import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { createProject, openPageManagement, selectDatasetView } from './helpers'

const phones = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 430, height: 932 },
  { width: 678, height: 827 },
  { width: 844, height: 390 },
]

async function fits(locator: Locator): Promise<void> {
  await expect(locator).toBeInViewport({ ratio: 1 })
  const box = await locator.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight }
  })
  expect(box.left).toBeGreaterThanOrEqual(0)
  expect(box.right).toBeLessThanOrEqual(box.width + 1)
  expect(box.top).toBeGreaterThanOrEqual(0)
  expect(box.bottom).toBeLessThanOrEqual(box.height + 1)
}

async function noOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    uncompiled: [...document.querySelectorAll('style')].some(style => /@(?:apply|reference)\b/.test(style.textContent ?? '')),
  }))
  expect(overflow).toEqual({ x: 0, y: 0, uncompiled: false })
}

test('phone layouts retain readable controls, rem spacing and reachable data actions across rotation', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await createProject(page, 'element')
  await openPageManagement(page)
  const header = page.locator('.project-workspace-header')
  await header.getByRole('link', { name: 'Manage data', exact: true }).click()
  await page.getByRole('button', { name: 'Create dataset', exact: true }).click()
  await selectDatasetView(page, 'Import data')
  await page.getByRole('textbox', { name: 'Raw data to import', exact: true }).fill('id,name\n1,Alpha\n2,Beta')
  await page.locator('[data-dataset-ingest-apply]').click()

  for (const viewport of phones) {
    await page.setViewportSize(viewport)
    if (viewport.width <= 700)
      await page.getByRole('tab', { name: 'Details', exact: true }).click()
    await expect(page.locator('html')).toHaveCSS('font-size', '16px')
    await expect(page.locator('.asset-manager__editor-body')).toHaveCSS('padding-top', '16px')
    const name = page.getByRole('textbox', { name: 'Dataset name', exact: true })
    await expect(name).toHaveCSS('font-size', '16px')
    await fits(name)
    await fits(page.getByRole('button', { name: 'Export', exact: true }))
    await fits(page.getByRole('button', { name: 'Save data', exact: true }))
    await page.getByRole('button', { name: 'Add column', exact: true }).click()
    const column = page.getByRole('textbox', { name: 'New column name', exact: true })
    await expect(column).toBeFocused()
    await expect(column).toHaveCSS('font-size', '16px')
    await fits(column)
    await fits(page.getByRole('button', { name: 'Save data', exact: true }))
    await page.getByRole('button', { name: 'Cancel column', exact: true }).click()
    await noOverflow(page)
  }
})

test('phone safe areas keep navigation, dialogs and source handoff inside the usable viewport', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await createProject(page, 'element')
  await page.setViewportSize({ width: 390, height: 844 })
  // Model the system insets separately from content spacing; a desktop runner has no notch.
  await page.addStyleTag({ content: ':root { --wb-safe-top: 47px; --wb-safe-bottom: 34px; }' })
  const appBounds = await page.locator('.workbench-app').boundingBox()
  expect(appBounds!.y).toBe(47)
  expect(appBounds!.y + appBounds!.height).toBeCloseTo(810, 0)
  await page.getByRole('button', { name: 'Handoff', exact: true }).click()
  const source = page.locator('.source-pane')
  await fits(source)
  await fits(source.getByRole('button', { name: 'Download project', exact: true }))
  await noOverflow(page)
  await page.getByRole('button', { name: 'Design', exact: true }).click()
  await openPageManagement(page)
  await page.locator('.page-manager__create-actions').getByRole('button', { name: 'From template', exact: true }).click()
  const dialog = page.locator('.page-creation-dialog:visible')
  await fits(dialog)
  await fits(dialog.getByRole('button', { name: 'Close this dialog', exact: true }))
  const bounds = await dialog.boundingBox()
  expect(bounds!.y).toBeGreaterThanOrEqual(47)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(810)
  await page.setViewportSize({ width: 844, height: 390 })
  await page.addStyleTag({ content: ':root { --wb-safe-top: 0px; --wb-safe-bottom: 21px; --wb-safe-left: 47px; --wb-safe-right: 47px; }' })
  await fits(dialog)
  await fits(dialog.getByRole('button', { name: 'Create page', exact: true }))
  const landscape = await dialog.boundingBox()
  expect(landscape!.x).toBeGreaterThanOrEqual(47)
  expect(landscape!.x + landscape!.width).toBeLessThanOrEqual(797)
  expect(landscape!.y + landscape!.height).toBeLessThanOrEqual(369)
})

test('preview and source use the remaining phone space without shrinking the runtime form', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await createProject(page, 'element')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('tab', { name: 'Theme', exact: true }).click()
  for (const viewport of phones) {
    await page.setViewportSize(viewport)
    const overflow = await page.locator('.project-theme-groups:visible').evaluate(node => node.scrollWidth - node.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    const picker = page.locator('.project-theme-color .el-color-picker').first()
    const trigger = picker.locator('.el-color-picker__trigger')
    expect((await picker.boundingBox())!.width).toBeGreaterThanOrEqual((await trigger.boundingBox())!.width)
    await fits(page.locator('.project-theme-actions').getByRole('button', { name: 'Apply', exact: true }))
    expect((await page.locator('.project-theme-tabs > .el-tabs__content').boundingBox())!.height).toBeGreaterThan(44)
  }
  await page.getByRole('button', { name: 'Show preview', exact: true }).click()
  for (const viewport of phones) {
    await page.setViewportSize(viewport)
    const preview = page.getByRole('complementary', { name: 'Page preview', exact: true })
    await fits(preview)
    const frame = preview.locator('iframe')
    await fits(frame)
    expect((await frame.boundingBox())!.height).toBeGreaterThan(160)
    await expect(page.locator('.mobile-studio-dock')).not.toBeVisible()
    await noOverflow(page)
  }
  await page.getByRole('button', { name: 'Handoff', exact: true }).click()
  const source = page.locator('.source-pane')
  await source.getByRole('treeitem', { name: 'main.ts', exact: true }).click()
  for (const viewport of phones) {
    await page.setViewportSize(viewport)
    await fits(source)
    await fits(source.getByRole('button', { name: 'Download project', exact: true }))
    await fits(source.locator('.source-workspace__statusbar'))
    const heading = source.locator('.source-workspace__heading h2')
    await fits(heading)
    expect((await heading.boundingBox())!.width).toBeGreaterThan(100)
    if (viewport.width === 678) {
      const text = await heading.evaluate(node => ({ content: node.scrollWidth, visible: node.clientWidth }))
      expect(text.content).toBeLessThanOrEqual(text.visible)
      const toolbar = await source.getByRole('toolbar', { name: 'Source shape' }).boundingBox()
      const identity = await source.locator('.source-workspace__identity').boundingBox()
      expect(toolbar!.y).toBeGreaterThanOrEqual(identity!.y + identity!.height)
    }
    const code = source.getByRole('region', { name: 'Read-only source: src/main.ts', exact: true })
    await expect(code).toBeVisible()
    expect((await code.boundingBox())!.height).toBeGreaterThan(80)
    await noOverflow(page)
  }
})

for (const locale of ['zh-CN', 'en-US'] as const) {
  test(`${locale} browser storage explanation opens by touch and stays readable in narrow navigation`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('moluoxixi.config-form.workbench.locale', value), locale)
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto('/#/projects')
    const label = locale === 'zh-CN' ? '存储：浏览器本地' : 'Storage: browser'
    const status = page.getByRole('button', { name: label, exact: true })
    const tooltip = page.getByRole('tooltip')
    await fits(status)
    await status.tap()
    await expect(tooltip).toContainText(locale === 'zh-CN' ? '清除网站数据会移除本地项目' : 'Clearing site data removes these projects')
    await expect(tooltip).toContainText('JSON')
    await fits(tooltip)
    await noOverflow(page)
    await page.keyboard.press('Escape')
    await expect(tooltip).not.toBeVisible()
    await page.getByRole('link', { name: locale === 'zh-CN' ? '模板管理' : 'Template management', exact: true }).tap()
    // The destination creates a new navigation shell. Do not tap the old
    // storage button while the lazy route is still replacing it.
    await expect(page.getByRole('main', { name: locale === 'zh-CN' ? '模板管理' : 'Template management', exact: true })).toBeVisible()
    await fits(status)
    await status.tap()
    await fits(tooltip)
    await expect(tooltip).toContainText(locale === 'zh-CN' ? '不会自动同步' : 'do not sync automatically')
    await page.locator('.management-navigation').tap({ position: { x: 1, y: 1 } })
    await expect(tooltip).not.toBeVisible()
    await noOverflow(page)
  })
}
