import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { autoComponent, autoImport } from '../index'
import { componentNames } from '../src/auto-loaders'

const componentsPackageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../components/package.json', import.meta.url)), 'utf8'),
) as { exports: Record<string, unknown> }

describe('component auto loaders', () => {
  it('resolves every public component with its package stylesheet', async () => {
    for (const name of componentNames) {
      expect(componentsPackageJson.exports).toHaveProperty(`./${name}`)
      expect(await autoComponent(name)).toEqual({
        from: `@moluoxixi/components/${name}`,
        name,
        sideEffects: '@moluoxixi/components/styles',
      })
    }
  })

  it('does not claim components outside the public entry', async () => {
    expect(await autoComponent('ElButton')).toBeUndefined()
    expect(await autoComponent('InternalComponent')).toBeUndefined()
  })

  it('groups runtime values by their smallest public subpath', () => {
    expect(autoImport['@moluoxixi/components/AntdConfigForm']).toEqual(['antdConfigForm'])
    expect(autoImport['@moluoxixi/components/CopyText']).toEqual(['ClipboardCopyError', 'copyText'])
    expect(autoImport['@moluoxixi/components/HeadlessTable']).toContain('useHeadlessTable')
    expect(autoImport['@moluoxixi/components/configForm']).toContain('defineFields')

    expect(Object.values(autoImport).flat()).toEqual(expect.arrayContaining([
      'antdConfigForm',
      'copyText',
      'defineFields',
      'useHeadlessTable',
    ]))
  })
})
