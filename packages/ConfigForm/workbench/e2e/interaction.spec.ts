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

async function selectCanvasNode(page: Page, node: Locator, hitTarget: Locator = node): Promise<void> {
  const box = await visibleBox(hitTarget)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(node).toHaveAttribute('data-config-node-state', /(?:^|\s)selected(?:\s|$)/)
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
  const layerOpacity = await Promise.all([
    candidate.evaluate(element => Number.parseFloat(getComputedStyle(element).opacity)),
    overlay.evaluate(element => Number.parseFloat(getComputedStyle(element).opacity)),
  ])
  expect(layerOpacity[0]).toBeLessThanOrEqual(0.3)
  expect(layerOpacity[0]).toBeLessThan(layerOpacity[1])
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
  const navigationTabs = page.locator('.designer-left-tabs button')
  await expect(navigationTabs).toHaveCount(3)
  const navigationGeometry = await navigationTabs.evaluateAll(tabs => tabs.map((tab) => {
    const label = tab.querySelector('span')
    return {
      labelClientWidth: label?.clientWidth ?? 0,
      labelScrollWidth: label?.scrollWidth ?? 0,
    }
  }))
  for (const tab of navigationGeometry)
    expect(tab.labelScrollWidth).toBeLessThanOrEqual(tab.labelClientWidth + 1)

  const materials = page.locator(`[data-material-row-key^="${prefix}."]`)
  await expect(materials).toHaveCount(expectedCount)

  for (let index = 0; index < expectedCount; index += 1) {
    const material = materials.nth(index)
    await material.scrollIntoViewIfNeeded()
    await expect(material).toBeVisible()
    const geometry = await material.evaluate((element) => {
      const row = element.getBoundingClientRect()
      const summary = element.querySelector('.mx-config-form-designer__palette-item-summary')?.getBoundingClientRect()
      const preview = element.querySelector('.mx-config-form-designer__palette-item-preview')?.getBoundingClientRect()
      return {
        row: { height: row.height, width: row.width },
        summary: summary ? { bottom: summary.bottom, top: summary.top } : undefined,
        preview: preview ? { bottom: preview.bottom, top: preview.top, width: preview.width } : undefined,
      }
    })
    expect(geometry.row.height).toBeLessThanOrEqual(60)
    expect(geometry.preview?.width ?? 0).toBeGreaterThan(0)
    if (geometry.summary && geometry.preview) {
      const summaryCenter = (geometry.summary.top + geometry.summary.bottom) / 2
      const previewCenter = (geometry.preview.top + geometry.preview.bottom) / 2
      expect(Math.abs(summaryCenter - previewCenter)).toBeLessThanOrEqual(2)
    }
    const kind = await material.getAttribute('data-material-kind')
    const runtimeNodes = material.locator('[data-specimen-node-id]')
    const unavailable = material.locator('.mx-config-form-designer__palette-preview-unavailable')
    if (kind === 'field') {
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

  test(`keeps the ${adapter.name} design runtime inert while Preview stays interactive`, async ({ page }) => {
    await createApplication(page, adapter.id)
    const canvas = page.locator('.mx-config-form-designer__canvas')
    const sheet = canvas.locator('.mx-config-form-designer__canvas-sheet')
    const runtimeForm = canvas.locator('.mx-config-form-designer__runtime-surface > form')
    const nameNode = canvas.locator('[data-config-node-id="profile-name"]')
    const designInput = nameNode.locator('input').first()

    await expect(runtimeForm).toHaveAttribute('inert', '')
    await expect(runtimeForm).toHaveAttribute('aria-hidden', 'true')
    await expect(canvas.locator('.mx-config-form-designer__canvas-tools')).toHaveCount(0)
    await expect(canvas.locator('.mx-config-form-designer__selection-box')).toHaveCount(0)
    const sheetBox = await visibleBox(sheet)
    await page.mouse.click(sheetBox.x + sheetBox.width - 20, sheetBox.y + Math.min(sheetBox.height - 20, 420))
    await expect(sheet).not.toBeFocused()
    await expect(canvas.locator('.mx-config-form-designer__selection-box')).toHaveCount(0)
    const designInputStyle = await designInput.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        caretColor: style.caretColor,
        cursor: style.cursor,
        pointerEvents: style.pointerEvents,
        userSelect: style.userSelect,
      }
    })
    expect(designInputStyle).toEqual({
      caretColor: 'rgba(0, 0, 0, 0)',
      cursor: 'default',
      pointerEvents: 'none',
      userSelect: 'none',
    })
    const designControls = await runtimeForm.locator('input,textarea,select,button,[role]').evaluateAll(elements => elements.map((element) => {
      const style = getComputedStyle(element)
      return {
        pointerEvents: style.pointerEvents,
        tabIndex: (element as HTMLElement).tabIndex,
        userSelect: style.userSelect,
        userDrag: style.webkitUserDrag,
      }
    }))
    expect(designControls.length).toBeGreaterThan(0)
    for (const control of designControls) {
      expect(control.pointerEvents).toBe('none')
      expect(control.userSelect).toBe('none')
      expect(control.userDrag).toBe('none')
      expect(control.tabIndex).toBe(-1)
    }
    await selectCanvasNode(page, nameNode, designInput)
    await expect(canvas).toHaveAttribute('data-editor-overlay-mode', 'selected')

    const selection = canvas.locator('[data-editor-focus-node-id="profile-name"]')
    await expect(selection).toBeFocused()
    await expect(designInput).not.toBeFocused()
    await expect(canvas.locator('.mx-config-form-designer__selection-box')).toHaveCount(1)
    expectSameSize(await visibleBox(selection), await visibleBox(nameNode))
    const selectionStyle = await selection.evaluate((element) => {
      const style = getComputedStyle(element)
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineOffset: style.outlineOffset }
    })
    expect(selectionStyle.outlineStyle).toBe('solid')
    expect(Number.parseFloat(selectionStyle.outlineWidth)).toBeGreaterThan(0)
    expect(Number.parseFloat(selectionStyle.outlineOffset)).toBeGreaterThanOrEqual(4)

    const propertyPanel = page.locator('.mx-config-form-designer__properties')
    const propertyHeading = propertyPanel.locator('.mx-config-form-designer__property-heading')
    await expect(propertyHeading).toBeVisible()
    await expect(propertyHeading).not.toContainText('element.input')
    const propertyTabs = propertyPanel.locator('.mx-config-form-designer__tabs > [role="tab"]')
    await expect(propertyTabs).toHaveCount(6)
    const propertyTabGeometry = await propertyTabs.evaluateAll(tabs => tabs.map((tab) => {
      const rect = tab.getBoundingClientRect()
      return { right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, scrollWidth: tab.scrollWidth, clientWidth: tab.clientWidth }
    }))
    const propertyPanelBox = await visibleBox(propertyPanel)
    for (const tab of propertyTabGeometry) {
      expect(tab.width).toBeGreaterThan(0)
      expect(tab.height).toBeGreaterThan(0)
      expect(tab.scrollWidth).toBeLessThanOrEqual(tab.clientWidth)
      expect(tab.right).toBeLessThanOrEqual(propertyPanelBox.x + propertyPanelBox.width + 1)
      expect(tab.bottom).toBeLessThanOrEqual(propertyPanelBox.y + propertyPanelBox.height + 1)
    }

    const nodeToolbar = selection.getByRole('toolbar', { name: 'Node actions' })
    await expect(nodeToolbar.locator('[data-node-toolbar-button]')).toHaveCount(4)
    const moreActions = nodeToolbar.getByRole('button', { name: 'More actions' })
    await expect(moreActions).toHaveAttribute('aria-expanded', 'false')
    await moreActions.click()
    const nodeMenu = selection.getByRole('menu')
    await expect(nodeMenu.getByRole('menuitem')).toHaveCount(4)
    await expect(nodeMenu.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('End')
    await expect(nodeMenu.getByRole('menuitem').last()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(nodeMenu).toHaveCount(0)
    await expect(moreActions).toBeFocused()

    const resizeBox = await visibleBox(selection.locator('.mx-config-form-designer__resize-handle'))
    expect(resizeBox.width).toBeLessThanOrEqual(12)
    expect(resizeBox.height).toBeLessThanOrEqual(24)
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 18, resizeBox.y + resizeBox.height / 2)
    await expect(canvas).toHaveAttribute('data-editor-overlay-mode', 'resizing')
    await expect(selection).toHaveClass(/is-resizing/)
    await expect(canvas.locator('[data-designer-drag-overlay]:visible')).toHaveCount(0)
    await page.mouse.up()
    await expect(canvas).toHaveAttribute('data-editor-overlay-mode', 'selected')
    await expect(selection).not.toHaveClass(/is-resizing/)
    const designValue = await designInput.inputValue()
    await page.keyboard.type('Injected')
    await expect(designInput).toHaveValue(designValue)
    await expect(sheet).not.toBeFocused()

    const inputBox = await designInput.boundingBox()
    expect(inputBox).not.toBeNull()
    await page.mouse.move(inputBox!.x + 8, inputBox!.y + inputBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(inputBox!.x + inputBox!.width - 8, inputBox!.y + inputBox!.height / 2)
    await page.mouse.up()
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('')

    await page.getByRole('button', { name: 'Show preview' }).click()
    const preview = page.getByRole('complementary', { name: 'Page preview' })
    const previewInput = preview.locator('[data-config-node-id="profile-name"] input').first()
    await previewInput.fill('Preview value')
    await expect(previewInput).toHaveValue('Preview value')
    await expect(previewInput).toBeFocused()
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

test('removes stale selection chrome while a pointer drag is active', async ({ page }) => {
  await createApplication(page, 'element')
  const canvas = page.locator('.mx-config-form-designer__canvas')
  const selectedNode = canvas.locator('[data-config-node-id="profile-name"]')
  await selectCanvasNode(page, selectedNode, selectedNode.locator('input').first())
  await expect(canvas.locator('.mx-config-form-designer__selection-box')).toHaveCount(1)

  const source = page.locator('[data-material-key="element.input"]')
  await source.scrollIntoViewIfNeeded()
  const sourceBox = await visibleBox(source)
  const canvasBox = await attachedBox(canvas.locator('.mx-config-form-designer__canvas-sheet'))
  await page.mouse.move(sourceBox.x + 18, sourceBox.y + 18)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + sourceBox.width + 16, sourceBox.y + sourceBox.height / 2, { steps: 4 })
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + 92, { steps: 8 })

  await expect(canvas.locator('[data-config-node-state~="candidate"]')).toHaveCount(1)
  await expect(canvas).toHaveAttribute('data-editor-overlay-mode', 'pointer-dragging')
  await expect(canvas.locator('.mx-config-form-designer__selection-box')).toHaveCount(0)
  await expect(canvas.locator('[data-designer-drag-overlay]:visible')).toBeVisible()
  await page.mouse.up()
})

test('keeps a compact Preview inside its own responsive runtime viewport', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 })
  await createApplication(page, 'element')
  const roleNode = page.locator('.mx-config-form-designer__canvas [data-config-node-id="profile-role"]')
  await selectCanvasNode(page, roleNode, roleNode.locator('.el-select__wrapper'))
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

