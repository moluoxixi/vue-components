import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { configFormSourceAliases } from '../../../scripts/workspace-source-aliases'

describe('ConfigForm workspace source resolution', () => {
  const resolveAlias = (name: string) => configFormSourceAliases.find(alias =>
    alias.find instanceof RegExp && alias.find.test(name))

  it('uses the published source contract for each workspace runtime boundary', () => {
    for (const name of [
      '@moluoxixi/config-form',
      '@moluoxixi/config-form-core',
      '@moluoxixi/config-form-headless',
      '@moluoxixi/config-form-model',
      '@moluoxixi/config-form-compiler',
      '@moluoxixi/config-form-vue-backend',
    ]) {
      const alias = resolveAlias(name)
      expect(alias, name).toBeDefined()
      expect(alias!.replacement).toMatch(/\.ts$/)
      expect(existsSync(alias!.replacement)).toBe(true)
    }
  })

  it('does not select unshipped third-party sources or rewrite stylesheet subpaths', () => {
    for (const name of ['scroll-into-view-if-needed', 'ant-design-vue', 'element-plus', '@moluoxixi/config-form/style.css'])
      expect(resolveAlias(name), name).toBeUndefined()
  })
})
