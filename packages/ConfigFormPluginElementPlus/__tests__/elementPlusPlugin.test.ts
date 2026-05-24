import type { ReadonlyAdapter, ReadonlyRenderContext } from '@moluoxixi/config-form/plugins'
import { defineField } from '@moluoxixi/config-form'
import { createFormRuntime } from '@moluoxixi/config-form/plugins'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createElementPlusPlugin } from '../src'

const ElSelectV2 = { name: 'ElSelectV2' }
const ElCheckboxGroup = { name: 'ElCheckboxGroup' }
const ElRadioGroup = { name: 'ElRadioGroup' }
const ElSwitch = { name: 'ElSwitch' }
const ElColorPicker = { name: 'ElColorPicker' }

/** 只读适配器渲染器；测试只关心最终文本和样式结果。 */
function renderReadonly(adapter: ReadonlyAdapter, context: ReadonlyRenderContext) {
  return mount(defineComponent({
    name: 'ReadonlyAdapterHarness',
    setup: () => () => h('div', undefined, adapter(context) ?? ''),
  }))
}

/** 将 runtime 返回节点收窄为字段节点，便于读取 props。 */
function asField(node: unknown): ReadonlyRenderContext['node'] {
  return node as ReadonlyRenderContext['node']
}

describe('element plus plugin package', () => {
  it('exposes readonly adapters and supports select, checkbox group, radio group, switch, and color swatches', () => {
    const runtime = createFormRuntime({
      plugins: [createElementPlusPlugin()],
    })

    const selectField = asField(runtime.transformField(defineField({
      component: ElSelectV2,
      field: 'role',
      props: {
        options: [
          { label: '管理员', value: 'admin' },
          { label: '用户', value: 'user' },
        ],
      },
    })))
    const checkboxGroupField = asField(runtime.transformField(defineField({
      component: ElCheckboxGroup,
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
      component: ElRadioGroup,
      field: 'status',
      props: {
        options: [
          { label: '启用', value: 'enabled' },
          { label: '停用', value: 'disabled' },
        ],
      },
    })))
    const switchField = asField(runtime.transformField(defineField({
      component: ElSwitch,
      field: 'enabled',
      props: {
        activeText: '开启',
        inactiveText: '关闭',
      },
    })))
    const colorField = asField(runtime.transformField(defineField({
      component: ElColorPicker,
      field: 'themeColor',
    })))

    expect(runtime.readonlyAdapters.ElSelectV2).toBeDefined()
    expect(renderReadonly(runtime.readonlyAdapters.ElSelectV2, {
      field: 'role',
      node: selectField,
      value: 'admin',
      values: { role: 'admin' },
    }).text()).toBe('管理员')
    expect(renderReadonly(runtime.readonlyAdapters.ElCheckboxGroup, {
      field: 'permissions',
      node: checkboxGroupField,
      value: ['read', 'audit'],
      values: { permissions: ['read', 'audit'] },
    }).text()).toBe('读、审')
    expect(renderReadonly(runtime.readonlyAdapters.ElRadioGroup, {
      field: 'status',
      node: radioGroupField,
      value: 'disabled',
      values: { status: 'disabled' },
    }).text()).toBe('停用')
    expect(renderReadonly(runtime.readonlyAdapters.ElSwitch, {
      field: 'enabled',
      node: switchField,
      value: true,
      values: { enabled: true },
    }).text()).toBe('开启')

    const colorWrapper = renderReadonly(runtime.readonlyAdapters.ElColorPicker, {
      field: 'themeColor',
      node: colorField,
      value: '#409EFF',
      values: { themeColor: '#409EFF' },
    })
    expect(colorWrapper.text()).toContain('#409EFF')
    expect(colorWrapper.find('[data-testid="readonly-color-swatch"]').exists()).toBe(true)
  })

  it('allows user readonly adapters to override plugin defaults', () => {
    const override: ReadonlyAdapter = ({ value }) => h('span', `override:${String(value)}`)
    const runtime = createFormRuntime({
      plugins: [
        createElementPlusPlugin({
          readonlyAdapters: {
            ElSelectV2: override,
          },
        }),
      ],
    })

    expect(runtime.readonlyAdapters.ElSelectV2).toBe(override)
  })
})
