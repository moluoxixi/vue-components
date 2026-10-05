import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createProject, readDownloadText } from './helpers'

async function openAssetManager(page: import('@playwright/test').Page): Promise<import('@playwright/test').Locator> {
  await page.getByRole('tab', { name: 'Pages', exact: true }).click()
  await page.getByRole('button', { name: 'Manage data', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Assets', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

async function openProjectCreation(page: import('@playwright/test').Page): Promise<void> {
  const dialog = page.locator('.project-creation-dialog:visible')
  if (await dialog.isVisible())
    return
  await page.locator('[data-project-create]').first().click()
  await expect(dialog).toBeVisible()
}

async function runtimeThemeFontSize(page: import('@playwright/test').Page, selector: string): Promise<string> {
  return page.frameLocator(selector).locator('.runtime-host-root').evaluate((root) => {
    return getComputedStyle(root).getPropertyValue('--demo-font-size').trim()
  })
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void> {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))
  expect(width.scroll).toBe(width.client)
}

async function expectAssetDialogFits(dialog: import('@playwright/test').Locator): Promise<void> {
  const bounds = await dialog.locator('.asset-manager-dialog').evaluate((root) => {
    const rect = root.getBoundingClientRect()
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight }
  })
  expect(bounds.left).toBeGreaterThanOrEqual(0)
  expect(bounds.right).toBeLessThanOrEqual(bounds.width)
  expect(bounds.top).toBeGreaterThanOrEqual(0)
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height)
}

