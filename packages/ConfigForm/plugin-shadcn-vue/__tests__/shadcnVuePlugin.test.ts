import type { ReadonlyAdapter, ReadonlyRenderContext } from '@moluoxixi/config-form/plugins'
import { defineField } from '@moluoxixi/config-form'
import { createFormRuntime } from '@moluoxixi/config-form/plugins'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createShadcnVuePlugin } from '../src'

const Input = { name: 'Input' }
const NativeSelect = { name: 'NativeSelect' }
const Textarea = { name: 'Textarea' }
const Slider = { name: 'Slider' }

/** 将 runtime 返回节点收窄为字段节点；本测试只传入带 field 的配置。 */
function asField(node: unknown): ReadonlyRenderContext['node'] {
  return node as ReadonlyRenderContext['node']
}

/** 将 readonly adapter 渲染成 DOM，测试只断言最终展示契约。 */
function renderReadonly(adapter: ReadonlyAdapter, context: ReadonlyRenderContext) {
  return mount(defineComponent({
    name: 'ReadonlyAdapterHarness',
    setup: () => () => h('div', undefined, adapter(context) ?? ''),
  }))
}

describe('shadcn vue plugin package', () => {
  it('provides shadcn-vue bindings through the default-field lifecycle', () => {
    const plugin = createShadcnVuePlugin({
      components: { Input, NativeSelect, Textarea },
    })

    expect(plugin).toHaveProperty('getDefaultField')
    expect(plugin).toHaveProperty('components')
    expect(plugin).not.toHaveProperty('transformField')
  })

  it('registers caller supplied shadcn-vue components for string fields', () => {
    const runtime = createFormRuntime({
      plugins: [
        createShadcnVuePlugin({
          components: { Input, NativeSelect, Textarea },
        }),
      ],
    })

    const input = asField(runtime.transformField(defineField({ component: 'Input', field: 'name' })))
    const select = asField(runtime.transformField(defineField({ component: 'NativeSelect', field: 'plan' })))
    const textarea = asField(runtime.transformField(defineField({ component: 'Textarea', field: 'notes' })))

    expect(input.component).toBe(Input)
    expect(select.component).toBe(NativeSelect)
    expect(textarea.component).toBe(Textarea)
  })

  it('maps shadcn-vue fields to modelValue/update:modelValue', () => {
    const runtime = createFormRuntime({
      plugins: [
        createShadcnVuePlugin({
          components: { Input, NativeSelect, Textarea },
        }),
      ],
    })

    const input = asField(runtime.transformField(defineField({ component: Input, field: 'name' })))
    const select = asField(runtime.transformField(defineField({ component: NativeSelect, field: 'plan' })))
    const textarea = asField(runtime.transformField(defineField({ component: Textarea, field: 'notes' })))

    expect(input.valueProp).toBe('modelValue')
    expect(input.trigger).toBe('update:modelValue')
    expect(select.valueProp).toBe('modelValue')
    expect(select.trigger).toBe('update:modelValue')
    expect(textarea.valueProp).toBe('modelValue')
    expect(textarea.trigger).toBe('update:modelValue')
  })

  it('keeps explicit field binding contracts unchanged', () => {
    const runtime = createFormRuntime({
      plugins: [
        createShadcnVuePlugin({
          components: { Input },
        }),
      ],
    })
    const field = asField(runtime.transformField(defineField({
      component: Input,
      field: 'custom',
      trigger: 'change',
      valueProp: 'customValue',
    })))

    expect(field.valueProp).toBe('customValue')
    expect(field.trigger).toBe('change')
  })

  it('supports user binding overrides and additional component keys', () => {
    const runtime = createFormRuntime({
      plugins: [
        createShadcnVuePlugin({
          bindings: {
            Input: { trigger: 'change', valueProp: 'value' },
            Slider: {
              props: { orientation: 'horizontal' },
              trigger: 'update:modelValue',
              valueProp: 'modelValue',
            },
          },
          components: { Input, Slider },
        }),
      ],
    })

    const input = asField(runtime.transformField(defineField({ component: 'Input', field: 'name' })))
    const slider = asField(runtime.transformField(defineField({ component: 'Slider', field: 'progress' })))

    expect(input.valueProp).toBe('value')
    expect(input.trigger).toBe('change')
    expect(slider.component).toBe(Slider)
    expect(slider.valueProp).toBe('modelValue')
    expect(slider.props.orientation).toBe('horizontal')
  })

  it('leaves non-field container nodes on the core component contract', () => {
    const runtime = createFormRuntime({
      plugins: [
        createShadcnVuePlugin({
          components: { Input },
        }),
      ],
    })

    const container = runtime.transformField(defineField({
      component: 'section',
      props: { class: 'settings-section' },
    }))

    expect(container.component).toBe('section')
    expect(container.props.class).toBe('settings-section')
  })

  it('rejects registered shadcn-vue component keys without bindings by default', () => {
    const strictRuntime = createFormRuntime({
      plugins: [
        createShadcnVuePlugin({
          components: { Slider },
        }),
      ],
    })
    const looseRuntime = createFormRuntime({
      plugins: [
        createShadcnVuePlugin({
          components: { Slider },
          strict: false,
        }),
      ],
    })

    const looseSlider = asField(looseRuntime.transformField(defineField({ component: 'Slider', field: 'progress' })))

    expect(looseSlider.component).toBe(Slider)
    expect(looseSlider.valueProp).toBe('modelValue')
    expect(() => strictRuntime.transformField(defineField({ component: 'Slider', field: 'progress' })))
      .toThrow(/Unknown shadcn-vue component binding: Slider/)
  })

  it('exposes readonly adapters for raw text and NativeSelect labels', () => {
    const runtime = createFormRuntime({
      plugins: [
        createShadcnVuePlugin({
          components: { Input, NativeSelect, Textarea },
        }),
      ],
    })

    const selectField = asField(runtime.transformField(defineField({
      component: 'NativeSelect',
      field: 'plan',
      props: {
        options: [
          { label: 'Starter / 单人项目', value: 'starter' },
          { label: 'Pro / 团队协作', value: 'pro' },
          { label: 'Enterprise / 企业治理', value: 'enterprise' },
        ],
      },
    })))
    const inputField = asField(runtime.transformField(defineField({
      component: 'Input',
      field: 'accountName',
    })))

    expect(renderReadonly(runtime.readonlyAdapters.NativeSelect, {
      field: 'plan',
      node: selectField,
      value: 'enterprise',
      values: { plan: 'enterprise' },
    }).text()).toBe('Enterprise / 企业治理')
    expect(renderReadonly(runtime.readonlyAdapters.NativeSelect, {
      field: 'plan',
      node: selectField,
      value: ['starter', 'pro'],
      values: { plan: ['starter', 'pro'] },
    }).text()).toBe('Starter / 单人项目、Pro / 团队协作')
    expect(renderReadonly(runtime.readonlyAdapters.NativeSelect, {
      field: 'plan',
      node: selectField,
      value: 'custom',
      values: { plan: 'custom' },
    }).text()).toBe('custom')
    expect(renderReadonly(runtime.readonlyAdapters.NativeSelect, {
      field: 'plan',
      node: selectField,
      value: ['starter', 'custom'],
      values: { plan: ['starter', 'custom'] },
    }).text()).toBe('Starter / 单人项目、custom')
    expect(renderReadonly(runtime.readonlyAdapters.Input, {
      field: 'accountName',
      node: inputField,
      value: 'Moluoxixi Cloud',
      values: { accountName: 'Moluoxixi Cloud' },
    }).text()).toBe('Moluoxixi Cloud')
  })

  it('allows user readonly adapters to override plugin defaults', () => {
    const override: ReadonlyAdapter = ({ value }) => h('span', `override:${String(value)}`)
    const runtime = createFormRuntime({
      plugins: [
        createShadcnVuePlugin({
          readonlyAdapters: {
            NativeSelect: override,
          },
        }),
      ],
    })

    expect(runtime.readonlyAdapters.NativeSelect).toBe(override)
  })
})
