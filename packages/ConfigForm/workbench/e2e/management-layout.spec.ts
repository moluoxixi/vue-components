import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

async function expectFitsViewport(locator: Locator): Promise<void> {
  await expect(locator).toBeInViewport({ ratio: 1 })
  const bounds = await locator.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight }
  })
  expect(bounds.left).toBeGreaterThanOrEqual(0)
  expect(bounds.right).toBeLessThanOrEqual(bounds.width)
  expect(bounds.top).toBeGreaterThanOrEqual(0)
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height)
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  const bounds = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }))
  expect(bounds.scrollWidth).toBe(bounds.width)
  expect(bounds.scrollHeight).toBe(bounds.height)
}

const copy = {
  'en-US': { name: 'Project name', pages: 'Manage pages', data: 'Manage data', projects: 'Back to projects', dataset: 'Create dataset', import: 'Import data', raw: 'Raw data to import', templates: 'Template management', save: 'Save data', list: 'Datasets', details: 'Details', export: 'Export', help: 'Table help' },
  'zh-CN': { name: '项目名称', pages: '管理页面', data: '管理数据', projects: '返回项目', dataset: '创建数据集', import: '导入数据', raw: '待导入数据', templates: '模板管理', save: '保存数据', list: '数据集', details: '编辑详情', export: '导出', help: '表格操作帮助' },
} as const

