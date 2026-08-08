import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DesignerConditionSetter from '../src/components/DesignerConditionSetter.vue'
import DesignerOptionsSetter from '../src/components/DesignerOptionsSetter.vue'
import DesignerValidationSetter from '../src/components/DesignerValidationSetter.vue'

describe('designer structured setters', () => {
  it('preserves option metadata while reordering rows', async () => {
    const wrapper = mount(DesignerOptionsSetter, {
      props: {
        modelValue: [
          { label: 'Option A', value: 'a', disabled: true, meta: { source: 'remote' } },
          { label: 'Option B', value: 'b' },
        ],
      },
    })

    await wrapper.get('button[aria-label="Move option 1 down"]').trigger('click')

    const value = wrapper.emitted('update:modelValue')!.at(-1)![0] as Array<Record<string, unknown>>
    expect(value[1]).toEqual({
      label: 'Option A',
      value: 'a',
      disabled: true,
      meta: { source: 'remote' },
    })
  })

  it('keeps unsupported condition trees in custom mode until explicitly replaced', async () => {
    const wrapper = mount(DesignerConditionSetter, {
      props: {
        modelValue: {
          kind: 'compare',
          operator: 'in',
          left: { kind: 'field', field: 'status' },
          right: { kind: 'literal', value: ['draft', 'published'] },
        },
      },
    })

    const custom = wrapper.findAll('button').find(button => button.text() === 'Custom')!
    expect(custom.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.mx-config-form-designer__condition-builder').exists()).toBe(false)

    await custom.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('preserves custom validation params when editing the message', async () => {
    const wrapper = mount(DesignerValidationSetter, {
      props: {
        modelValue: {
          version: 1,
          base: { type: 'string' },
          rules: [{ kind: 'custom', key: 'strong-password', params: { score: 3 } }],
        },
      },
    })

    const message = wrapper.get('input[aria-label="Rule 1 message"]')
    await message.setValue('Use a stronger password')
    await message.trigger('blur')

    const value = wrapper.emitted('update:modelValue')!.at(-1)![0] as {
      rules: Array<Record<string, unknown>>
    }
    expect(value.rules[0]).toMatchObject({
      kind: 'custom',
      key: 'strong-password',
      params: { score: 3 },
      message: 'Use a stronger password',
    })
  })
})