test('pins the selected Preview viewport when the host window is wider', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await createApplication(page, 'element')
  await page.getByRole('button', { name: 'Show preview' }).click()

  const preview = page.getByRole('complementary', { name: 'Page preview' })
  await preview.getByRole('button', { name: 'Mobile preview' }).click()
  const stage = preview.locator('.preview-stage')
  const layout = stage.locator('[data-config-form-responsive-layout]').first()
  const activeColumns = await layout.evaluate(element => getComputedStyle(element).getPropertyValue('--mx-config-form-active-columns').trim())
  const mobileColumns = await layout.evaluate(element => getComputedStyle(element).getPropertyValue('--mx-config-form-columns-mobile').trim())

  await expect(stage).toHaveAttribute('data-viewport', 'mobile')
  expect(activeColumns).toBe(mobileColumns)
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

test('keeps the layer action menu inside the viewport at the scroll boundary', async ({ page }) => {
  await createApplication(page, 'element')
  const inputMaterial = page.locator('[data-material-key="element.input"]')
  for (let index = 0; index < 16; index += 1)
    await inputMaterial.click()

  await page.getByRole('tab', { name: 'Layers' }).click()
  const lastLayer = page.getByRole('treeitem').last()
  await lastLayer.scrollIntoViewIfNeeded()
  await lastLayer.click()
  await lastLayer.locator('[aria-haspopup="menu"]').click()

  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const box = await visibleBox(menu)
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  expect(box.x).toBeGreaterThanOrEqual(8)
  expect(box.y).toBeGreaterThanOrEqual(8)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width - 8)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height - 8)
})
