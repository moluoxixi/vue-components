import type { CDPSession, FrameLocator, Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { createProject, restoreAppearance, setAppearance } from './helpers'

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

function expectSameRect(
  actual: DragGeometry & { x: number, y: number },
  expected: DragGeometry & { x: number, y: number },
): void {
  expectSameSize(actual, expected)
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(1)
}

function rectsIntersect(
  left: DragGeometry & { x: number, y: number },
  right: DragGeometry & { x: number, y: number },
): boolean {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
}

async function expectTopbarFits(page: Page): Promise<void> {
  const geometry = await page.locator('.workbench-topbar').evaluate((header) => {
    const headerRect = header.getBoundingClientRect()
    const visible = [...header.querySelectorAll<HTMLElement>(':scope > *, .topbar-actions > *')]
      .filter(element => getComputedStyle(element).display !== 'none')
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
      })
    return {
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      header: { bottom: headerRect.bottom, left: headerRect.left, right: headerRect.right, top: headerRect.top },
      visible,
    }
  })
  expect(geometry.documentScrollWidth).toBe(geometry.documentClientWidth)
  for (const box of geometry.visible) {
    expect(box.left).toBeGreaterThanOrEqual(geometry.header.left - 1)
    expect(box.right).toBeLessThanOrEqual(geometry.header.right + 1)
    expect(box.top).toBeGreaterThanOrEqual(geometry.header.top - 1)
    expect(box.bottom).toBeLessThanOrEqual(geometry.header.bottom + 1)
  }
}

async function chooseResponsiveTopbarAction(page: Page, width: number, name: string): Promise<void> {
  if (width > 900) {
    await page.getByRole('button', { name }).click()
    return
  }
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name }).click()
}

function previewRuntime(page: Page): FrameLocator {
  return page.frameLocator('iframe[data-preview-runtime-host]')
}

function designRuntime(page: Page): FrameLocator {
  return page.frameLocator('iframe[data-design-runtime-variant="canvas"]')
}

function dragVisualRuntime(page: Page): FrameLocator {
  return page.frameLocator('iframe[data-design-runtime-variant="drag-visual"]')
}

async function runtimeNodeSignature(node: Locator): Promise<{
  descendantCount: number
  kind: string | null
  nodeClasses: string[]
  rootClasses: string[]
  rootTag: string | null
}> {
  return node.evaluate((element) => {
    const root = element.firstElementChild
    return {
      descendantCount: element.querySelectorAll('*').length,
      kind: element.getAttribute('data-config-node-kind'),
      nodeClasses: [...element.classList].sort(),
      rootClasses: root ? [...root.classList].sort() : [],
      rootTag: root?.tagName ?? null,
    }
  })
}

async function visibleBox(locator: Locator, options: { timeout?: number } = {}): Promise<DragGeometry & { x: number, y: number }> {
  await expect(locator).toBeVisible({ timeout: options.timeout })
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
  const nodeId = await node.getAttribute('data-config-node-id')
  expect(nodeId).toBeTruthy()
  const box = await visibleBox(hitTarget)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.locator(`[data-editor-focus-node-id="${nodeId}"]`)).toBeVisible()
}

async function pointerDrop(
  page: Page,
  materialKey: string,
  target: Locator,
  options: { verifyCommitGeometry?: boolean } = {},
): Promise<DragResult> {
  const source = page.locator(`[data-material-key="${materialKey}"]`)
  await source.scrollIntoViewIfNeeded()
  const sourceBox = await visibleBox(source)
  const targetBox = await attachedBox(target)

  await page.mouse.move(sourceBox.x + Math.min(24, sourceBox.width / 2), sourceBox.y + Math.min(24, sourceBox.height / 2))
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + sourceBox.width + 12, sourceBox.y + sourceBox.height / 2, { steps: 4 })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + Math.min(targetBox.height / 2, 72), { steps: 12 })

  const candidate = designRuntime(page).locator('[data-config-node-state~="candidate"]')
  const candidateBox = await attachedBox(candidate)
  const nodeId = await candidate.getAttribute('data-config-node-id')
  expect(nodeId).toBeTruthy()

  const overlay = page.locator('[data-designer-drag-overlay]:visible')
  const overlayBox = await visibleBox(overlay)
  const dragVisualNode = dragVisualRuntime(page).locator(`[data-config-node-id="${nodeId}"]`)
  const dragVisualBox = await attachedBox(dragVisualNode)
  expectSameSize(dragVisualBox, candidateBox)
  const dragVisualSignature = await runtimeNodeSignature(dragVisualNode)
  expect(dragVisualSignature).toEqual(await runtimeNodeSignature(candidate))
  expect(dragVisualSignature.kind).toBeTruthy()
  expect([...dragVisualSignature.nodeClasses, ...dragVisualSignature.rootClasses].length).toBeGreaterThan(0)
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
  const committed = designRuntime(page).locator(`[data-config-node-id="${nodeId}"]`)
  const committedBox = collapsed ? await attachedBox(committed) : await visibleBox(committed)
  if (options.verifyCommitGeometry !== false)
    expectSameSize(committedBox, candidateBox)
  await expect(designRuntime(page).locator('[data-config-node-state~="candidate"]')).toHaveCount(0)

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

  const candidate = designRuntime(page).locator('[data-config-node-state~="candidate"]')
  const candidateBox = await visibleBox(candidate)
  const nodeId = await candidate.getAttribute('data-config-node-id')
  expect(nodeId).toBeTruthy()
  await expect(page.locator('[data-designer-drag-overlay]:visible')).toBeVisible()

  await dispatchTouch(client, 'touchEnd')
  await client.detach()
  const committed = designRuntime(page).locator(`[data-config-node-id="${nodeId}"]`)
  const committedBox = await visibleBox(committed)
  expectSameSize(committedBox, candidateBox)
  return { geometry: committedBox, node: committed, nodeId: nodeId! }
}

async function expectAllPaletteItems(page: Page, prefix: 'antd' | 'element', expectedCount: number): Promise<void> {
  const navigationTabs = page.locator('.designer-left-tabs [role="tab"]')
  await expect(navigationTabs).toHaveCount(4)
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
  const materialKeys = await materials.evaluateAll(elements => elements.map(element => (
    element.getAttribute('data-material-row-key')
  )))
  expect(materialKeys).toHaveLength(expectedCount)

  for (const materialKey of materialKeys) {
    expect(materialKey).toBeTruthy()
    const material = page.locator(`[data-material-row-key="${materialKey}"]`)
    await material.scrollIntoViewIfNeeded()
    await expect(material).toBeVisible()
    const geometry = await material.evaluate((element) => {
      const row = element.getBoundingClientRect()
      const summary = element.querySelector('.mx-config-form-designer__palette-item-summary')?.getBoundingClientRect()
      return {
        row: { height: row.height, width: row.width },
        summary: summary ? { height: summary.height, width: summary.width } : undefined,
      }
    })
    expect(geometry.row.height).toBeGreaterThanOrEqual(44)
    expect(geometry.summary?.height ?? 0).toBeGreaterThan(0)
    expect(geometry.summary?.width ?? 0).toBeGreaterThan(0)
    await expect(material.locator('.mx-config-form-designer__palette-item-name')).not.toHaveText('')
    await expect(material.locator('svg, .mx-config-form-designer__palette-icon')).toHaveCount(1)
    await expect(material.locator('[data-specimen-node-id], .mx-config-form-designer__palette-item-preview')).toHaveCount(0)
  }
}

