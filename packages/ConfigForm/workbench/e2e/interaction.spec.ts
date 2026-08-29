import type { CDPSession, Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { createApplication } from './helpers'

interface DragGeometry {
  height: number
  width: number
}

interface DragResult {
  geometry: DragGeometry
  node: Locator
  nodeId: string
}

function expectSameSize(actual: DragGeometry, expected: DragGeometry): void {
  expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(1)
}

async function visibleBox(locator: Locator): Promise<DragGeometry & { x: number, y: number }> {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box!
}

async function attachedBox(locator: Locator): Promise<DragGeometry & { x: number, y: number }> {
  await locator.waitFor({ state: 'attached' })
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box!
}

async function pointerDrop(page: Page, materialKey: string, target: Locator): Promise<DragResult> {
  const source = page.locator(`[data-material-key="${materialKey}"]`)
  await source.scrollIntoViewIfNeeded()
  const sourceBox = await visibleBox(source)
  const targetBox = await attachedBox(target)

  await page.mouse.move(sourceBox.x + Math.min(24, sourceBox.width / 2), sourceBox.y + Math.min(24, sourceBox.height / 2))
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + sourceBox.width + 12, sourceBox.y + sourceBox.height / 2, { steps: 4 })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + Math.min(targetBox.height / 2, 72), { steps: 12 })

  const candidate = page.locator('.mx-config-form-designer__canvas [data-config-node-state~="candidate"]')
  const candidateBox = await attachedBox(candidate)
  const nodeId = await candidate.getAttribute('data-config-node-id')
  expect(nodeId).toBeTruthy()

  const overlay = page.locator('[data-designer-drag-overlay]:visible')
  const overlayBox = await visibleBox(overlay)
  const collapsed = candidateBox.width < 1 || candidateBox.height < 1
  if (collapsed)
    expect(overlayBox.height).toBeGreaterThanOrEqual(24)
  else
    expectSameSize(overlayBox, candidateBox)

  await page.mouse.up()
  const committed = page.locator(`.mx-config-form-designer__canvas [data-config-node-id="${nodeId}"]`)
  const committedBox = collapsed ? await attachedBox(committed) : await visibleBox(committed)
  expectSameSize(committedBox, candidateBox)
  await expect(page.locator('.mx-config-form-designer__canvas [data-config-node-state~="candidate"]')).toHaveCount(0)

  return { geometry: committedBox, node: committed, nodeId: nodeId! }
}

async function dispatchTouch(
  client: CDPSession,
  type: 'touchEnd' | 'touchMove' | 'touchStart',
  point?: { x: number, y: number },
): Promise<void> {
  await client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: point
      ? [{ force: 1, id: 73, radiusX: 2, radiusY: 2, x: point.x, y: point.y }]
      : [],
  })
}

async function touchDrop(page: Page, materialKey: string, target: Locator): Promise<DragResult> {
  const source = page.locator(`[data-material-key="${materialKey}"]`)
  await source.scrollIntoViewIfNeeded()
  const sourceBox = await visibleBox(source)
  const targetBox = await visibleBox(target)
  const start = { x: sourceBox.x + 18, y: sourceBox.y + 18 }
  const end = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + Math.min(targetBox.height / 2, 88) }
  const client = await page.context().newCDPSession(page)

  await dispatchTouch(client, 'touchStart', start)
  await dispatchTouch(client, 'touchMove', { x: start.x + 36, y: start.y + 12 })
  await dispatchTouch(client, 'touchMove', end)

  const candidate = page.locator('.mx-config-form-designer__canvas [data-config-node-state~="candidate"]')
  const candidateBox = await visibleBox(candidate)
  const nodeId = await candidate.getAttribute('data-config-node-id')
  expect(nodeId).toBeTruthy()
  await expect(page.locator('[data-designer-drag-overlay]:visible')).toBeVisible()

  await dispatchTouch(client, 'touchEnd')
  await client.detach()
  const committed = page.locator(`.mx-config-form-designer__canvas [data-config-node-id="${nodeId}"]`)
  const committedBox = await visibleBox(committed)
  expectSameSize(committedBox, candidateBox)
  return { geometry: committedBox, node: committed, nodeId: nodeId! }
}

