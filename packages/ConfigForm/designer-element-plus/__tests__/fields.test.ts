import type { DesignerFieldNode } from '@moluoxixi/config-form-designer'
import { flushPromises, mount } from '@vue/test-utils'
import { ElCheckbox, ElOption, ElRadio, ElSelect } from 'element-plus'
import { describe, expect, it, vi } from 'vitest'
import ElementCheckboxField from '../src/components/ElementCheckboxField.vue'
import ElementChoiceDefaultSetter from '../src/components/ElementChoiceDefaultSetter.vue'
import ElementRadioField from '../src/components/ElementRadioField.vue'
import ElementSelectField from '../src/components/ElementSelectField.vue'
import {
  createElementPlusOptionResolverContext,
  ELEMENT_PLUS_OPTION_RESOLVER_KEY,
} from '../src/options'

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

  it('resolves dictionaries and exposes their normalized options to default-value controls', async () => {
    const context = createElementPlusOptionResolverContext({
      dictionaries: {
        environments: [
          { label: 'Playground', value: 'playground' },
          { label: 'Production', value: 'production' },
        ],
      },
    })
    const node: DesignerFieldNode = {
      id: 'environment',
      kind: 'field',
      material: 'element.select',
      field: 'environment',
      props: { optionSource: { kind: 'dictionary', key: 'environments' } },
    }
    const wrapper = mount(ElementChoiceDefaultSetter, {
      global: { provide: { [ELEMENT_PLUS_OPTION_RESOLVER_KEY as symbol]: context } },
      props: { kind: 'select', node },
    })
    await flushPromises()

    expect(wrapper.findAll('button').map(button => button.text())).toEqual(expect.arrayContaining(['Playground', 'Production']))
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