async function expectInspectorTabs(page: Page, expected: string[]): Promise<void> {
  const tabs = page.locator('.mx-config-form-designer__properties .mx-config-form-designer__tabs > [role="tab"]')
  await expect(tabs).toHaveText(expected)
}

async function expectInspectorTabGeometry(page: Page, expectedPanelWidth?: number): Promise<void> {
  const panel = page.locator('.mx-config-form-designer__properties')
  const tabs = panel.locator('.mx-config-form-designer__tabs > [role="tab"]')
  await expect(panel).toBeVisible()
  await tabs.last().click()
  await expect(tabs.last()).toHaveAttribute('aria-selected', 'true')
  await expect.poll(() => panel.evaluate((element) => {
    const track = element.querySelector<HTMLElement>('.mx-config-form-designer__tabs')
    const active = track?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    if (!track || !active)
      return false
    const trackRect = track.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    return activeRect.left >= trackRect.left - 1 && activeRect.right <= trackRect.right + 1
  })).toBe(true)

  const geometry = await panel.evaluate((element) => {
    const panelRect = element.getBoundingClientRect()
    const track = element.querySelector<HTMLElement>('.mx-config-form-designer__tabs')!
    const trackRect = track.getBoundingClientRect()
    const tabRects = [...track.querySelectorAll<HTMLElement>('[role="tab"]')].map((tab) => {
      const rect = tab.getBoundingClientRect()
      return {
        bottom: rect.bottom,
        clientWidth: tab.clientWidth,
        height: rect.height,
        scrollWidth: tab.scrollWidth,
        top: rect.top,
        width: rect.width,
      }
    })
    return {
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      panelWidth: panelRect.width,
      tabRects,
      track: {
        clientWidth: track.clientWidth,
        flexWrap: getComputedStyle(track).flexWrap,
        height: trackRect.height,
        overflowX: getComputedStyle(track).overflowX,
        scrollWidth: track.scrollWidth,
      },
    }
  })
  expect(geometry.documentScrollWidth).toBeLessThanOrEqual(geometry.documentClientWidth + 1)
  if (expectedPanelWidth !== undefined)
    expect(Math.abs(geometry.panelWidth - expectedPanelWidth)).toBeLessThanOrEqual(1)
  expect(geometry.track.flexWrap).toBe('nowrap')
  expect(geometry.track.overflowX).toBe('auto')
  expect(geometry.track.scrollWidth).toBeGreaterThanOrEqual(geometry.track.clientWidth)
  expect(Math.max(...geometry.tabRects.map(rect => rect.top)) - Math.min(...geometry.tabRects.map(rect => rect.top))).toBeLessThanOrEqual(1)
  for (const tab of geometry.tabRects) {
    expect(tab.width).toBeGreaterThan(0)
    expect(tab.height).toBeGreaterThan(0)
    expect(tab.bottom).toBeLessThanOrEqual(geometry.tabRects[0]!.top + geometry.track.height + 1)
    expect(tab.scrollWidth).toBeLessThanOrEqual(tab.clientWidth + 1)
  }
}

