import { describe, expect, it } from 'vitest'
import { createEslintConfig } from '../src/index'

describe('createEslintConfig', () => {
  it('merges shared ignores and caller ignores', async () => {
    const configs = await createEslintConfig({
      ignores: ['fixtures/**'],
    })

    const ignores = configs
      .flatMap(config => config.ignores ?? [])

    expect(ignores).toContain('.husky/**')
    expect(ignores).toContain('**/dist/**')
    expect(ignores).toContain('fixtures/**')
  })

  it('keeps generic style rules overridable by callers', async () => {
    const configs = await createEslintConfig({
      rules: {
        'vue/block-order': 'off',
      },
    })

    const rules = Object.assign({}, ...configs.map(config => config.rules ?? {}))

    expect(rules['style/spaced-comment']).toEqual(['error', 'always', {
      line: {
        markers: [
          '#region',
          '#endregion',
        ],
      },
    }])
    expect(rules['vue/block-order']).toBe('off')
  })

  it('does not emit Vue rules when Vue support is disabled', async () => {
    const configs = await createEslintConfig({ vue: false })
    const rules = Object.assign({}, ...configs.map(config => config.rules ?? {}))

    expect(rules['style/spaced-comment']).toBeDefined()
    expect(rules).not.toHaveProperty('vue/block-order')
  })

  it('scopes auto-detected Vue rules to Vue files', async () => {
    const configs = await createEslintConfig()
    const vueConfig = configs.find(config => (
      config.files?.includes('**/*.vue') && config.rules?.['vue/block-order']
    ))
    const nonVueConfigs = configs.filter(config => !config.files?.includes('**/*.vue'))

    expect(vueConfig?.rules?.['vue/block-order']).toBeDefined()
    expect(nonVueConfigs.every(config => !config.rules?.['vue/block-order'])).toBe(true)
  })

  it('formats embedded Markdown code with the shared Prettier options', async () => {
    const configs = await createEslintConfig()
    const markdownConfig = configs.filter(config => (
      config.files?.includes('**/*.md') && config.rules?.['format/prettier']
    )).at(-1)
    const formatRule = markdownConfig?.rules?.['format/prettier']

    expect(formatRule).toEqual(['error', expect.objectContaining({
      arrowParens: 'avoid',
      endOfLine: 'auto',
      embeddedLanguageFormatting: 'auto',
      parser: 'markdown',
      printWidth: 120,
      semi: false,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'all',
      useTabs: false,
    })])
  })
})
