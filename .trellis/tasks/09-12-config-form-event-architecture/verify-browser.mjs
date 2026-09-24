import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
const AxeBuilder = createRequire('D:/project-new/vue-component/packages/ConfigForm/workbench/package.json')('@axe-core/playwright').default

const directory = fileURLToPath(new URL('./artifacts/', import.meta.url))
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.goto('http://127.0.0.1:4332/')
const workspace = page.getByRole('main', { name: 'Create project' })
await workspace.getByRole('option', { name: /Element Plus profile/ }).click()
await workspace.getByText('Registry requirements met', { exact: true }).waitFor()
await workspace.getByRole('button', { name: 'Create project', exact: true }).click()
await page.getByRole('region', { name: 'Design editor' }).waitFor()
await page.getByRole('tab', { name: 'Layers' }).click()
await page.getByRole('button', { name: 'Name', exact: true }).click()
await page.getByRole('tab', { name: 'Events' }).click()
await page.getByRole('button', { name: 'Configure Value change event flow' }).click()
const dialog = page.getByRole('dialog', { name: 'Event flow orchestration' })
await dialog.getByTestId('add-flow').click()
await dialog.getByRole('button', { name: 'Action', exact: true }).click()
const inspector = dialog.getByRole('complementary', { name: 'Event flow inspector' })
await inspector.getByRole('textbox', { name: 'Node config' }).fill('{"input":{"message":{"$event":"args.0"},"type":"success"}}')
await inspector.getByRole('textbox', { name: 'Node config' }).press('Tab')
await inspector.getByTestId('flow-action-inputs').waitFor()
for (const [width, height] of [[1440, 1000], [900, 900], [390, 844]]) {
  await page.setViewportSize({ width, height })
  await page.screenshot({ path: `${directory}/event-editor-${width}.png`, fullPage: true, animations: 'disabled' })
  const geometry = await dialog.evaluate(element => ({
    width: element.getBoundingClientRect().width,
    viewport: document.documentElement.clientWidth,
    overflow: element.scrollWidth - element.clientWidth,
  }))
  assert(geometry.width <= geometry.viewport, JSON.stringify(geometry))
  assert(geometry.overflow <= 1, JSON.stringify(geometry))
  const accessibility = await new AxeBuilder({ page }).include('[data-flow-workspace-dialog]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  assert.deepEqual(accessibility.violations, [])
}
await page.setViewportSize({ width: 1440, height: 1000 })
await page.emulateMedia({ colorScheme: 'dark' })
await page.screenshot({ path: `${directory}/event-editor-dark.png`, fullPage: true, animations: 'disabled' })
const darkAccessibility = await new AxeBuilder({ page }).include('[data-flow-workspace-dialog]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
assert.deepEqual(darkAccessibility.violations, [])
assert.deepEqual(errors, [])
await browser.close()
console.log(JSON.stringify({ screenshots: directory, errors }))
