import type { NormalizedFieldConfig } from '@moluoxixi/config-form/plugins'
import { defineField } from '@moluoxixi/config-form'
import { createFormRuntime } from '@moluoxixi/config-form/plugins'
import { describe, expect, it } from 'vitest'
import { createAntdVuePlugin } from '../src'

const AInput = { name: 'AInput' }
const ASwitch = { name: 'ASwitch' }
const ACheckbox = { name: 'ACheckbox' }
const ATextarea = { name: 'ATextarea' }
const ASelect = { name: 'ASelect' }
const ASlider = { name: 'ASlider' }
const AUnknown = { name: 'AUnknown' }
const CustomInput = { name: 'CustomInput' }

/** 将 runtime 返回节点收窄为字段节点；本测试只传入带 field 的配置。 */
function asField(node: unknown): NormalizedFieldConfig {
  return node as NormalizedFieldConfig
}

describe('antd vue plugin package', () => {
  it('provides Ant Design Vue bindings through the default-field lifecycle', () => {
    const plugin = createAntdVuePlugin()

    expect(plugin).toHaveProperty('getDefaultField')
    expect(plugin).not.toHaveProperty('transformField')
  })

  it('maps Ant Design Vue value components to value/update:value', () => {
    const runtime = createFormRuntime({
      plugins: [createAntdVuePlugin()],
    })

    const input = asField(runtime.transformField(defineField({ component: AInput, field: 'name' })))
    const textarea = asField(runtime.transformField(defineField({ component: ATextarea, field: 'bio' })))
    const select = asField(runtime.transformField(defineField({ component: ASelect, field: 'role' })))
    const slider = asField(runtime.transformField(defineField({ component: ASlider, field: 'progress' })))

    expect(input.valueProp).toBe('value')
    expect(input.trigger).toBe('update:value')
    expect(textarea.valueProp).toBe('value')
    expect(select.trigger).toBe('update:value')
    expect(slider.valueProp).toBe('value')
  })

  it('supports string component names and leaves unnamed components on the core binding', () => {
    const runtime = createFormRuntime({
      components: { AInput },
      plugins: [createAntdVuePlugin()],
    })

    const stringComponent = asField(runtime.transformField(defineField({ component: 'AInput', field: 'stringName' })))
    const unnamedObject = asField(runtime.transformField(defineField({ component: {}, field: 'unnamedObject' })))
    const emptyComponent = asField(runtime.transformField(defineField({ component: null as never, field: 'emptyComponent' })))

    expect(stringComponent.valueProp).toBe('value')
    expect(stringComponent.trigger).toBe('update:value')
    expect(unnamedObject.valueProp).toBe('modelValue')
    expect(emptyComponent.trigger).toBe('update:modelValue')
  })

  it('maps Ant Design Vue checked components to checked/update:checked', () => {
    const runtime = createFormRuntime({
      plugins: [createAntdVuePlugin()],
    })

    const switchField = asField(runtime.transformField(defineField({ component: ASwitch, field: 'enabled' })))
    const checkboxField = asField(runtime.transformField(defineField({ component: ACheckbox, field: 'accepted' })))

    expect(switchField.valueProp).toBe('checked')
    expect(switchField.trigger).toBe('update:checked')
    expect(checkboxField.valueProp).toBe('checked')
    expect(checkboxField.trigger).toBe('update:checked')
  })

  it('keeps explicit field binding contracts unchanged', () => {
    const runtime = createFormRuntime({
      plugins: [createAntdVuePlugin()],
    })
    const field = asField(runtime.transformField(defineField({
      component: AInput,
      field: 'custom',
      trigger: 'change',
      valueProp: 'customValue',
    })))

    expect(field.valueProp).toBe('customValue')
    expect(field.trigger).toBe('change')
  })

  it('supports user binding overrides and additional component names', () => {
    const runtime = createFormRuntime({
      plugins: [
        createAntdVuePlugin({
          bindings: {
            AInput: { trigger: 'change', valueProp: 'text' },
            ATransfer: { trigger: 'update:targetKeys', valueProp: 'targetKeys' },
          },
        }),
      ],
    })

    const input = asField(runtime.transformField(defineField({ component: AInput, field: 'name' })))
    const transfer = asField(runtime.transformField(defineField({ component: { name: 'ATransfer' }, field: 'targets' })))

    expect(input.valueProp).toBe('text')
    expect(input.trigger).toBe('change')
    expect(transfer.valueProp).toBe('targetKeys')
    expect(transfer.trigger).toBe('update:targetKeys')
  })

  it('rejects AntD-like unknown names by default and allows explicit loose mode', () => {
    const strictRuntime = createFormRuntime({
      plugins: [createAntdVuePlugin()],
    })
    const looseRuntime = createFormRuntime({
      plugins: [createAntdVuePlugin({ strict: false })],
    })

    const unknown = asField(looseRuntime.transformField(defineField({ component: AUnknown, field: 'unknown' })))
    const custom = asField(looseRuntime.transformField(defineField({ component: CustomInput, field: 'custom' })))

    expect(unknown.valueProp).toBe('modelValue')
    expect(custom.trigger).toBe('update:modelValue')
    expect(() => strictRuntime.transformField(defineField({ component: AUnknown, field: 'unknown' })))
      .toThrow(/Unknown Ant Design Vue component binding: AUnknown/)
  })

  it('injects ASwitch props style width 44px when no user style is declared', () => {
    const runtime = createFormRuntime({
      plugins: [createAntdVuePlugin()],
    })

    const switchField = asField(runtime.transformField(
      defineField({ component: ASwitch, field: 'enabled' }),
    ))

    expect((switchField.props.style as Record<string, unknown>)?.width).toBe('44px')
  })

  it('deep merges ASwitch props with user props, user values take priority', () => {
    const runtime = createFormRuntime({
      plugins: [createAntdVuePlugin()],
    })

    const switchField = asField(runtime.transformField(
      defineField({
        component: ASwitch,
        field: 'enabled',
        props: { style: { width: '60px', color: 'red' } },
      }),
    ))

    expect((switchField.props.style as Record<string, unknown>)?.width).toBe('60px')
    expect((switchField.props.style as Record<string, unknown>)?.color).toBe('red')
  })
})
