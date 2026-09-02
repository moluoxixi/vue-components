import type { Component, FunctionalComponent, VNodeChild } from 'vue'
import type { ConfigFormExpose } from '@/types'
import { mount } from '@vue/test-utils'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { h } from 'vue'
import { asVueFunctionalComponent, ConfigForm, defineField } from '../../../index'

describe('asVueFunctionalComponent', () => {
  it('renders Vue functional components with props and emit semantics', async () => {
    interface InputProps {
      modelValue?: string
    }
    interface InputSlots {
      default?: () => VNodeChild
    }
    type InputEmits = Record<'update:modelValue', [value: string]>
    const FunctionalInput: FunctionalComponent<InputProps, InputEmits, InputSlots> = (props, { attrs, emit, slots }) => h('button', {
      'aria-label': attrs['aria-label'],
      'data-testid': 'functional-input',
      'onClick': () => emit('update:modelValue', `${props.modelValue ?? ''}!`),
    }, [props.modelValue, slots.default?.()])
    const WrappedInput = asVueFunctionalComponent(FunctionalInput)
    type WrappedInputInstance = InstanceType<typeof WrappedInput>
    type PreservesVueContract = typeof WrappedInput extends Component<InputProps, any, any, any, any, InputEmits, InputSlots>
      ? true
      : false
    expectTypeOf<PreservesVueContract>().toEqualTypeOf<true>()
    expectTypeOf<WrappedInputInstance['$props']['onUpdate:modelValue']>()
      .toEqualTypeOf<((value: string) => any) | undefined>()
    expectTypeOf<WrappedInputInstance['$emit']>()
      .toBeCallableWith('update:modelValue', 'Ada')
    expectTypeOf<WrappedInputInstance['$slots']['default']>()
      .toEqualTypeOf<InputSlots['default']>()
    const typedField = defineField({ id: 'fixture-node-packages-ConfigForm-runtime-src-utils-tests-vueComponent-test-ts-1', component: WrappedInput, field: 'typed-name', props: { modelValue: 'typed' } })
    expectTypeOf(typedField.props?.modelValue).toEqualTypeOf<string | undefined>()

    const wrapper = mount(ConfigForm, {
      props: {
        defaultValues: { name: 'Ada' },
        fields: [{
          component: WrappedInput,
          field: 'name',
          props: { 'aria-label': 'Functional name' },
          slots: {
            default: () => h('span', ' suffix'),
          },
        }],
      },
    })
    const api = wrapper.vm as unknown as ConfigFormExpose<Record<string, unknown>>

    expect(wrapper.get('[data-testid="functional-input"]').text()).toBe('Ada suffix')
    expect(wrapper.get('[data-testid="functional-input"]').attributes('aria-label')).toBe('Functional name')
    await wrapper.get('[data-testid="functional-input"]').trigger('click')
    expect(api.getValues()).toEqual({ name: 'Ada!' })
  })
})
