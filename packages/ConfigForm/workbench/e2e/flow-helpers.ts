import type { ConfigFormFlow } from '@moluoxixi/config-form-core'
import type { ProjectDocument } from '@moluoxixi/config-form-model'
import type { Locator, Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

export const lifecycleEntries = [
  { kind: 'form.initialize', label: 'Form initialization' },
  { kind: 'page.mount', label: 'Page mounted' },
  { kind: 'page.unmount', label: 'Page unmounted' },
  { kind: 'form.valuesChange', label: 'Form values changed' },
  { kind: 'form.beforeSubmit', label: 'Before submit' },
  { kind: 'form.validationSuccess', label: 'Validation succeeded' },
  { kind: 'form.validationFailure', label: 'Validation failed' },
  { kind: 'form.reset', label: 'Form reset' },
  { kind: 'form.submit', label: 'Form submit' },
] as const

export function flowDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Event flow orchestration', exact: true })
}

export async function chooseFlowOption(page: Page, control: Locator, name: string | RegExp): Promise<void> {
  await control.press('ArrowDown')
  await page.getByRole('option', { name, exact: typeof name === 'string' }).click()
}

export async function addFlowAction(page: Page, name: string, label?: string): Promise<Locator> {
  const dialog = flowDialog(page)
  await dialog.getByTestId('add-action').click()
  const inspector = dialog.locator('.flow-step-inspector')
  await chooseFlowOption(page, inspector.getByRole('combobox').first(), name)
  if (label) {
    const input = inspector.getByRole('textbox', { name: 'Step label', exact: true })
    await input.fill(label)
    await input.press('Tab')
  }
  await expect(inspector.getByTestId('flow-action-inputs')).toBeVisible()
  return inspector
}

export async function saveFlow(page: Page): Promise<void> {
  const dialog = flowDialog(page)
  await dialog.getByTestId('save-flow').click()
  await expect(dialog).toBeHidden()
}

export async function readExportedProject(page: Page): Promise<ProjectDocument> {
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Export config', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Config model', exact: true })
  await dialog.getByRole('tab', { name: 'JSON', exact: true }).click()
  const refresh = dialog.getByRole('button', { name: 'Refresh snapshot', exact: true })
  if (await refresh.isVisible()) {
    await refresh.click()
    await expect(dialog.locator('.export-stale')).toBeHidden()
  }
  const source = await dialog.locator('.config-json-view').textContent()
  await dialog.getByRole('button', { name: 'Close export', exact: true }).click()
  return JSON.parse(source ?? '') as ProjectDocument
}

export function projectFlows(project: ProjectDocument): ConfigFormFlow[] {
  return project.pageOrder.flatMap(id => project.pagesById[id]!.flows ?? [])
}

export async function watchBusinessRequests(page: Page): Promise<string[]> {
  const requests: string[] = []
  const origin = new URL(page.url()).origin
  await page.context().route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const business = ['fetch', 'xhr'].includes(request.resourceType())
      && (url.origin !== origin || url.pathname.startsWith('/__flow_business__/'))
      && !/\.(?:js|mjs|css|woff2?|ttf|png|jpe?g|gif|svg|ico|map)$/.test(url.pathname)
    if (!business) {
      await route.continue()
      return
    }
    requests.push(`${request.method()} ${request.url()}`)
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  })
  return requests
}

export async function expectFlowAccessibility(page: Page, state: string): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  await test.info().attach(`${state}-axe`, {
    body: JSON.stringify(result.violations, null, 2),
    contentType: 'application/json',
  })
  expect.soft(result.violations, `${state} accessibility violations`).toEqual([])
}
