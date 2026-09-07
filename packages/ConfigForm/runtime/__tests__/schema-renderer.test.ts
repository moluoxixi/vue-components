import type { ConfigFormRendererExpose } from '../index'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { ConfigForm, ConfigFormRenderer } from '../index'

const Input = defineComponent({
  props: { value: String },
  emits: ['change'],
  setup: (props, { emit }) => () => h('input', {
    value: props.value,
    onInput: (event: Event) => emit('change', (event.target as HTMLInputElement).value),
  }),
})

describe('schema preprocessing through the shared renderer', () => {
  it('runs plugin binding, defaults, nested fields and readonly adapters through one controller', async () => {
    const values = shallowRef<Record<string, unknown>>({})
    const readonly = shallowRef(false)
    const wrapper = mount(ConfigForm, { props: {
      model: createConfigFormModel(values),
      fields: [{ id: 'section', component: 'section', slots: { default: [
        { id: 'name', field: 'name', component: 'BusinessInput', defaultValue: 'Ada', readonly: () => readonly.value },
      ] } }],
      runtime: { plugins: [{
        name: 'business',
        components: { BusinessInput: { component: Input, valueProp: 'value', trigger: 'change' } },
        readonlyAdapters: { BusinessInput: ({ value }) => h('strong', String(value)) },
      }] },
    } })
    const form = wrapper.vm as unknown as ConfigFormRendererExpose
    expect(values.value.name).toBe('Ada')
    await wrapper.get('input').setValue('Grace')
    expect(values.value.name).toBe('Grace')
    readonly.value = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.get('strong').text()).toBe('Grace')
    expect(await form.submit()).toBe(true)
    expect(wrapper.emitted('submit')?.at(-1)).toEqual([{ name: 'Grace' }])
  })

  it('preserves option slots for readonly adapters and preprocesses plugin-created slots once', () => {
    const transform = vi.fn((node) => {
      if (node.id !== 'section')
        return node
      expect(node.slots.default).toHaveLength(1)
      return { ...node, slots: { ...node.slots, footer: { id: 'footer', component: 'small', props: { innerHTML: 'Footer' } } } }
    })
    const Section = defineComponent({
      setup: (_, { slots }) => () => h('section', [slots.default?.(), slots.footer?.()]),
    })
    const wrapper = mount(ConfigForm, { props: {
      model: createConfigFormModel(shallowRef<Record<string, unknown>>({ role: 'admin' })),
      fields: [{ id: 'section', component: Section, slots: { default: [
        { id: 'role', field: 'role', component: 'Select', readonly: true, slots: { default: [
          { id: 'admin', component: 'option', props: { label: 'Administrator', value: 'admin' } },
        ] } },
      ] } }],
      runtime: { plugins: [{
        name: 'options',
        components: { Select: Input },
        transformField: transform,
        readonlyAdapters: { Select: ({ node, value }) => {
          const options = node.slots?.default
          const option = Array.isArray(options) && options.find(item => typeof item !== 'function' && item.props?.value === value)
          return h('strong', option && typeof option !== 'function' ? String(option.props?.label) : String(value))
        } },
      }] },
    } })
    expect(wrapper.get('strong').text()).toBe('Administrator')
    expect(wrapper.get('small').text()).toBe('Footer')
    expect(transform.mock.calls.map(([node]) => node.id)).toEqual(['section', 'role', 'admin', 'footer'])
    wrapper.unmount()
  })

  it.each(['disabled', 'readonly', 'visible'] as const)('uses host %s state for validation and submission', async (state) => {
    const values = shallowRef<Record<string, unknown>>({ name: '' })
    const wrapper = mount(ConfigFormRenderer, { props: {
      model: createConfigFormModel(values),
      fields: [{ id: 'name', field: 'name', component: Input, required: true }],
    } })
    const form = wrapper.vm as unknown as ConfigFormRendererExpose
    expect(await form.validate()).toBe(false)
    await wrapper.setProps({ reactionProjection: {
      values: values.value,
      props: {},
      validate: [],
      states: { name: { [state]: state !== 'visible' } },
    } })
    expect(form.getErrors()).toEqual({})
    expect(await form.submit()).toBe(true)
    expect(wrapper.emitted('submit')?.at(-1)).toEqual([state === 'readonly' ? { name: '' } : {}])
    wrapper.unmount()
  })

  it('invalidates pending validation on host state changes and unmount', async () => {
    const pending: Array<(value: string) => void> = []
    const wrapper = mount(ConfigFormRenderer, { props: {
      model: createConfigFormModel(shallowRef<Record<string, unknown>>({ name: 'Ada' })),
      fields: [{ id: 'name', field: 'name', component: Input, validator: () => new Promise<string>(resolve => pending.push(resolve)) }],
    } })
    const form = wrapper.vm as unknown as ConfigFormRendererExpose
    const first = form.validate()
    await flushPromises()
    await wrapper.setProps({ readonly: true })
    pending[0]!('Old state')
    expect(await first).toBe(false)
    expect(form.getErrors()).toEqual({})
    await wrapper.setProps({ readonly: false })
    const second = form.validate()
    await flushPromises()
    wrapper.unmount()
    pending[1]!('Old lifetime')
    expect(await second).toBe(false)
    expect(form.getErrors()).toEqual({})
  })
})
