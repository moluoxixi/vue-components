import type { PersistedProjectEnvelope } from '@moluoxixi/config-form-model'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { openHttpProjectRepository, workspaceRequest } from '@moluoxixi/config-form-studio/client'
import { expect, test } from '@playwright/test'
// Reuse the portable acceptance project for both the designer and exported apps.
import { createEmployeeDirectory } from '../examples/employee-directory.mjs'
import { startLocalWorkspace } from '../src/services/server'

let directory: string
let service: Awaited<ReturnType<typeof startLocalWorkspace>>

test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'config-form-browser-'))
  service = await startLocalWorkspace({ directory, port: 0, staticDirectory: resolve(import.meta.dirname, '../dist/designer') })
})

test.afterAll(async () => {
  await service?.close()
  if (directory)
    await rm(directory, { recursive: true, force: true })
})

async function request<T>(path: string, input: unknown): Promise<T> {
  return workspaceRequest<T>(`${service.url}/api/config-form/${path}`, input)
}

test('separate browser contexts share projects, refresh saved edits, and preserve a conflicting local draft', async ({ page, browser }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const other = await browser.newContext()
  const right = await other.newPage()
  let releaseCommit = () => {}
  try {
    await page.goto(`${service.url}/#/projects`)
    await right.goto(`${service.url}/#/projects`)
    const created = await request<PersistedProjectEnvelope>('create', { id: 'shared-browser', name: 'Shared account', preset: 'element-plus', templateId: 'element-profile' })
    await expect(page.getByText('Shared account', { exact: true }).first()).toBeVisible()
    await expect(right.getByText('Shared account', { exact: true }).first()).toBeVisible()
    await expect(page.locator('.workspace-status')).toContainText('config-form-browser-')
    const surfaceId = created.document.homeSurfaceId
    await page.goto(`${service.url}/#/projects/${created.document.id}/pages/${surfaceId}/design`)
    const canvas = page.frameLocator('iframe[data-design-runtime-variant="canvas"]')
    await expect(canvas.locator('[data-field="name"]')).toContainText('Name')
    await request('operations', { projectId: created.document.id, expectedRepositoryRevision: 0, commandId: 'remote-field', label: 'Rename field', operations: [{ type: 'node.settings', surfaceId, nodeId: 'profile-name', settings: { kind: 'field', component: 'element.input', field: 'name', label: 'Shared name', defaultValue: '' } }] })
    await expect(canvas.locator('[data-field="name"]')).toContainText('Shared name')
    await expect(page.locator('.revision-state')).toContainText('v1')

    // Hold autosave while another client commits, forcing the real conflict path.
    const held = new Promise<void>(accept => releaseCommit = accept)
    await page.route('**/api/config-form/repository', async (route) => {
      if (route.request().postDataJSON()?.method === 'commit')
        await held
      await route.continue()
    })
    await page.getByRole('tab', { name: 'Layers', exact: true }).click()
    await page.locator('[data-layer-id="profile-name"] .designer-layer-select').click()
    const showProperties = page.getByRole('button', { name: 'Show properties', exact: true })
    if (await showProperties.isVisible())
      await showProperties.click()
    const inspector = page.locator('.mx-config-form-designer__properties')
    const label = inspector.getByRole('textbox', { name: /^(Label|标签)$/ })
    await label.fill('My unsaved name')
    await label.press('Tab')
    await expect(canvas.locator('[data-field="name"]')).toContainText('My unsaved name')
    await request('operations', { projectId: created.document.id, expectedRepositoryRevision: 1, commandId: 'remote-project', label: 'Remote edit', operations: [{ type: 'project.rename', name: 'Other client saved' }] })
    await expect(page.locator('.revision-state')).toContainText(/外部|External revision|Conflict/)
    releaseCommit()
    await expect(canvas.locator('[data-field="name"]')).toContainText('My unsaved name')
    const latest = await request<PersistedProjectEnvelope>('repository', { method: 'get', args: [created.document.id] })
    expect(latest.repositoryRevision).toBe(2)
    expect(latest.document.surfacesById[surfaceId]!.graph.nodesById['profile-name']).toMatchObject({ label: 'Shared name' })
    await expect(right.getByText('Other client saved', { exact: true }).first()).toBeVisible()
    expect(errors).toEqual([])
  }
  finally {
    releaseCommit()
    await other.close()
  }
})

