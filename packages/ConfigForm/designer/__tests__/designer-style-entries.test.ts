import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compile } from 'sass'
import { describe, expect, it } from 'vitest'

const packageRoot = process.cwd()
const loadPaths = [resolve(packageRoot, 'node_modules')]

function compileStyle(relativePath: string): string {
  return compile(resolve(packageRoot, relativePath), { loadPaths }).css
}

describe('designer component Sass entries', () => {
  it('keeps the compatibility aggregate while removing tag-level provider overrides', () => {
    const css = compileStyle('src/styles.scss')

    expect(css).toContain('.mx-config-form-designer__palette-item')
    expect(css).toContain('.mx-config-form-designer__canvas-sheet')
    expect(css).toContain('.mx-config-form-designer__property-heading')
    expect(css).not.toMatch(/\.mx-config-form-designer input:focus-visible/)
    expect(css).not.toMatch(/\.mx-config-form-designer textarea:focus-visible/)
    expect(css).not.toMatch(/\.mx-config-form-designer select:focus-visible/)
    expect(css).not.toContain('.mx-config-form-designer__setter input:not([type=checkbox])')
    expect(css).toContain('.mx-config-form-designer__setter > input:not([type=checkbox])')
    expect(css).toContain('.mx-config-form-designer__search input:focus-visible')
  })

  it.each([
    {
      entry: 'src/components/DesignerCanvas/style/index.scss',
      includes: '.mx-config-form-designer__canvas-sheet',
      excludes: ['.mx-config-form-designer__palette-item {', '.mx-config-form-designer__property-heading'],
    },
    {
      entry: 'src/components/DesignerPalette/style/index.scss',
      includes: '.mx-config-form-designer__palette-item {',
      excludes: ['.mx-config-form-designer__canvas-sheet', '.mx-config-form-designer__property-heading'],
    },
    {
      entry: 'src/components/DesignerMaterialSpecimen/style/index.scss',
      includes: '.mx-config-form-designer__palette-item-preview',
      excludes: ['.mx-config-form-designer__palette-item {', '.mx-config-form-designer__canvas-sheet'],
    },
    {
      entry: 'src/components/DesignerPropertyPanel/style/index.scss',
      includes: '.mx-config-form-designer__property-heading',
      excludes: ['.mx-config-form-designer__palette-item {', '.mx-config-form-designer__canvas-sheet'],
    },
  ])('$entry contains only its component family', ({ entry, excludes, includes }) => {
    const css = compileStyle(entry)

    expect(css).toContain(includes)
    for (const selector of excludes)
      expect(css).not.toContain(selector)
  })

  it('publishes stable Sass subpaths for public visual components', () => {
    const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
      exports: Record<string, { sass?: string }>
      sideEffects: string[]
    }

    expect(manifest.sideEffects).toContain('**/style/index.ts')
    for (const component of [
      'design-surface',
      'designer-canvas',
      'designer-palette',
      'designer-material-specimen',
      'designer-property-panel',
    ]) {
      expect(manifest.exports[`./${component}/style`]?.sass).toMatch(/\/style\/index\.scss$/)
    }
  })

  it('keeps styled Vue components connected to their own style modules', () => {
    const components = [
      ['src/components/DesignSurface/index.vue', './style'],
      ['src/components/DesignerCanvas/index.vue', './style'],
      ['src/components/DesignerPalette/index.vue', './style'],
      ['src/components/DesignerMaterialSpecimen.vue', './DesignerMaterialSpecimen/style'],
      ['src/components/DesignerPropertyPanel/index.vue', './style'],
      ['src/components/DesignerPropertyPanel/components/DesignerPropertyForm.vue', './DesignerPropertyForm/style'],
      ['src/components/DesignerPropertyPanel/components/DesignerSetter.vue', './DesignerSetter/style'],
      ['src/components/DesignerPropertyPanel/components/DesignerResponsiveSettings.vue', './DesignerResponsiveSettings/style'],
      ['src/components/DesignerPropertyPanel/components/DesignerBreakpointLayoutSettings.vue', './DesignerBreakpointLayoutSettings/style'],
      ['src/components/DesignerPropertyPanel/components/DesignerDefaultValueSetter.vue', './DesignerDefaultValueSetter/style'],
      ['src/components/DesignerPropertyPanel/components/DesignerConditionSetter.vue', './DesignerConditionSetter/style'],
      ['src/components/DesignerPropertyPanel/components/DesignerReactionSetter.vue', './DesignerReactionSetter/style'],
      ['src/components/DesignerPropertyPanel/components/DesignerOptionsSetter.vue', './DesignerOptionsSetter/style'],
      ['src/components/DesignerPropertyPanel/components/DesignerValidationSetter.vue', './DesignerValidationSetter/style'],
    ] as const

    for (const [component, styleImport] of components) {
      const componentPath = resolve(packageRoot, component)
      expect(readFileSync(componentPath, 'utf8')).toContain(`import '${styleImport}'`)
      const styleDirectory = component.endsWith('/index.vue')
        ? resolve(componentPath, '../style')
        : resolve(componentPath, `../${component.split('/').at(-1)!.replace(/\.vue$/, '')}/style`)
      expect(existsSync(resolve(styleDirectory, 'index.scss'))).toBe(true)
      expect(existsSync(resolve(styleDirectory, 'index.ts'))).toBe(true)
    }
  })
})
