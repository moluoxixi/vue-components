import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { DesignerResponsiveSettings } from '../src/components/DesignerPropertyPanel'

const BooleanControl = defineComponent({
  inheritAttrs: false,
  props: {
    disabled: Boolean,
    modelValue: Boolean,
  },
  emits: ['change'],
  setup(props, { attrs, emit }) {
    return () => h('button', {
      ...attrs,
      'aria-checked': props.modelValue,
      'data-adapter-boolean': '',
      'disabled': props.disabled,
      'role': 'switch',
      'type': 'button',
      'onClick': () => emit('change', !props.modelValue),
    })
  },
})

const NumberControl = defineComponent({
  inheritAttrs: false,
  props: {
    disabled: Boolean,
    modelValue: Number,
  },
  emits: ['change'],
  setup(props, { attrs, emit }) {
    return () => h('input', {
      ...attrs,
      'data-adapter-number': '',
      'disabled': props.disabled,
      'type': 'number',
      'value': props.modelValue,
      'onChange': (event: Event) => emit('change', Number((event.currentTarget as HTMLInputElement).value)),
    })
  },
})

const components = {
  boolean: { component: BooleanControl, trigger: 'change' },
  number: { component: NumberControl, trigger: 'change' },
}
const controls = {
  boolean: { component: 'boolean' },
  number: { component: 'number' },
}

describe('designer responsive settings fractions', () => {
  it('shows final desktop, tablet, and inherited mobile fractions and refreshes with overrides', async () => {
    const wrapper = mount(DesignerResponsiveSettings, {
      props: {
        columns: 24,
        fieldSpan: 12,
        modelValue: {
          tablet: { columns: 12, fieldSpan: 6 },
        },
      },
    })

    const outputs = () => wrapper.findAll('.mx-config-form-designer__responsive-fraction').map(item => item.text())
    expect(outputs()).toEqual([
      'Resolved width: 12 / 24 · 1/2',
      'Resolved width: 6 / 12 · 1/2',
      'Resolved width (inherited): 6 / 12 · 1/2',
    ])
    expect(wrapper.findAll('output').map(output => output.attributes('aria-label'))).toEqual([
      'Desktop, Resolved width: 12 / 24 · 1/2',
      'Tablet, Resolved width: 6 / 12 · 1/2',
      'Mobile, Resolved width (inherited): 6 / 12 · 1/2',
    ])

    await wrapper.setProps({
      modelValue: {
        tablet: { columns: 12, fieldSpan: 6 },
        mobile: { columns: 8, fieldSpan: 8 },
      },
    })
    expect(outputs().at(-1)).toBe('Resolved width: 8 / 8 · 100%')
    expect(wrapper.findAll('.mx-config-form-designer__setter-hint.is-value').map(item => item.text())).toEqual([
      '6 / 12 · 1/2',
      '8 / 8 · 100%',
    ])
  })

  it('projects responsive switches and numbers through the adapter registry', async () => {
    const wrapper = mount(DesignerResponsiveSettings, {
      props: {
        columns: 24,
        components,
        controls,
        fieldSpan: 12,
        modelValue: {
          tablet: { columns: 12, fieldSpan: 6 },
        },
      },
    })

    expect(wrapper.findAll('[data-adapter-boolean]')).toHaveLength(2)
    expect(wrapper.findAll('[data-adapter-number]')).toHaveLength(2)
    const hintField = wrapper.get('[data-hint-label="6 / 12 · 1/2"]')
    expect(hintField.get('[data-adapter-number]').attributes('aria-description')).toBe('6 / 12 · 1/2')

    await wrapper.findAll('[data-adapter-boolean]')[0]!.trigger('click')
    await nextTick()
    expect(wrapper.emitted('commit')?.at(-1)).toEqual([undefined])

    await wrapper.setProps({ readonly: true })
    expect(wrapper.findAll('[data-adapter-boolean]').every(control => control.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.findAll('[data-adapter-number]').every(control => control.attributes('disabled') !== undefined)).toBe(true)
  })
})
