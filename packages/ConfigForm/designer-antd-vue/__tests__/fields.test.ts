import type { FieldNode } from '@moluoxixi/config-form-model'
import {
  DESIGNER_OPTION_VALUE_TYPES,
  DESIGNER_TEXT_NUMBER_OPTION_VALUE_TYPES,
} from '@moluoxixi/config-form-designer'
import { flushPromises, mount } from '@vue/test-utils'
import { AutoComplete, CheckboxGroup, RadioGroup, Select } from 'ant-design-vue'
import { describe, expect, it } from 'vitest'
import AntdAutoCompleteField from '../src/materials/components/AntdAutoCompleteField/index.vue'
import AntdCheckboxField from '../src/materials/components/AntdCheckboxField/index.vue'
import AntdChoiceDefaultSetter from '../src/materials/components/AntdChoiceDefaultSetter/index.vue'
import AntdRadioField from '../src/materials/components/AntdRadioField/index.vue'
import AntdSelectField from '../src/materials/components/AntdSelectField/index.vue'

describe('ant design vue designer fields', () => {
  it('renders normalized options and forwards the native value event', async () => {
    const wrapper = mount(AntdSelectField, {
      props: {
        value: 1,
        options: [
          { label: 'Number one', value: 1 },
          { label: 'String one', value: '1' },
        ],
      },
    })
    const select = wrapper.getComponent(Select)
    expect(select.props('options')).toHaveLength(2)
    expect(wrapper.get('[data-designer-selection-target]').classes()).toContain('ant-select')
    select.vm.$emit('update:value', '1')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:value')).toEqual([['1']])

    const autoComplete = mount(AntdAutoCompleteField, {
      props: { value: 'a', options: [{ label: 'Option A', value: 'a' }] },
    })
    expect(autoComplete.get('[data-designer-selection-target]').classes()).toContain('ant-select-auto-complete')
    autoComplete.getComponent(AutoComplete).vm.$emit('update:value', 'b')
    await autoComplete.vm.$nextTick()
    expect(autoComplete.emitted('update:value')).toEqual([['b']])
  })

  it('renders static options for fields and default-value controls', async () => {
    const options = [
      { label: 'Playground', value: 'playground' },
      { label: 'Production', value: 'production' },
      { label: 'Enabled', value: true },
    ]
    const select = mount(AntdSelectField, { props: { options } })
    const autoComplete = mount(AntdAutoCompleteField, { props: { options } })
    const radio = mount(AntdRadioField, { props: { options } })
    const checkbox = mount(AntdCheckboxField, { props: { options } })
    await flushPromises()
    expect(select.getComponent(Select).props('options')).toHaveLength(2)
    expect(autoComplete.getComponent(AutoComplete).props('options')).toHaveLength(2)
    expect(radio.getComponent(RadioGroup).props('options')).toHaveLength(3)
    expect(checkbox.getComponent(CheckboxGroup).props('options')).toHaveLength(2)
    expect(radio.get('[data-designer-selection-target]').classes()).toContain('ant-radio-group')
    expect(checkbox.get('[data-designer-selection-target]').classes()).toContain('ant-checkbox-group')

    const node: FieldNode = {
      id: 'environment',
      kind: 'field',
      component: 'antd.select',
      field: 'environment',
      props: { options },
    }
    const setter = mount(AntdChoiceDefaultSetter, {
      props: { kind: 'select', node, optionValueTypes: DESIGNER_OPTION_VALUE_TYPES },
    })
    await flushPromises()
    // antd 包不依赖 element-plus；核心默认值控件渲染的 ElSelect/ElOption 按组件名断言。
    expect(setter.findAllComponents({ name: 'ElOption' }).map(option => option.props('label')))
      .toEqual(['Playground', 'Production', 'Enabled'])
    expect(setter.findComponent({ name: 'ElSelect' }).exists()).toBe(true)

    await setter.setProps({
      kind: 'multiselect',
      optionValueTypes: DESIGNER_TEXT_NUMBER_OPTION_VALUE_TYPES,
    })
    expect(setter.findAllComponents({ name: 'ElOption' }).map(option => option.props('label')))
      .toEqual(['Playground', 'Production'])
  })

  it('renders no choices for an empty static option list', () => {
    const wrapper = mount(AntdSelectField, {
      props: { options: [] },
    })
    expect(wrapper.getComponent(Select).props('options')).toEqual([])
  })
})
