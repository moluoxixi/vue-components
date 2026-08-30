import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const stylesheetEntry = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8')
const stylesheetLayers = ['shell', 'studio', 'features', 'responsive'] as const
const stylesheet = stylesheetLayers
  .map(layer => readFileSync(new URL(`../../styles/${layer}.css`, import.meta.url), 'utf8'))
  .join('\n')
const responsiveStylesheet = readFileSync(new URL('../../styles/responsive.css', import.meta.url), 'utf8')
const designerStylesheet = readFileSync(new URL('../../../../designer/src/styles.scss', import.meta.url), 'utf8')

interface CssRule {
  body: string
  selector: string
}

function cssRules(source: string): CssRule[] {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({
    selector: match[1]!.trim(),
    body: match[2]!,
  }))
}

function selectorBlock(selector: string, source = stylesheet): string {
  const rule = cssRules(source).find(candidate => candidate.selector
    .split(',')
    .some(item => item.trim() === selector))
  if (!rule)
    throw new Error(`Missing CSS selector: ${selector}`)
  return rule.body
}

function colorVariable(selector: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = selectorBlock(selector).match(new RegExp(`${escaped}:\\s*(#[0-9a-f]{3,8})\\s*;`, 'i'))
  if (!match)
    throw new Error(`Missing color variable ${name} in ${selector}`)
  return match[1]!
}

function luminance(hex: string): number {
  const normalized = hex.length === 4
    ? hex.slice(1).split('').map(value => value.repeat(2)).join('')
    : hex.slice(1, 7)
  const channels = normalized.match(/.{2}/g)!.map(value => Number.parseInt(value, 16) / 255)
  const [red, green, blue] = channels.map(value => value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!
}

function contrast(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left)
  return (values[0]! + 0.05) / (values[1]! + 0.05)
}

