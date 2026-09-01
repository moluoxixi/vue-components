import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createProject } from './helpers'

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
  return page.frameLocator(frameSelector).locator('[data-config-node-id="profile-name"]').first().evaluate((node) => {
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

test('keeps the desktop workbench accessible in dark and light themes', async ({ page }) => {
  await expectNoAccessibilityViolations(page, 'new project dialog')
  await createProject(page, 'element')
  await expectNoAccessibilityViolations(page, 'desktop dark theme')

  await page.getByRole('button', { name: 'Use light theme' }).click()
  await expectNoAccessibilityViolations(page, 'desktop light theme')
})

for (const adapter of ['element', 'antd'] as const) {
  test(`keeps the ${adapter} mobile Inspector and auxiliary workspaces accessible`, async ({ page }) => {
    await createProject(page, adapter)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('tablist', { name: 'Designer navigation' })).toHaveCount(1)

    await page.getByRole('tab', { name: 'Layers' }).click()
    await page.getByRole('treeitem').first().click()
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

    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Event flow orchestration' }).click()
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
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Use light theme' }).click()
  await page.getByRole('button', { name: 'More actions' }).click()
  await expect(page.locator('[data-mobile-action-menu]')).toBeVisible()
  await expectNoAccessibilityViolations(page, '900px light theme overflow')
})

for (const adapter of ['element', 'antd'] as const) {
  test(`keeps ${adapter} Design and Preview runtime computed styles independent from Workbench theme`, async ({ page }) => {
    await createProject(page, adapter)
    await page.getByRole('button', { name: 'Show preview' }).click()
    const designSelector = 'iframe[data-design-runtime-variant="canvas"]'
    const previewSelector = 'iframe[data-preview-runtime-host]'
    const before = {
      design: await runtimeStyleFingerprint(page, designSelector),
      preview: await runtimeStyleFingerprint(page, previewSelector),
    }

    await page.getByRole('button', { name: 'Use light theme' }).click()
    const after = {
      design: await runtimeStyleFingerprint(page, designSelector),
      preview: await runtimeStyleFingerprint(page, previewSelector),
    }
    expect(after).toEqual(before)
  })
}
