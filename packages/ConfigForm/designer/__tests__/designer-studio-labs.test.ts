import type { SafeExpression, SafeExpressionNode, SurfaceFieldNode } from '@moluoxixi/config-form-model'
import { safeExpressionSchema } from '@moluoxixi/config-form-model'
import { flushPromises, mount } from '@vue/test-utils'
import { ElInput } from 'element-plus'
import { describe, expect, it } from 'vitest'
import DesignerConditionTree from '../src/components/DesignerPropertyPanel/components/DesignerInteractionEditor/components/DesignerSafeExpressionEditor/components/DesignerConditionTree.vue'
import DesignerSafeExpressionEditor from '../src/components/DesignerPropertyPanel/components/DesignerInteractionEditor/components/DesignerSafeExpressionEditor/index.vue'
import DesignerValidationLab from '../src/components/DesignerPropertyPanel/components/DesignerValidationLab.vue'

const fields = [{ id: 'amount', field: 'amount', label: 'Amount' }]
const leaf: SafeExpressionNode = { kind: 'binary', operator: '>=', left: { kind: 'reference', scope: 'values', path: ['amount'] }, right: { kind: 'literal', value: 10 } }

describe('studio rule labs', () => {
  it('limits wrapping an existing condition subtree and allows nesting after removing a group', async () => {
    const wrapper = mount(DesignerConditionTree, { props: { fields, modelValue: leaf } })
    const root = '.mx-config-form-designer__condition-tree[data-depth="0"]'
    for (let depth = 1; depth <= 6; depth++) {
      await wrapper.get(`${root} > footer button`).trigger('click')
      await wrapper.setProps({ modelValue: wrapper.emitted('update:modelValue')!.at(-1)![0] as SafeExpressionNode })
    }
    expect(wrapper.findAll(`${root} > footer button`).every(button => button.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.find('[data-depth="7"]').exists()).toBe(false)
    const before = wrapper.emitted('update:modelValue')!.length
    for (const button of wrapper.findAll(`${root} > footer button`))
      await button.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toHaveLength(before)
    await wrapper.get(`${root} > button`).trigger('click')
    await wrapper.setProps({ modelValue: wrapper.emitted('update:modelValue')!.at(-1)![0] as SafeExpressionNode })
    expect(wrapper.get(`${root} > footer button`).attributes('disabled')).toBeUndefined()
    await wrapper.get(`${root} > footer button`).trigger('click')
    const updated = wrapper.emitted('update:modelValue')!.at(-1)![0] as SafeExpressionNode
    expect(safeExpressionSchema.safeParse({ version: 1, ast: updated }).success).toBe(true)
    await wrapper.setProps({ modelValue: updated })
    expect(wrapper.find('[data-depth="7"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('edits nested conditions while preserving an unsupported reference and refusing invalid literals', async () => {
    const original: SafeExpressionNode = { kind: 'binary', operator: '&&', left: leaf, right: { kind: 'reference', scope: 'parameters', path: ['approved'] } }
    const wrapper = mount(DesignerConditionTree, { props: { fields, modelValue: original } })
    const input = wrapper.findComponent(ElInput)
    input.vm.$emit('update:modelValue', '20')
    await wrapper.vm.$nextTick()
    await input.get('input').trigger('blur')
    const updated = wrapper.emitted('update:modelValue')!.at(-1)![0] as SafeExpressionNode
    expect(updated).toMatchObject({ left: { right: { value: 20 } }, right: original.right })
    expect(safeExpressionSchema.safeParse({ version: 1, ast: updated }).success).toBe(true)
    await wrapper.setProps({ modelValue: updated })
    const before = wrapper.emitted('update:modelValue')!.length
    input.vm.$emit('update:modelValue', '{invalid')
    await wrapper.vm.$nextTick()
    await input.get('input').trigger('blur')
    expect(wrapper.emitted('update:modelValue')).toHaveLength(before)
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not replace a group when switching to an incompatible simple editor', async () => {
    const expression: SafeExpression = { version: 1, ast: { kind: 'binary', operator: '||', left: leaf, right: { kind: 'literal', value: false } } }
    const wrapper = mount(DesignerSafeExpressionEditor, { props: { fields, modelValue: expression } })
    const segment = (label: string) => wrapper.findAll('.el-segmented__item').find(item => item.text() === label)!
    await segment('Groups').get('input').setValue(true)
    expect(wrapper.find('.mx-config-form-designer__condition-tree').exists()).toBe(true)
    await segment('Simple').get('input').setValue(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.find('.mx-config-form-designer__condition-tree').exists()).toBe(true)
    expect(wrapper.get('[role="alert"]').text()).toContain('single condition')
    wrapper.unmount()
  })

  it('validates compare rules with separate sample context and leaves the field unchanged', async () => {
    const node: SurfaceFieldNode = { id: 'end', kind: 'field', field: 'end', component: 'input', props: {}, required: true, validation: { version: 2, base: { type: 'number' }, rules: [{ kind: 'compare', field: 'start', operator: 'gte', message: 'Must be at least start' }] } }
    const initial = JSON.stringify(node)
    const wrapper = mount(DesignerValidationLab, { props: { node } })
    await wrapper.get('select').setValue('json')
    await wrapper.get('textarea[aria-label="Test value"]').setValue('8')
    await wrapper.get('textarea[aria-label="Other field values (JSON)"]').setValue('{"start":10}')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('output').attributes('data-success')).toBe('false')
    expect(wrapper.get('output').text()).toContain('Must be at least start')
    await wrapper.get('textarea[aria-label="Test value"]').setValue('12')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('output').attributes('data-success')).toBe('true')
    expect(JSON.stringify(node)).toBe(initial)
    wrapper.unmount()
  })
})
