import type { FieldNode } from '@moluoxixi/config-form-model'
import {
  DESIGNER_OPTION_VALUE_TYPES,
  DESIGNER_TEXT_NUMBER_OPTION_VALUE_TYPES,
} from '@moluoxixi/config-form-designer'
import { flushPromises, mount } from '@vue/test-utils'
import { ElCheckbox, ElDatePicker, ElInput, ElInputNumber, ElOption, ElRadio, ElSelect, ElSwitch, ElTimePicker } from 'element-plus'
import { describe, expect, it } from 'vitest'
import ElementCheckboxField from '../src/materials/components/ElementCheckboxField/index.vue'
import ElementChoiceDefaultSetter from '../src/materials/components/ElementChoiceDefaultSetter/index.vue'
import ElementDefaultValueSetter from '../src/materials/components/ElementDefaultValueSetter/index.vue'
import ElementRadioField from '../src/materials/components/ElementRadioField/index.vue'
import ElementSelectField from '../src/materials/components/ElementSelectField/index.vue'

describe('element plus designer fields', () => {
  it('renders JSON options and forwards the Element Plus value event', async () => {
    const wrapper = mount(ElementSelectField, {
      props: {
        modelValue: 1,
        options: [
          { label: 'Number one', value: 1 },
          { label: 'String one', value: '1' },
          { label: 'Boolean true', value: true },
          { label: 'String true', value: 'true', disabled: true },
        ],
      },
    })

    const options = wrapper.findAllComponents(ElOption)
    expect(options).toHaveLength(4)
    expect(new Set(options.map(option => option.vm.$.vnode.key)).size).toBe(4)
    wrapper.getComponent(ElSelect).vm.$emit('update:modelValue', '1')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')).toEqual([['1']])
  })

  it('exposes static options to default-value controls', async () => {
    const node: FieldNode = {
      id: 'environment',
      kind: 'field',
      component: 'element.select',
      field: 'environment',
      props: {
        options: [
          { label: 'Playground', value: 'playground' },
          { label: 'Production', value: 'production' },
        ],
      },
    }
    const wrapper = mount(ElementChoiceDefaultSetter, {
      props: { kind: 'select', node, optionValueTypes: DESIGNER_OPTION_VALUE_TYPES },
    })
    await flushPromises()

    expect(wrapper.findAllComponents(ElOption).map(option => option.props('label'))).toEqual(['Playground', 'Production'])
    expect(wrapper.findComponent(ElSelect).exists()).toBe(true)
  })

  it('uses Element Plus controls for every default-value kind', async () => {
    const text = mount(ElementDefaultValueSetter, {
      attrs: {
        class: [
          'mx-config-form-designer__property-control',
          { 'consumer-control': true, 'is-default-value': true },
        ],
      },
      props: { id: 'default-value-control', kind: 'text', modelValue: 'before' },
    })
    await text.vm.$nextTick()
    expect(text.getComponent(ElInput).classes()).toEqual(expect.arrayContaining([
      'mx-config-form-designer__property-control',
      'is-text',
    ]))
    expect(text.getComponent(ElInput).classes()).not.toContain('is-default-value')
    expect(text.getComponent(ElInput).classes()).toContain('consumer-control')
    expect(text.getComponent(ElInput).classes()
      .filter(className => className === 'mx-config-form-designer__property-control')).toHaveLength(1)
    expect(text.get('.el-input__inner').attributes('id')).toBe('default-value-control')
    expect(text.attributes('id')).toBeUndefined()
    text.getComponent(ElInput).vm.$emit('update:modelValue', 'after')
    await text.vm.$nextTick()
    await text.get('.el-input__inner').trigger('blur')
    expect(text.emitted('update:modelValue')).toEqual([['after']])
    text.getComponent(ElInput).vm.$emit('update:modelValue', '')
    await text.vm.$nextTick()
    await text.get('.el-input__inner').trigger('blur')
    expect(text.emitted('update:modelValue')?.at(-1)).toEqual([''])

    const number = mount(ElementDefaultValueSetter, { props: { kind: 'number', modelValue: 1 } })
    expect(number.getComponent(ElInputNumber).classes()).toEqual(expect.arrayContaining([
      'mx-config-form-designer__property-control',
      'is-number',
    ]))
    number.getComponent(ElInputNumber).vm.$emit('change', 2)
    expect(number.emitted('update:modelValue')).toEqual([[2]])

    const boolean = mount(ElementDefaultValueSetter, { props: { kind: 'boolean', modelValue: false } })
    expect(boolean.getComponent(ElSwitch).classes()).toEqual(expect.arrayContaining([
      'mx-config-form-designer__property-control',
      'is-boolean',
    ]))
    boolean.getComponent(ElSwitch).vm.$emit('change', true)
    expect(boolean.emitted('update:modelValue')).toEqual([[true]])

    const select = mount(ElementDefaultValueSetter, {
      props: {
        kind: 'select',
        options: [{ label: 'First', value: 'first' }],
      },
    })
    expect(select.getComponent(ElSelect).props('multiple')).toBe(false)
    expect(select.getComponent(ElSelect).classes()).toEqual(expect.arrayContaining([
      'mx-config-form-designer__property-control',
      'is-select',
    ]))
    expect(select.findAllComponents(ElOption)).toHaveLength(1)
    select.getComponent(ElSelect).vm.$emit('update:modelValue', 'first')
    select.getComponent(ElSelect).vm.$emit('update:modelValue', null)
    expect(select.emitted('update:modelValue')).toEqual([['first'], [undefined]])

    const multiselect = mount(ElementDefaultValueSetter, {
      props: {
        kind: 'multiselect',
        modelValue: ['first'],
        options: [{ label: 'First', value: 'first' }],
      },
    })
    expect(multiselect.getComponent(ElSelect).props('multiple')).toBe(true)
    expect(multiselect.getComponent(ElSelect).classes()).toEqual(expect.arrayContaining([
      'mx-config-form-designer__property-control',
      'is-select',
    ]))
    expect(multiselect.getComponent(ElSelect).classes()).not.toContain('is-multiselect')
    multiselect.getComponent(ElSelect).vm.$emit('update:modelValue', ['first'])
    expect(multiselect.emitted('update:modelValue')).toEqual([[['first']]])

    const date = mount(ElementDefaultValueSetter, { props: { kind: 'date', modelValue: '2026-09-04' } })
    expect(date.get('.el-date-editor').classes()).toEqual(expect.arrayContaining([
      'mx-config-form-designer__property-control',
      'is-date',
    ]))
    date.getComponent(ElDatePicker).vm.$emit('update:modelValue', '2026-09-05')
    expect(date.emitted('update:modelValue')).toEqual([['2026-09-05']])
    const time = mount(ElementDefaultValueSetter, { props: { kind: 'time', modelValue: '09:30:00', disabled: true } })
    expect(time.get('.el-date-editor').classes()).toEqual(expect.arrayContaining([
      'mx-config-form-designer__property-control',
      'is-time',
    ]))
    expect(time.getComponent(ElTimePicker).props('disabled')).toBe(true)
    time.getComponent(ElTimePicker).vm.$emit('update:modelValue', '10:15:30')
    expect(time.emitted('update:modelValue')).toEqual([['10:15:30']])
  })

  it('preserves choice values and removes boolean values from multiselect defaults', async () => {
    const node: FieldNode = {
      id: 'choice-values',
      kind: 'field',
      component: 'element.select',
      field: 'choiceValues',
      props: {
        options: [
          { label: 'Number one', value: 1 },
          { label: 'Boolean true', value: true },
          { label: 'String one', value: '1' },
        ],
      },
    }
    const wrapper = mount(ElementChoiceDefaultSetter, {
      props: { kind: 'select', node, optionValueTypes: DESIGNER_OPTION_VALUE_TYPES },
    })
    await flushPromises()

    expect(wrapper.findAllComponents(ElOption).map(option => option.props('value'))).toEqual([1, true, '1'])

    await wrapper.setProps({
      kind: 'multiselect',
      optionValueTypes: DESIGNER_TEXT_NUMBER_OPTION_VALUE_TYPES,
    })
    expect(wrapper.findAllComponents(ElOption).map(option => option.props('value'))).toEqual([1, '1'])
  })

  it('renders static options consistently across select, radio, and checkbox fields', async () => {
    const options = [
      { label: 'Number one', value: 1 },
      { label: 'String one', value: '1' },
      { label: 'Boolean true', value: true },
    ]
    const select = mount(ElementSelectField, { props: { options } })
    const radio = mount(ElementRadioField, { props: { options } })
    const checkbox = mount(ElementCheckboxField, { props: { options } })
    await flushPromises()

    expect(select.findAllComponents(ElOption)).toHaveLength(3)
    expect(radio.findAllComponents(ElRadio)).toHaveLength(3)
    expect(checkbox.findAllComponents(ElCheckbox)).toHaveLength(2)
    expect(new Set(radio.findAllComponents(ElRadio).map(option => option.vm.$.vnode.key)).size).toBe(3)
  })

  it('renders no choices for an empty static option list', () => {
    const wrapper = mount(ElementSelectField, {
      props: { options: [] },
    })

    expect(wrapper.findAllComponents(ElOption)).toHaveLength(0)
  })
})
