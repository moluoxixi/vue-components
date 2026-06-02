import type { Component } from 'vue'
import { defineField, defineFields } from '@moluoxixi/config-form-core'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import ShadcnConfigFormSource from './src/index.vue'

const ShadcnConfigForm = ShadcnConfigFormSource as Component

interface AccountForm {
  accountName: string
  owner: string
  plan: string
}

const InputStub = defineComponent({
  name: 'ShadcnInputStub',
  props: {
    disabled: Boolean,
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    /**
     * 模拟 shadcn-vue 输入组件的 modelValue/update:modelValue 契约。
     */
    function handleInput(event: Event): void {
      emit('update:modelValue', (event.target as HTMLInputElement).value)
    }

    return () => h('input', {
      'data-testid': 'shadcn-input-stub',
      'disabled': props.disabled,
      'onInput': handleInput,
      'placeholder': props.placeholder,
      'value': props.modelValue,
    })
  },
})

const SelectStub = defineComponent({
  name: 'ShadcnSelectStub',
  props: {
    modelValue: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, { emit, slots }) {
    return () => h('div', { 'data-testid': 'shadcn-select-stub' }, [
      h('button', {
        'data-testid': 'shadcn-select-change',
        'onClick': () => emit('update:modelValue', 'enterprise'),
        'type': 'button',
      }, props.modelValue),
      slots.default?.({ source: 'select' }),
    ])
  },
})

const OptionStub = defineComponent({
  name: 'ShadcnOptionStub',
  props: {
    label: { type: String, default: '' },
    value: { type: String, default: '' },
  },
  setup(props) {
    return () => h('span', {
      'data-label': props.label,
      'data-testid': 'shadcn-option-stub',
      'data-value': props.value,
    }, props.label)
  },
})

const ContainerStub = defineComponent({
  name: 'ShadcnContainerStub',
  setup(_props, { slots }) {
    return () => h('article', { 'data-testid': 'shadcn-container-stub' }, slots.default?.())
  },
})

describe('shadcn config form', () => {
  it('渲染字段壳、写回模型并在必填校验失败时展示错误', async () => {
    const fields = [
      defineField<AccountForm>({
        component: InputStub,
        field: 'accountName',
        label: '账户名称',
        props: { placeholder: '请输入账户名称' },
        rules: [{ message: '请输入账户名称', required: true }],
        span: 12,
      }),
      defineField<AccountForm>({
        component: InputStub,
        disabled: values => values.plan === 'locked',
        field: 'owner',
        label: '负责人',
        required: true,
        visible: values => values.plan !== 'hidden',
      }),
    ]

    const wrapper = mount(ShadcnConfigForm, {
      props: {
        fields,
        modelValue: {
          accountName: '',
          owner: '',
          plan: 'locked',
        },
      },
    })

    expect(wrapper.get('[data-field="accountName"]').text()).toContain('账户名称')
    expect(wrapper.get('[data-field="owner"]').attributes('data-required')).toBe('true')
    expect(wrapper.findAll('[data-testid="shadcn-input-stub"]')[1].attributes('disabled')).toBeDefined()

    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('.mx-shadcn-config-form__error').text()).toBe('请输入账户名称')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.emitted('error')![0][0]).toEqual({
      accountName: ['请输入账户名称'],
    })

    await wrapper.get<HTMLInputElement>('[data-testid="shadcn-input-stub"]').setValue('Moluoxixi Cloud')

    const nextValues = {
      accountName: 'Moluoxixi Cloud',
      owner: '',
      plan: 'locked',
    }

    expect(wrapper.emitted('update:modelValue')![0]).toEqual([nextValues])
    expect(wrapper.emitted('fieldChange')![0]).toEqual([{
      field: 'accountName',
      value: 'Moluoxixi Cloud',
      values: nextValues,
    }])
  })

  it('支持 defineFields、容器节点、配置化 slot 和提交成功', async () => {
    const { defineField: defineAccountField } = defineFields<AccountForm>()
    const fields = [
      defineAccountField({
        component: ContainerStub,
        slots: {
          default: defineAccountField({
            component: OptionStub,
            props: { label: '容器说明', value: 'container-copy' },
          }),
        },
      }),
      defineAccountField({
        component: SelectStub,
        field: 'plan',
        label: '套餐',
        slots: {
          default: [
            defineAccountField({
              component: OptionStub,
              props: { label: '企业版', value: 'enterprise' },
            }),
          ],
        },
      }),
      defineAccountField({
        component: InputStub,
        field: 'owner',
      }),
    ]

    const wrapper = mount(ShadcnConfigForm, {
      props: {
        fields,
        modelValue: {
          accountName: 'Moluoxixi Cloud',
          owner: 'Ada',
          plan: 'starter',
        },
      },
    })

    expect(wrapper.find('[data-testid="shadcn-container-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-field="owner"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="shadcn-option-stub"]').map(option => option.text())).toEqual(['容器说明', '企业版'])

    await wrapper.get('[data-testid="shadcn-select-change"]').trigger('click')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('fieldChange')![0][0]).toMatchObject({
      field: 'plan',
      value: 'enterprise',
    })
    expect(wrapper.emitted('submit')![0]).toEqual([{
      accountName: 'Moluoxixi Cloud',
      owner: 'Ada',
      plan: 'enterprise',
    }])
  })
})
