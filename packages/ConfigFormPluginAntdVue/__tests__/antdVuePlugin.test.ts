import type { NormalizedFieldConfig } from '@moluoxixi/config-form/plugins'
import { defineField } from '@moluoxixi/config-form'
import { createFormRuntime } from '@moluoxixi/config-form/plugins'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createAntdVuePlugin } from '../src'

const AInput = { name: 'AInput' }
const ASwitch = { name: 'ASwitch' }
const ACheckbox = { name: 'ACheckbox' }
const ACheckboxGroup = { name: 'ACheckboxGroup' }
const ATextarea = { name: 'ATextarea' }
const ASelect = { name: 'ASelect' }
const ASlider = { name: 'ASlider' }
const ARadioGroup = { name: 'ARadioGroup' }
const AUnknown = { name: 'AUnknown' }
const CustomInput = { name: 'CustomInput' }

/** 将 runtime 返回节点收窄为字段节点；本测试只传入带 field 的配置。 */
function asField(node: unknown): NormalizedFieldConfig {
  return node as NormalizedFieldConfig
}

/** 将 readonly adapter 渲染成可断言的 DOM，保持测试只关心展示结果。 */
function renderReadonly(adapter: (context: Record<string, unknown>) => unknown, context: Record<string, unknown>) {
  return mount(defineComponent({
    name: 'ReadonlyAdapterHarness',
    setup: () => () => h('div', adapter(context)),
  }))
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

  it('exposes readonly adapters for select, checkbox group, radio group, and switch labels', () => {
    const runtime = createFormRuntime({
      plugins: [createAntdVuePlugin()],
    })

    const selectField = asField(runtime.transformField(defineField({
      component: ASelect,
      field: 'role',
      props: {
        options: [
          { label: '管理员', value: 'admin' },
          { label: '用户', value: 'user' },
        ],
      },
    })))
    const checkboxGroupField = asField(runtime.transformField(defineField({
      component: ACheckboxGroup,
      field: 'permissions',
      props: {
        options: [
          { label: '读', value: 'read' },
          { label: '写', value: 'write' },
          { label: '审', value: 'audit' },
        ],
      },
    })))
    const radioGroupField = asField(runtime.transformField(defineField({
      component: ARadioGroup,
      field: 'status',
      props: {
        options: [
          { label: '启用', value: 'enabled' },
          { label: '停用', value: 'disabled' },
        ],
      },
    })))
    const switchField = asField(runtime.transformField(defineField({
      component: ASwitch,
      field: 'enabled',
      props: {
        checkedChildren: '开启',
        unCheckedChildren: '关闭',
      },
    })))

    expect(renderReadonly(runtime.readonlyAdapters.ASelect, {
      field: 'role',
      node: selectField,
      value: 'admin',
      values: { role: 'admin' },
    }).text()).toBe('管理员')
    expect(renderReadonly(runtime.readonlyAdapters.ACheckboxGroup, {
      field: 'permissions',
      node: checkboxGroupField,
      value: ['read', 'audit'],
      values: { permissions: ['read', 'audit'] },
    }).text()).toBe('读、审')
    expect(renderReadonly(runtime.readonlyAdapters.ARadioGroup, {
      field: 'status',
      node: radioGroupField,
      value: 'disabled',
      values: { status: 'disabled' },
    }).text()).toBe('停用')
    expect(renderReadonly(runtime.readonlyAdapters.ASwitch, {
      field: 'enabled',
      node: switchField,
      value: true,
      values: { enabled: true },
    }).text()).toBe('开启')
  })

  it('allows user readonly adapters to override plugin defaults', () => {
    const override = ({ value }: Record<string, unknown>) => h('span', `override:${String(value)}`)
    const runtime = createFormRuntime({
      plugins: [
        createAntdVuePlugin({
          readonlyAdapters: {
            ASelect: override,
          },
        }),
      ],
    })

    expect(runtime.readonlyAdapters.ASelect).toBe(override)
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
