import { describe, expect, it } from 'vitest'
import { autoComponent } from '../../autoComponent'
import { autoImport } from '../../autoImport'
import * as ComponentsRoot from '../index'

const componentNames = [
  'AntdConfigForm',
  'ConfigTable',
  'CopyText',
  'DateRangePicker',
  'ElementConfigForm',
  'EnterNextContainer',
  'HeadlessCopyText',
  'HeadlessTable',
  'PopoverTableSelect',
  'RequestCascader',
  'RequestSelectV2',
  'RequestTreeSelect',
  'RichTextEditor',
]

describe('component auto loaders', () => {
  it('resolves every public component with its package stylesheet', async () => {
    for (const name of componentNames) {
      expect(ComponentsRoot).toHaveProperty(name)
      expect(await autoComponent(name)).toEqual({
        from: '@moluoxixi/components',
        name,
        sideEffects: '@moluoxixi/components/styles',
      })
    }
  })

  it('does not claim components outside the public entry', async () => {
    expect(await autoComponent('ElButton')).toBeUndefined()
    expect(await autoComponent('InternalComponent')).toBeUndefined()
  })

  it('only exposes runtime values from the root package entry', () => {
    const entries = autoImport['@moluoxixi/components']

    expect(entries).toContain('copyText')
    expect(entries).toContain('defineFields')
    expect(entries).toContain('useHeadlessTable')
    expect(entries).not.toContain('CopyText')
    entries.forEach(name => expect(ComponentsRoot).toHaveProperty(name))
  })
})
