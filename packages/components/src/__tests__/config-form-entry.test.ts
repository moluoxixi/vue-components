import * as HeadlessEntry from '@moluoxixi/config-form-headless'
import { describe, expect, it } from 'vitest'
import { AntdConfigForm as LocalAntdConfigForm } from '../AntdConfigForm'
import { ElementConfigForm as LocalElementConfigForm } from '../ElementConfigForm'
import AntdConfigFormDefault, { AntdConfigForm, antdConfigForm } from '../entries/antd'
import ElementConfigFormDefault, { ElementConfigForm } from '../entries/element'
import * as ComponentsRoot from '../index'

describe('pure ConfigForm entry points', () => {
  it('exports the local Element implementation without a runtime plugin layer', () => {
    expect(ElementConfigForm).toBe(LocalElementConfigForm)
    expect(ElementConfigFormDefault).toBe(LocalElementConfigForm)
  })

  it('exports the local Antd implementation without a runtime plugin layer', () => {
    expect(AntdConfigForm).toBe(LocalAntdConfigForm)
    expect(antdConfigForm).toBe(LocalAntdConfigForm)
    expect(AntdConfigFormDefault).toBe(LocalAntdConfigForm)
  })

  it('keeps the root entry independent from external ConfigForm implementations', () => {
    expect(ComponentsRoot.ElementConfigForm).toBe(LocalElementConfigForm)
    expect(ComponentsRoot.AntdConfigForm).toBe(LocalAntdConfigForm)
    expect(ComponentsRoot.defineField).toBe(HeadlessEntry.defineField)
    expect(ComponentsRoot.defineFields).toBe(HeadlessEntry.defineFields)
    expect(ComponentsRoot.createConfigFormController).toBe(HeadlessEntry.createConfigFormController)
  })
})
