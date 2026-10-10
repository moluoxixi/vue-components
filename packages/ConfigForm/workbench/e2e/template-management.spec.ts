import type { Locator, Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createProject, openPageCreation as openManagedPageCreation, openPageManagement, restoreAppearance, setAppearance } from './helpers'

const TEMPLATE_PREVIEW_FRAME = '.template-runtime-preview iframe[data-design-runtime-host][data-design-runtime-variant="canvas"]'

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))
  expect(width.scroll).toBe(width.client)
}

async function openProjectCreation(page: Page): Promise<Locator> {
  // Template catalog coverage now belongs to page creation. A project is
  // created through the project console first, then its page workspace opens.
  await createProject(page, 'antd')
  await openPageCreation(page)
  const workspace = page.locator('.template-creation-workspace:visible').first()
  await expect(workspace).toBeVisible()
  return workspace
}

async function openPageCreation(page: Page): Promise<void> {
  await openManagedPageCreation(page)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('keeps project creation separate from the page template workspace', async ({ page }) => {
  const trigger = page.locator('[data-project-create]').first()
  await expect(trigger).toBeVisible()
  await trigger.click()

  const dialog = page.locator('.project-creation-dialog:visible')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.project-creation-workspace')).toBeVisible()
  await expect(dialog.locator('.template-creation-workspace')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Create page', exact: true })).toHaveCount(0)
  await expect(page).toHaveURL(/#\/projects$/)

  await dialog.getByRole('textbox', { name: 'Project name', exact: true }).fill('Project flow contract')
  await dialog.locator('.project-creation-adapter').filter({ hasText: 'Element Plus' }).click()
  await dialog.locator('[data-project-create-submit]').click()

  await expect(page).toHaveURL(/#\/projects\/[^/]+\/pages$/)
  await expect(page.locator('.page-manager')).toBeVisible()
  await expect(page.locator('.page-manager__row')).toHaveCount(0)
  await page.locator('.page-manager__create-actions').getByRole('button', { name: 'New page', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Design editor', exact: true })).toBeVisible()
  await expect(page.locator('.template-creation-workspace')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/projects\/[^/]+\/pages\/[^/]+\/design$/)
})

test('keeps the direct project creation route separate from page creation', async ({ page }) => {
  await expect(page.locator('.project-manager')).toBeVisible()
  await page.goto('/#/projects/new')

  await expect(page.locator('.project-creation-workspace')).toBeVisible()
  await expect(page.locator('.template-creation-workspace')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Create page', exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Project name', exact: true })).toBeVisible()
})

test('browses, filters, keyboard-selects, and previews the built-in catalog', async ({ page }) => {
  const workspace = await openProjectCreation(page)
  const search = workspace.getByRole('searchbox', { name: 'Search templates' })
  await expect(workspace.getByRole('option')).toHaveCount(4)
  await search.fill('no-such-template')
  await expect(workspace.getByText('No templates match these filters', { exact: true })).toBeVisible()
  await expect(workspace.getByText('No template selected', { exact: true })).toBeVisible()
  await workspace.getByRole('button', { name: 'Browse templates', exact: true }).click()
  await expect(search).toBeFocused()
  await search.fill('Ant Design Vue')
  await expect(workspace.getByRole('option')).toHaveCount(4)
  const first = workspace.getByRole('option').first()
  await first.focus()
  await first.press('End')
  await expect(workspace.getByRole('option', { name: /Ant Design Vue survey/ })).toHaveAttribute('aria-selected', 'true')
  const profile = workspace.getByRole('option', { name: /Ant Design Vue profile/ })
  await profile.click()
  await expect(profile).toHaveAttribute('aria-selected', 'true')
  await expect(workspace.locator(TEMPLATE_PREVIEW_FRAME)).toBeVisible()
  await expect(workspace.locator(TEMPLATE_PREVIEW_FRAME)).toHaveAttribute('title', /Runtime preview/)
  await expect(workspace.getByText('Ready to use', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  const results = await new AxeBuilder({ page })
    .exclude(TEMPLATE_PREVIEW_FRAME)
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(results.violations).toEqual([])

  await setAppearance(page, 'dark', 'morandi')
  await expect(workspace).toHaveAttribute('data-theme', 'dark')
  await expect(workspace).toHaveAttribute('data-palette', 'morandi')
  await expect(workspace.locator('.template-catalog-filters .el-select__wrapper').first())
    .toHaveCSS('background-color', 'rgb(40, 44, 49)')
  const lightResults = await new AxeBuilder({ page })
    .exclude(TEMPLATE_PREVIEW_FRAME)
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(lightResults.violations).toEqual([])

  await page.getByRole('button', { name: 'Switch language' }).click()
  const localizedWorkspace = page.locator('.template-creation-workspace:visible').first()
  await expect(localizedWorkspace.getByRole('option', { name: /Ant Design Vue 资料表单/ })).toBeVisible()
  await expect(localizedWorkspace.getByText('可以使用', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  const localizedResults = await new AxeBuilder({ page })
    .exclude(TEMPLATE_PREVIEW_FRAME)
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(localizedResults.violations).toEqual([])
})

test('creates independent pages and only offers compatible templates', async ({ page }) => {
  await createProject(page, 'element')
  const firstPageId = await page.frameLocator('iframe[data-design-runtime-variant="canvas"]')
    .locator('[data-config-node-id]')
    .first()
    .getAttribute('data-config-node-id')

  await openPageCreation(page)
  const workspace = page.locator('.template-creation-workspace:visible').first()
  await expect(workspace.getByRole('option', { name: /Ant Design Vue/ })).toHaveCount(0)
  await expect(workspace.getByText('Cannot create with this Registry', { exact: true })).toHaveCount(0)

  await workspace.getByRole('option', { name: /Element Plus profile/ }).click()
  await expect(workspace.getByText('Ready to use', { exact: true })).toBeVisible()
  await workspace.getByRole('button', { name: 'Create form page', exact: true }).click()
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
  const workspace = page.locator('.template-creation-workspace:visible').first()
  await workspace.getByRole('option', { name: /Ant Design Vue profile/ }).click()
  await expect(workspace.getByText('Ready to use', { exact: true })).toBeVisible()
  await workspace.getByRole('button', { name: 'Create form page', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Design editor' })).toBeVisible()
  const createdPageNodeId = await runtime.locator('[data-config-node-id]').first().getAttribute('data-config-node-id')
  expect(createdPageNodeId).not.toBe(firstPageNodeId)

  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(runtime.locator(`[data-config-node-id="${createdPageNodeId}"]`)).toHaveCount(0)
  await expect(runtime.locator('[data-config-node-id]').first()).toHaveAttribute('data-config-node-id', firstPageNodeId!)

  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await page.getByRole('tab', { name: 'Pages', exact: true }).click()
  await page.getByRole('button', { name: 'Manage pages', exact: true }).click()
  const pages = page.getByRole('main', { name: 'Page management', exact: true })
  await expect(pages.locator('.page-manager__row')).toHaveCount(2)
})

test('restores the page-management trigger on cancel and leaves page management after success', async ({ page }) => {
  await createProject(page, 'element')
  await openPageManagement(page)
  const pages = page.getByRole('main', { name: 'Page management', exact: true })
  const newSurface = pages.getByRole('button', { name: 'From template', exact: true })
  await newSurface.click()
  let workspace = page.locator('.template-creation-workspace:visible').first()
  await workspace.getByRole('button', { name: 'Back to Designer' }).click()
  await expect(newSurface).toBeFocused()

  await newSurface.click()

  workspace = page.locator('.template-creation-workspace:visible').first()
  await expect(workspace).toBeVisible()
  await workspace.getByRole('button', { name: 'Back to Designer' }).click()
  await expect(pages).toBeVisible()
  await expect(newSurface).toBeFocused()

  await newSurface.click()
  await expect(workspace.getByText('Ready to use', { exact: true })).toBeVisible()
  await workspace.getByRole('button', { name: 'Create form page', exact: true }).click()
  await expect(pages).not.toBeVisible()
  await expect(page.locator('[data-designer-entry]')).toBeFocused()
})

test('walks the project, page, and design hierarchy through the URLs', async ({ page }) => {
  await createProject(page, 'element')

  // The fixture creates a project and then creates its first page.
  await expect(page).toHaveURL(/#\/projects\/[^/]+\/pages\/[^/]+\/design$/)
  const projectId = page.url().match(/#\/projects\/([^/]+)\//)![1]

  // The designer links up to page management (the desktop entry lives in the
  // Pages panel; the topbar button is the mobile variant).
  await page.getByRole('tab', { name: 'Pages', exact: true }).click()
  await page.getByRole('button', { name: 'Manage pages', exact: true }).click()
  const pages = page.getByRole('main', { name: 'Page management', exact: true })
  await expect(pages).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`#/projects/${projectId}/pages$`))

  // Cards link to their designer and only expose inputs while editing.
  await expect(pages.getByRole('listitem')).toHaveCount(1)
  await expect(pages.locator('.page-manager__preview').first()).toBeVisible()
  await expect(pages.locator('.page-manager__row input')).toHaveCount(0)
  await expect(pages.locator('.page-manager__link').first()).toBeVisible()
  await pages.getByRole('button', { name: /^Edit / }).first().click()
  await expect(pages.locator('.page-manager__row input').first()).toBeVisible()
  await expect(pages.locator('input[aria-label^="Page name"]')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(pages.locator('.page-manager__row input')).toHaveCount(0)

  // Page management belongs to the named project; global navigation offers no page shortcut.
  await expect(pages.getByRole('heading', { level: 1 })).toHaveText('Element Plus profile form')
  await expect(page.getByRole('navigation', { name: 'Management' })).toHaveCount(0)
  await expect(pages.getByRole('combobox')).toHaveCount(0)
  await pages.getByRole('button', { name: 'Back to projects', exact: true }).click()
  const projects = page.getByRole('region', { name: 'Projects', exact: true })
  await expect(projects).toBeVisible()
  await expect(page).toHaveURL(/#\/projects$/)
  await expect(pages).not.toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Page management', exact: true })).toHaveCount(0)

  // Re-enter page management by explicitly choosing the project.
  await projects.locator(`[data-project-id="${decodeURIComponent(projectId)}"] [data-project-open]`).click()
  await expect(pages).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`#/projects/${projectId}/pages$`))

  await pages.getByRole('button', { name: /^Open .* in the designer$/ }).first().click()
  await expect(page.getByRole('region', { name: 'Design editor' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`#/projects/${projectId}/pages/[^/]+/design$`))

  // The designer links back to project management as well.
  await page.getByRole('button', { name: 'Back to projects', exact: true }).click()
  await expect(projects).toBeVisible()
  await expect(page).toHaveURL(/#\/projects$/)

  // A project card opens that project's page management.
  await projects.locator('[data-project-open]').first().click()
  await expect(pages).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`#/projects/${projectId}/pages$`))
})

test('requires a chosen project and scopes page browsing to that project', async ({ page }) => {
  await expect(page.locator('.project-manager')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Management' })).toHaveCount(0)
  await page.goto('/#/pages')
  await expect(page).toHaveURL(/#\/projects$/)
  await expect(page.locator('.page-manager')).toHaveCount(0)

  await createProject(page, 'element')
  const firstProjectId = page.url().match(/#\/projects\/([^/]+)\//)![1]
  await openPageManagement(page)
  const pages = page.getByRole('main', { name: 'Page management', exact: true })
  await pages.getByRole('searchbox', { name: 'Search pages', exact: true }).fill('unmatched page')
  await expect(pages.getByRole('listitem')).toHaveCount(0)
  await pages.getByRole('button', { name: 'Back to projects', exact: true }).click()

  await page.locator('[data-project-create]').first().click()
  const dialog = page.locator('.project-creation-dialog:visible')
  const projectName = 'Customer operations / 客户运营管理平台'
  await dialog.getByRole('textbox', { name: 'Project name', exact: true }).fill(projectName)
  await dialog.locator('[data-project-create-submit]').click()
  await expect(pages.getByRole('heading', { level: 1 })).toHaveText(projectName)
  await expect(pages.getByRole('listitem')).toHaveCount(0)
  await expect(pages.getByRole('searchbox', { name: 'Search pages', exact: true })).toHaveValue('')
  await expect(pages.getByRole('combobox')).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(pages.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(pages.getByRole('button', { name: 'New page', exact: true }).first()).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await pages.getByRole('button', { name: 'Back to projects', exact: true }).click()
  await page.locator(`[data-project-id="${decodeURIComponent(firstProjectId)}"] [data-project-open]`).click()
  await expect(pages.getByRole('heading', { level: 1 })).toHaveText('Element Plus profile form')
  await expect(pages.getByRole('listitem')).toHaveCount(1)
  await expect(pages.getByRole('searchbox', { name: 'Search pages', exact: true })).toHaveValue('')
  await expectNoHorizontalOverflow(page)

  // A current session must not turn an unscoped page URL into a recent-project shortcut.
  await page.goto('/#/pages')
  await expect(page).toHaveURL(/#\/projects$/)
  await expect(page.locator('.page-manager')).toHaveCount(0)
})

test('keeps page previews, names, and actions usable when a project scrolls at narrow widths', async ({ page }) => {
  await createProject(page, 'element')
  await openPageManagement(page)
  const pages = page.getByRole('main', { name: 'Page management', exact: true })
  const cards = pages.getByRole('listitem')
  for (const count of [2, 3]) {
    await cards.first().getByRole('button', { name: /^Duplicate / }).click()
    await expect(cards).toHaveCount(count)
  }

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(pages.getByRole('heading', { level: 1 })).toBeInViewport()
    await expect(pages.getByRole('searchbox', { name: 'Search pages', exact: true })).toBeInViewport()
    await expect(pages.getByRole('button', { name: 'New page', exact: true })).toBeInViewport()
    await expectNoHorizontalOverflow(page)

    const geometry = await pages.locator('.page-manager__table').evaluate((table) => {
      const cards = [...table.querySelectorAll('.page-manager__row')]
      return {
        scrolls: table.scrollHeight > table.clientHeight,
        cards: cards.map((card, index) => {
          const preview = card.querySelector('.page-manager__preview-button')!.getBoundingClientRect()
          const name = card.querySelector('.page-manager__name-cell')!.getBoundingClientRect()
          const actions = card.querySelector('.page-manager__actions')!.getBoundingClientRect()
          return {
            previewBottom: preview.bottom,
            nameTop: name.top,
            nameBottom: name.bottom,
            actionsTop: actions.top,
            actionsBottom: actions.bottom,
            cardBottom: card.getBoundingClientRect().bottom,
            nextTop: cards[index + 1]?.getBoundingClientRect().top,
          }
        }),
      }
    })
    expect(geometry.scrolls).toBe(true)
    for (const card of geometry.cards) {
      expect(card.previewBottom).toBeLessThanOrEqual(card.nameTop + 1)
      expect(card.nameBottom).toBeLessThanOrEqual(card.actionsTop + 1)
      expect(card.actionsBottom).toBeLessThanOrEqual(card.cardBottom)
      if (card.nextTop !== undefined)
        expect(card.cardBottom).toBeLessThanOrEqual(card.nextTop)
    }

    // The last card's actions must actually work after scrolling, not just fit the viewport.
    const lastCard = cards.last()
    await lastCard.scrollIntoViewIfNeeded()
    await expect(lastCard.locator('.page-manager__link')).toBeInViewport()
    await lastCard.getByRole('button', { name: /^Edit / }).click()
    const name = `Last page (${width}px)`
    await lastCard.getByRole('textbox', { name: /^Page name for / }).fill(name)
    await lastCard.getByRole('button', { name: /^Finish editing / }).click()
    await expect(lastCard.locator('.page-manager__link-label')).toHaveText(name)
  }
})

test('only shows compatible templates and keeps the create action visible at 390px', async ({ page }) => {
  await createProject(page, 'element')
  await page.setViewportSize({ width: 390, height: 844 })
  await openPageCreation(page)

  const workspace = page.locator('.template-creation-workspace:visible').first()
  await expect(workspace.getByRole('option', { name: /Ant Design Vue/ })).toHaveCount(0)
  await workspace.getByRole('option', { name: /Element Plus profile/ }).click()
  await expect(workspace.getByText('Ready to use', { exact: true })).toBeVisible()
  await expect(workspace.getByRole('button', { name: 'Create form page', exact: true })).toBeEnabled()
  await expect(workspace.getByRole('button', { name: 'Create form page', exact: true })).toBeInViewport()
  await expectNoHorizontalOverflow(page)
})

test('keeps the Runtime preview dominant and restores focus after the 900px catalog Drawer closes', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 })
  const workspace = await openProjectCreation(page)
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
  expect(geometry.detailWidth).toBeGreaterThan(760)
  await expect(detail.locator(TEMPLATE_PREVIEW_FRAME)).toBeVisible()

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
  const workspace = await openProjectCreation(page)
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

test('keeps library filters available while browsing and localizes narrow-screen appearance settings', async ({ page }) => {
  await page.getByRole('link', { name: 'Template management', exact: true }).click()
  const library = page.getByRole('main', { name: 'Template management', exact: true })
  const search = library.getByRole('searchbox', { name: 'Search templates', exact: true })
  await expect(library.getByRole('listitem')).toHaveCount(12)
  await search.fill('profile')
  await expect(library.getByRole('listitem')).toHaveCount(2)
  await library.getByRole('combobox', { name: 'Component library', exact: true }).press('ArrowDown')
  await page.getByRole('option', { name: 'Element Plus', exact: true }).click()
  await expect(library.getByRole('listitem')).toHaveCount(1)
  await library.locator('.el-segmented__item').filter({ hasText: 'Dialog' }).click()
  await expect(library.getByText('No templates match these filters', { exact: true })).toBeVisible()
  await library.getByRole('button', { name: 'Clear filters', exact: true }).first().click()
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('')
  await expect(library.getByRole('radio', { name: 'All types', exact: true })).toBeChecked()
  await expect(library.getByRole('listitem')).toHaveCount(12)
  await library.evaluate(element => element.scrollTop = element.scrollHeight)
  const navigation = (await page.getByRole('navigation').boundingBox())!
  const filters = (await library.locator('.template-manager__controls').boundingBox())!
  expect(filters.y).toBeGreaterThanOrEqual(navigation.y + navigation.height)
  expect(filters.y).toBeLessThanOrEqual(navigation.y + navigation.height + 1)
  await expect(search).toBeVisible()

  await page.setViewportSize({ width: 320, height: 740 })
  await page.getByRole('button', { name: 'Switch language', exact: true }).click()
  const settings = page.getByRole('button', { name: '打开外观设置', exact: true })
  await settings.click()
  const appearance = page.getByRole('dialog', { name: '外观', exact: true })
  await expect(appearance).toBeVisible()
  await expect(appearance.locator('.appearance-panel__header')).toHaveText('外观')
  await appearance.locator('.appearance-mode-control .el-segmented__item').filter({ hasText: '深色' }).click()
  await expect(page.locator('.management-shell')).toHaveAttribute('data-theme', 'dark')
  await page.keyboard.press('Escape')
  await expect(appearance).toBeHidden()
  await expect(settings).toBeFocused()
  await expectNoHorizontalOverflow(page)
  await page.reload()
  await expect(page.locator('.management-shell')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('heading', { name: '模板库', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('designs, saves, duplicates, and deletes personal templates without creating projects', async ({ page }) => {
  await page.getByRole('link', { name: 'Template management', exact: true }).click()
  const library = page.getByRole('main', { name: 'Template management', exact: true })
  await expect(library.getByRole('listitem')).toHaveCount(12)
  await library.getByRole('button', { name: 'New template', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New template', exact: true })
  await expect(dialog.getByRole('textbox', { name: 'Template name', exact: true })).toBeFocused()
  await dialog.getByRole('textbox', { name: 'Template name', exact: true }).fill('Customer details')
  await dialog.getByRole('button', { name: 'Dialog', exact: true }).click()
  await dialog.getByRole('button', { name: 'Start designing', exact: true }).click()
  const editor = page.getByRole('main', { name: 'Template designer', exact: true })
  await expect(editor).toBeVisible()
  await expect(editor.locator('[data-surface-presentation="dialog"]')).toBeVisible()
  await editor.locator('[data-material-row-key="element.input"] button').click()
  const runtime = editor.frameLocator('iframe[data-design-runtime-variant="canvas"]')
  await expect(runtime.locator('[data-config-node-id]').first()).toBeVisible()
  await expect(editor.getByText('Unsaved changes', { exact: true })).toBeVisible()
  await editor.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(runtime.locator('[data-config-node-id]')).toHaveCount(0)
  await editor.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(runtime.locator('[data-config-node-id]').first()).toBeVisible()
  await editor.getByRole('button', { name: 'Back to templates', exact: true }).click()
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(editor).toBeVisible()
  await editor.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(editor.getByText('Saved to library', { exact: true })).toBeVisible()
  await page.reload()
  await expect(runtime.locator('[data-config-node-id]').first()).toBeVisible()
  await editor.getByRole('button', { name: 'Back to templates', exact: true }).click()
  const personal = library.locator('[data-library-template^="custom-"]').first()
  await expect(personal.getByRole('heading')).toHaveText('Customer details')
  await personal.getByRole('button', { name: 'Preview Customer details', exact: true }).click()
  await expect(page.locator('.library-preview-dialog [data-surface-presentation="dialog"]')).toBeVisible()
  await expect(page.locator('.library-preview-dialog').frameLocator('iframe').locator('[data-config-node-id]').first()).toBeVisible()
  await page.locator('.library-preview-dialog').getByRole('button', { name: 'Close', exact: true }).last().click()
  await personal.getByRole('button', { name: 'Duplicate Customer details', exact: true }).click()
  await expect(library.locator('[data-library-template^="custom-"]')).toHaveCount(2)
  await library.locator('[data-library-template^="custom-"]').filter({ hasText: 'Customer details copy' }).getByRole('button', { name: 'Delete Customer details copy', exact: true }).click()
  await page.getByRole('dialog', { name: 'Delete template?', exact: true }).getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(library.locator('[data-library-template^="custom-"]')).toHaveCount(1)
  await page.getByRole('link', { name: 'Project management', exact: true }).click()
  await expect(page.locator('.project-row')).toHaveCount(0)
})

test('saves a project page to the template library and reuses an independent copy', async ({ page }) => {
  await createProject(page, 'element')
  const firstNode = await page.frameLocator('iframe[data-design-runtime-variant="canvas"]').locator('[data-config-node-id]').first().getAttribute('data-config-node-id')
  await openPageManagement(page)
  const manager = page.getByRole('main', { name: 'Page management', exact: true })
  await manager.getByRole('button', { name: 'More page actions', exact: true }).first().click()
  await page.getByRole('menuitem', { name: 'Save as template', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Save as template', exact: true })
  await dialog.getByRole('textbox', { name: 'Template name', exact: true }).fill('Reusable profile')
  await dialog.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await manager.getByRole('button', { name: 'From template', exact: true }).click()
  const workspace = page.locator('.template-creation-workspace:visible').first()
  await expect(workspace.getByRole('option', { name: /Ant Design Vue/ })).toHaveCount(0)
  await workspace.getByRole('option', { name: /Reusable profile/ }).click()
  await workspace.getByRole('button', { name: 'Create form page', exact: true }).click()
  const copied = page.frameLocator('iframe[data-design-runtime-variant="canvas"]').locator('[data-config-node-id]').first()
  await expect(copied).toBeVisible()
  expect(await copied.getAttribute('data-config-node-id')).not.toBe(firstNode)
})

test('creates a drawer directly as the first project surface and persists it', async ({ page }) => {
  await page.locator('[data-project-create]').first().click()
  const dialog = page.locator('.project-creation-dialog:visible')
  await dialog.getByRole('textbox', { name: 'Project name', exact: true }).fill('Overlay first')
  await dialog.locator('[data-project-create-submit]').click()
  const manager = page.getByRole('main', { name: 'Page management', exact: true })
  await manager.getByRole('button', { name: 'Choose page type', exact: true }).click()
  await page.getByRole('menuitem', { name: 'New drawer', exact: true }).click()
  await expect(page.locator('[data-surface-presentation="drawer"]')).toBeVisible()
  await expect(page.locator('.template-creation-workspace')).toHaveCount(0)
  await expect(page.locator('.surface-presentation-empty')).toBeVisible()
  await page.locator('[data-material-key="element.input"]').click()
  const runtime = page.frameLocator('iframe[data-design-runtime-variant="canvas"]')
  await expect(runtime.locator('[data-config-node-id]').first()).toBeVisible()
  await expect(page.locator('.revision-state')).toContainText(/Saved|Autosaved/, { timeout: 20_000 })
  await page.reload()
  await expect(page.locator('[data-surface-presentation="drawer"]')).toBeVisible()
  await expect(runtime.locator('[data-config-node-id]').first()).toBeVisible()
})

for (const scenario of [
  { width: 390, theme: 'light', adapter: 'antd', kind: 'Drawer' },
  { width: 1440, theme: 'dark', adapter: 'element', kind: 'Dialog' },
] as const) {
  test(`designs an accessible ${scenario.adapter} ${scenario.kind} template at ${scenario.width}px in ${scenario.theme} mode`, async ({ page }) => {
    const browserErrors: string[] = []
    page.on('pageerror', error => browserErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning')
        browserErrors.push(message.text())
    })
    await page.setViewportSize({ width: scenario.width, height: 844 })
    await restoreAppearance(page, scenario.theme, 'morandi')
    await page.getByRole('link', { name: 'Template management', exact: true }).click()
    const library = page.getByRole('main', { name: 'Template management', exact: true })
    await expect(library.getByRole('button', { name: 'New template', exact: true })).toBeEnabled()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const libraryAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(libraryAxe.violations).toEqual([])
    await library.getByRole('button', { name: 'New template', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'New template', exact: true })
    await expect(dialog.getByRole('textbox', { name: 'Template name', exact: true })).toBeFocused()
    await expect(page.locator('.el-overlay.el-modal-dialog:visible')).not.toHaveClass(/dialog-fade-/)
    const createAxe = await new AxeBuilder({ page }).include('.template-details-dialog').withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(createAxe.violations).toEqual([])
    await dialog.getByRole('textbox', { name: 'Template name', exact: true }).fill('Reusable overlay')
    await dialog.getByRole('button', { name: scenario.kind, exact: true }).click()
    if (scenario.adapter === 'antd')
      await dialog.locator('.el-segmented__item').filter({ hasText: 'Ant Design Vue' }).click()
    await dialog.getByRole('button', { name: 'Start designing', exact: true }).click()
    const editor = page.getByRole('main', { name: 'Template designer', exact: true })
    await expect(editor.locator('[data-surface-presentation]')).toBeVisible()
    if (scenario.width === 390)
      await editor.locator('.template-editor__mobile .el-segmented__item').filter({ hasText: 'Components' }).click()
    await editor.locator(`[data-material-row-key="${scenario.adapter}.input"] button`).click()
    if (scenario.width === 390)
      await editor.locator('.template-editor__mobile .el-segmented__item').filter({ hasText: 'Canvas' }).click()
    const runtime = editor.frameLocator('iframe[data-design-runtime-variant="canvas"]')
    await expect(runtime.locator('[data-config-node-id]').first()).toBeVisible()
    await editor.getByRole('button', { name: 'Overlay appearance', exact: true }).click()
    const appearance = page.getByRole('dialog', { name: 'Overlay appearance', exact: true })
    await appearance.getByRole('textbox', { name: 'Title', exact: true }).fill('Overlay title')
    await appearance.getByRole('spinbutton').first().fill('640')
    await appearance.getByRole('button', { name: 'Apply', exact: true }).click()
    await editor.getByRole('button', { name: 'Desktop', exact: true }).click()
    await expect(editor.locator('.surface-presentation-header')).toHaveText('Overlay title')
    await expect(editor.locator('.surface-presentation-shell')).toHaveCSS('--surface-presentation-size', '640px')
    await page.keyboard.press('Control+s')
    await expect(editor.getByText('Saved to library', { exact: true })).toBeVisible()
    await page.reload()
    await expect(runtime.locator('[data-config-node-id]').first()).toBeVisible()
    await expect(editor.locator('.surface-presentation-header')).toHaveText('Overlay title')
    await editor.getByRole('button', { name: 'Desktop', exact: true }).click()
    await expect(editor.locator('.surface-presentation-shell')).toHaveCSS('--surface-presentation-size', '640px')
    await expectNoHorizontalOverflow(page)
    if (scenario.width === 390)
      expect((await editor.locator('.template-editor__header').boundingBox())!.height).toBeLessThan(130)
    const editorAxe = await new AxeBuilder({ page }).exclude('iframe').withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(editorAxe.violations).toEqual([])
    expect(browserErrors).toEqual([])
  })
}

const templateVisualCases = [
  { height: 900, locale: 'zh', overlay: true, palette: 'ink', theme: 'light', width: 900 },
  { height: 900, locale: 'en', overlay: false, palette: 'morandi', theme: 'dark', width: 900 },
  { height: 844, locale: 'en', overlay: false, palette: 'cyber', theme: 'light', width: 390 },
  { height: 844, locale: 'zh', overlay: false, palette: 'glass', theme: 'dark', width: 390 },
] as const

for (const visualCase of templateVisualCases) {
  const { height, locale, overlay, palette, theme, width } = visualCase
  test(`matches the ${width}px ${palette} ${theme} ${locale} template visual contract @visual`, async ({ page }) => {
    await page.setViewportSize({ height, width })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await restoreAppearance(page, theme, palette)
    let workspace = await openProjectCreation(page)

    if (locale === 'zh') {
      if (width > 640) {
        await workspace.getByRole('button', { name: 'Switch language', exact: true }).click()
      }
      else {
        await workspace.getByRole('button', { name: 'More actions', exact: true }).click()
        await page.getByRole('menuitem', { name: 'Switch language', exact: true }).click()
      }
      workspace = page.locator('.template-creation-workspace:visible').first()
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
    await expect(page.locator('.template-catalog-item[aria-selected="true"] .template-catalog-status').first()).toHaveAttribute('data-status', 'eligible', { timeout: 15_000 })
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    if (width === 390 && locale === 'en')
      await page.locator('.page-creation-dialog .el-dialog__header').hover({ position: { x: 4, y: 4 } })
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
    const workspace = await openProjectCreation(page)
    if (viewport.width === 390) {
      await workspace.locator('.template-mobile-panes .el-segmented__item').filter({ hasText: 'Details' }).click()
      await expect(workspace.getByRole('button', { name: 'Catalog', exact: true })).toBeVisible()
      await expect(workspace.getByRole('button', { name: 'Create form page', exact: true })).toBeVisible()
    }
    else if (viewport.width === 900) {
      await expect(workspace.locator('.template-category-rail')).toBeVisible()
      await expect(workspace.locator(TEMPLATE_PREVIEW_FRAME)).toBeVisible()
    }
    else {
      await expect(workspace.getByRole('option')).toHaveCount(4)
      await expect(workspace.locator(TEMPLATE_PREVIEW_FRAME)).toBeVisible()
      const catalogWidth = await workspace.locator('.template-catalog-pane').evaluate(element => element.getBoundingClientRect().width)
      expect(catalogWidth).toBeGreaterThanOrEqual(280)
      expect(catalogWidth).toBeLessThanOrEqual(340)
    }
    await expectNoHorizontalOverflow(page)
  })
}