async function expectThemeFieldsFit(theme: import('@playwright/test').Locator): Promise<void> {
  const overflowing = await theme.evaluate((root) => {
    const panel = root.getBoundingClientRect()
    return [...root.querySelectorAll<HTMLElement>('.designer-theme-field > .el-select, .designer-theme-field > .el-input-number')]
      .filter((field) => {
        const bounds = field.getBoundingClientRect()
        if (bounds.width <= 0 || bounds.height <= 0)
          return false
        return bounds.left < panel.left - 1 || bounds.right > panel.right + 1
      })
      .map(field => field.className)
  })
  expect(overflowing).toEqual([])
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('authors Dataset and Resource assets, then applies a project theme across Design and Experience', async ({ page }) => {
  await openProjectCreation(page)
  await createProject(page, 'element')
  const dialog = await openAssetManager(page)

  await dialog.locator('.asset-manager__empty-actions').getByRole('button', { name: 'Create dataset', exact: true }).click()
  const datasetName = dialog.getByRole('textbox', { name: 'Dataset name', exact: true })
  const datasetRows = JSON.stringify([{
    id: 'one',
    meta: { label: 'One', disabled: true },
    tags: ['a'],
  }], null, 2)
  await dialog.getByRole('textbox', { name: 'Dataset JSON', exact: true }).fill(datasetRows)
  await datasetName.fill('People')
  await datasetName.press('Tab')
  await expect(dialog.getByRole('textbox', { name: 'Dataset JSON', exact: true })).toHaveValue(datasetRows)
  await dialog.locator('[data-asset-dataset-save]').click()
  await expect(dialog.getByRole('status')).toContainText('Dataset saved.')
  await dialog.getByRole('tab', { name: 'Table', exact: true }).click()
  await expect(dialog.locator('[data-asset-dataset-table]')).toContainText('{"label":"One","disabled":true}')
  await expect(dialog.locator('[data-asset-dataset-table]')).toContainText('["a"]')
  await dialog.getByRole('tab', { name: 'Default projection', exact: true }).click()
  const projection = { kind: 'options', valuePath: ['id'], labelPath: ['meta', 'label'] }
  await dialog.getByRole('textbox', { name: 'Dataset default projection JSON', exact: true }).fill(JSON.stringify(projection))
  await dialog.getByRole('button', { name: 'Save projection', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Default projection saved.')

  const [datasetDownload] = await Promise.all([
    page.waitForEvent('download'),
    dialog.locator('[data-asset-dataset-export]').click(),
  ])
  const datasetTransfer = JSON.parse(await readDownloadText(datasetDownload))
  expect(datasetTransfer).toMatchObject({
    kind: 'config-form-dataset',
    version: 1,
    dataset: { name: 'People', rows: [{ id: 'one', meta: { label: 'One', disabled: true } }], defaultProjection: projection },
  })
  await dialog.locator('[data-asset-dataset-import-file] input[type="file"]').setInputFiles({
    name: 'people.config-form-dataset.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(datasetTransfer)),
  })
  await expect(dialog.locator('[data-asset-navigation]').getByRole('button', { name: /People/ })).toHaveCount(2)

  await dialog.getByRole('button', { name: 'New URL Resource', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Resource URL', exact: true }).fill('https://example.com/product.json')
  await dialog.getByRole('textbox', { name: 'Resource media type', exact: true }).fill('application/json')
  await dialog.getByRole('textbox', { name: 'Resource integrity', exact: true }).fill('sha256-demo')
  await dialog.getByRole('textbox', { name: 'Resource name', exact: true }).fill('Product API')
  await dialog.getByRole('button', { name: 'Save URL', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Resource saved.')

  const [resourceDownload] = await Promise.all([
    page.waitForEvent('download'),
    dialog.locator('[data-asset-resource-export]').click(),
  ])
  const resourceTransfer = JSON.parse(await readDownloadText(resourceDownload))
  expect(resourceTransfer).toMatchObject({
    kind: 'config-form-resource',
    version: 1,
    payload: {
      resource: {
        kind: 'url',
        name: 'Product API',
        url: 'https://example.com/product.json',
        mediaType: 'application/json',
        integrity: 'sha256-demo',
      },
    },
  })

  const file = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  const hash = `sha256:${createHash('sha256').update(file).digest('hex')}`
  await dialog.locator('[data-asset-resource-file] input[type="file"]').setInputFiles({
    name: 'logo.svg',
    mimeType: 'image/svg+xml',
    buffer: file,
  })
  const embedded = dialog.locator('[data-asset-resource-editor]')
  await expect(embedded).toContainText('logo.svg')
  await expect(embedded).toContainText(String(file.byteLength))
  await expect(embedded).toContainText(hash)

  const replacement = { name: 'logo-updated.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><title>Updated</title></svg>') }
  const replaceFile = dialog.getByRole('button', { name: 'Replace file', exact: true })
  await dialog.locator('[data-asset-resource-replacement-file] input[type="file"]').setInputFiles(replacement)
  await expect(dialog.locator('.asset-manager__pending-file')).toContainText(replacement.name)
  await dialog.locator('[data-asset-navigation]').getByRole('button', { name: /Product API/ }).click()
  await dialog.locator('[data-asset-navigation]').getByRole('button', { name: /logo.svg/ }).click()
  await expect(replaceFile).toBeDisabled()
  await expect(dialog.locator('.asset-manager__pending-file')).toHaveCount(0)
  await dialog.locator('[data-asset-resource-replacement-file] input[type="file"]').setInputFiles(replacement)
  await replaceFile.click()
  await expect(embedded).toContainText(replacement.name)
  await expect(dialog.getByRole('status')).toContainText('Resource saved.')
  await expect(replaceFile).toBeDisabled()

  for (let index = 0; index < 2; index++) {
    await dialog.locator('[data-asset-navigation]').getByRole('button', { name: /People/ }).first().click()
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  }
  await expect(embedded).toBeVisible()
  await expect(dialog.locator('.asset-manager__empty')).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  const designFrame = 'iframe[data-design-runtime-variant="canvas"]'
  const experienceFrame = 'iframe[data-preview-runtime-host]'
  await expect.poll(() => runtimeThemeFontSize(page, designFrame)).toBe('')

  await page.getByRole('tab', { name: 'Theme', exact: true }).click()
  const theme = page.getByRole('region', { name: 'Project theme', exact: true })
  await expect(theme).toBeVisible()
  await theme.getByRole('tab', { name: 'Type', exact: true }).click()
  const baseSize = theme.locator('label').filter({ hasText: 'Base size' }).getByRole('spinbutton')
  await baseSize.fill('19')
  await baseSize.press('Tab')
  await theme.getByRole('button', { name: 'Apply', exact: true }).click()

  await expect.poll(() => runtimeThemeFontSize(page, designFrame), { timeout: 15_000 }).toBe('19px')
  await page.getByRole('button', { name: 'Show preview', exact: true }).click()
  await expect(page.locator(experienceFrame)).toBeVisible()
  await expect.poll(() => runtimeThemeFontSize(page, experienceFrame), { timeout: 15_000 }).toBe('19px')
  await page.getByRole('button', { name: 'Close preview', exact: true }).click()
  await expect(page.locator(experienceFrame)).toHaveCount(0)

  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect.poll(() => runtimeThemeFontSize(page, designFrame), { timeout: 15_000 }).toBe('')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect.poll(() => runtimeThemeFontSize(page, designFrame), { timeout: 15_000 }).toBe('19px')
  await page.getByRole('button', { name: 'Show preview', exact: true }).click()
  await expect(page.locator(experienceFrame)).toBeVisible()
  await expect.poll(() => runtimeThemeFontSize(page, experienceFrame), { timeout: 15_000 }).toBe('19px')
  await page.getByRole('button', { name: 'Close preview', exact: true }).click()

  await expect(page.locator('.revision-state')).toContainText('Autosaved', { timeout: 60_000 })
  await page.reload()
  // The theme is read back from the restored design route.
  await expect(page.getByRole('region', { name: 'Design editor', exact: true })).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => runtimeThemeFontSize(page, designFrame), { timeout: 15_000 }).toBe('19px')
})

test('keeps Dataset, Resource, and Theme entry points reachable at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openProjectCreation(page)
  await createProject(page, 'element')
  await page.setViewportSize({ width: 390, height: 560 })

  await page.locator('[data-mobile-studio-tab="pages"]').click()
  const dialog = await openAssetManager(page)
  await expectAssetDialogFits(dialog)
  await dialog.getByRole('tab', { name: 'Asset list', exact: true }).click()
  await expect(dialog.locator('[data-asset-navigation]')).toBeVisible()
  await dialog.getByRole('button', { name: 'New Dataset', exact: true }).click()
  await expect(dialog.locator('[data-asset-dataset-save]')).toBeVisible()
  await expectAssetDialogFits(dialog)
  const editorBody = dialog.locator('.asset-manager__editor-body')
  const editorScroll = await editorBody.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    return { scrollTop: element.scrollTop, maxScrollTop: element.scrollHeight - element.clientHeight }
  })
  expect(editorScroll.scrollTop).toBeGreaterThan(0)
  await expect(dialog.locator('[data-asset-dataset-save]')).toBeInViewport()
  await dialog.getByRole('tab', { name: 'Details', exact: true }).press('ArrowLeft')
  await expect(dialog.getByRole('tab', { name: 'Asset list', exact: true })).toBeFocused()
  await expect(dialog.locator('[data-asset-navigation]')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.keyboard.press('Escape')

  await page.locator('[data-mobile-studio-tab="theme"]').click()
  const theme = page.getByRole('region', { name: 'Project theme', exact: true })
  await expect(theme).toBeVisible()
  await theme.getByRole('tab', { name: 'Type', exact: true }).click()
  await expect(theme.locator('.designer-theme-type-grid')).toBeVisible()
  await expectThemeFieldsFit(theme)
  await theme.getByRole('tab', { name: 'Shape', exact: true }).click()
  await expect(theme.locator('.designer-theme-shape-grid')).toBeVisible()
  await expectThemeFieldsFit(theme)
  await theme.getByRole('tab', { name: 'Shadows', exact: true }).click()
  const themeContent = theme.locator('.el-tabs__content')
  await expect.poll(() => themeContent.evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }))).toMatchObject({ overflowY: 'auto' })
  await expect.poll(() => themeContent.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  const scrollState = await themeContent.evaluate((element) => {
    const maxScrollTop = element.scrollHeight - element.clientHeight
    element.scrollTop = maxScrollTop
    return { maxScrollTop, scrollTop: element.scrollTop }
  })
  expect(scrollState.maxScrollTop).toBeGreaterThan(0)
  expect(scrollState.scrollTop).toBeGreaterThan(0)
  await expectNoHorizontalOverflow(page)
})
