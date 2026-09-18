import type { RuleSet } from '@moluoxixi/zod3-to-rule'
import { mount } from '@vue/test-utils'
import { ElOption } from 'element-plus'
import { describe, expect, it } from 'vitest'
import DesignerValidationSetter from '../src/components/DesignerPropertyPanel/components/DesignerValidationSetter/index.vue'

describe('designerValidationSetter advanced rules', () => {
  it('keeps compare and custom rules read-only and preserves them while basic rules change', async () => {
    const validation: RuleSet = {
      version: 1,
      base: { type: 'string' },
      rules: [
        { kind: 'compare', field: 'confirmation', operator: 'eq', message: 'Values must match' },
        { kind: 'minLength', value: 3, message: 'Too short' },
        { kind: 'custom', key: 'available-name', params: { scope: 'tenant' }, message: 'Unavailable' },
      ],
    }
    const wrapper = mount(DesignerValidationSetter, {
      props: { modelValue: validation },
    })

    const advanced = wrapper.findAll('[data-advanced-validation-rule]')
    expect(advanced).toHaveLength(2)
    expect(advanced.map(item => item.get('code').text())).toEqual(['compare', 'custom'])
    expect(advanced[0]!.get('pre').text()).toContain('"field": "confirmation"')
    expect(advanced[1]!.get('pre').text()).toContain('"key": "available-name"')
    expect(advanced.every(item => !item.find('button').exists())).toBe(true)
    expect(wrapper.get('[role="switch"]').attributes('disabled')).toBeDefined()

    const creatableKinds = wrapper.findAllComponents(ElOption)
      .map(option => option.props('value'))
      .filter(Boolean)
    expect(creatableKinds).not.toContain('compare')
    expect(creatableKinds).not.toContain('custom')

    await wrapper.get('input[aria-label="Rule 2 message"]').setValue('At least three characters')
    const emitted = wrapper.emitted('update:modelValue')
    const next = emitted?.at(-1)?.[0] as RuleSet
    expect(next.rules).toEqual([
      validation.rules[0],
      { kind: 'minLength', value: 3, message: 'At least three characters' },
      validation.rules[2],
    ])
  })
})
