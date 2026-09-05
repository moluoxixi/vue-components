import type { FieldNode } from '@moluoxixi/config-form-model'
import { flushPromises, mount } from '@vue/test-utils'
import { ElCheckbox, ElDatePicker, ElInput, ElInputNumber, ElOption, ElRadio, ElSelect, ElSwitch, ElTimePicker } from 'element-plus'
import { describe, expect, it, vi } from 'vitest'
import ElementCheckboxField from '../src/materials/components/ElementCheckboxField/index.vue'
import ElementChoiceDefaultSetter from '../src/materials/components/ElementChoiceDefaultSetter/index.vue'
import ElementDefaultValueSetter from '../src/materials/components/ElementDefaultValueSetter/index.vue'
import ElementRadioField from '../src/materials/components/ElementRadioField/index.vue'
import ElementSelectField from '../src/materials/components/ElementSelectField/index.vue'
import {
  createElementPlusOptionResolverContext,
  ELEMENT_PLUS_OPTION_RESOLVER_KEY,
  readElementPlusOptionSource,
} from '../src/options'

describe('element plus designer fields', () => {
  it('rejects non-JSON and circular provider params without recursive overflow', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(readElementPlusOptionSource({ kind: 'provider', key: 'projects', params: circular })).toBeUndefined()
    expect(readElementPlusOptionSource({ kind: 'provider', key: 'projects', params: new Date() })).toBeUndefined()
  })

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

  it('resolves dictionaries and exposes their normalized options to default-value controls', async () => {
    const context = createElementPlusOptionResolverContext({
      dictionaries: {
        environments: [
          { label: 'Playground', value: 'playground' },
          { label: 'Production', value: 'production' },
        ],
      },
    })
    const node: FieldNode = {
      id: 'environment',
      kind: 'field',
      component: 'element.select',
      field: 'environment',
      props: { optionSource: { kind: 'dictionary', key: 'environments' } },
      events: {},
      bindings: {},
    }
    const wrapper = mount(ElementChoiceDefaultSetter, {
      global: { provide: { [ELEMENT_PLUS_OPTION_RESOLVER_KEY as symbol]: context } },
      props: { kind: 'select', node },
    })
    await flushPromises()

    expect(wrapper.findAllComponents(ElOption).map(option => option.props('label'))).toEqual(['Playground', 'Production'])
    expect(wrapper.findComponent(ElSelect).exists()).toBe(true)
  })

  it('uses Element Plus controls for every default-value kind', async () => {
    const text = mount(ElementDefaultValueSetter, {
      props: { id: 'default-value-control', kind: 'text', modelValue: 'before' },
    })
    await text.vm.$nextTick()
    expect(text.getComponent(ElInput).classes()).toEqual(expect.arrayContaining([
      'mx-config-form-designer__property-control',
      'is-text',
    ]))
    expect(text.get('.el-input__inner').attributes('id')).toBe('default-value-control')
    expect(text.attributes('id')).toBeUndefined()
    text.getComponent(ElInput).vm.$emit('update:modelValue', 'after')
    await text.vm.$nextTick()
    await text.get('.el-input__inner').trigger('blur')
    expect(text.emitted('update:modelValue')).toEqual([['after']])

    const number = mount(ElementDefaultValueSetter, { props: { kind: 'number', modelValue: 1 } })
    expect(number.getComponent(ElInputNumber).classes()).toContain('mx-config-form-designer__property-control')
    number.getComponent(ElInputNumber).vm.$emit('change', 2)
    expect(number.emitted('update:modelValue')).toEqual([[2]])

    const boolean = mount(ElementDefaultValueSetter, { props: { kind: 'boolean', modelValue: false } })
    boolean.getComponent(ElSwitch).vm.$emit('change', true)
    expect(boolean.emitted('update:modelValue')).toEqual([[true]])

    const select = mount(ElementDefaultValueSetter, {
      props: {
        kind: 'select',
        options: [{ label: 'First', value: 'first' }],
      },
    })
    expect(select.getComponent(ElSelect).props('multiple')).toBe(false)
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
    multiselect.getComponent(ElSelect).vm.$emit('update:modelValue', ['first'])
    expect(multiselect.emitted('update:modelValue')).toEqual([[['first']]])

    const date = mount(ElementDefaultValueSetter, { props: { kind: 'date', modelValue: '2026-09-04' } })
    date.getComponent(ElDatePicker).vm.$emit('update:modelValue', '2026-09-05')
    expect(date.emitted('update:modelValue')).toEqual([['2026-09-05']])
    const time = mount(ElementDefaultValueSetter, { props: { kind: 'time', modelValue: '09:30:00', disabled: true } })
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
      events: {},
      bindings: {},
    }
    const wrapper = mount(ElementChoiceDefaultSetter, { props: { kind: 'select', node } })
    await flushPromises()

    expect(wrapper.findAllComponents(ElOption).map(option => option.props('value'))).toEqual([1, true, '1'])

    await wrapper.setProps({ kind: 'multiselect' })
    expect(wrapper.findAllComponents(ElOption).map(option => option.props('value'))).toEqual([1, '1'])
  })

  it('resolves dictionary options consistently across select, radio, and checkbox fields', async () => {
    const context = createElementPlusOptionResolverContext({
      dictionaries: {
        mixed: [
          { label: 'Number one', value: 1 },
          { label: 'String one', value: '1' },
          { label: 'Boolean true', value: true },
        ],
      },
    })
    const global = { provide: { [ELEMENT_PLUS_OPTION_RESOLVER_KEY as symbol]: context } }
    const optionSource = { kind: 'dictionary' as const, key: 'mixed' }
    const select = mount(ElementSelectField, { global, props: { optionSource } })
    const radio = mount(ElementRadioField, { global, props: { optionSource } })
    const checkbox = mount(ElementCheckboxField, { global, props: { optionSource } })
    await flushPromises()

    expect(select.findAllComponents(ElOption)).toHaveLength(3)
    expect(radio.findAllComponents(ElRadio)).toHaveLength(3)
    expect(checkbox.findAllComponents(ElCheckbox)).toHaveLength(2)
    expect(new Set(radio.findAllComponents(ElRadio).map(option => option.vm.$.vnode.key)).size).toBe(3)
  })

  it('renders the empty state for a resolved option source without values', async () => {
    const context = createElementPlusOptionResolverContext({
      dictionaries: { empty: [] },
    })
    const wrapper = mount(ElementSelectField, {
      global: { provide: { [ELEMENT_PLUS_OPTION_RESOLVER_KEY as symbol]: context } },
      props: { optionSource: { kind: 'dictionary', key: 'empty' } },
    })
    await flushPromises()

    expect(wrapper.findAllComponents(ElOption)).toHaveLength(0)
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('No options')
  })

  it('runs adapter providers with params and renders loading and error states', async () => {
    let resolveOptions: ((options: Array<{ label: string, value: string }>) => void) | undefined
    const provider = vi.fn(() => new Promise<Array<{ label: string, value: string }>>((resolve) => {
      resolveOptions = resolve
    }))
    const context = createElementPlusOptionResolverContext({ providers: { projects: provider } })
    const wrapper = mount(ElementSelectField, {
      global: { provide: { [ELEMENT_PLUS_OPTION_RESOLVER_KEY as symbol]: context } },
      props: {
        optionSource: { kind: 'provider', key: 'projects', params: { team: 'frontend' } },
      },
    })
    await flushPromises()

    expect(provider).toHaveBeenCalledWith(expect.objectContaining({
      key: 'projects',
      params: { team: 'frontend' },
      signal: expect.any(AbortSignal),
    }))
    expect(wrapper.find('[aria-label="Loading options"]').exists()).toBe(true)

    resolveOptions?.([{ label: 'Website', value: 'website' }])
    await flushPromises()
    expect(wrapper.findAllComponents(ElOption)).toHaveLength(1)
    expect(wrapper.find('[aria-label="Loading options"]').exists()).toBe(false)

    await wrapper.setProps({ optionSource: { kind: 'provider', key: 'missing' } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').attributes('aria-label')).toContain('Unknown option provider')
  })
})
