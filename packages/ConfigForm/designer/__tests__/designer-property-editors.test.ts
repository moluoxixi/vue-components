import type { RuleSet } from '@moluoxixi/zod3-to-rule'
import type { DesignerPropertySetterDefinition } from '../src/registry'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { mount } from '@vue/test-utils'
import { ElOption } from 'element-plus'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import DesignerDefaultValueSetter from '../src/components/DesignerPropertyPanel/components/DesignerDefaultValueSetter/index.vue'
import DesignerOptionsSetter from '../src/components/DesignerPropertyPanel/components/DesignerOptionsSetter/index.vue'
import DesignerPropertyForm from '../src/components/DesignerPropertyPanel/components/DesignerPropertyForm/index.vue'
import DesignerValidationSetter from '../src/components/DesignerPropertyPanel/components/DesignerValidationSetter/index.vue'
import {
  resolveDesignerValidationBase,
  resolveDesignerValidationRuleKinds,
} from '../src/components/DesignerPropertyPanel/services'

describe('designer property editors', () => {
  it('projects validation capabilities from the field value contract', () => {
    expect(resolveDesignerValidationBase('text', undefined)).toEqual({ type: 'string' })
    expect(resolveDesignerValidationBase('number', undefined)).toEqual({ type: 'number' })
    expect(resolveDesignerValidationBase('boolean', undefined)).toEqual({ type: 'boolean' })
    expect(resolveDesignerValidationBase('date', undefined)).toEqual({ type: 'date' })
    expect(resolveDesignerValidationBase('time', undefined)).toBeUndefined()
    expect(resolveDesignerValidationBase('select', [
      { label: 'Draft', value: 'draft' },
      { label: 'Published', value: 'published' },
    ])).toEqual({ type: 'enum', values: ['draft', 'published'] })
    expect(resolveDesignerValidationBase('select', [{ label: 'One', value: 1 }]))
      .toEqual({ type: 'literal', value: 1 })
    expect(resolveDesignerValidationBase('select', [
      { label: 'One', value: 1 },
      { label: 'Two', value: 2 },
    ])).toBeUndefined()
    expect(resolveDesignerValidationBase('select', [
      { label: 'Enabled', value: true },
      { label: 'Disabled', value: false },
    ])).toBeUndefined()
    expect(resolveDesignerValidationBase('multiselect', [
      { label: 'One', value: 'one' },
    ])).toBeUndefined()

    expect(resolveDesignerValidationRuleKinds({ type: 'string' })).toEqual([
      'minLength',
      'maxLength',
      'length',
      'regex',
      'email',
      'url',
      'uuid',
    ])
    expect(resolveDesignerValidationRuleKinds({ type: 'number' })).toEqual([
      'min',
      'max',
      'integer',
      'finite',
      'multipleOf',
    ])
    expect(resolveDesignerValidationRuleKinds({ type: 'boolean' })).toEqual([])
    expect(resolveDesignerValidationRuleKinds({ type: 'date' })).toEqual(['dateMin', 'dateMax'])
    expect(resolveDesignerValidationRuleKinds({ type: 'enum', values: ['one'] })).toEqual([])
  })

  it('keeps an invalid regex draft local until it becomes valid', async () => {
    const validation: RuleSet = {
      version: 2,
      base: { type: 'string' },
      rules: [{ kind: 'regex', source: '^before$' }],
    }
    const wrapper = mount(DesignerValidationSetter, {
      props: { modelValue: validation, valueKind: 'text' },
    })
    const pattern = wrapper.get('input[aria-label="Rule 1 pattern"]')

    await pattern.setValue('[')
    await pattern.trigger('blur')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await pattern.setValue('^after$')
    await pattern.trigger('blur')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
      ...validation,
      rules: [{ kind: 'regex', source: '^after$' }],
    })
  })

  it('limits newly-created option values to the provider capability', async () => {
    const wrapper = mount(DesignerOptionsSetter, {
      props: { modelValue: [], optionValueTypes: ['number'] },
    })

    await wrapper.get('.mx-config-form-designer__add-row').trigger('click')
    expect(wrapper.findAllComponents(ElOption).map(option => option.props('value'))).toEqual(['number'])
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
      { label: 'Option 1', value: 0 },
    ])
  })

  it('preserves an empty string as a valid text default', async () => {
    const wrapper = mount(DesignerDefaultValueSetter, {
      props: { kind: 'text', modelValue: 'before' },
    })
    const input = wrapper.get('input[aria-label="Default value"]')

    await input.setValue('')
    await input.trigger('blur')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([''])
  })

  it('reprojects the authoritative value after a parent rejects a command', async () => {
    const setter: DesignerPropertySetterDefinition = {
      key: 'field',
      label: 'Field',
      path: ['field'],
      control: 'text',
    }
    const wrapper = mount(DesignerPropertyForm, {
      props: {
        entries: [{ setter, value: 'accepted' }],
        renderer: ConfigFormRenderer,
      },
    })
    const input = wrapper.get('input[aria-label="Field"]')

    await input.setValue('rejected')
    await input.trigger('blur')
    expect(wrapper.emitted('commit')?.at(-1)).toEqual(['rejected', setter])
    await nextTick()
    expect((input.element as HTMLInputElement).value).toBe('accepted')
  })
})
