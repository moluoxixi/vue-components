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

const baseForm = {
  columns: 24,
  fieldSpan: 12,
  labelWidth: 120,
  responsive: {
    tablet: { columns: 12, fieldSpan: 6, labelWidth: 96 },
  },
}

describe('designer responsive settings', () => {
  it('renders three matching breakpoint sections and refreshes inherited values', async () => {
    const wrapper = mount(DesignerResponsiveSettings, {
      props: { form: baseForm },
    })

    const outputs = () => wrapper.findAll('.mx-config-form-designer__responsive-fraction').map(item => item.text())
    const cards = () => wrapper.findAll('.mx-config-form-designer__breakpoint-layout')
    expect(cards().map(card => card.attributes('data-breakpoint'))).toEqual(['desktop', 'tablet', 'mobile'])
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
    expect(cards().map(card => card.find('.mx-config-form-designer__breakpoint-fields').exists()
      ? card.find('.mx-config-form-designer__breakpoint-fields').findAll('.mx-config-form-designer__setter-label').map(label => label.text())
      : [])).toEqual([
      ['Columns', 'Field span', 'Label width (px)'],
      ['Columns', 'Field span', 'Label width (px)'],
      [],
    ])

    await wrapper.setProps({
      form: {
        ...baseForm,
        responsive: {
          ...baseForm.responsive,
          mobile: { columns: 8, fieldSpan: 8, labelWidth: 72 },
        },
      },
    })
    expect(outputs().at(-1)).toBe('Resolved width: 8 / 8 · 100%')
    expect(cards()[2]!.find('.mx-config-form-designer__breakpoint-fields').findAll('.mx-config-form-designer__setter-label').map(label => label.text())).toEqual([
      'Columns',
      'Field span',
      'Label width (px)',
    ])
  })

  it('projects all breakpoint controls through the adapter registry and commits one form patch', async () => {
    const form = {
      ...baseForm,
      responsive: {
        ...baseForm.responsive,
        mobile: { columns: 8, fieldSpan: 8, labelWidth: 72 },
      },
    }
    const wrapper = mount(DesignerResponsiveSettings, {
      props: {
        components,
        controls,
        form,
      },
    })

    const cards = wrapper.findAll('.mx-config-form-designer__breakpoint-layout')
    expect(wrapper.findAll('[data-adapter-boolean]')).toHaveLength(2)
    expect(wrapper.findAll('[data-adapter-number]')).toHaveLength(9)
    expect(cards.map(card => card.findAll('[data-adapter-number]').map(control => control.attributes('aria-label')))).toEqual([
      ['Columns', 'Field span', 'Label width (px)'],
      ['Columns', 'Field span', 'Label width (px)'],
      ['Columns', 'Field span', 'Label width (px)'],
    ])
    expect(cards.flatMap(card => card.findAll('[data-adapter-number]').map(control => ({
      max: control.attributes('max'),
      min: control.attributes('min'),
      precision: control.attributes('precision'),
      step: control.attributes('step'),
    })))).toEqual([
      { max: '24', min: '1', precision: '0', step: '1' },
      { max: '24', min: '1', precision: '0', step: '1' },
      { max: '480', min: '0', precision: '0', step: '1' },
      { max: '24', min: '1', precision: '0', step: '1' },
      { max: '12', min: '1', precision: '0', step: '1' },
      { max: '480', min: '0', precision: '0', step: '1' },
      { max: '24', min: '1', precision: '0', step: '1' },
      { max: '8', min: '1', precision: '0', step: '1' },
      { max: '480', min: '0', precision: '0', step: '1' },
    ])

    await wrapper.findAll('[data-adapter-boolean]')[0]!.trigger('click')
    await nextTick()
    expect(wrapper.emitted('commit')?.at(-1)).toEqual([{
      mobile: { columns: 8, fieldSpan: 8, labelWidth: 72 },
    }])
    expect(wrapper.emitted('updateForm')?.at(-1)).toEqual([{
      responsive: {
        mobile: { columns: 8, fieldSpan: 8, labelWidth: 72 },
      },
    }])

    await wrapper.setProps({ form })
    const tablet = wrapper.get('[data-breakpoint="tablet"]')
    const tabletColumns = tablet.get('[data-adapter-number][aria-label="Columns"]')
    ;(tabletColumns.element as HTMLInputElement).value = '4'
    await tabletColumns.trigger('change')
    expect(wrapper.emitted('commit')?.at(-1)).toEqual([{
      tablet: { columns: 4, fieldSpan: 4, labelWidth: 96 },
      mobile: { columns: 8, fieldSpan: 8, labelWidth: 72 },
    }])

    const tabletLabelWidth = tablet.get('[data-adapter-number][aria-label="Label width (px)"]')
    ;(tabletLabelWidth.element as HTMLInputElement).value = '88'
    await tabletLabelWidth.trigger('change')
    expect(wrapper.emitted('commit')?.at(-1)).toEqual([{
      tablet: { columns: 12, fieldSpan: 6, labelWidth: 88 },
      mobile: { columns: 8, fieldSpan: 8, labelWidth: 72 },
    }])

    const desktopLabelWidth = wrapper
      .get('[data-breakpoint="desktop"]')
      .get('[data-adapter-number][aria-label="Label width (px)"]')
    ;(desktopLabelWidth.element as HTMLInputElement).value = '144'
    await desktopLabelWidth.trigger('change')
    expect(wrapper.emitted('updateForm')?.at(-1)).toEqual([{ labelWidth: 144 }])

    await wrapper.setProps({ readonly: true })
    expect(wrapper.findAll('[data-adapter-boolean]').every(control => control.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.findAll('[data-adapter-number]').every(control => control.attributes('disabled') !== undefined)).toBe(true)
  })
})
