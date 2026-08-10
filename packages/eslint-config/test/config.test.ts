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
})