async function expectCompactResponsiveFieldsReadable(page: Page): Promise<void> {
  const fields = page.locator('.mx-config-form-designer__properties .mx-config-form-designer__responsive-fields')
  await expect(fields).toHaveCount(2)
  const geometry = await fields.evaluateAll(elements => elements.map((element) => {
    const setters = [...element.querySelectorAll<HTMLElement>('.mx-config-form-designer-property-form__field')]
    return {
      columns: getComputedStyle(element).gridTemplateColumns,
      setters: setters.map((setter) => {
        const rect = setter.getBoundingClientRect()
        const label = setter.querySelector<HTMLElement>('.mx-config-form-designer-property-form__label')
        return {
          bottom: rect.bottom,
          labelFits: !label || label.scrollWidth <= label.clientWidth + 1,
          hintFits: !setter.dataset.hintLabel || Boolean(label && label.scrollWidth <= label.clientWidth + 1),
          top: rect.top,
        }
      }),
    }
  }))
  for (const row of geometry) {
    expect(row.setters).toHaveLength(2)
    expect(row.columns.trim().split(/\s+/)).toHaveLength(1)
    expect(row.setters[1]!.top).toBeGreaterThanOrEqual(row.setters[0]!.bottom - 1)
    expect(row.setters.every(setter => setter.labelFits && setter.hintFits)).toBe(true)
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

const visualCases = [
  ...(['catppuccin', 'kanagawa', 'gruvbox', 'rose-pine'] as const).flatMap(palette =>
    (['light', 'dark'] as const).map(theme => ({ height: 1000, locale: 'en' as const, palette, theme, width: 1440 }))),
  { height: 900, locale: 'zh', palette: 'catppuccin', theme: 'light', width: 900 },
  { height: 900, locale: 'en', palette: 'kanagawa', theme: 'dark', width: 900 },
  { height: 844, locale: 'en', palette: 'gruvbox', theme: 'light', width: 390 },
  { height: 844, locale: 'zh', palette: 'rose-pine', theme: 'dark', width: 390 },
] as const

for (const visualCase of visualCases) {
  const { height, locale, palette, theme, width } = visualCase
  test(`matches the ${width}px ${palette} ${theme} ${locale} workbench visual contract`, async ({ page }) => {
    await page.setViewportSize({ height, width })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await restoreAppearance(page, theme, palette)
    await createProject(page, 'element')
    if (width === 1440)
      await expectCompactResponsiveFieldsReadable(page)
    if (locale === 'zh')
      await chooseResponsiveTopbarAction(page, width, 'Switch to Chinese')
    await page.keyboard.press('Escape')
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.locator('.workbench-layout').hover({ position: { x: 2, y: 2 } })
    await expect(page.locator('.workbench-command-tooltip:visible')).toHaveCount(0)
    await expect(page.locator('iframe[data-design-runtime-variant="canvas"]')).toBeVisible()
    await expect(page.locator('.mx-config-form-designer__camera-controls')).toBeVisible()
    await expect(page.locator('.workbench-app')).toHaveScreenshot(
      `workbench-${width}-${palette}-${theme}-${locale}.png`,
      { animations: 'disabled' },
    )
  })
}

test('provides focus and Escape command hints, including disabled reasons and real shortcuts', async ({ page }) => {
  await createProject(page, 'element')
  const undo = page.getByRole('button', { name: 'Undo' })
  await expect(undo).toHaveAttribute('aria-disabled', 'true')
  await undo.focus()
  const tooltip = page.locator('.workbench-command-tooltip:visible')
  await expect(tooltip).toContainText('Undo · Ctrl/Cmd+Z · No operation to undo')
  await expect(tooltip).toHaveClass(/is-light/)
  const tooltipColors = await tooltip.evaluate((element) => {
    const arrow = element.querySelector('.el-popper__arrow')
    return {
      arrow: arrow ? getComputedStyle(arrow, '::before').backgroundColor : '',
      body: getComputedStyle(element).backgroundColor,
    }
  })
  expect(tooltipColors.arrow).toBe(tooltipColors.body)
  const tooltipId = await tooltip.getAttribute('id')
  expect(tooltipId).toBeTruthy()
  expect(await undo.getAttribute('aria-describedby')).toContain(tooltipId)
  await page.keyboard.press('Escape')
  await expect(tooltip).toHaveCount(0)

  await undo.evaluate(element => (element as HTMLElement).blur())
  await undo.focus()
  await expect(tooltip).toContainText('Undo · Ctrl/Cmd+Z · No operation to undo')
  const zoomOut = page.getByRole('button', { name: 'Zoom out' })
  await zoomOut.hover()
  await expect(tooltip).toHaveCount(1)
  await expect(tooltip).toHaveText('Zoom out · -')

  for (let attempt = 0; attempt < 8 && await zoomOut.getAttribute('aria-disabled') !== 'true'; attempt += 1)
    await zoomOut.click()
  await expect(zoomOut).toHaveAttribute('aria-disabled', 'true')
  await page.locator('.workbench-layout').hover({ position: { x: 2, y: 2 } })
  await zoomOut.evaluate(element => (element as HTMLElement).blur())
  await zoomOut.focus()
  await expect(tooltip).toHaveText('Zoom out · - · Minimum zoom reached')
  await page.keyboard.press('Escape')
  await expect(tooltip).toHaveCount(0)

  const desktop = page.getByRole('button', { name: 'Desktop' })
  const tablet = page.getByRole('button', { name: 'Tablet' })
  await tablet.hover()
  await desktop.hover()
  await expect(page.locator('.workbench-command-tooltip:visible')).toHaveText('Desktop')
  await page.keyboard.press('Escape')
  await desktop.dispatchEvent('pointerover', { pointerType: 'touch' })
  await page.waitForTimeout(400)
  await expect(page.locator('.workbench-command-tooltip:visible')).toHaveCount(0)

  await page.getByRole('button', { name: 'Show preview' }).click()
  await expect(page.getByRole('complementary', { name: 'Page preview' })).toBeVisible()
  await page.waitForTimeout(400)
  await expect(page.locator('.workbench-command-tooltip:visible')).toHaveCount(0)
  await page.keyboard.press('Tab')
  await page.getByRole('button', { name: 'Mobile preview' }).focus()
  await expect(page.locator('.workbench-command-tooltip:visible')).toHaveText('Mobile preview')
})

test('keeps status and lower-priority commands reachable without topbar overflow at 900 and 390', async ({ page }) => {
  await createProject(page, 'element')
  await page.setViewportSize({ width: 900, height: 900 })
  await expectTopbarFits(page)
  await expect(page.getByRole('button', { name: 'Save options' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show preview' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New page' })).toBeHidden()

  const more = page.getByRole('button', { name: 'More actions' })
  await more.click()
  const menu = page.locator('[data-mobile-action-menu]')
  await expect(menu.getByRole('status')).toContainText(/^v\d+ · /)
  await expect(page.getByRole('button', { name: 'Manage pages' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Manage pages' })).toHaveCount(0)
  await expect(menu.getByRole('menuitem', { name: 'Save' })).toHaveCount(0)
  await expect(menu.getByRole('menuitem', { name: 'Create named checkpoint' })).toHaveCount(0)
  await expect(menu.getByRole('menuitem', { name: 'Version history' })).toHaveCount(0)
  await expect(menu.getByRole('menuitem', { name: 'New page' })).toBeVisible()
  await menu.getByRole('menuitem', { name: 'Switch to Chinese' }).click()
  await expect(page.getByRole('button', { name: '更多操作' })).toBeVisible()
  await expectTopbarFits(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectTopbarFits(page)
  await expect(page.getByRole('button', { name: '保存选项' })).toBeVisible()
  await expect(page.getByRole('button', { name: '导出' })).toBeVisible()
  await expect(page.getByRole('button', { name: '显示预览' })).toBeVisible()
  await page.getByRole('button', { name: '更多操作' }).click()
  await expect(page.getByRole('button', { name: '管理页面' })).toBeHidden()
  await expect(page.locator('[data-mobile-action-menu]').getByRole('menuitem', { name: '管理页面' })).toBeVisible()
  await expect(page.locator('[data-mobile-action-menu]').getByRole('menuitem', { name: '保存' })).toHaveCount(0)
  await expect(page.locator('[data-mobile-action-menu]').getByRole('status')).toContainText(/^v\d+ · /)
  await page.locator('[data-mobile-action-menu]').press('Escape')
  await expect(page.getByRole('button', { name: '更多操作' })).toBeFocused()
})

test('keeps the empty canvas hint out of runtime geometry and removes it after adding a material', async ({ page }) => {
  await createProject(page, 'element')
  await page.getByRole('tab', { name: 'Layers' }).click()
  for (const nodeId of ['profile-name', 'profile-role']) {
    await page.locator(`[data-layer-id^="${nodeId}-"] .designer-layer-select`).click()
    await page.keyboard.press('Delete')
  }

  const sheet = page.locator('.mx-config-form-designer__canvas-sheet')
  const before = await visibleBox(sheet)
  await page.locator('[data-layer-id^="profile-active-"] .designer-layer-select').click()
  await page.keyboard.press('Delete')
  const empty = page.locator('.mx-config-form-designer__canvas-empty')
  await expect(empty).toHaveText('Drag or click a component on the left to add a field')
  expect(await empty.evaluate(element => ({
    pointerEvents: getComputedStyle(element).pointerEvents,
    position: getComputedStyle(element).position,
  }))).toEqual({ pointerEvents: 'none', position: 'absolute' })
  expectSameRect(await visibleBox(sheet), before)
  await expect(page.locator('.mx-config-form-designer__canvas')).toHaveAttribute('aria-describedby', await empty.getAttribute('id') ?? '')

  await page.getByRole('tab', { name: 'Components' }).click()
  await page.locator('[data-material-key="element.input"]').click()
  await expect(empty).toHaveCount(0)
  await page.getByRole('button', { name: 'Show preview' }).click()
  await expect(previewRuntime(page).locator('[data-config-node-id] input')).toBeVisible()
})

test('keeps Camera inside the canvas lower right without covering selected node actions', async ({ page }) => {
  await createProject(page, 'element')
  const node = designRuntime(page).locator('[data-config-node-id^="profile-name-"]')
  await selectCanvasNode(page, node, node.locator('input').first())

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 900, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    if (viewport.width === 390)
      await page.locator('[data-mobile-studio-tab="canvas"]').click()
    const canvas = page.locator('.mx-config-form-designer__canvas')
    const { cameraBox, canvasBox, toolbarBox } = await canvas.evaluate((element) => {
      const camera = element.querySelector<HTMLElement>('.mx-config-form-designer__camera-controls')
      const toolbar = element.querySelector<HTMLElement>('.mx-config-form-designer__node-actions')
      if (!camera || !toolbar)
        throw new Error('Canvas camera and selected node actions must be visible.')
      const rectangle = (target: Element): DragGeometry => {
        const rect = target.getBoundingClientRect()
        return { height: rect.height, width: rect.width, x: rect.x, y: rect.y }
      }
      return {
        cameraBox: rectangle(camera),
        canvasBox: rectangle(element),
        toolbarBox: rectangle(toolbar),
      }
    })
    expect(cameraBox.x + cameraBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width - 8)
    expect(cameraBox.y + cameraBox.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height - 8)
    expect(cameraBox.x).toBeGreaterThan(canvasBox.x + canvasBox.width / 2)
    expect(rectsIntersect(cameraBox, toolbarBox)).toBe(false)
  }
})

for (const adapter of [
  { id: 'element', name: 'Element' },
  { id: 'antd', name: 'Ant' },
] as const) {
  test(`keeps ${adapter.name} keyboard editing, undo notice, and local history on one project timeline`, async ({ page }) => {
    await createProject(page, adapter.id)
    await page.getByRole('tab', { name: 'Layers' }).click()

    const layers = page.getByRole('treeitem')
    const nameLayer = page.locator('[data-layer-id^="profile-name-"] .designer-layer-select')
    const roleLayer = page.locator('[data-layer-id^="profile-role-"] .designer-layer-select')
    await roleLayer.click()
    const propertyInput = page.locator('[data-workspace-panel="properties"] input').first()
    await expect(propertyInput).toBeVisible()
    await propertyInput.focus()
    await page.keyboard.press('Control+D')
    await page.keyboard.press('Delete')
    await expect(layers).toHaveCount(3)

    await page.getByRole('button', { name: 'Show preview' }).click()
    const previewInput = previewRuntime(page).locator('[data-config-node-id^="profile-name-"] input').first()
    await previewInput.focus()
    await page.keyboard.press('Control+D')
    await page.keyboard.press('Delete')
    await page.getByRole('button', { name: 'Close preview' }).click()
    await expect(layers).toHaveCount(3)

    await nameLayer.click()
    await roleLayer.click({ modifiers: ['Control'] })
    await expect(page.locator('[role="treeitem"][aria-selected="true"]')).toHaveCount(2)
    const copyButton = page.getByRole('button', { name: 'Copy selection' })
    await expect(copyButton).toHaveAttribute('aria-keyshortcuts', 'Control+D Meta+D')
    await page.keyboard.press('Control+D')
    await expect(layers).toHaveCount(5)
    await expect(page.locator('[role="treeitem"][aria-selected="true"]')).toHaveCount(2)

    await page.keyboard.press('Delete')
    await expect(layers).toHaveCount(3)
    const notice = page.locator('.workbench-toast')
    await expect(notice).toContainText('Deleted. Undo to restore.')
    await notice.getByRole('button', { name: 'Undo' }).click()
    await expect(notice).toHaveCount(0)
    await expect(layers).toHaveCount(5)

    await page.getByRole('tab', { name: 'History' }).click()
    const historyPanel = page.locator('.designer-history-panel')
    await expect(historyPanel).toContainText('1 of 2')
    await expect(historyPanel).toContainText('Duplicate components')
    await expect(historyPanel).toContainText('Remove components')
    await historyPanel.getByRole('button', { name: 'Earliest retained state' }).click()

    await page.getByRole('tab', { name: 'Layers' }).click()
    await expect(layers).toHaveCount(3)
    await nameLayer.click()
    await page.keyboard.press('Control+D')
    await expect(layers).toHaveCount(4)

    await page.getByRole('tab', { name: 'History' }).click()
    await expect(historyPanel).toContainText('1 of 1')
    await expect(historyPanel).toContainText('Duplicate component')
    await expect(historyPanel).not.toContainText('Remove components')
    await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })
}

for (const adapter of [
  { count: 17, id: 'element', name: 'Element' },
  { count: 22, id: 'antd', name: 'Ant' },
] as const) {
  test(`renders every registered ${adapter.name} material as a dense icon and name row`, async ({ page }) => {
    await createProject(page, adapter.id)
    await expectAllPaletteItems(page, adapter.id, adapter.count)
  })

  test(`projects the ${adapter.name} Inspector capability matrix from Registry contracts`, async ({ page }) => {
    await createProject(page, adapter.id)
    const scenarios = [
      { material: 'input', tabs: ['Properties', 'Validation', 'Events', 'Bindings', 'Conditions', 'Reactions'] },
      { material: 'switch', tabs: ['Properties', 'Validation', 'Events', 'Bindings', 'Conditions', 'Reactions'] },
      { material: 'section', tabs: ['Properties', 'Conditions', 'Reactions'] },
      { material: 'grid', tabs: ['Properties', 'Conditions', 'Reactions'] },
      { material: 'tabs', tabs: ['Properties', 'Events', 'Conditions', 'Reactions'] },
      { material: 'collapse', tabs: ['Properties', 'Events', 'Conditions', 'Reactions'] },
    ]

    for (const scenario of scenarios) {
      await page.locator(`[data-material-key="${adapter.id}.${scenario.material}"]`).click()
      await expectInspectorTabs(page, scenario.tabs)
      if (scenario.material === 'input')
        await expectInspectorTabGeometry(page, 304)
    }
  })

  test(`keeps the ${adapter.name} design runtime inert while Preview stays interactive`, async ({ page }) => {
    await createProject(page, adapter.id)
    const canvas = page.locator('.mx-config-form-designer__canvas')
    const sheet = canvas.locator('.mx-config-form-designer__canvas-sheet')
    const runtime = designRuntime(page)
    const runtimeForm = runtime.locator('form')
    const nameNode = runtime.locator('[data-config-node-id^="profile-name-"]')
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

    const selection = canvas.locator('[data-editor-focus-node-id^="profile-name-"]')
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
    await expectInspectorTabs(page, ['Properties', 'Validation', 'Events', 'Bindings', 'Conditions', 'Reactions'])
    await expectInspectorTabGeometry(page, 304)

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
    const previewInput = previewRuntime(page).locator('[data-config-node-id^="profile-name-"] input').first()
    await previewInput.fill('Preview value')
    await expect(previewInput).toHaveValue('Preview value')
    await expect(previewInput).toBeFocused()
    const runtimeStyle = await previewInput.evaluate((element) => {
      const style = getComputedStyle(element)
      return { backgroundColor: style.backgroundColor, color: style.color }
    })
    await setAppearance(page, 'light', 'rose-pine')
    expect(await previewInput.evaluate((element) => {
      const style = getComputedStyle(element)
      return { backgroundColor: style.backgroundColor, color: style.color }
    })).toEqual(runtimeStyle)
  })
}

test('keeps pointer candidates, drag visuals, committed nodes, and Preview on the same Element runtime tree', async ({ page }) => {
  await createProject(page, 'element')
  const canvas = page.locator('.mx-config-form-designer__canvas')

  const section = await pointerDrop(page, 'element.section', canvas)
  const flex = await pointerDrop(page, 'element.flex', section.node)
  const input = await pointerDrop(page, 'element.input', flex.node)
  await expect(input.node.locator('.el-input')).toBeVisible()
  await expect(section.node.locator(`[data-config-node-id="${flex.nodeId}"] [data-config-node-id="${input.nodeId}"]`)).toBeVisible()

  await page.getByRole('button', { name: 'Show preview' }).click()
  const previewInput = previewRuntime(page).locator(`[data-config-node-id="${input.nodeId}"]`)
  await expect(previewInput.locator('.el-input')).toBeVisible()
})

test('removes stale selection chrome while a pointer drag is active', async ({ page }) => {
  await createProject(page, 'element')
  const canvas = page.locator('.mx-config-form-designer__canvas')
  const selectedNode = designRuntime(page).locator('[data-config-node-id^="profile-name-"]')
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

  await expect(designRuntime(page).locator('[data-config-node-state~="candidate"]')).toHaveCount(1)
  await expect(canvas).toHaveAttribute('data-editor-overlay-mode', 'pointer-dragging')
  await expect(canvas.locator('.mx-config-form-designer__selection-box')).toHaveCount(0)
  await expect(canvas.locator('[data-designer-drag-overlay]:visible')).toBeVisible()
  await page.mouse.up()
})

test('edits Flow settings through Element Plus keyboard and numeric controls', async ({ page }) => {
  await createProject(page, 'element')
  await page.getByRole('button', { name: 'Event flow orchestration' }).click()
  const flowDialog = page.getByRole('dialog', { name: 'Event flow orchestration' })
  await flowDialog.getByRole('button', { name: 'Choose an event' }).click()
  await page.locator('.flow-trigger-popper:visible').getByRole('menuitem').filter({ hasText: 'Form submit' }).click()

  const flowInspector = flowDialog.getByRole('complementary', { name: 'Event flow inspector' })
  const concurrency = flowInspector.locator('[data-flow-control="concurrency"]')
  await concurrency.getByRole('combobox').focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(concurrency).toContainText('Queue')

  const timeout = flowInspector.getByRole('spinbutton', { name: 'Timeout (ms)' })
  await timeout.fill('1200')
  await timeout.press('Enter')
  await expect(timeout).toHaveValue('1200')
})

for (const adapter of ['element', 'antd'] as const) {
  test(`keeps the ${adapter} 900px canvas active while stable triggers open non-modal sidebars`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 })
    await createProject(page, adapter)

    const designer = page.locator('.mx-config-form-design-surface')
    const workspace = designer.locator('.mx-config-form-designer__workspace')
    const canvasPanel = designer.locator('[data-workspace-panel="canvas"]')
    const palettePanel = designer.locator('[data-workspace-panel="palette"]')
    const propertiesPanel = designer.locator('[data-workspace-panel="properties"]')
    const paletteTrigger = designer.locator('[data-sidebar-trigger="palette"]')
    const propertiesTrigger = designer.locator('[data-sidebar-trigger="properties"]')

    await expect(designer).toHaveAttribute('data-workspace-mode', 'medium')
    await expect(canvasPanel).toBeVisible()
    await expect(palettePanel).toBeHidden()
    await expect(propertiesPanel).toBeHidden()
    await expect(paletteTrigger).toHaveAttribute('aria-expanded', 'false')
    await expect(propertiesTrigger).toHaveAttribute('aria-expanded', 'false')
    const initialWorkspace = await visibleBox(workspace)

    await paletteTrigger.click()
    await expect(paletteTrigger).toHaveAttribute('aria-expanded', 'true')
    await expect(palettePanel).toBeVisible()
    await expect(propertiesPanel).toBeHidden()
    await expect(canvasPanel).toBeVisible()
    expectSameSize(await visibleBox(workspace), initialWorkspace)

    await propertiesTrigger.click()
    await expect(palettePanel).toBeHidden()
    await expect(propertiesPanel).toBeVisible()
    await expect(propertiesTrigger).toHaveAttribute('aria-expanded', 'true')
    await expect(canvasPanel).toBeVisible()
    expectSameSize(await visibleBox(workspace), initialWorkspace)

    const nameNode = designRuntime(page).locator('[data-config-node-id^="profile-name-"]')
    await selectCanvasNode(page, nameNode, nameNode.locator('input').first())
    const selection = page.locator('[data-editor-focus-node-id^="profile-name-"]')
    await expect(propertiesPanel).toBeVisible()
    await expect(selection).toBeFocused()
    await expectInspectorTabs(page, ['Properties', 'Validation', 'Events', 'Bindings', 'Conditions', 'Reactions'])
    await expectInspectorTabGeometry(page, 304)
    await selection.focus()
    await page.keyboard.press('Escape')
    await expect(propertiesPanel).toBeHidden()
    await expect(selection).toBeFocused()

    const overflow = await designer.evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)
  })
}

for (const adapter of ['element', 'antd'] as const) {
  test(`keeps the ${adapter} 390px Inspector tabs on one reachable track`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await createProject(page, adapter)
    await page.getByRole('tab', { name: 'Layers' }).click()
    await page.locator('[data-layer-id^="profile-name-"] .designer-layer-select').click()
    await page.getByRole('tab', { name: 'Inspector' }).click()
    await expectInspectorTabs(page, ['Properties', 'Validation', 'Events', 'Bindings', 'Conditions', 'Reactions'])
    await expectInspectorTabGeometry(page)
  })

  test(`removes and restores a ${adapter} selection-incompatible stored binding`, async ({ page }) => {
    await createProject(page, adapter)
    await page.getByRole('tab', { name: 'Layers' }).click()
    await page.locator('[data-layer-id^="profile-name-"] .designer-layer-select').click()
    await page.getByRole('tab', { name: 'Bindings' }).click()
    const source = page.getByRole('tabpanel', { name: 'Bindings' }).getByRole('textbox', { name: 'value' })
    await source.fill('profile.source')
    await source.press('Enter')

    await page.getByRole('tab', { name: 'Components' }).click()
    await page.locator(`[data-material-key="${adapter}.section"]`).click()
    await page.getByRole('tab', { name: 'Layers' }).click()
    await page.locator('[data-layer-id^="profile-name-"] .designer-layer-select').click({ modifiers: ['Control'] })
    await expect(page.locator('[role="treeitem"][aria-selected="true"]')).toHaveCount(2)

    await page.getByRole('tab', { name: 'Bindings' }).click()
    const stale = page.locator('[data-stale-kind="selection-incompatible"][data-stale-node-id^="profile-name-"]')
    await expect(stale).toContainText('value')
    await expect(stale).toContainText('profile.source')
    const staleKey = stale.locator('code')
    await staleKey.evaluate((element) => {
      element.textContent = 'stored.binding.key.that.must.remain.fully.readable.at.compact.inspector.width'
    })
    const staleGeometry = await stale.evaluate((element) => {
      const key = element.querySelector<HTMLElement>('code')!
      const remove = element.querySelector<HTMLElement>('[data-stale-remove]')!
      const itemRect = element.getBoundingClientRect()
      const removeRect = remove.getBoundingClientRect()
      return {
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        keyOverflowWrap: getComputedStyle(key).overflowWrap,
        keyWhiteSpace: getComputedStyle(key).whiteSpace,
        removeInside: removeRect.left >= itemRect.left && removeRect.right <= itemRect.right,
        removeWidth: removeRect.width,
      }
    })
    expect(staleGeometry.keyOverflowWrap).toBe('anywhere')
    expect(staleGeometry.keyWhiteSpace).toBe('normal')
    expect(staleGeometry.removeInside).toBe(true)
    expect(staleGeometry.removeWidth).toBeGreaterThan(0)
    expect(staleGeometry.documentScrollWidth).toBeLessThanOrEqual(staleGeometry.documentClientWidth + 1)
    await stale.getByRole('button', { name: 'Delete stored configuration value' }).click()
    await expect(page.getByRole('tab', { name: 'Bindings' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Properties' })).toHaveAttribute('aria-selected', 'true')

    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await page.getByRole('tab', { name: 'Bindings' }).click()
    await expect(stale).toContainText('profile.source')
  })
}

test('keeps a compact Preview inside its own responsive runtime viewport', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 })
  await createProject(page, 'element')
  const roleNode = designRuntime(page).locator('[data-config-node-id^="profile-role-"]')
  await selectCanvasNode(page, roleNode, roleNode.locator('.el-select__wrapper'))
  await page.getByRole('button', { name: 'Show preview' }).click()

  const preview = page.getByRole('complementary', { name: 'Page preview' })
  const stage = preview.locator('.preview-stage')
  const runtime = previewRuntime(page)
  const layout = runtime.locator('[data-config-form-responsive-layout]').first()
  const cells = runtime.locator('[data-config-form-responsive-cell]')
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
  const overflow = await runtime.locator('html').evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)

  await runtime.locator('[data-config-node-id^="profile-role-"] .el-select__wrapper').click()
  await expect(runtime.getByRole('option', { name: 'Developer' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Developer' })).toHaveCount(0)
  await page.keyboard.press('Escape')
})

for (const adapter of [
  { id: 'element', name: 'Element' },
  { id: 'antd', name: 'Ant' },
] as const) {
  test(`shows the submitted runtime JSON in the ${adapter.name} Preview testbench`, async ({ page }) => {
    await createProject(page, adapter.id)
    await page.getByRole('button', { name: 'Show preview' }).click()

    const preview = page.getByRole('complementary', { name: 'Page preview' })
    const input = previewRuntime(page).getByRole('textbox', { name: 'Name', exact: true })
    await input.fill(`${adapter.name} preview value`)
    await expect(input).toHaveValue(`${adapter.name} preview value`)
    await preview.getByRole('button', { name: 'Submit preview form' }).click()

    const result = preview.locator('[data-preview-submission-json]')
    await expect(result).toContainText(`${adapter.name} preview value`)
    await expect(preview.locator('[data-preview-results]')).toContainText('Submitted successfully')
  })
}

test('separates the intrinsic canvas frame from fit, manual zoom, and pan state', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 })
  await createProject(page, 'element')
  await page.getByRole('button', { name: 'Desktop' }).click()

  const canvas = page.locator('.mx-config-form-designer__canvas')
  const viewport = page.locator('[data-canvas-camera-viewport]')
  const sheet = page.locator('.mx-config-form-designer__canvas-sheet')
  const runtimeFrame = page.locator('iframe[data-design-runtime-variant="canvas"]')
  await expect(sheet).toHaveAttribute('data-intrinsic-width', '900')
  expect(await sheet.evaluate(element => getComputedStyle(element).width)).toBe('900px')
  await runtimeFrame.evaluate(element => element.setAttribute('data-camera-runtime-identity', 'stable'))

  await page.getByRole('button', { name: 'Actual size' }).click()
  await expect(canvas).toHaveAttribute('data-camera-scale', '1')
  await expect.poll(() => viewport.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)

  await page.getByRole('button', { name: 'Zoom out' }).click()
  await expect(canvas).toHaveAttribute('data-camera-scale', '0.8')
  const nameNode = designRuntime(page).locator('[data-config-node-id^="profile-name-"]')
  await selectCanvasNode(page, nameNode, nameNode.locator('input').first())
  expectSameRect(
    await visibleBox(page.locator('[data-editor-focus-node-id^="profile-name-"]')),
    await visibleBox(nameNode),
  )

  await page.getByRole('button', { name: 'Actual size' }).click()
  await expect(canvas).toHaveAttribute('data-camera-scale', '1')
  await canvas.focus()
  const viewportBox = await visibleBox(viewport)
  await page.keyboard.down('Space')
  await page.mouse.move(viewportBox.x + viewportBox.width * 0.75, viewportBox.y + 96)
  await page.mouse.down()
  await page.mouse.move(viewportBox.x + viewportBox.width * 0.35, viewportBox.y + 96, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Space')
  expect(await viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)

  await canvas.hover()
  await page.keyboard.press('Shift+1')
  await expect(canvas).toHaveAttribute('data-camera-mode', 'fit')
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBe(0)
  await expect(runtimeFrame).toHaveAttribute('data-camera-runtime-identity', 'stable')
  await expect(sheet).toHaveAttribute('data-intrinsic-width', '900')
})