async function expectAllPaletteSpecimens(page: Page, prefix: 'antd' | 'element', expectedCount: number): Promise<void> {
  const materials = page.locator(`[data-material-key^="${prefix}."]`)
  await expect(materials).toHaveCount(expectedCount)

  for (let index = 0; index < expectedCount; index += 1) {
    const material = materials.nth(index)
    await material.scrollIntoViewIfNeeded()
    await expect(material).toBeVisible()
    const kind = (await material.locator('small').textContent())?.trim()
    const runtimeNodes = material.locator('[data-specimen-node-id]')
    const unavailable = material.locator('.mx-config-form-designer__palette-preview-unavailable')
    if (kind === 'Field') {
      await expect(runtimeNodes, `field specimen ${await material.getAttribute('data-material-key')}`).not.toHaveCount(0)
    }
    else {
      await expect(
        runtimeNodes.or(unavailable),
        `layout specimen ${await material.getAttribute('data-material-key')}`,
      ).not.toHaveCount(0)
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

for (const adapter of [
  { count: 17, id: 'element', name: 'Element' },
  { count: 22, id: 'antd', name: 'Ant' },
] as const) {
  test(`renders every registered ${adapter.name} material through a real specimen contract`, async ({ page }) => {
    await createApplication(page, adapter.id)
    await expectAllPaletteSpecimens(page, adapter.id, adapter.count)
  })
}

test('keeps pointer candidates, drag visuals, committed nodes, and Preview on the same Element runtime tree', async ({ page }) => {
  await createApplication(page, 'element')
  const canvas = page.locator('.mx-config-form-designer__canvas')

  const section = await pointerDrop(page, 'element.section', canvas)
  const flex = await pointerDrop(page, 'element.flex', section.node)
  const input = await pointerDrop(page, 'element.input', flex.node)
  await expect(input.node.locator('.el-input')).toBeVisible()
  await expect(section.node.locator(`[data-config-node-id="${flex.nodeId}"] [data-config-node-id="${input.nodeId}"]`)).toBeVisible()

  await page.getByRole('button', { name: 'Show preview' }).click()
  const previewInput = page.getByRole('complementary', { name: 'Page preview' })
    .locator(`[data-config-node-id="${input.nodeId}"]`)
  await expect(previewInput.locator('.el-input')).toBeVisible()
})

test('keeps a compact Preview inside its own responsive runtime viewport', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 })
  await createApplication(page, 'element')
  await page.locator('.mx-config-form-designer__canvas [data-config-node-id="profile-role"]').click()
  await page.getByRole('button', { name: 'Show preview' }).click()

  const preview = page.getByRole('complementary', { name: 'Page preview' })
  const stage = preview.locator('.preview-stage')
  const layout = stage.locator('[data-config-form-responsive-layout]').first()
  const cells = stage.locator('[data-config-form-responsive-cell]')
  await expect(cells).toHaveCount(3)

  const responsiveVariables = await layout.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      active: style.getPropertyValue('--mx-config-form-active-columns').trim(),
      mobile: style.getPropertyValue('--mx-config-form-columns-mobile').trim(),
    }
  })
  expect(responsiveVariables.active).toBe(responsiveVariables.mobile)

  const stageBox = await visibleBox(stage)
  for (let index = 0; index < await cells.count(); index += 1) {
    const cellBox = await visibleBox(cells.nth(index))
    expect(cellBox.x).toBeGreaterThanOrEqual(stageBox.x - 1)
    expect(cellBox.x + cellBox.width).toBeLessThanOrEqual(stageBox.x + stageBox.width + 1)
  }
  const overflow = await stage.evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)

  await preview.locator('[data-config-node-id="profile-role"] .el-select__wrapper').click()
  await expect(page.getByRole('option', { name: 'Developer' })).toBeVisible()
  await page.keyboard.press('Escape')
})

test('uses the real Ant runtime component for pointer candidate, overlay, and committed output', async ({ page }) => {
  await createApplication(page, 'antd')
  const result = await pointerDrop(page, 'antd.input', page.locator('.mx-config-form-designer__canvas'))
  await expect(result.node.locator('.ant-input')).toBeVisible()
})

test('supports keyboard and touch material drops without a second editable model', async ({ page }) => {
  await createApplication(page, 'element')
  const canvas = page.locator('.mx-config-form-designer__canvas')
  const inputMaterial = page.locator('[data-material-key="element.input"]')

  await inputMaterial.press(' ')
  const keyboardCandidate = canvas.locator('[data-config-node-state~="candidate"]')
  const candidateBox = await visibleBox(keyboardCandidate)
  const candidateId = await keyboardCandidate.getAttribute('data-config-node-id')
  await expect(inputMaterial).toHaveAttribute('aria-pressed', 'true')
  await inputMaterial.press('ArrowDown')
  await inputMaterial.press(' ')
  const keyboardNode = canvas.locator(`[data-config-node-id="${candidateId}"]`)
  expectSameSize(await visibleBox(keyboardNode), candidateBox)

  const date = await touchDrop(page, 'element.date', canvas)
  await expect(date.node.locator('.el-date-editor')).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(canvas.locator(`[data-config-node-id="${date.nodeId}"]`)).toHaveCount(0)
})
