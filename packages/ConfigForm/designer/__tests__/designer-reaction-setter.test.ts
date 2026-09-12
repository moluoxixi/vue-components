import type { ConfigFormReaction } from '@moluoxixi/config-form-core'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DesignerReactionSetter from '../src/components/DesignerPropertyPanel/components/DesignerReactionSetter.vue'

const setValueExpression = 'values.quantity * values.price'
const propExpression = 'values.readonly ? "locked" : "editable"'

const reactions: ConfigFormReaction[] = [{
  id: 'expression-reaction',
  when: { kind: 'literal', value: true },
  then: [
    {
      kind: 'setValue',
      target: 'total',
      value: { kind: 'expression', expression: setValueExpression },
    },
    {
      kind: 'setProps',
      target: 'total',
      props: {
        placeholder: { kind: 'expression', expression: propExpression },
      },
    },
  ],
}]

describe('designer reaction setter expression operands', () => {
  it('renders expressions without exposing literal value controls or replacing the configuration', () => {
    const wrapper = mount(DesignerReactionSetter, {
      props: {
        fieldOptions: ['quantity', 'price', 'total'],
        modelValue: reactions,
      },
    })

    const effects = wrapper.findAll('.mx-config-form-designer__reaction-effect')
    expect(effects).toHaveLength(2)

    const setValueOperand = effects[0]!.get('.mx-config-form-designer__reaction-operand')
    expect(setValueOperand.get('output').text()).toBe(setValueExpression)
    expect(setValueOperand.get('output').attributes('title')).toBe(setValueExpression)
    expect(setValueOperand.findAll('select')).toHaveLength(1)
    expect((setValueOperand.get('select').element as HTMLSelectElement).value).toBe('expression')
    expect(setValueOperand.find('input').exists()).toBe(false)

    const propOperand = effects[1]!.get('.mx-config-form-designer__reaction-prop')
    expect(propOperand.get('output').text()).toBe(propExpression)
    expect(propOperand.get('output').attributes('title')).toBe(propExpression)
    expect(propOperand.findAll('select')).toHaveLength(1)
    expect((propOperand.get('select').element as HTMLSelectElement).value).toBe('expression')
    expect(propOperand.findAll('input')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    wrapper.unmount()
  })
})
