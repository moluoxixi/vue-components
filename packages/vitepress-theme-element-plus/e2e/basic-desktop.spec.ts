import { expect, test } from '@playwright/test'
import { collectBrowserProblems } from './browser-problems'
import { coldStartTimeout, openBasicHome } from './page-readiness'

test('examples preserve native and authored styles across search, dark mode and Playground', async ({ page, context }) => {
  const browserProblems = collectBrowserProblems(page)
  const defaultThemeStyles: string[] = []
  page.on('request', (request) => {
    if (/theme-default\/styles\/(?:base|utils|components\/vp-doc)\.css/.test(request.url()))
      defaultThemeStyles.push(request.url())
  })

  const baseline = await context.newPage()
  await baseline.goto('/native-baseline.html')
  const readNativeStyles = (elements: Element[]) => elements.map((element) => {
    const style = getComputedStyle(element)
    const properties = [
      'display',
      'position',
      'font-size',
      'font-family',
      'color',
      'background-color',
      'color-scheme',
      'font-weight',
      'line-height',
      'box-sizing',
      'margin-top',
      'margin-bottom',
      'padding-top',
      'padding-left',
      'border-top-width',
      'border-radius',
      'border-collapse',
      'list-style-type',
      'scrollbar-color',
      'background-image',
    ]
    return {
      probe: element.getAttribute('data-probe'),
      styles: Object.fromEntries(properties.map(property => [property, style.getPropertyValue(property)])),
    }
  })
  const nativeStyles = await baseline.locator('[data-probe]').evaluateAll(readNativeStyles)
  await baseline.close()

  await page.goto('/style-isolation.html')
  const nativeElements = page.getByTestId('native-elements')
  await expect(nativeElements).toBeVisible({ timeout: coldStartTimeout })
  await expect(page.getByTestId('manual-ep-control')).toHaveClass(/\bel-button\b/)
  await expect(page.getByTestId('manual-ep-control')).not.toHaveClass(/\bepd-button\b/)

  const codeGroup = page.locator('.vp-code-group')
  await expect(codeGroup.locator('.language-sh').filter({ hasText: 'pnpm add example' })).toBeVisible()
  await codeGroup.locator('label').filter({ hasText: 'npm', hasNotText: 'pnpm' }).click()
  await expect(codeGroup.locator('.language-sh').filter({ hasText: 'npm install example' })).toBeVisible()
  await expect(codeGroup.locator('.language-sh').filter({ hasText: 'pnpm add example' })).toBeHidden()

  for (const dark of [false, true]) {
    if (dark) {
      await page.locator('.theme-toggler-content .epd-switch__core').click()
      await expect(page.locator('html')).toHaveClass(/dark/)
    }
    expect(await nativeElements.locator('[data-probe]').evaluateAll(readNativeStyles)).toEqual(nativeStyles)
    await expect(page.getByTestId('authored-heading')).toHaveCSS('font-size', '18px')
    await expect(page.getByTestId('authored-heading')).toHaveCSS('margin-top', '3px')
    await expect(page.getByTestId('authored-heading')).toHaveCSS('display', 'block')
    await expect(page.getByTestId('authored-paragraph')).toHaveCSS('margin-top', '5px')
    await expect(page.getByTestId('manual-raw').locator('h2')).toHaveCSS('font-size', '24px')
    await expect(page.locator('#document-heading')).toHaveCSS('font-size', '26.4px')
    await expect(page.locator('.doc-content ul:not(:where(.vp-raw, .vp-raw *))').first()).toHaveCSS('list-style-type', 'disc')

    await page.getByRole('button', { name: 'Toggle component overlay' }).click()
    await expect(page.getByTestId('teleported-heading')).toHaveCSS('font-family', nativeStyles[0]!.styles['font-family']!)
    await expect(page.getByTestId('teleported-heading')).toHaveCSS('color', nativeStyles[0]!.styles.color!)
    await expect(page.getByTestId('teleported-heading')).toHaveCSS('font-size', '18px')
    await expect(page.getByTestId('teleported-heading')).toHaveCSS('margin-top', '3px')
    await expect(page.getByTestId('teleported-paragraph')).toHaveCSS('margin-top', '5px')
    await page.getByRole('button', { name: 'Close component overlay' }).click()
  }

  // Lazy search loading must not reintroduce the default theme's reset.
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('searchbox').fill('Style isolation')
  await expect(page.getByRole('option').first()).toBeVisible()
  await page.keyboard.press('Escape')
  expect(await nativeElements.locator('[data-probe]').evaluateAll(readNativeStyles)).toEqual(nativeStyles)
  expect(defaultThemeStyles).toEqual([])

  await page.locator('.demo-block').first().getByRole('button', { name: 'Edit in lightweight playground' }).click()
  await expect(page.getByTestId('playground-preview').getByTestId('native-elements')).toBeVisible()
  expect(await page.getByTestId('playground-preview').locator('[data-probe]').evaluateAll(readNativeStyles)).toEqual(nativeStyles)
  expect(browserProblems).toEqual([])
})

