import type { ConfigFormReaction } from '@moluoxixi/config-form-core'
import { mount } from '@vue/test-utils'
import { ElInput, ElSelect } from 'element-plus'
import { describe, expect, it } from 'vitest'
import DesignerReactionSetter from '../src/components/DesignerPropertyPanel/components/DesignerReactionSetter/index.vue'

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
    const setValueSource = setValueOperand.findAllComponents(ElSelect)
    expect(setValueSource).toHaveLength(1)
    expect(setValueSource[0]!.props('modelValue')).toBe('expression')
    expect(setValueOperand.find('.el-input-number').exists()).toBe(false)

    const propOperand = effects[1]!.get('.mx-config-form-designer__reaction-prop')
    expect(propOperand.get('output').text()).toBe(propExpression)
    expect(propOperand.get('output').attributes('title')).toBe(propExpression)
    const propSource = propOperand.findAllComponents(ElSelect)
    expect(propSource).toHaveLength(1)
    expect(propSource[0]!.props('modelValue')).toBe('expression')
    expect(propOperand.findAllComponents(ElInput)).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    wrapper.unmount()
  })
})