test('keeps mobile and desktop intrinsic frames stable inside a 390px workbench', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await createProject(page, 'element')
  const canvas = page.locator('.mx-config-form-designer__canvas')
  const viewport = page.locator('[data-canvas-camera-viewport]')
  const sheet = page.locator('.mx-config-form-designer__canvas-sheet')

  await page.getByRole('button', { name: 'Mobile' }).click()
  await expect(sheet).toHaveAttribute('data-intrinsic-width', '390')
  expect(await sheet.evaluate(element => ({
    padding: getComputedStyle(element).padding,
    width: getComputedStyle(element).width,
  }))).toEqual({ padding: '28px', width: '390px' })

  await page.getByRole('button', { name: 'Desktop' }).click()
  await page.getByRole('button', { name: 'Fit canvas' }).click()
  await expect(sheet).toHaveAttribute('data-intrinsic-width', '900')
  expect(await sheet.evaluate(element => getComputedStyle(element).width)).toBe('900px')
  expect(Number(await canvas.getAttribute('data-camera-scale'))).toBeLessThan(0.5)

  await page.getByRole('button', { name: 'Actual size' }).click()
  await expect(canvas).toHaveAttribute('data-camera-scale', '1')
  await expect.poll(() => viewport.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
})

for (const adapter of ['element', 'antd'] as const) {
  test(`runs a ${adapter} component event flow from the real Preview Runtime node`, async ({ page }) => {
    await createProject(page, adapter)

    await page.getByRole('button', { name: 'Event flow orchestration' }).click()
    const flowDialog = page.getByRole('dialog', { name: 'Event flow orchestration' })
    await flowDialog.getByRole('button', { name: 'Choose an event' }).click()
    await page.locator('.flow-trigger-popper:visible').getByRole('menuitem').filter({ hasText: 'Name · Value change' }).click()

    const flowInspector = flowDialog.getByRole('complementary', { name: 'Event flow inspector' })
    const eventTarget = flowInspector.locator('[data-flow-control="event-target"]')
    await expect(eventTarget).toContainText('Name · Value change')
    await expect(eventTarget).toHaveAttribute('data-selected-value', /profile-name/)

    await flowDialog.getByRole('button', { name: 'Action', exact: true }).click()
    await flowInspector.getByRole('textbox', { name: 'Node config' }).fill(`{"input":"${adapter}-component-event"}`)
    await flowDialog.getByRole('button', { name: 'Close event flow orchestration' }).click()

    await page.getByRole('button', { name: 'Show preview' }).click()
    await previewRuntime(page).getByRole('textbox', { name: 'Name', exact: true }).fill('Alice')
    await expect(page.getByText(`${adapter}-component-event`, { exact: true })).toBeVisible()
  })
}

