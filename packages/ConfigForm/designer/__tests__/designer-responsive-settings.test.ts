import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DesignerResponsiveSettings from '../src/components/DesignerResponsiveSettings.vue'

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
})