for (const preset of ['element-plus', 'antd-vue'] as const) {
  test(`saved previews stay on their revision and render overlays with ${preset}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const project = await request<PersistedProjectEnvelope>('create', { id: `preview-${preset}`, name: 'Saved preview', preset, templateId: preset === 'element-plus' ? 'element-profile' : 'antd-profile' })
    const surfaceId = project.document.homeSurfaceId
    const preview = await request<{ previewUrl: string }>('preview', { projectId: project.document.id, expectedRepositoryRevision: 0 })
    await page.goto(preview.previewUrl)
    const frame = page.frameLocator('iframe[data-preview-runtime-host]')
    await expect(frame.locator('[data-field="name"]')).toContainText('Name')
    await request('operations', { projectId: project.document.id, expectedRepositoryRevision: 0, commandId: 'later-field', label: 'New label', operations: [{ type: 'node.settings', surfaceId, nodeId: 'profile-name', settings: { kind: 'field', component: preset === 'element-plus' ? 'element.input' : 'antd.input', field: 'name', label: 'Newer label', defaultValue: '' } }] })
    await page.reload()
    await expect(frame.locator('[data-field="name"]')).toContainText('Name')
    await expect(frame.locator('[data-field="name"]')).not.toContainText('Newer label')
    await frame.locator('[data-field="name"] input').fill('Review user')
    await expect(frame.locator('[data-field="name"] input')).toHaveValue('Review user')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: '手机', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
    const box = await page.locator('iframe').boundingBox()
    expect(box!.height).toBeGreaterThan(600)
    await page.screenshot({ path: `.tmp-test-results/${preset}-saved-preview.png` })

    const dialog = await request<PersistedProjectEnvelope>('create', { id: `dialog-${preset}`, name: 'Overlay preview', preset, templateId: preset === 'element-plus' ? 'element-dialog' : 'antd-dialog' })
    const dialogPreview = await request<{ previewUrl: string }>('preview', { projectId: dialog.document.id, surfaceId: dialog.document.surfaceOrder[0], expectedRepositoryRevision: 0 })
    await page.goto(dialogPreview.previewUrl)
    await frame.getByRole('button', { name: /^打开 / }).click()
    await expect(frame.getByRole('dialog')).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('embedded image previews read bytes from the pinned version', async ({ page }) => {
  const repository = await openHttpProjectRepository({ url: service.url })
  try {
    const project = await request<PersistedProjectEnvelope>('create', { id: 'saved-image', name: 'Image preview', preset: 'element-plus' })
    const bytes = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBpQAAAAASUVORK5CYII=', 'base64'))
    const contentHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
    const document = project.document
    document.resources.logo = { id: 'logo', kind: 'embedded', name: 'Saved logo', fileName: 'logo.png', mediaType: 'image/png', contentHash, byteLength: bytes.byteLength }
    const home = document.surfacesById.home!
    home.graph.nodesById.logo = { id: 'logo', kind: 'element', component: 'element.image', props: { alt: 'Saved logo' }, resourceBindings: { src: { resourceId: 'logo' } } }
    home.graph.root.push({ nodeId: 'logo', placement: {} })
    await repository.commit({ id: document.id, expectedRepositoryRevision: 0, commandId: 'image', document, embeddedWrites: [{ resourceId: 'logo', contentHash, bytes }], metadata: { source: 'manual' } })
    delete document.resources.logo
    delete document.surfacesById.home!.graph.nodesById.logo
    document.surfacesById.home!.graph.root = []
    await repository.commit({ id: document.id, expectedRepositoryRevision: 1, commandId: 'remove-image', document, metadata: { source: 'manual' } })
    await page.goto(`${service.url}/#/preview/${document.id}/1/home`)
    const image = page.frameLocator('iframe[data-preview-runtime-host]').getByRole('img', { name: 'Saved logo', exact: true })
    await expect(image).toBeVisible()
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true)
  }
  finally {
    repository.close()
  }
})

for (const preset of ['element-plus', 'antd-vue'] as const) {
  test(`saved directory previews filter rows and validate overlays with ${preset}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const repository = await openHttpProjectRepository({ url: service.url })
    const document = createEmployeeDirectory(preset)
    try {
      await repository.create({ document, embeddedContents: [] })
      await page.goto(`${service.url}/#/preview/${document.id}/0/home`)
      const frame = page.frameLocator('iframe[data-preview-runtime-host]')
      await expect(frame.getByRole('row').filter({ hasText: '林晓' })).toHaveCount(1)
      await expect(frame.getByRole('row').filter({ hasText: '王宁' })).toBeVisible()
      if (preset === 'element-plus') {
        // Missing provider table styles used to leave native header alignment.
        await expect.poll(() => frame.locator('.el-table th .cell').first().evaluate(element => getComputedStyle(element).textAlign)).toBe('left')
        await frame.locator('.el-switch').click()
      }
      else {
        await frame.getByRole('switch').click()
      }
      await expect(frame.getByRole('row').filter({ hasText: '王宁' })).toHaveCount(0)
      await expect(frame.getByRole('row').filter({ hasText: '林晓' })).toHaveCount(1)
      await frame.getByRole('row').filter({ hasText: '林晓' }).click()
      const dialog = frame.getByRole('dialog')
      await expect(dialog).toBeVisible()
      // The overlay backdrop must cover positioned provider table headers.
      const covered = await frame.locator('body').evaluate((body) => {
        const header = body.querySelector('th')
        if (!header)
          return true
        const rect = header.getBoundingClientRect()
        return !!body.ownerDocument.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest('.mx-prototype-host__overlay-layer')
      })
      expect(covered).toBe(true)
      await dialog.getByRole('button', { name: /^完\s*成$/ }).click()
      await expect(dialog.getByText('请输入员工姓名', { exact: true })).toBeVisible()
      await dialog.getByRole('textbox').fill('林晓')
      await dialog.getByRole('button', { name: /^完\s*成$/ }).click()
      await expect(dialog).toHaveCount(0)
      expect(errors).toEqual([])
    }
    finally { repository.close() }
  })
}
