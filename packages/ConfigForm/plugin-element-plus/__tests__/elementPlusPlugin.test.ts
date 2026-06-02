import type { ReadonlyAdapter, ReadonlyRenderContext } from '@moluoxixi/config-form/plugins'
import { defineField } from '@moluoxixi/config-form'
import { createFormRuntime } from '@moluoxixi/config-form/plugins'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createElementPlusPlugin } from '../src'
import {
  findElementPlusOptionLabel,
  readElementPlusOptionKeys,
  readElementPlusOptionSource,
  resolveElementPlusPathLabel,
} from '../src/readonly/options'

const ElSelectV2 = { name: 'ElSelectV2' }
const ElCascader = { name: 'ElCascader' }
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

/** 构造只读适配器所需的最小字段节点，避免测试耦合完整 runtime 拓扑。 */
function createReadonlyNode(
  props: Record<string, unknown>,
  slots?: Record<string, unknown>,
): ReadonlyRenderContext['node'] {
  return {
    blurTrigger: 'blur',
    component: 'ElSelect',
    disabled: false,
    field: 'field',
    props,
    readonly: false,
    required: false,
    requiredMessage: '必填',
    span: 24,
    submitWhenDisabled: false,
    submitWhenHidden: false,
    trigger: 'update:modelValue',
    validateOn: ['submit'],
    valueProp: 'modelValue',
    values: {},
    visible: true,
    ...(slots ? { slots } : {}),
  } as unknown as ReadonlyRenderContext['node']
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

  it('resolves Element Plus cascader path labels with custom option keys', () => {
    const runtime = createFormRuntime({
      plugins: [createElementPlusPlugin()],
    })

    const cascaderField = asField(runtime.transformField(defineField({
      component: ElCascader,
      field: 'region',
      props: {
        props: {
          children: 'nodes',
          label: 'name',
          value: 'id',
        },
        options: [
          {
            id: 'east',
            name: '华东',
            nodes: [
              { id: 'shanghai', name: '上海' },
            ],
          },
        ],
      },
    })))

    expect(renderReadonly(runtime.readonlyAdapters.ElCascader, {
      field: 'region',
      node: cascaderField,
      value: ['east', 'shanghai'],
      values: { region: ['east', 'shanghai'] },
    }).text()).toBe('华东 / 上海')
    expect(renderReadonly(runtime.readonlyAdapters.ElCascader, {
      field: 'region',
      node: cascaderField,
      value: ['east', 'missing'],
      values: { region: ['east', 'missing'] },
    }).text()).toBe('[\n  "east",\n  "missing"\n]')
  })

  it('falls back to raw values for missing option labels and inactive switch labels', () => {
    const runtime = createFormRuntime({
      plugins: [createElementPlusPlugin()],
    })

    const selectField = asField(runtime.transformField(defineField({
      component: ElSelectV2,
      field: 'role',
      props: {
        options: [
          { label: '管理员', value: 'admin' },
        ],
      },
    })))
    const switchField = asField(runtime.transformField(defineField({
      component: ElSwitch,
      field: 'enabled',
      props: {
        activeValue: 'yes',
        inactiveText: '关闭',
        inactiveValue: 'no',
      },
    })))

    expect(renderReadonly(runtime.readonlyAdapters.ElSelectV2, {
      field: 'role',
      node: selectField,
      value: 'guest',
      values: { role: 'guest' },
    }).text()).toBe('guest')
    expect(renderReadonly(runtime.readonlyAdapters.ElSwitch, {
      field: 'enabled',
      node: switchField,
      value: 'no',
      values: { enabled: 'no' },
    }).text()).toBe('关闭')
    expect(renderReadonly(runtime.readonlyAdapters.ElSwitch, {
      field: 'enabled',
      node: switchField,
      value: 'pending',
      values: { enabled: 'pending' },
    }).text()).toBe('pending')
    expect(renderReadonly(runtime.readonlyAdapters.ElSwitch, {
      field: 'enabled',
      node: asField(runtime.transformField(defineField({ component: ElSwitch, field: 'rawEnabled' }))),
      value: true,
      values: { rawEnabled: true },
    }).text()).toBe('true')
  })

  it('reads Element Plus option utilities from props, nested nodes, and static slots', () => {
    const customKeysNode = createReadonlyNode({
      props: {
        children: 'nodes',
        label: 'name',
        value: 'id',
      },
    })
    const optionKeys = readElementPlusOptionKeys(customKeysNode)
    const options = [
      {
        id: 'east',
        name: '华东',
        nodes: [
          { id: 'hangzhou', name: '杭州' },
        ],
      },
    ]
    const fallbackOptions = [
      {
        options: [
          { label: '默认子项', value: 'default-child' },
        ],
        value: 'default-parent',
      },
    ]
    const rawPathOptions = [
      {
        id: 'raw-parent',
        nodes: [
          { id: 'raw-child' },
        ],
      },
    ]

    const slotNode = createReadonlyNode({}, {
      default: [
        {},
        {
          props: { label: '静态一', value: 'static-one' },
        },
        {
          props: { value: 'value-only' },
        },
        {
          props: { label: 'label-only' },
        },
        {
          props: { label: '静态组', value: 'static-group' },
          slots: {
            default: {
              props: { label: '静态二', value: 'static-two' },
            },
          },
        },
      ],
    })

    expect(readElementPlusOptionSource(createReadonlyNode({ options: 'raw-options' }), ['options']))
      .toBe('raw-options')
    expect(readElementPlusOptionSource(createReadonlyNode({}, { default: () => [] }), ['options']))
      .toEqual([])
    expect(readElementPlusOptionSource(slotNode, ['options'])).toEqual([
      {
        children: undefined,
        label: undefined,
        value: undefined,
      },
      {
        children: undefined,
        label: '静态一',
        value: 'static-one',
      },
      {
        children: undefined,
        label: 'value-only',
        value: 'value-only',
      },
      {
        children: undefined,
        label: 'label-only',
        value: 'label-only',
      },
      {
        children: [
          {
            children: undefined,
            label: '静态二',
            value: 'static-two',
          },
        ],
        label: '静态组',
        value: 'static-group',
      },
    ])
    expect(findElementPlusOptionLabel(options, 'hangzhou', optionKeys)).toBe('杭州')
    expect(findElementPlusOptionLabel([{ id: 'raw-value' }], 'raw-value', optionKeys)).toBe('raw-value')
    expect(findElementPlusOptionLabel(fallbackOptions, 'default-child', optionKeys)).toBe('默认子项')
    expect(findElementPlusOptionLabel(options, 'missing', optionKeys)).toBeUndefined()
    expect(resolveElementPlusPathLabel(options, ['east', 'hangzhou'], optionKeys)).toBe('华东 / 杭州')
    expect(resolveElementPlusPathLabel(rawPathOptions, ['raw-parent', 'raw-child'], optionKeys))
      .toBe('raw-parent / raw-child')
    expect(resolveElementPlusPathLabel('not-options', ['east'], optionKeys)).toBeUndefined()
    expect(resolveElementPlusPathLabel(options, ['east', 'missing'], optionKeys)).toBeUndefined()
    expect(resolveElementPlusPathLabel(options, ['east', 'hangzhou', 'xihu'], optionKeys)).toBeUndefined()
  })
})
