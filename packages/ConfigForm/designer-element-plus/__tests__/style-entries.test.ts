import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compile } from 'sass'
import { describe, expect, it } from 'vitest'

const packageRoot = process.cwd()

function compileStyle(relativePath: string): string {
  return compile(resolve(packageRoot, relativePath)).css
}

describe('element Plus designer component Sass entries', () => {
  it('keeps the aggregate style entry compatible', () => {
    const css = compileStyle('src/styles/index.scss')

    expect(css).toContain('.mx-element-designer-section')
    expect(css).toContain('.mx-element-flex-layout')
    expect(css).toContain('.mx-element-grid-layout')
    expect(css).toContain('.mx-element-designer-choice-field')
    expect(css).toContain('.mx-element-designer-option-state')
  })

  it.each([
    {
      entry: 'src/materials/components/ElementSection/style/index.scss',
      includes: '.mx-element-designer-section',
      excludes: ['.mx-element-flex-layout', '.mx-element-grid-layout'],
    },
    {
      entry: 'src/materials/components/ElementFlexLayout/style/index.scss',
      includes: '.mx-element-flex-layout',
      excludes: ['.mx-element-designer-section', '.mx-element-grid-layout'],
    },
    {
      entry: 'src/materials/components/ElementGridLayout/style/index.scss',
      includes: '.mx-element-grid-layout',
      excludes: ['.mx-element-designer-section', '.mx-element-flex-layout'],
    },
    {
      entry: 'src/materials/components/ElementSelectField/style/index.scss',
      includes: '.mx-element-designer-choice-field',
      excludes: ['.mx-element-designer-option-state', '.mx-element-flex-layout'],
    },
    {
      entry: 'src/materials/components/ElementOptionState/style/index.scss',
      includes: '.mx-element-designer-option-state',
      excludes: ['.mx-element-designer-choice-field', '.mx-element-grid-layout'],
    },
  ])('$entry excludes unrelated component styles', ({ entry, excludes, includes }) => {
    const css = compileStyle(entry)

    expect(css).toContain(includes)
    for (const selector of excludes)
      expect(css).not.toContain(selector)
  })

  it('publishes a Sass entry for every styled adapter component', () => {
    const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
      exports: Record<string, { sass?: string }>
      sideEffects: string[]
    }

    expect(manifest.sideEffects).toContain('**/style/index.ts')
    expect(manifest.sideEffects).toContain('**/*.scss')
    for (const component of [
      'element-section',
      'element-flex-layout',
      'element-grid-layout',
      'element-checkbox-field',
      'element-radio-field',
      'element-select-field',
      'element-option-state',
      'element-option-source-setter',
      'element-choice-default-setter',
    ]) {
      expect(manifest.exports[`./${component}/style`]?.sass).toMatch(/\/style\/index\.scss$/)
    }
  })
})
