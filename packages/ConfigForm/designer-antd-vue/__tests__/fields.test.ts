import type { DesignerFieldNode } from '@moluoxixi/config-form-designer'
import { flushPromises, mount } from '@vue/test-utils'
import { AutoComplete, CheckboxGroup, RadioGroup, Select } from 'ant-design-vue'
import { describe, expect, it, vi } from 'vitest'
import AntdAutoCompleteField from '../src/components/AntdAutoCompleteField.vue'
import AntdCheckboxField from '../src/components/AntdCheckboxField.vue'
import AntdChoiceDefaultSetter from '../src/components/AntdChoiceDefaultSetter.vue'
import AntdRadioField from '../src/components/AntdRadioField.vue'
import AntdSelectField from '../src/components/AntdSelectField.vue'
import {
  ANTD_VUE_OPTION_RESOLVER_KEY,
  createAntdVueOptionResolverContext,
} from '../src/options'

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

  it('resolves dictionaries for fields and default-value controls', async () => {
    const context = createAntdVueOptionResolverContext({
      dictionaries: {
        environments: [
          { label: 'Playground', value: 'playground' },
          { label: 'Production', value: 'production' },
        ],
      },
    })
    const global = { provide: { [ANTD_VUE_OPTION_RESOLVER_KEY as symbol]: context } }
    const optionSource = { kind: 'dictionary' as const, key: 'environments' }
    const select = mount(AntdSelectField, { global, props: { optionSource } })
    const autoComplete = mount(AntdAutoCompleteField, { global, props: { optionSource } })
    const radio = mount(AntdRadioField, { global, props: { optionSource } })
    const checkbox = mount(AntdCheckboxField, { global, props: { optionSource } })
    await flushPromises()
    expect(select.getComponent(Select).props('options')).toHaveLength(2)
    expect(autoComplete.getComponent(AutoComplete).props('options')).toHaveLength(2)
    expect(radio.getComponent(RadioGroup).props('options')).toHaveLength(2)
    expect(checkbox.getComponent(CheckboxGroup).props('options')).toHaveLength(2)
    expect(radio.get('[data-designer-selection-target]').classes()).toContain('ant-radio-group')
    expect(checkbox.get('[data-designer-selection-target]').classes()).toContain('ant-checkbox-group')

    const node: DesignerFieldNode = {
      id: 'environment',
      kind: 'field',
      material: 'antd.select',
      field: 'environment',
      props: { optionSource },
    }
    const setter = mount(AntdChoiceDefaultSetter, {
      global,
      props: { kind: 'select', node },
    })
    await flushPromises()
    expect(setter.findAll('button').map(button => button.text())).toEqual(expect.arrayContaining(['Playground', 'Production']))
  })

  it('renders empty, loading, and provider error states', async () => {
    let resolveOptions: ((options: Array<{ label: string, value: string }>) => void) | undefined
    const provider = vi.fn(() => new Promise<Array<{ label: string, value: string }>>((resolve) => {
      resolveOptions = resolve
    }))
    const context = createAntdVueOptionResolverContext({ providers: { projects: provider } })
    const wrapper = mount(AntdSelectField, {
      global: { provide: { [ANTD_VUE_OPTION_RESOLVER_KEY as symbol]: context } },
      props: { optionSource: { kind: 'provider', key: 'projects', params: { team: 'frontend' } } },
    })
    await flushPromises()
    expect(wrapper.find('[aria-label="Loading options"]').exists()).toBe(true)
    expect(provider).toHaveBeenCalledWith(expect.objectContaining({
      key: 'projects',
      params: { team: 'frontend' },
      signal: expect.any(AbortSignal),
    }))

    resolveOptions?.([])
    await flushPromises()
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('No options')

    await wrapper.setProps({ optionSource: { kind: 'provider', key: 'missing' } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').attributes('aria-label')).toContain('Unknown option provider')
  })
})
