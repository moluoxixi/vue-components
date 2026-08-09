import { expect, test } from '@playwright/test'
import { collectBrowserProblems } from './browser-problems'

test('built theme renders and searches fixture content in light and dark modes', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Basic documentation' })).toBeVisible()
  await expect(page.getByText('The reusable Element Plus documentation theme is active.')).toBeVisible()
  await expect(page).toHaveScreenshot('basic-desktop-light.png', { animations: 'disabled', fullPage: true })

  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByRole('searchbox').fill('Navigation')
  const result = page.getByRole('option', { name: 'Basic documentation > Navigation' })
  await expect(result).toBeVisible()
  await result.click()
  await expect(page).toHaveURL(/#navigation$/)

  await page.locator('.theme-toggler-content .el-switch__core').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.goto('/')
  await expect(page).toHaveScreenshot('basic-desktop-dark.png', { animations: 'disabled', fullPage: true })

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

test('fresh consumer enables Demo, Playground, and ApiDocs from public package APIs', async ({ page }) => {
  const browserProblems = collectBrowserProblems(page)

  await page.goto('/content.html')
  const demoButton = page.getByTestId('fixture-demo-button')
  await expect(demoButton).toHaveText('Fixture count: 0')
  await demoButton.click()
  await expect(demoButton).toHaveText('Fixture count: 1')

  await expect(page.getByRole('heading', { level: 3, name: 'Props' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Text rendered inside the button.' })).toBeVisible()

  await page.getByRole('button', { name: 'Open in playground' }).click()
  await expect(page).toHaveURL(/\/playground\.html\?session=[a-z0-9-]+$/i)
  const editor = page.getByTestId('playground-editor')
  await expect(editor).toHaveValue(/Fixture count/)
  await expect(page.getByTestId('fixture-demo-button')).toHaveText('Fixture count: 0')

  await editor.fill(`<template><p data-testid="fixture-edited-preview">Edited preview</p></template>`)
  await page.getByTestId('playground-run').click()
  await expect(page.getByTestId('fixture-edited-preview')).toHaveText('Edited preview')
  await expect(browserProblems).toEqual([])
})