test('keeps Element Plus Inspector input frames stable while focused', async ({ page }) => {
  await createProject(page, 'element')
  const properties = page.locator('.mx-config-form-designer__properties')
  const controls = [
    {
      control: properties.getByRole('textbox', { name: 'Gap' }),
      rootSelector: '.el-input.mx-config-form-designer__property-control',
    },
    {
      control: properties.getByRole('spinbutton', { name: 'Columns' }).first(),
      rootSelector: '.el-input-number.mx-config-form-designer__property-control',
    },
  ]

  for (const { control, rootSelector } of controls) {
    const restingState = await control.evaluate((element) => {
      const field = element.closest('.mx-config-form-designer-property-form__field')
      const label = field?.querySelector('.mx-config-form-designer-property-form__label')
      const wrapper = element.closest('.el-input__wrapper')
      return {
        labelColor: label ? getComputedStyle(label).color : '',
        wrapperShadow: wrapper ? getComputedStyle(wrapper).boxShadow : 'none',
      }
    })
    await control.focus()
    const focusState = await control.evaluate((element, selector) => {
      const providerRoot = element.closest(selector)
      const field = element.closest('.mx-config-form-designer-property-form__field')
      const label = field?.querySelector('.mx-config-form-designer-property-form__label')
      const wrapper = element.closest('.el-input__wrapper')
      return {
        hasProviderRoot: Boolean(providerRoot),
        inputOutlineStyle: getComputedStyle(element).outlineStyle,
        labelColor: label ? getComputedStyle(label).color : '',
        wrapperFocused: wrapper?.classList.contains('is-focus') ?? false,
        wrapperShadow: wrapper ? getComputedStyle(wrapper).boxShadow : 'none',
      }
    }, rootSelector)

    expect(focusState).toMatchObject({
      hasProviderRoot: true,
      inputOutlineStyle: 'none',
      wrapperFocused: true,
    })
    expect(focusState.wrapperShadow).toBe(restingState.wrapperShadow)
    expect(focusState.labelColor).not.toBe(restingState.labelColor)
  }
})