for (const locale of ['en-US', 'zh-CN'] as const) {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 540 }, { width: 1024, height: 600 }, { width: 320, height: 568 }]) {
    test(`${locale} management keeps content, navigation and save actions reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      test.setTimeout(90_000)
      const labels = copy[locale]
      await page.addInitScript(value => localStorage.setItem('moluoxixi.config-form.workbench.locale', value), locale)
      await page.goto('/')
      await page.locator('[data-project-create]').first().click()
      const dialog = page.locator('.project-creation-dialog:visible')
      const name = ('Product operations / 产品研发、审批流程、业务页面与数据工作区 '.repeat(2)).slice(0, 88)
      await dialog.getByRole('textbox', { name: labels.name, exact: true }).fill(name)
      const projectName = await dialog.getByRole('textbox', { name: labels.name, exact: true }).inputValue()
      await dialog.locator('.project-creation-adapter').filter({ hasText: 'Element Plus' }).click()
      await dialog.locator('[data-project-create-submit]').click()
      await expect(page.locator('.page-manager')).toBeVisible()
      const pagesUrl = page.url()
      await page.locator('[data-create-trigger="page-manager-new-surface"]').click()
      await expect(page.locator('[data-designer-entry]')).toBeVisible()
      await page.goto(pagesUrl)
      await expect(page.locator('.page-manager')).toBeVisible()
      const duplicate = page.locator('.page-manager__actions button').filter({ has: page.locator('svg.lucide-copy') }).first()
      for (let count = 2; count <= 9; count++) {
        await duplicate.click()
        await expect(page.locator('.page-manager__row')).toHaveCount(count)
      }
      await page.setViewportSize(viewport)
      const compactHeader = page.locator('.project-workspace-header')
      await expect(compactHeader.locator('h1')).toHaveAttribute('title', projectName.trim())
      await expectFitsViewport(compactHeader.getByRole('link', { name: labels.pages, exact: true }))
      await expectFitsViewport(compactHeader.getByRole('link', { name: labels.data, exact: true }))
      const pageList = await page.locator('.page-manager__table').boundingBox()
      expect(pageList!.y).toBeLessThanOrEqual(viewport.width > 700 ? 230 : 310)
      expect(pageList!.height).toBeGreaterThan(viewport.height * (viewport.width > 700 ? 0.55 : 0.45))
      await page.locator('.page-manager__table').focus()
      await page.keyboard.press('End')
      const lastActions = page.locator('.page-manager__row').last().locator('.page-manager__actions')
      await expect(lastActions).toBeInViewport({ ratio: 1 })
      await expectNoPageOverflow(page)

      await compactHeader.getByRole('link', { name: labels.data, exact: true }).click()
      await expect(page.locator('[data-project-data]')).toBeVisible()
      if (viewport.width <= 700)
        await page.getByRole('tab', { name: labels.details, exact: true }).click()
      await page.getByRole('button', { name: labels.dataset, exact: true }).click()
      await page.getByRole('tab', { name: labels.import, exact: true }).click()
      await page.getByRole('textbox', { name: labels.raw, exact: true }).fill(`id,name\n${Array.from({ length: 60 }, (_, index) => `${index + 1},Record ${index + 1}`).join('\n')}`)
      await page.locator('[data-dataset-ingest-apply]').click()
      const save = page.getByRole('button', { name: labels.save, exact: true })
      await expectFitsViewport(save)
      await save.click()
      await expectFitsViewport(page.getByRole('button', { name: labels.export, exact: true }))
      await expectFitsViewport(page.getByRole('button', { name: labels.help, exact: true }))
      await page.getByRole('button', { name: '1 / id', exact: true }).click()
      await expect(page.locator('[data-dataset-cell-detail]')).toBeVisible()
      await expectFitsViewport(save)
      await expectNoPageOverflow(page)
      await page.locator('[data-dataset-cell-detail] header button').click()

      // The last row and save action remain reachable when the table scrolls.
      await page.locator('[data-asset-dataset-table]').evaluate((node) => {
        node.scrollTop = node.scrollHeight
        node.scrollLeft = 0
      })
      await expectFitsViewport(page.getByRole('button', { name: '25 / id', exact: true }))
      await page.getByRole('button', { name: '25 / id', exact: true }).click()
      await expect(page.locator('[data-dataset-cell-detail]')).toBeVisible()
      await expectFitsViewport(save)
      await page.locator('[data-asset-dataset-table]').evaluate((node) => {
        node.scrollLeft = node.scrollWidth
      })
      await expectFitsViewport(save)
      await compactHeader.getByRole('button', { name: labels.projects, exact: true }).click()
      await expect(page.locator('.project-card')).toHaveCount(1)
      const firstProject = await page.locator('.project-card').boundingBox()
      expect(firstProject!.y).toBeLessThanOrEqual(240)
      await expectFitsViewport(page.locator('.project-manager__import'))
      await expectFitsViewport(page.locator('[data-project-create]').first())
      await expectFitsViewport(page.locator('.project-card__footer'))
      await expectNoPageOverflow(page)

      await page.getByRole('link', { name: labels.templates, exact: true }).click()
      await expect(page.locator('.template-card')).toHaveCount(12)
      const templates = await page.locator('.template-manager__grid').boundingBox()
      expect(templates!.y).toBeLessThanOrEqual(viewport.width > 700 ? 250 : 330)
      const lastTemplateAction = page.locator('.template-card__edit').last()
      await lastTemplateAction.focus()
      await expectFitsViewport(lastTemplateAction)
      await expectNoPageOverflow(page)
    })
  }
}

for (const viewport of [{ width: 1280, height: 540 }, { width: 320, height: 568 }]) {
  test(`creation dialogs keep their fields and primary action reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('moluoxixi.config-form.workbench.locale', 'en-US'))
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.locator('[data-project-create]').first().click()
    const project = page.locator('.project-creation-dialog:visible')
    await expectFitsViewport(project)
    await expectFitsViewport(project.locator('[data-project-create-submit]'))
    await page.keyboard.press('Escape')
    await page.getByRole('link', { name: 'Template management', exact: true }).click()
    await page.getByRole('button', { name: 'New template', exact: true }).click()
    const template = page.locator('.template-details-dialog:visible')
    await expectFitsViewport(template)
    await expectFitsViewport(template.getByRole('button', { name: 'Start designing', exact: true }))
    await expectNoPageOverflow(page)
  })
}