test('built theme renders and searches fixture content in light and dark modes', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await openBasicHome(page)
  await expect(page.getByText('The reusable Element Plus documentation theme is active.')).toBeVisible()
  await expect(page.locator('.logo-container img')).toHaveCount(0)

  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByRole('searchbox').fill('Navigation')
  const result = page.getByRole('option', { name: 'Basic documentation > Navigation' })
  await expect(result).toBeVisible()
  await result.click()
  await expect(page).toHaveURL(/#navigation$/)

  await page.locator('.theme-toggler-content .epd-switch__core').click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.goto('/guide/')
  await expect(page.getByRole('heading', { level: 1, name: 'Guide' })).toBeVisible()
  const toc = page.locator('.toc-wrapper')
  await expect(toc).toBeVisible()
  await expect(toc.locator('a[href^="#"]')).toHaveText([
    'Heading level 2',
    'Heading level 3',
    'Heading level 4',
    'Heading level 5',
    'Heading level 6',
  ])
  const headings = await page.locator('.doc-content h1, .doc-content h2, .doc-content h3, .doc-content h4, .doc-content h5, .doc-content h6').evaluateAll(elements => elements.map((element) => {
    const style = getComputedStyle(element)
    return {
      tag: element.tagName,
      display: style.display,
      fontSize: Number.parseFloat(style.fontSize),
      fontWeight: style.fontWeight,
      lineHeight: Number.parseFloat(style.lineHeight),
    }
  }))
  expect(headings.map(({ tag }) => tag)).toEqual(['H1', 'H2', 'H3', 'H4', 'H5', 'H6'])
  expect(headings.map(({ display }) => display)).toEqual(Array.from({ length: 6 }).fill('flex'))
  expect(headings.map(({ fontWeight }) => fontWeight)).toEqual(Array.from({ length: 6 }).fill('600'))
  expect(headings.map(({ fontSize }) => fontSize)).toEqual([35.2, 26.4, 21.6, 18.4, 16, 16])
  headings.forEach(({ fontSize, lineHeight }) => {
    expect(lineHeight / fontSize).toBeCloseTo(1.25, 1)
  })
  expect(browserProblems).toEqual([])
})

test('@visual built theme matches desktop baselines', async ({ page }) => {
  await openBasicHome(page)
  await expect(page).toHaveScreenshot('basic-desktop-light.png', { animations: 'disabled', fullPage: true })

  await page.locator('.theme-toggler-content .epd-switch__core').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page).toHaveScreenshot('basic-desktop-dark.png', { animations: 'disabled', fullPage: true })
})

test('renders nested table-of-content links recursively', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await page.goto('/guide/')
  await expect(page.getByRole('heading', { level: 1, name: 'Guide' }))
    .toBeVisible({ timeout: coldStartTimeout })

  const tocLinks = page.locator('.toc-content--desktop a[href^="#"]')
  await expect(tocLinks).toHaveText([
    'Heading level 2',
    'Heading level 3',
    'Heading level 4',
    'Heading level 5',
    'Heading level 6',
  ])
  const tocDepths = await tocLinks.evaluateAll(links => links.map((link) => {
    let depth = 0
    let item = link.closest('.epd-anchor__item')
    while (item) {
      depth += 1
      item = item.parentElement?.closest('.epd-anchor__item') ?? null
    }
    return depth
  }))
  expect(tocDepths).toEqual([1, 2, 3, 4, 5])
  expect(browserProblems).toEqual([])
})

test('fresh consumer enables Demo, Playground, and ApiDocs from public package APIs', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await page.goto('/content.html')
  await expect(page).toHaveURL(/\/content\.html$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Reusable content modules' }))
    .toBeVisible({ timeout: coldStartTimeout })
  const avatar = page.locator('.doc-contributor-avatar')
  await expect(avatar).toHaveAttribute('src', '/fixture-author.svg')
  await expect.poll(() => avatar.evaluate(element => (
    (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0
  )), { timeout: coldStartTimeout }).toBe(true)
  const demoButton = page.getByTestId('fixture-demo-button')
  await expect(demoButton).toHaveText('Fixture count: 0')
  await demoButton.click()
  await expect(demoButton).toHaveText('Fixture count: 1')

  await expect(page.getByRole('heading', { level: 3, name: 'Props' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Text rendered inside the button.' })).toBeVisible()

  const demo = page.locator('.demo-block').first()
  await demo.getByRole('button', { name: 'Expand example code' }).click()
  await expect(demo.locator('.demo-source')).toContainText('lang="ts"')
  await demo.getByTestId('demo-source-language').getByText('JS', { exact: true }).click()
  await expect(demo.locator('.demo-source')).not.toContainText('lang="ts"')

  await page.getByRole('button', { name: 'Edit in lightweight playground' }).click()
  await expect(page).toHaveURL(/\/playground\.html\?session=[a-z0-9-]+$/i)
  const editor = page.getByTestId('playground-editor')
  await expect(editor).toHaveValue(/Fixture count/)
  await expect(editor).not.toHaveValue(/lang="ts"/)
  await expect(page.getByTestId('fixture-demo-button')).toHaveText('Fixture count: 0')

  await editor.fill(`<template><p data-testid="fixture-edited-preview">Edited preview</p></template>`)
  await page.getByTestId('playground-run').click()
  await expect(page.getByTestId('fixture-edited-preview')).toHaveText('Edited preview')
  await expect(browserProblems).toEqual([])
})
