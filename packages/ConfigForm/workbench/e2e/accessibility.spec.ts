import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createApplication } from './helpers'

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
      target: node.target.join(' '),
    })),
  }))
  expect(summary, `${state} accessibility violations`).toEqual([])
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('keeps the desktop workbench accessible in dark and light themes', async ({ page }) => {
  await expectNoAccessibilityViolations(page, 'new application dialog')
  await createApplication(page, 'element')
  await expectNoAccessibilityViolations(page, 'desktop dark theme')

  await page.getByRole('button', { name: 'Use light theme' }).click()
  await expectNoAccessibilityViolations(page, 'desktop light theme')
})

test('keeps mobile inspector and auxiliary workspaces accessible', async ({ page }) => {
  await createApplication(page, 'element')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('tab', { name: 'Inspector' }).click()
  await expect(page.getByRole('complementary', { name: 'Properties' })).toBeVisible()
  await expectNoAccessibilityViolations(page, 'mobile inspector')

  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Flow orchestration' }).click()
  await expect(page.getByRole('dialog', { name: 'Flow orchestration' })).toBeVisible()
  await expectNoAccessibilityViolations(page, 'mobile flow dialog')

  await page.getByRole('button', { name: 'Close flow orchestration' }).click()
  await page.getByRole('button', { name: 'Export' }).click()
  await page.getByRole('menuitem', { name: 'Export source' }).click()
  await expect(page.getByRole('dialog', { name: 'Generated Vue source' })).toBeVisible()
  await expect(page.getByRole('tree', { name: 'Generated source files' })).toBeVisible()
  await expectNoAccessibilityViolations(page, 'mobile source export')
})
