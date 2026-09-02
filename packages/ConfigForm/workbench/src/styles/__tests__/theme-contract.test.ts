import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const stylesheetEntry = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const stylesheetLayers = ['shell', 'studio', 'features', 'templates', 'responsive'] as const
const stylesheet = stylesheetLayers
  .map(layer => readFileSync(new URL(`../../styles/${layer}.css`, import.meta.url), 'utf8'))
  .join('\n')
const responsiveStylesheet = readFileSync(new URL('../../styles/responsive.css', import.meta.url), 'utf8')
const designerStylesheet = readFileSync(new URL('../../../../designer/src/styles.scss', import.meta.url), 'utf8')
  .replace(/^@use[^\n]+\n+/, '')

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

function colorVariable(selector: string, name: string, source = stylesheet): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = selectorBlock(selector, source).match(new RegExp(`${escaped}:\\s*(#[0-9a-f]{3,8})\\s*;`, 'i'))
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
      .map(layer => `@import url(./${layer}.css);`)
      .join('\n')}\n`)
  })

  it('loads only the active adapter implementation and styles', async () => {
    const [entry, adapters, templates] = await Promise.all([
      import('../../main.ts?raw').then(module => module.default),
      import('../../adapters/services/load.ts?raw').then(module => module.default),
      import('../../project/templates/adapters/create-seed-graph.ts?raw').then(module => module.default),
    ])

    expect(entry).not.toMatch(/designer-(?:antd-vue|element-plus)\/styles/)
    expect(entry).not.toMatch(/(?:ant-design-vue|element-plus)\/dist/)
    expect(adapters).toContain('import(\'@moluoxixi/config-form-designer-antd-vue\')')
    expect(adapters).toContain('import(\'@moluoxixi/config-form-designer-element-plus\')')
    expect(templates).not.toContain('@moluoxixi/config-form-designer-antd-vue')
    expect(templates).not.toContain('@moluoxixi/config-form-designer-element-plus')
  })
  const paletteSelectors = ['catppuccin', 'kanagawa', 'gruvbox', 'rose-pine'].flatMap(palette =>
    ['light', 'dark'].map(theme => `.workbench-app[data-palette="${palette}"][data-theme="${theme}"]`))
  const contrastContracts = paletteSelectors.flatMap(selector => [
    [selector, '--wb-text', '--wb-surface', 4.5],
    [selector, '--wb-muted', '--wb-surface', 4.5],
    [selector, '--wb-small-text', '--wb-bg', 4.5],
    [selector, '--wb-small-text', '--wb-surface', 4.5],
    [selector, '--wb-small-text', '--wb-surface-raised', 4.5],
    [selector, '--wb-small-text', '--wb-accent-soft', 4.5],
    [selector, '--wb-text-strong', '--wb-hover', 4.5],
    [selector, '--wb-border', '--wb-surface', 3],
    [selector, '--wb-border', '--wb-surface-raised', 3],
    [selector, '--wb-control-border', '--wb-surface', 3],
    [selector, '--wb-control-border', '--wb-surface-raised', 3],
    [selector, '--wb-accent', '--wb-surface', 3],
    [selector, '--wb-focus', '--wb-surface', 3],
    [selector, '--wb-action-text', '--wb-action-bg', 4.5],
    [selector, '--wb-positive', '--wb-surface', 4.5],
    [selector, '--wb-warning', '--wb-surface', 4.5],
    [selector, '--wb-danger', '--wb-surface', 4.5],
  ] as const)
  const separatorContracts = paletteSelectors.flatMap(selector => [
    [selector, '--wb-surface'],
    [selector, '--wb-surface-raised'],
  ] as const)

  it.each(contrastContracts)('%s keeps %s readable against %s', (selector, foreground, background, minimum) => {
    expect(contrast(
      colorVariable(selector, foreground),
      colorVariable(selector, background),
    )).toBeGreaterThanOrEqual(minimum)
  })

  it.each(separatorContracts)('%s keeps structural separators quiet against %s', (selector, background) => {
    const separatorContrast = contrast(
      colorVariable(selector, '--wb-separator'),
      colorVariable(selector, background),
    )
    const controlContrast = contrast(
      colorVariable(selector, '--wb-control-border'),
      colorVariable(selector, background),
    )

    expect(separatorContrast).toBeGreaterThan(1.25)
    expect(separatorContrast).toBeLessThan(controlContrast)
  })

  it('keeps interaction styling and runtime canvas tokens explicit', () => {
    expect(selectorBlock(
      '.workbench-app .el-segmented',
    )).toContain('--el-segmented-item-hover-color: var(--wb-text-strong);')
    expect(selectorBlock(
      '.template-creation-workspace .el-segmented',
    )).toContain('--el-segmented-item-selected-bg-color: var(--wb-action-bg);')
    expect(selectorBlock(
      '.template-catalog-item.is-selected .template-catalog-copy span',
    )).toContain('color: var(--wb-small-text);')
    expect(stylesheet).toContain('.topbar-actions button:hover:not(:disabled, [aria-disabled="true"]),')
    expect(stylesheet).toContain('.export-stale .el-button')
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
      '.workbench-app[data-theme] .embedded-designer.mx-config-form-designer',
    )).toContain('--mx-designer-accent: var(--wb-accent);')
    expect(stylesheet).toContain('--el-border-color-light: var(--wb-separator);')
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
    expect(selectorBlock(
      '.workbench-app[data-theme] .embedded-designer.mx-config-form-designer',
    )).toContain('--mx-designer-selection-bg: var(--wb-action-bg);')
    expect(stylesheet).toContain('--mx-designer-canvas-sheet: #fff;')
    expect(stylesheet).toContain('--mx-designer-runtime-text: #17202a;')
    expect(stylesheet).toContain('--mx-designer-runtime-muted: #64748b;')
    expect(stylesheet).toContain('--mx-designer-runtime-border: #d9dee7;')
    expect(stylesheet).toContain('--mx-designer-runtime-surface: #fff;')
    expect(designerStylesheet).toContain('--mx-designer-runtime-surface: #ffffff;')
    expect(designerStylesheet).toContain('--mx-designer-surface: var(--mx-designer-overlay-surface, #fff);')
    expect(designerStylesheet).not.toContain('--mx-designer-surface: var(--mx-designer-runtime-surface')
    for (const [foreground, minimum] of [
      ['--mx-designer-text', 4.5],
      ['--mx-designer-muted', 4.5],
      ['--mx-designer-border', 3],
      ['--mx-designer-control-border', 3],
      ['--mx-designer-accent', 3],
    ] as const) {
      expect(contrast(
        colorVariable('.mx-config-form-designer', foreground, designerStylesheet),
        colorVariable('.mx-config-form-designer', '--mx-designer-overlay', designerStylesheet),
      )).toBeGreaterThanOrEqual(minimum)
    }
    expect(contrast(
      colorVariable('.mx-config-form-designer', '--mx-designer-border', designerStylesheet),
      colorVariable('.mx-config-form-designer', '--mx-designer-canvas', designerStylesheet),
    )).toBeGreaterThanOrEqual(3)

    expect(selectorBlock(
      '.workbench-app[data-theme] .embedded-designer.mx-config-form-designer',
    )).toContain('--mx-designer-border: var(--wb-separator);')
    expect(selectorBlock(
      '.workbench-app[data-theme] .embedded-designer.mx-config-form-designer',
    )).toContain('--mx-designer-control-border: var(--wb-control-border);')
    expect(selectorBlock(
      '.workbench-app[data-theme] .embedded-designer.mx-config-form-designer',
    )).toContain('--mx-designer-overlay-border: var(--wb-separator);')
    expect(selectorBlock('.workspace-context')).toContain('border: 0;')
    expect(selectorBlock('.editor-file-meta > small')).toContain('background: var(--wb-hover);')
  })

  it('keeps provider theme rules in Workbench chrome and out of Runtime surfaces', () => {
    const providerRules = cssRules(stylesheet).filter(({ body, selector }) =>
      body.includes('--el-') || selector.includes('.el-') || selector.includes('.ant-'),
    )

    expect(providerRules.length).toBeGreaterThan(0)
    for (const rule of providerRules) {
      for (const selector of rule.selector.split(',')) {
        expect(selector).not.toMatch(/(?:design-runtime-host|preview-runtime-host|preview-stage|canvas-sheet)/)
      }
    }
    const workbenchBlocks = cssRules(stylesheet)
      .filter(rule => rule.selector.split(',').some(selector => selector.trim() === '.workbench-app'))
      .map(rule => rule.body)
      .join('\n')
    expect(workbenchBlocks).toContain('--el-color-primary: var(--wb-accent);')
  })

  it('keeps export and Preview responsive without mutating intrinsic Canvas runtime styles', () => {
    expect(selectorBlock('.export-preview-body')).toContain('background: var(--wb-editor-surface);')
    expect(selectorBlock('.export-menu-popover .el-dropdown-menu__item')).toContain('white-space: nowrap;')
    expect(stylesheet).toContain('@media (max-width: 480px)')
    expect(stylesheet).toContain('.export-menu-popover .el-dropdown-menu__item,')
    expect(stylesheet).toContain('.mobile-action-popover .el-dropdown-menu__item,')
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
    expect(designerStylesheet).not.toContain('.mx-config-form-designer__canvas-sheet [class*="config-form__row--grid"]')
  })

  it('keeps Preview as an overlay that cannot resize the Design surface', () => {
    const rules = cssRules(stylesheet)
    const previewRule = rules.find(rule => rule.selector === '.preview-pane')
    const overlayRule = rules.find(
      rule => rule.selector === '.workbench-overlays > .preview-drawer-overlay',
    )
    const expandedRule = rules.find(rule => rule.selector === '.preview-drawer-shell.is-expanded')

    expect(selectorBlock('.workbench-layout')).toContain('position: relative;')
    expect(selectorBlock('.workbench-layout')).toContain('grid-template-columns: minmax(0, 1fr);')
    expect(rules.some(rule => rule.selector === '.editor-pane' && rule.body.includes('isolation: isolate;'))).toBe(true)
    expect(overlayRule?.body).toContain('top: 48px !important;')
    expect(overlayRule?.body).toContain('height: auto !important;')
    expect(previewRule?.body).toContain('position: static;')
    expect(expandedRule?.body).toContain('box-shadow: none;')
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
