import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createProject, openAppearance, setAppearance } from './helpers'

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function expectNoAccessibilityViolations(page: Page, state: string): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(wcagTags)
    .analyze()
  const summary = result.violations.map(violation => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map(node => ({
      details: node.any.map(check => check.data),
      failureSummary: node.failureSummary,
      html: node.html,
      target: node.target.join(' '),
    })),
  }))
  expect(summary, `${state} accessibility violations`).toEqual([])
}

async function runtimeStyleFingerprint(page: Page, frameSelector: string): Promise<Record<string, Record<string, string>>> {
  return page.frameLocator(frameSelector).locator('[data-config-node-id^="profile-name-"]').first().evaluate((node) => {
    const input = node.querySelector('input')
    const label = node.querySelector('label')
    if (!(input instanceof HTMLElement) || !(label instanceof HTMLElement))
      throw new Error('Representative Runtime input and label are required')
    const styleValues = (element: HTMLElement): Record<string, string> => {
      const style = getComputedStyle(element)
      return {
        backgroundColor: style.backgroundColor,
        borderBottomColor: style.borderBottomColor,
        borderBottomStyle: style.borderBottomStyle,
        borderBottomWidth: style.borderBottomWidth,
        borderLeftColor: style.borderLeftColor,
        borderRightColor: style.borderRightColor,
        borderTopColor: style.borderTopColor,
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
      }
    }
    return {
      input: styleValues(input),
      label: styleValues(label),
    }
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('keeps all palette and resolved-theme combinations accessible', async ({ page }) => {
  const creationWorkspace = page.getByRole('main', { name: 'Create project' })
  await expect(creationWorkspace.getByText('Registry requirements met', { exact: true })).toBeVisible()
  await expect(creationWorkspace).toHaveAttribute('data-palette', 'ink')
  await expectNoAccessibilityViolations(page, 'new project workspace')
  await createProject(page, 'element')

  for (const palette of ['ink', 'morandi', 'cyber', 'glass'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      await setAppearance(page, theme, palette)
      await expectNoAccessibilityViolations(page, `${palette} ${theme}`)
    }
  }
})

test('follows system color changes and keeps explicit modes stable', async ({ page }) => {
  await expect(page.locator('.template-creation-workspace')).toHaveAttribute('data-palette', 'ink')
  await setAppearance(page, 'system', 'morandi')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('.template-creation-workspace')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('#workbench-overlays')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('.template-creation-workspace')).toHaveAttribute('data-theme', 'light')

  await setAppearance(page, 'dark', 'morandi')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('.template-creation-workspace')).toHaveAttribute('data-theme', 'dark')
})

test('keeps the desktop popover and mobile drawer accessible with focus restoration', async ({ page }) => {
  const desktopTrigger = page.getByRole('button', { name: 'Open appearance settings' })
  await openAppearance(page)
  await expectNoAccessibilityViolations(page, 'desktop appearance popover')
  const desktopPanel = page.locator('.appearance-panel:visible')
  await desktopPanel.getByRole('radio', { name: 'System' }).focus()
  expect(await desktopPanel.evaluate(element => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(desktopPanel).toBeHidden()
  await expect(desktopTrigger).toBeFocused()

  await page.setViewportSize({ width: 390, height: 844 })
  const more = page.getByRole('button', { name: 'More actions' })
  await openAppearance(page)
  const drawer = page.getByRole('dialog', { name: 'Appearance' })
  await expect(drawer).toBeVisible()
  await drawer.locator('.appearance-palette-option', { hasText: 'Morandi Cream' }).click()
  await expect(page.locator('.template-creation-workspace')).toHaveAttribute('data-palette', 'morandi')
  await expectNoAccessibilityViolations(page, 'mobile appearance drawer')
  await drawer.getByRole('button', { name: 'Close' }).focus()
  await page.keyboard.press('Tab')
  expect(await drawer.evaluate(element => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(more).toBeFocused()
})

for (const adapter of ['element', 'antd'] as const) {
  test(`keeps the ${adapter} mobile Inspector and auxiliary workspaces accessible`, async ({ page }) => {
    await createProject(page, adapter)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('tablist', { name: 'Designer navigation' })).toHaveCount(1)

    await page.getByRole('tab', { name: 'Layers' }).click()
    await page.locator('[data-layer-id^="profile-name-"] .designer-layer-select').click()
    await page.getByRole('button', { name: /Arrange/ }).first().click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expectNoAccessibilityViolations(page, `${adapter} mobile layers menu`)
    await page.getByRole('menu').press('Escape')

    const inspectorTab = page.getByRole('tab', { name: 'Inspector' })
    await inspectorTab.click()
    await expect(inspectorTab).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-workspace-panel="properties"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('complementary', { name: 'Properties' })).toBeVisible({ timeout: 10_000 })
    await expectNoAccessibilityViolations(page, `${adapter} mobile inspector`)

    await page.getByRole('tab', { name: 'Events' }).click()
    await page.getByRole('button', { name: 'Configure Value change event flow' }).click()
    await expect(page.getByRole('dialog', { name: 'Event flow orchestration' })).toBeVisible()
    await expectNoAccessibilityViolations(page, `${adapter} mobile flow dialog`)

    await page.getByRole('button', { name: 'Close event flow orchestration' }).click()
    await page.getByRole('button', { name: 'Export' }).click()
    await page.getByRole('menuitem', { name: 'Export source' }).click()
    await expect(page.getByRole('dialog', { name: 'Generated Vue source' })).toBeVisible()
    await expect(page.getByRole('tree', { name: 'Generated source files' })).toBeVisible()
    await expectNoAccessibilityViolations(page, `${adapter} mobile source export`)
  })
}

test('keeps the 900px light-theme overflow menu accessible', async ({ page }) => {
  await createProject(page, 'element')
  await page.setViewportSize({ width: 900, height: 900 })
  await setAppearance(page, 'light', 'glass')
  await page.getByRole('button', { name: 'More actions' }).click()
  await expect(page.locator('[data-mobile-action-menu]')).toBeVisible()
  await expectNoAccessibilityViolations(page, '900px light theme overflow')
})

for (const adapter of ['element', 'antd'] as const) {
  test(`keeps ${adapter} Design and Preview runtime computed styles independent from Workbench theme`, async ({ page }) => {
    test.slow()
    await createProject(page, adapter)
    const designSelector = 'iframe[data-design-runtime-variant="canvas"]'
    const previewSelector = 'iframe[data-preview-runtime-host]'
    // Preview is a modal dialog, so appearance switching happens with the dialog
    // closed and each fingerprint is taken from a freshly opened preview.
    const openPreview = async (): Promise<void> => {
      await page.getByRole('button', { name: 'Show preview' }).click()
      await expect(page.locator(previewSelector)).toBeVisible()
    }
    const closePreview = async (): Promise<void> => {
      await page.getByRole('button', { name: 'Close preview' }).click()
      await expect(page.locator('.preview-dialog-shell')).toHaveCount(0)
    }
    const fingerprint = async (): Promise<{ design: unknown, preview: unknown }> => {
      await openPreview()
      const snapshot = {
        design: await runtimeStyleFingerprint(page, designSelector),
        preview: await runtimeStyleFingerprint(page, previewSelector),
      }
      await closePreview()
      return snapshot
    }

    const before = await fingerprint()

    for (const palette of ['ink', 'morandi', 'cyber', 'glass'] as const) {
      for (const theme of ['light', 'dark'] as const) {
        await setAppearance(page, theme, palette)
        expect(await fingerprint()).toEqual(before)
      }
    }
  })
}
