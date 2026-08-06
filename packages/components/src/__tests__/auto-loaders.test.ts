// @vitest-environment node

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as AutoLoaders from '../../auto-loaders'
import { autoComponent, autoImport } from '../../auto-loaders'
import { componentNames } from '../auto-loaders'
import * as ComponentsRoot from '../index'

const componentsPackageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
) as { exports: Record<string, unknown> }

const publicComponentNames = Object.keys(componentsPackageJson.exports)
  .filter(path => /^\.\/[A-Z]/.test(path))
  .map(path => path.slice(2))
  .sort()

describe('component auto loaders', () => {
  it('matches every public component export in both directions', async () => {
    expect([...componentNames]).toEqual(publicComponentNames)

    for (const name of componentNames) {
      expect(await autoComponent(name)).toEqual({
        from: `@moluoxixi/components/${name}`,
        name,
        sideEffects: '@moluoxixi/components/styles',
      })
    }
  })

  it('keeps loader APIs isolated from the component root entry', () => {
    expect(Object.keys(AutoLoaders).sort()).toEqual(['autoComponent', 'autoImport'])
    expect(ComponentsRoot).not.toHaveProperty('autoComponent')
    expect(ComponentsRoot).not.toHaveProperty('autoImport')
  })

  it('does not claim components outside the public entry', async () => {
    expect(await autoComponent('ElButton')).toBeUndefined()
    expect(await autoComponent('InternalComponent')).toBeUndefined()
  })

  it('groups runtime values by their smallest public subpath', () => {
    for (const specifier of Object.keys(autoImport)) {
      const subpath = `.${specifier.slice('@moluoxixi/components'.length)}`
      expect(componentsPackageJson.exports).toHaveProperty(subpath)
    }

    expect(autoImport['@moluoxixi/components/AntdConfigForm']).toEqual(['antdConfigForm'])
    expect(autoImport['@moluoxixi/components/CopyText']).toEqual(['ClipboardCopyError', 'copyText'])
    expect(autoImport['@moluoxixi/components/HeadlessTable']).toContain('useHeadlessTable')
    expect(autoImport['@moluoxixi/components/HeadlessTable']).toContain('createHeadlessTableRendererPlugin')
    expect(autoImport['@moluoxixi/components/configForm']).toContain('defineFields')
  })
})
