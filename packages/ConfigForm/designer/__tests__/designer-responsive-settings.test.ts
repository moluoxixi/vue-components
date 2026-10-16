import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { mount } from '@vue/test-utils'
import { ElSwitch } from 'element-plus'
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
      props: {
        renderer: ConfigFormRenderer,
        form: baseForm,
      },
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
      ? card.find('.mx-config-form-designer__breakpoint-fields').findAll('[data-config-form-label]').map(label => label.text())
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
    expect(cards()[2]!.find('.mx-config-form-designer__breakpoint-fields').findAll('[data-config-form-label]').map(label => label.text())).toEqual([
      'Columns',
      'Field span',
      'Label width (px)',
    ])
  })

  it('uses one renderer for numeric fields and keeps breakpoint commands outside its model', async () => {
    const form = {
      ...baseForm,
      responsive: {
        ...baseForm.responsive,
        mobile: { columns: 8, fieldSpan: 8, labelWidth: 72 },
      },
    }
    const wrapper = mount(DesignerResponsiveSettings, {
      props: {
        renderer: ConfigFormRenderer,
        components,
        controls,
        form,
      },
    })

    const cards = wrapper.findAll('.mx-config-form-designer__breakpoint-layout')
    expect(wrapper.findAllComponents(ConfigFormRenderer)).toHaveLength(1)
    expect(wrapper.findAll('[data-adapter-boolean]')).toHaveLength(0)
    expect(wrapper.findAll('[role="switch"]')).toHaveLength(2)
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

    await wrapper.get('[data-breakpoint="tablet"] .mx-config-form-designer__responsive-toggle-control').trigger('click')
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
    expect(wrapper.findAll('[role="switch"]').every(control => control.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.findAll('[data-adapter-number]').every(control => control.attributes('disabled') !== undefined)).toBe(true)
  })

  it('copies the resolved inherited layout when enabling and removes only that override when disabling', async () => {
    const wrapper = mount(DesignerResponsiveSettings, {
      props: { renderer: ConfigFormRenderer, form: baseForm, components, controls },
    })
    const mobile = () => wrapper.get('[data-breakpoint="mobile"]')
    expect(mobile().find('.mx-config-form-designer__breakpoint-fields').exists()).toBe(false)
    await mobile().get('.mx-config-form-designer__responsive-toggle-control').trigger('click')
    expect(wrapper.emitted('updateForm')?.at(-1)).toEqual([{
      responsive: {
        tablet: { columns: 12, fieldSpan: 6, labelWidth: 96 },
        mobile: { columns: 12, fieldSpan: 6, labelWidth: 96 },
      },
    }])
    // A rejected command must leave the authoritative disabled state visible.
    await nextTick()
    expect(mobile().get('[role="switch"]').attributes('aria-checked')).toBe('false')
    expect(mobile().find('.mx-config-form-designer__breakpoint-fields').exists()).toBe(false)

    await wrapper.setProps({ form: {
      ...baseForm,
      responsive: { ...baseForm.responsive, mobile: { columns: 12, fieldSpan: 6, labelWidth: 96 } },
    } })
    expect(mobile().get('[role="switch"]').attributes('aria-checked')).toBe('true')
    expect(mobile().findAll('[data-adapter-number]')).toHaveLength(3)
    await mobile().get('.mx-config-form-designer__responsive-toggle-control').trigger('click')
    expect(wrapper.emitted('commit')?.at(-1)).toEqual([baseForm.responsive])
    expect(baseForm.responsive).toEqual({ tablet: { columns: 12, fieldSpan: 6, labelWidth: 96 } })
  })

  it('reconciles rejected numeric commands and blocks disabled control emissions', async () => {
    const wrapper = mount(DesignerResponsiveSettings, {
      props: { renderer: ConfigFormRenderer, form: baseForm, components, controls },
    })
    const tabletColumns = () => wrapper.get('[data-breakpoint="tablet"] [data-adapter-number][aria-label="Columns"]')
    ;(tabletColumns().element as HTMLInputElement).value = '4'
    await tabletColumns().trigger('change')
    await nextTick()
    expect((tabletColumns().element as HTMLInputElement).value).toBe('12')
    expect(wrapper.emitted('updateForm')).toHaveLength(1)

    await wrapper.setProps({ disabled: true })
    wrapper.findAllComponents(ElSwitch)[0]!.vm.$emit('change', false)
    wrapper.findAllComponents(NumberControl)[0]!.vm.$emit('change', 4)
    await nextTick()
    expect(wrapper.emitted('updateForm')).toHaveLength(1)
    expect((tabletColumns().element as HTMLInputElement).value).toBe('12')
    expect(wrapper.findAll('[role="switch"]').every(control => control.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.findAll('[data-adapter-number]').every(control => control.attributes('disabled') !== undefined)).toBe(true)
  })

  it('keeps accessible tab relationships and keyboard navigation', async () => {
    const wrapper = mount(DesignerResponsiveSettings, {
      props: { renderer: ConfigFormRenderer, form: baseForm, breakpoint: 'tablet' },
    })
    const tabs = () => wrapper.findAll('[role="tab"]')
    const panels = () => wrapper.findAll('[role="tabpanel"]')
    expect(tabs().map(tab => tab.attributes('aria-selected'))).toEqual(['false', 'true', 'false'])
    expect(tabs().map(tab => tab.attributes('aria-controls'))).toEqual(panels().map(panel => panel.attributes('id')))
    expect(panels().map(panel => panel.attributes('aria-labelledby'))).toEqual(tabs().map(tab => tab.attributes('id')))
    await tabs()[1]!.trigger('keydown', { key: 'ArrowRight' })
    expect(tabs().map(tab => tab.attributes('aria-selected'))).toEqual(['false', 'false', 'true'])
    await tabs()[2]!.trigger('keydown', { key: 'Home' })
    expect(tabs().map(tab => tab.attributes('aria-selected'))).toEqual(['true', 'false', 'false'])
    await wrapper.setProps({ breakpoint: 'mobile' })
    expect(tabs().map(tab => tab.attributes('aria-selected'))).toEqual(['false', 'false', 'true'])
  })
})
