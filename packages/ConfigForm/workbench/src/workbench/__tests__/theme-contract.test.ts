import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8')
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

function selectorBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = stylesheet.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  if (!match)
    throw new Error(`Missing CSS selector: ${selector}`)
  return match[1]!
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
  it.each([
    ['.workbench-app', '--wb-text', '--wb-surface', 4.5],
    ['.workbench-app', '--wb-muted', '--wb-surface', 4.5],
    ['.workbench-app', '--wb-control-border', '--wb-surface', 3],
    ['.workbench-app', '--wb-accent', '--wb-surface', 3],
    ['.workbench-app[data-theme="light"]', '--wb-text', '--wb-surface', 4.5],
    ['.workbench-app[data-theme="light"]', '--wb-muted', '--wb-surface', 4.5],
    ['.workbench-app[data-theme="light"]', '--wb-control-border', '--wb-surface', 3],
    ['.workbench-app[data-theme="light"]', '--wb-accent', '--wb-surface', 3],
  ] as const)('%s keeps %s readable against %s', (selector, foreground, background, minimum) => {
    expect(contrast(
      colorVariable(selector, foreground),
      colorVariable(selector, background),
    )).toBeGreaterThanOrEqual(minimum)
  })

  it('keeps interaction styling and runtime canvas tokens explicit', () => {
    expect(stylesheet).toContain('.topbar-actions button:hover:not(:disabled),')
    expect(stylesheet).toContain('.export-preview-dialog > header button:hover:not(:disabled)')
    expect(stylesheet).toContain('--el-segmented-item-selected-bg-color: var(--mx-designer-accent);')
    expect(stylesheet).toContain('--mx-designer-canvas-sheet: #fff;')
    expect(stylesheet).toContain('--mx-designer-runtime-text: #24262b;')
    expect(stylesheet).toContain('--mx-designer-runtime-surface: #fff;')
    expect(designerStylesheet).toContain('--mx-designer-runtime-surface: #ffffff;')
    expect(designerStylesheet).toContain('--mx-designer-surface: var(--mx-designer-runtime-surface, #fff);')
  })

  it('keeps every provider theme rule inside the dark Inspector scope', () => {
    const providerRules = cssRules(stylesheet).filter(({ body, selector }) =>
      body.includes('--el-') || selector.includes('.el-') || selector.includes('.ant-'),
    )
    const scope = /^\.workbench-app\[data-theme="dark"\] \.embedded-designer \.mx-config-form-designer__properties(?:\s|$)/

    expect(providerRules.length).toBeGreaterThan(0)
    for (const rule of providerRules) {
      for (const selector of rule.selector.split(','))
        expect(selector.trim()).toMatch(scope)
    }
  })

  it('keeps export and narrow runtime surfaces responsive to their context', () => {
    expect(selectorBlock('.export-preview-body')).toContain('background: var(--wb-editor-surface);')
    expect(selectorBlock('.preview-canvas')).toContain('container-name: preview-canvas;')
    expect(stylesheet).toContain('@container preview-canvas (max-width: 520px) {')
    expect(stylesheet).toContain('.page-preview-form [class*="config-form__row--grid"] {\n    gap: 12px 6px !important;')
    expect(designerStylesheet).toContain('.mx-config-form-designer__canvas-sheet [class*="config-form__row--grid"] {\n  gap: 12px 6px !important;')
  })
})