for (const scenario of [
  { adapter: 'element', material: 'element.collapse', trigger: '.el-collapse-item__header' },
  { adapter: 'antd', material: 'antd.collapse', trigger: '.ant-collapse-header' },
] as const) {
  test(`runs a registered non-binding ${scenario.adapter} event exactly once`, async ({ page }) => {
    await createProject(page, scenario.adapter)
    const canvas = page.locator('.mx-config-form-designer__canvas')
    const collapse = await pointerDrop(page, scenario.material, canvas)

    await page.getByRole('tab', { name: 'Layers' }).click()
    await page.locator(`[data-layer-id="${collapse.nodeId}"] .designer-layer-select`).click()
    await page.getByRole('tab', { name: 'Events' }).click()
    await page.getByRole('button', { name: 'Configure Expanded items change event flow' }).click()
    const flowDialog = page.getByRole('dialog', { name: 'Event flow orchestration' })
    const preferredEvent = page.locator('.flow-trigger-popper:visible').getByRole('menuitem').filter({ hasText: 'Expanded items change' })
    await expect(preferredEvent).toHaveClass(/is-preferred/)
    await preferredEvent.click()
    const flowInspector = flowDialog.getByRole('complementary', { name: 'Event flow inspector' })
    const eventTarget = flowInspector.locator('[data-flow-control="event-target"]')
    await expect(eventTarget).toContainText('Expanded items change')
    await expect(eventTarget).toHaveAttribute('data-selected-value', new RegExp(collapse.nodeId))

    await flowDialog.getByRole('button', { name: 'Action', exact: true }).click()
    await flowInspector.getByRole('textbox', { name: 'Node config' })
      .fill(`{"input":"${scenario.adapter}-collapse-change"}`)
    await flowDialog.getByRole('button', { name: 'Close event flow orchestration' }).click()

    await page.getByRole('button', { name: 'Show preview' }).click()
    await previewRuntime(page).locator(`[data-config-node-id="${collapse.nodeId}"] ${scenario.trigger}`).click()
    await expect(page.getByText(`${scenario.adapter}-collapse-change`, { exact: true })).toHaveCount(1)
  })
}

