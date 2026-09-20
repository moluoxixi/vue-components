import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createProject, readDownloadText } from './helpers'

async function openAssetManager(page: import('@playwright/test').Page): Promise<import('@playwright/test').Locator> {
  await page.getByRole('tab', { name: 'Surfaces', exact: true }).click()
  await page.getByRole('button', { name: 'Manage data', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Assets', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

async function openProjectCreation(page: import('@playwright/test').Page): Promise<void> {
  const workspace = page.getByRole('main', { name: 'Create project', exact: true })
  if (await workspace.isVisible())
    return
  await page.getByRole('main').getByRole('button', { name: 'New project', exact: true }).first().click()
  await expect(workspace).toBeVisible()
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

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('authors Dataset and Resource assets, then applies a project theme across Design and Experience', async ({ page }) => {
  await openProjectCreation(page)
  await createProject(page, 'element')
  const dialog = await openAssetManager(page)

  await dialog.getByRole('button', { name: 'New Dataset', exact: true }).click()
  const datasetName = dialog.getByRole('textbox', { name: 'Dataset name', exact: true })
  await datasetName.fill('People')
  await datasetName.press('Tab')
  await dialog.getByRole('textbox', { name: 'Dataset JSON', exact: true }).fill(JSON.stringify([{
    id: 'one',
    meta: { label: 'One', disabled: true },
    tags: ['a'],
  }], null, 2))
  await dialog.locator('[data-asset-dataset-save]').click()
  await expect(dialog.getByRole('status')).toContainText('Dataset saved.')
  await dialog.getByRole('tab', { name: 'Table', exact: true }).click()
  await expect(dialog.locator('[data-asset-dataset-table]')).toContainText('{"label":"One","disabled":true}')
  await expect(dialog.locator('[data-asset-dataset-table]')).toContainText('["a"]')

  const [datasetDownload] = await Promise.all([
    page.waitForEvent('download'),
    dialog.locator('[data-asset-dataset-export]').click(),
  ])
  const datasetTransfer = JSON.parse(await readDownloadText(datasetDownload))
  expect(datasetTransfer).toMatchObject({
    kind: 'config-form-dataset',
    version: 1,
    dataset: { name: 'People', rows: [{ id: 'one', meta: { label: 'One', disabled: true } }] },
  })
  await dialog.locator('[data-asset-dataset-import-file] input[type="file"]').setInputFiles({
    name: 'people.config-form-dataset.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(datasetTransfer)),
  })
  await expect(dialog.locator('[data-asset-navigation]').getByRole('button', { name: /People/ })).toHaveCount(2)

  await dialog.getByRole('button', { name: 'New URL Resource', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Resource name', exact: true }).fill('Product API')
  await dialog.getByRole('textbox', { name: 'Resource URL', exact: true }).fill('https://example.com/product.json')
  await dialog.getByRole('textbox', { name: 'Resource media type', exact: true }).fill('application/json')
  await dialog.getByRole('textbox', { name: 'Resource integrity', exact: true }).fill('sha256-demo')
  await dialog.getByRole('button', { name: 'Save URL', exact: true }).click()

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
  await dialog.locator('[data-asset-resource-file-create]').click()
  const embedded = dialog.locator('[data-asset-resource-editor]')
  await expect(embedded).toContainText('logo.svg')
  await expect(embedded).toContainText(String(file.byteLength))
  await expect(embedded).toContainText(hash)

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

  await expect(page.locator('.revision-state')).toContainText('Autosaved', { timeout: 15_000 })
  await page.reload()
  await page.getByRole('region', { name: 'Projects', exact: true }).getByRole('button').first().click()
  await expect(page.getByRole('region', { name: 'Design editor', exact: true })).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => runtimeThemeFontSize(page, designFrame), { timeout: 15_000 }).toBe('19px')
})

test('keeps Dataset, Resource, and Theme entry points reachable at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openProjectCreation(page)
  await createProject(page, 'element')

  await page.locator('[data-mobile-studio-tab="pages"]').click()
  const dialog = await openAssetManager(page)
  await expect(dialog.locator('[data-asset-navigation]')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.keyboard.press('Escape')

  await page.locator('[data-mobile-studio-tab="theme"]').click()
  await expect(page.getByRole('region', { name: 'Project theme', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
