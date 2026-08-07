import type { Page } from '@playwright/test'

const assetTypes = new Set(['font', 'image', 'script', 'stylesheet'])

export function collectBrowserProblems(page: Page): string[] {
  const problems: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error')
      problems.push(`console ${message.type()}: ${message.text()}`)
  })
  page.on('pageerror', error => problems.push(`page error: ${error.message}`))
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText ?? 'unknown error'
    if (errorText.includes('ERR_ABORTED') || !assetTypes.has(request.resourceType()))
      return

    const currentOrigin = page.url() === 'about:blank' ? '' : new URL(page.url()).origin
    if (new URL(request.url()).origin === currentOrigin)
      problems.push(`request failed: ${request.url()} (${errorText})`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400 && assetTypes.has(response.request().resourceType()))
      problems.push(`asset ${response.status()}: ${response.url()}`)
  })

  return problems
}