test('pins the selected Preview viewport when the host window is wider', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await createProject(page, 'element')
  await page.getByRole('button', { name: 'Show preview' }).click()

  const preview = page.getByRole('complementary', { name: 'Page preview' })
  await preview.getByRole('button', { name: 'Mobile preview' }).click()
  const stage = preview.locator('.preview-stage')
  const layout = previewRuntime(page).locator('[data-config-form-responsive-layout]').first()
  const activeColumns = await layout.evaluate(element => getComputedStyle(element).getPropertyValue('--mx-config-form-active-columns').trim())
  const mobileColumns = await layout.evaluate(element => getComputedStyle(element).getPropertyValue('--mx-config-form-columns-mobile').trim())

  await expect(stage).toHaveAttribute('data-viewport', 'mobile')
  expect(activeColumns).toBe(mobileColumns)
})

test('recreates an interactive Preview Runtime session after closing and reopening', async ({ page }) => {
  await createProject(page, 'element')
  await page.getByRole('button', { name: 'Show preview' }).click()
  const firstRuntime = previewRuntime(page)
  const firstInput = firstRuntime.getByRole('textbox', { name: 'Name', exact: true })
  await firstInput.fill('First Preview session')
  await expect(firstInput).toHaveValue('First Preview session')

  await page.getByRole('button', { name: 'Close preview' }).click()
  await expect(page.locator('iframe[data-preview-runtime-host]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show preview' }).click()

  const reopenedInput = previewRuntime(page).getByRole('textbox', { name: 'Name', exact: true })
  await expect(reopenedInput).toHaveValue('First Preview session')
  await reopenedInput.fill('Reopened Preview session')
  await expect(reopenedInput).toHaveValue('Reopened Preview session')
})