describe('workbench theme contract', () => {
  it('composes scoped style layers in stable cascade order', () => {
    expect(stylesheetEntry).toBe(`${stylesheetLayers
      .map(layer => `@import url(./styles/${layer}.css);`)
      .join('\n')}\n`)
  })

  it('loads only the active adapter implementation and styles', async () => {
    const [entry, adapters, templates] = await Promise.all([
      import('../../main.ts?raw').then(module => module.default),
      import('../../adapters.ts?raw').then(module => module.default),
      import('../../project/templates/create-template.ts?raw').then(module => module.default),
    ])

    expect(entry).not.toMatch(/designer-(?:antd-vue|element-plus)\/styles/)
    expect(entry).not.toMatch(/(?:ant-design-vue|element-plus)\/dist/)
    expect(adapters).toContain('import(\'@moluoxixi/config-form-designer-antd-vue\')')
    expect(adapters).toContain('import(\'@moluoxixi/config-form-designer-element-plus\')')
    expect(templates).not.toContain('@moluoxixi/config-form-designer-antd-vue')
    expect(templates).not.toContain('@moluoxixi/config-form-designer-element-plus')
  })
  it.each([
    ['.workbench-app', '--wb-text', '--wb-surface', 4.5],
    ['.workbench-app', '--wb-muted', '--wb-surface', 4.5],
    ['.workbench-app', '--wb-control-border', '--wb-surface', 3],
    ['.workbench-app', '--wb-accent', '--wb-surface', 3],
    ['.workbench-app', '--wb-action-text', '--wb-action-bg', 4.5],
    ['.workbench-app[data-theme="light"]', '--wb-text', '--wb-surface', 4.5],
    ['.workbench-app[data-theme="light"]', '--wb-muted', '--wb-surface', 4.5],
    ['.workbench-app[data-theme="light"]', '--wb-control-border', '--wb-surface', 3],
    ['.workbench-app[data-theme="light"]', '--wb-accent', '--wb-surface', 3],
    ['.workbench-app[data-theme="light"]', '--wb-action-text', '--wb-action-bg', 4.5],
  ] as const)('%s keeps %s readable against %s', (selector, foreground, background, minimum) => {
    expect(contrast(
      colorVariable(selector, foreground),
      colorVariable(selector, background),
    )).toBeGreaterThanOrEqual(minimum)
  })

  it('keeps interaction styling and runtime canvas tokens explicit', () => {
    expect(stylesheet).toContain('.topbar-actions button:hover:not(:disabled),')
    expect(stylesheet).toContain('.export-preview-dialog > header button:hover:not(:disabled)')
    expect(selectorBlock(
      '.workbench-app[data-theme] .embedded-designer .mx-config-form-designer__properties .el-segmented',
    )).toContain('--el-segmented-item-selected-bg-color: var(--mx-designer-selection-bg);')
    expect(selectorBlock(
      '.workbench-app[data-theme] .embedded-designer .mx-config-form-designer__properties .el-segmented__item-selected',
    )).toContain('transition: none;')
    expect(selectorBlock(
      '.workbench-app[data-theme] .embedded-designer .mx-config-form-designer__properties .el-segmented__item-label',
    )).toContain('transition: none;')
    expect(selectorBlock(
      '.workbench-app[data-theme="light"] .embedded-designer.mx-config-form-designer',
    )).toContain('--mx-designer-muted: #526176;')
    const paletteItem = selectorBlock(
      '.mx-config-form-designer__palette-item',
      designerStylesheet,
    )
    expect(paletteItem).toContain('background: transparent;')
    expect(paletteItem).toContain('transition: background-color 100ms ease, border-color 100ms ease;')
    expect(selectorBlock(
      '.mx-config-form-designer__palette-item:focus-within',
      designerStylesheet,
    )).toContain('outline: 2px solid color-mix(in srgb, var(--mx-designer-accent) 32%, transparent);')
    expect(selectorBlock(
      '.mx-config-form-designer__palette-item-preview',
      designerStylesheet,
    )).toContain('background: var(--mx-designer-runtime-surface);')
    expect(contrast(
      '#ffffff',
      colorVariable('.workbench-app[data-theme="dark"] .embedded-designer.mx-config-form-designer', '--mx-designer-selection-bg'),
    )).toBeGreaterThanOrEqual(4.5)
    expect(contrast(
      '#ffffff',
      colorVariable('.workbench-app[data-theme="light"] .embedded-designer.mx-config-form-designer', '--mx-designer-selection-bg'),
    )).toBeGreaterThanOrEqual(4.5)
    expect(stylesheet).toContain('--mx-designer-canvas-sheet: #fff;')
    expect(stylesheet).toContain('--mx-designer-runtime-text: #17202a;')
    expect(stylesheet).toContain('--mx-designer-runtime-muted: #64748b;')
    expect(stylesheet).toContain('--mx-designer-runtime-border: #d9dee7;')
    expect(stylesheet).toContain('--mx-designer-runtime-surface: #fff;')
    expect(designerStylesheet).toContain('--mx-designer-runtime-surface: #ffffff;')
    expect(designerStylesheet).toContain('--mx-designer-surface: var(--mx-designer-overlay-surface, #fff);')
    expect(designerStylesheet).not.toContain('--mx-designer-surface: var(--mx-designer-runtime-surface')
  })

  it('keeps every provider theme rule inside a themed Inspector scope', () => {
    const providerRules = cssRules(stylesheet).filter(({ body, selector }) =>
      body.includes('--el-') || selector.includes('.el-') || selector.includes('.ant-'),
    )
    const scope = /^\.workbench-app\[data-theme(?:="dark")?\] \.embedded-designer \.mx-config-form-designer__properties(?:\s|$)/

    expect(providerRules.length).toBeGreaterThan(0)
    for (const rule of providerRules) {
      for (const selector of rule.selector.split(','))
        expect(selector.trim()).toMatch(scope)
    }
  })

  it('keeps export and narrow runtime surfaces responsive to their context', () => {
    expect(selectorBlock('.export-preview-body')).toContain('background: var(--wb-editor-surface);')
    expect(selectorBlock('.topbar-actions .export-menu-popover button')).toContain('white-space: nowrap;')
    expect(stylesheet).toContain('@media (max-width: 480px)')
    expect(stylesheet).toContain('.topbar-actions .export-menu-popover button,')
    expect(stylesheet).toContain('.topbar-actions .mobile-action-popover button,')
    expect(stylesheet).toContain('.export-menu > button .export-chevron')
    expect(selectorBlock('.preview-stage')).toContain('container-name: preview-runtime;')
    expect(selectorBlock('.preview-stage')).toContain('container-type: inline-size;')
    expect(stylesheet).toContain('@container preview-runtime (max-width: 1024px) {')
    expect(stylesheet).toContain('--mx-config-form-active-columns: var(--mx-config-form-columns-tablet);')
    expect(stylesheet).toContain('--mx-config-form-active-span: var(--mx-config-form-span-tablet);')
    expect(stylesheet).toContain('@container preview-runtime (max-width: 720px) {')
    expect(stylesheet).toContain('--mx-config-form-active-columns: var(--mx-config-form-columns-mobile);')
    expect(stylesheet).toContain('--mx-config-form-active-span: var(--mx-config-form-span-mobile);')
    expect(stylesheet).toContain('@container preview-runtime (max-width: 520px) {')
    expect(stylesheet).toContain('.page-preview-form [class*="config-form__row--grid"] {\n    gap: 12px 6px !important;')
    expect(designerStylesheet).toContain('.mx-config-form-designer__canvas-sheet [class*="config-form__row--grid"] {\n  gap: 12px 6px !important;')
  })

  it('keeps Preview as an overlay that cannot resize the Design surface', () => {
    const rules = cssRules(stylesheet)
    const previewRule = rules.find(rule => rule.selector === '.preview-pane')
    const expandedRule = rules.find(rule => rule.selector === '.workbench-layout.is-preview-expanded .preview-pane')

    expect(selectorBlock('.workbench-layout')).toContain('position: relative;')
    expect(selectorBlock('.workbench-layout')).toContain('grid-template-columns: minmax(0, 1fr);')
    expect(rules.some(rule => rule.selector === '.editor-pane' && rule.body.includes('isolation: isolate;'))).toBe(true)
    expect(previewRule?.body).toContain('position: absolute;')
    expect(previewRule?.body).toContain('right: 0;')
    expect(expandedRule?.body).toContain('width: 100%;')
  })

  it('keeps compact desktop Preview as an overlay and reserves replacement mode for mobile', () => {
    const compactStart = responsiveStylesheet.indexOf('@media (max-width: 900px)')
    const mobileStart = responsiveStylesheet.indexOf('@media (max-width: 700px)')
    const narrowStart = responsiveStylesheet.indexOf('@media (max-width: 480px)')
    const compactRules = responsiveStylesheet.slice(compactStart, mobileStart)
    const mobileRules = responsiveStylesheet.slice(mobileStart, narrowStart)

    expect(compactRules).not.toContain('show-mobile-preview')
    expect(mobileRules).toContain('.workbench-layout.show-mobile-preview .editor-pane')
    expect(mobileRules).toContain('.workbench-layout.show-mobile-preview .preview-pane')
  })
})
