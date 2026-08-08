import { parseRuleSet } from '@moluoxixi/zod3-to-rule'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DesignerConditionSetter from '../src/components/DesignerConditionSetter.vue'
import DesignerDefaultValueSetter from '../src/components/DesignerDefaultValueSetter.vue'
import DesignerOptionsSetter from '../src/components/DesignerOptionsSetter.vue'
import DesignerPropertyPanel from '../src/components/DesignerPropertyPanel.vue'
import DesignerSetter from '../src/components/DesignerSetter.vue'
import DesignerValidationSetter from '../src/components/DesignerValidationSetter.vue'

describe('designer structured setters', () => {
  it('commits numeric values from the native change event', async () => {
    const wrapper = mount(DesignerSetter, {
      props: {
        setter: {
          key: 'columns',
          label: 'Columns',
          path: ['columns'],
          control: 'number',
          min: 1,
          max: 24,
        },
        value: 24,
      },
    })

    const input = wrapper.get('input')
    await input.setValue('12')
    await input.trigger('change')
    expect(wrapper.emitted('commit')?.at(-1)).toEqual([12])
  })

  it('shows an inherited span without materializing it on blur', async () => {
    const node = {
      id: 'name',
      kind: 'field' as const,
      material: 'test.input',
      field: 'name',
    }
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        breakpoint: 'mobile',
        diagnostics: [],
        document: {
          version: 1,
          form: {
            fieldSpan: 8,
            responsive: { mobile: { columns: 4, fieldSpan: 2 } },
          },
          nodes: [node],
        },
        node,
      },
    })

    const span = wrapper.findAll('.mx-config-form-designer__setter')
      .find(setter => setter.text().includes('Span'))!
    expect((span.get('input').element as HTMLInputElement).value).toBe('2')
    expect(span.text()).toContain('Inherited')

    await span.get('input').trigger('blur')
    expect(wrapper.emitted('updatePath')).toBeUndefined()

    await span.get('input').setValue('3')
    await span.get('input').trigger('change')
    expect(wrapper.emitted('updatePath')?.at(-1)).toEqual(['name', ['span'], 3])
  })

  it('keeps boolean default values distinct from the unset state', async () => {
    const wrapper = mount(DesignerDefaultValueSetter, {
      props: { kind: 'boolean', modelValue: undefined },
    })

    await wrapper.findAll('button').find(button => button.text() === 'On')!.trigger('click')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toBe(true)

    await wrapper.setProps({ modelValue: true })
    await wrapper.findAll('button').find(button => button.text() === 'Unset')!.trigger('click')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toBeUndefined()
  })

  it('keeps an empty text default distinct from the unset state', async () => {
    const wrapper = mount(DesignerDefaultValueSetter, {
      props: { kind: 'text', modelValue: undefined },
    })

    const input = wrapper.get('input')
    await input.setValue('value')
    await input.setValue('')
    await input.trigger('blur')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toBe('')

    await wrapper.setProps({ modelValue: '' })
    await wrapper.get('.mx-config-form-designer__unset-button').trigger('click')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toBeUndefined()
  })

  it('does not rewrite an imported null default when the input was not edited', async () => {
    const wrapper = mount(DesignerDefaultValueSetter, {
      props: { kind: 'text', modelValue: null },
    })

    await wrapper.get('input').trigger('blur')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('preserves zero and an explicitly empty multiple default', async () => {
    const number = mount(DesignerDefaultValueSetter, {
      props: { kind: 'number', modelValue: 0 },
    })
    expect((number.get('input').element as HTMLInputElement).value).toBe('0')
    await number.get('input').trigger('blur')
    expect(number.emitted('update:modelValue')).toBeUndefined()

    const multiple = mount(DesignerDefaultValueSetter, {
      props: {
        kind: 'multiselect',
        modelValue: [],
        options: [{ label: 'Playground', value: 'playground' }],
      },
    })
    expect(multiple.get('.mx-config-form-designer__unset-button').attributes('aria-pressed')).toBe('false')
    await multiple.findAll('button').find(button => button.text() === 'Playground')!.trigger('click')
    expect(multiple.emitted('update:modelValue')!.at(-1)![0]).toEqual(['playground'])
  })

  it('edits option-backed single and multiple default values without JSON input', async () => {
    const options = [
      { label: 'Playground', value: 'playground' },
      { label: 'Production', value: 'production' },
    ]
    const single = mount(DesignerDefaultValueSetter, {
      props: { kind: 'select', modelValue: 'playground', options },
    })
    await single.findAll('button').find(button => button.text() === 'Production')!.trigger('click')
    expect(single.emitted('update:modelValue')!.at(-1)![0]).toBe('production')

    const multiple = mount(DesignerDefaultValueSetter, {
      props: { kind: 'multiselect', modelValue: ['playground'], options },
    })
    await multiple.findAll('button').find(button => button.text() === 'Production')!.trigger('click')
    expect(multiple.emitted('update:modelValue')!.at(-1)![0]).toEqual(['playground', 'production'])
  })

  it('offers only scalar dynamic option values as component defaults', () => {
    const node = {
      id: 'environment',
      kind: 'field' as const,
      material: 'test.select',
      field: 'environment',
      props: {
        options: [
          { label: 'Playground', value: 'playground' },
          { label: 'Structured', value: { id: 1 } },
        ],
      },
    }
    const material = {
      key: 'test.select',
      version: 1,
      kind: 'field' as const,
      title: 'Select',
      category: 'Fields',
      runtime: { component: 'select' },
      setters: [{
        key: 'defaultValue',
        label: 'Default value',
        path: ['defaultValue'],
        control: 'defaultValue' as const,
        valueKind: 'select' as const,
        optionsPath: ['props', 'options'],
      }],
      createNode: () => node,
    }
    const wrapper = mount(DesignerPropertyPanel, {
      props: {
        document: { version: 1, form: {}, nodes: [node] },
        node,
        material,
        diagnostics: [],
      },
    })

    expect(wrapper.findAll('button').some(button => button.text() === 'Playground')).toBe(true)
    expect(wrapper.findAll('button').some(button => button.text() === 'Structured')).toBe(false)
  })

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

  it('keeps date and numeric rule edits inside the serializable rule contract', async () => {
    const date = mount(DesignerValidationSetter, {
      props: {
        modelValue: {
          version: 1,
          base: { type: 'date' },
          rules: [{ kind: 'dateMin', value: '2025-01-02T00:00:00.000Z' }],
        },
      },
    })
    const dateInput = date.get('input[type="date"]')
    expect((dateInput.element as HTMLInputElement).value).toBe('2025-01-02')
    await dateInput.setValue('2026-03-04')
    await dateInput.trigger('change')
    const dateRules = date.emitted('update:modelValue')!.at(-1)![0]
    expect(dateRules).toMatchObject({
      rules: [{ kind: 'dateMin', value: '2026-03-04T00:00:00.000Z' }],
    })
    expect(parseRuleSet(dateRules).success).toBe(true)

    const number = mount(DesignerValidationSetter, {
      props: {
        modelValue: {
          version: 1,
          base: { type: 'number' },
          rules: [{ kind: 'multipleOf', value: 2 }],
        },
      },
    })
    const numberInput = number.get('input[type="number"]')
    await numberInput.setValue('')
    expect(number.emitted('update:modelValue')).toBeUndefined()
    expect((numberInput.element as HTMLInputElement).value).toBe('2')
  })

  it('keeps literal number values numeric and restores invalid edits', async () => {
    const wrapper = mount(DesignerValidationSetter, {
      props: {
        modelValue: {
          version: 1,
          base: { type: 'literal', value: 2 },
          rules: [],
        },
      },
    })

    const input = wrapper.get('input[aria-label="Literal value"]')
    await input.setValue('5')
    await input.trigger('blur')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toMatchObject({
      base: { type: 'literal', value: 5 },
    })

    await input.setValue('')
    await input.trigger('blur')
    expect((input.element as HTMLInputElement).value).toBe('5')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toMatchObject({
      base: { type: 'literal', value: 5 },
    })
  })

  it('uses known fields and validators when creating executable rules', async () => {
    const wrapper = mount(DesignerValidationSetter, {
      props: {
        currentField: 'end',
        fieldOptions: ['start', 'end'],
        validatorOptions: ['available'],
        modelValue: {
          version: 1,
          base: { type: 'number' },
          rules: [{ kind: 'required' }],
        },
      },
    })

    await wrapper.get('select[aria-label="Rule 1 type"]').setValue('compare')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toMatchObject({
      rules: [{ kind: 'compare', field: 'start', operator: 'eq' }],
    })

    await wrapper.get('select[aria-label="Rule 1 type"]').setValue('custom')
    expect(wrapper.emitted('update:modelValue')!.at(-1)![0]).toMatchObject({
      rules: [{ kind: 'custom', key: 'available' }],
    })
  })
})