test('restores Preview focus and removes the closed drawer from Canvas hit testing', async ({ page }) => {
  await createProject(page, 'element')
  const previewTrigger = page.getByRole('button', { name: 'Show preview' })
  await previewTrigger.click()
  await page.getByRole('button', { name: 'Close preview' }).click()

  await expect(previewTrigger).toBeFocused()
  await expect(page.locator('.preview-drawer-overlay')).toHaveCount(0)
  const node = designRuntime(page).locator('[data-config-node-id^="profile-name-"]')
  const nodeBox = await visibleBox(node)
  const parentHitClasses = await page.evaluate(({ x, y }) => document
    .elementsFromPoint(x, y)
    .map(element => element.className)
    .filter(value => typeof value === 'string'), {
    x: nodeBox.x + nodeBox.width / 2,
    y: nodeBox.y + nodeBox.height / 2,
  })
  expect(parentHitClasses.join(' ')).not.toContain('preview-drawer')

  await selectCanvasNode(page, node, node.locator('input').first())
  await expect(page.locator('[data-editor-focus-node-id^="profile-name-"]')).toBeFocused()
})

test('uses the real Ant runtime component for pointer candidate, overlay, and committed output', async ({ page }) => {
  await createProject(page, 'antd')
  const result = await pointerDrop(page, 'antd.input', page.locator('.mx-config-form-designer__canvas'))
  await expect(result.node.locator('.ant-input')).toBeVisible()
})

test('supports keyboard and touch material drops without a second editable model', async ({ page }) => {
  await createProject(page, 'element')
  const canvas = page.locator('.mx-config-form-designer__canvas')
  const inputMaterial = page.locator('[data-material-key="element.input"]')

  await inputMaterial.press(' ')
  const keyboardCandidate = designRuntime(page).locator('[data-config-node-state~="candidate"]')
  const candidateBox = await visibleBox(keyboardCandidate, { timeout: 10_000 })
  const candidateId = await keyboardCandidate.getAttribute('data-config-node-id')
  await expect(inputMaterial).toHaveAttribute('aria-pressed', 'true')
  await inputMaterial.press('ArrowDown')
  await inputMaterial.press(' ')
  const keyboardNode = designRuntime(page).locator(`[data-config-node-id="${candidateId}"]`)
  expectSameSize(await visibleBox(keyboardNode), candidateBox)

  const date = await touchDrop(page, 'element.date', canvas)
  await expect(date.node.locator('.el-date-editor')).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(designRuntime(page).locator(`[data-config-node-id="${date.nodeId}"]`)).toHaveCount(0)
})

test('keeps the layer action menu inside the viewport at the scroll boundary', async ({ page }) => {
  await createProject(page, 'element')
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

test('exports pinned source and config files through the readonly workspace', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning')
      browserErrors.push(message.text())
  })
  page.on('pageerror', error => browserErrors.push(error.stack ?? error.message))
  await createProject(page, 'element')

  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Export source', exact: true }).click()
  const sourceDialog = page.getByRole('dialog', { name: 'Generated Vue source' })
  await expect(sourceDialog.getByRole('tree', { name: 'Generated source files' })).toContainText('package.json')
  await expect(sourceDialog.getByRole('region', { name: 'Code viewer' })).toBeVisible()
  const [sourceDownload] = await Promise.all([
    page.waitForEvent('download'),
    sourceDialog.getByRole('button', { name: 'Download', exact: true }).click(),
  ])
  expect(sourceDownload.suggestedFilename()).toBe('App.vue')

  await sourceDialog.getByRole('button', { name: 'Close export' }).click()
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Export config', exact: true }).click()
  const configDialog = page.getByRole('dialog', { name: 'Config model' })
  await expect(configDialog.getByRole('tree', { name: 'Generated source files' })).toContainText('form.config.ts')
  await expect(configDialog.locator('.view-lines')).toContainText('version: 4')
  const [configDownload] = await Promise.all([
    page.waitForEvent('download'),
    configDialog.getByRole('button', { name: 'Download', exact: true }).click(),
  ])
  expect(configDownload.suggestedFilename()).toBe('project.config.ts')
  expect(browserErrors).toEqual([])
})
