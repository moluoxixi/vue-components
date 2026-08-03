import type { Component } from 'vue'
import type { ShadcnConfigFormExpose } from '../src/types'
import { defineField, defineFields } from '@moluoxixi/config-form-headless'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import ShadcnConfigFormSource from '../src/index.vue'

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
  it('透传原生 attrs，并保持 formAttrs 与 adapter namespace 优先级', () => {
    const wrapper = mount(ShadcnConfigForm, {
      attrs: {
        'class': 'consumer-form',
        'data-consumer': 'true',
        'id': 'consumer-id',
        'namespace': 'consumer-namespace',
      },
      props: {
        fields: [],
        formAttrs: { 'data-form-attrs': 'true', 'id': 'form-attrs-id' },
        modelValue: { accountName: '', owner: '', plan: 'free' },
      },
    })

    const form = wrapper.get('form')
    expect(form.attributes()).toMatchObject({
      'data-consumer': 'true',
      'data-form-attrs': 'true',
      'id': 'form-attrs-id',
    })
    expect(form.classes()).toEqual(expect.arrayContaining(['consumer-form', 'mx-shadcn-config-form']))
    expect(form.classes()).not.toContain('consumer-namespace')
  })

  it('渲染字段壳、写回模型并在必填校验失败时展示错误', async () => {
    const fields = [
      defineField<AccountForm>({
        component: InputStub,
        field: 'accountName',
        label: '账户名称',
        props: { placeholder: '请输入账户名称' },
        required: true,
        requiredMessage: '请输入账户名称',
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
    expect(wrapper.get('.mx-shadcn-config-form__row').classes()).toContain('mx-shadcn-config-form__row--grid')
    expect(wrapper.get('.mx-shadcn-config-form__cell').attributes('style')).toContain('grid-column: span 12')

    await wrapper.get('form').trigger('submit')
    await flushPromises()
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
    expect(wrapper.emitted('metaChange')!.at(-1)![0]).toMatchObject({ dirty: true, touched: true })
  })

  it('同页同名字段生成唯一 control/error id 并关联本字段错误', async () => {
    const fields = [defineField<AccountForm>({
      component: InputStub,
      field: 'accountName',
      label: '账户名称',
      required: true,
      requiredMessage: '请输入账户名称',
    })]
    const Host = defineComponent({
      setup: () => () => h('div', [
        h(ShadcnConfigForm, { fields, modelValue: { accountName: '', owner: '', plan: 'starter' } }),
        h(ShadcnConfigForm, { fields, modelValue: { accountName: '', owner: '', plan: 'starter' } }),
      ]),
    })
    const wrapper = mount(Host)
    const forms = wrapper.findAll('form')

    expect(forms).toHaveLength(2)
    for (const form of forms)
      await form.trigger('submit')
    await flushPromises()

    const controlIds: string[] = []
    const errorIds: string[] = []
    for (const form of forms) {
      const control = form.get('[data-testid="shadcn-input-stub"]')
      const error = form.get('.mx-shadcn-config-form__error')
      const label = form.get('.mx-shadcn-config-form__label')

      controlIds.push(control.attributes('id') ?? '')
      errorIds.push(error.attributes('id') ?? '')
      expect(label.attributes('for')).toBe(control.attributes('id'))
      expect(control.attributes('aria-describedby')).toBe(error.attributes('id'))
    }

    expect(controlIds.every(Boolean)).toBe(true)
    expect(errorIds.every(Boolean)).toBe(true)
    expect(new Set(controlIds).size).toBe(2)
    expect(new Set(errorIds).size).toBe(2)
  })

  it('inline 布局使用 flex 行容器，不生成 grid cell', () => {
    const fields = [
      defineField<AccountForm>({
        component: InputStub,
        field: 'accountName',
        label: '账户名称',
        span: 12,
      }),
      defineField<AccountForm>({
        component: InputStub,
        field: 'owner',
        label: '负责人',
        span: 12,
      }),
    ]

    const wrapper = mount(ShadcnConfigForm, {
      props: {
        fields,
        inline: true,
        modelValue: {
          accountName: 'Moluoxixi Cloud',
          owner: 'Ada',
          plan: 'starter',
        },
      },
    })

    expect(wrapper.get('.mx-shadcn-config-form__row').classes()).toContain('mx-shadcn-config-form__row--inline')
    expect(wrapper.find('.mx-shadcn-config-form__cell').exists()).toBe(false)
    expect(wrapper.findAll('.mx-shadcn-config-form__field')).toHaveLength(2)
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
    expect(wrapper.find('[data-field="owner"]').exists()).toBe(true)
    expect(wrapper.find('[data-field="owner"] [data-testid="shadcn-input-stub"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="shadcn-option-stub"]').map(option => option.text())).toEqual(['容器说明', '企业版'])

    await wrapper.get('[data-testid="shadcn-select-change"]').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('fieldChange')![0][0]).toMatchObject({
      field: 'plan',
      value: 'enterprise',
    })
    expect(wrapper.emitted('submit')![0]).toEqual([{
      owner: 'Ada',
      plan: 'enterprise',
    }])
  })

  it('通过 expose 重置模型，并按字段或全量清理错误', async () => {
    const fields = [
      defineField<AccountForm>({
        component: InputStub,
        field: 'accountName',
        required: true,
        requiredMessage: '请输入账户名称',
      }),
      defineField<AccountForm>({
        component: InputStub,
        field: 'owner',
        required: true,
        requiredMessage: '请输入负责人',
      }),
    ]
    const initialValues: AccountForm = {
      accountName: 'Moluoxixi Cloud',
      owner: 'Ada',
      plan: 'starter',
    }
    const wrapper = mount(ShadcnConfigForm, {
      props: {
        fields,
        modelValue: initialValues,
      },
    })
    const form = wrapper.vm as unknown as ShadcnConfigFormExpose<AccountForm>

    form.setValue('accountName', '')
    form.setValue('owner', '')
    await form.validate()
    expect(form.getErrors()).toEqual({
      accountName: ['请输入账户名称'],
      owner: ['请输入负责人'],
    })

    form.clearValidate('accountName')
    expect(form.getErrors()).toEqual({ owner: ['请输入负责人'] })

    form.setValue('accountName', 'Recovered')
    expect(form.getErrors()).toEqual({ owner: ['请输入负责人'] })

    form.resetFields('owner')
    expect(form.getValues()).toEqual({ ...initialValues, accountName: 'Recovered' })
    expect(form.getErrors()).toEqual({})

    form.setValues({ accountName: 'Changed', owner: 'Grace' })
    form.resetFields()
    expect(form.getValues()).toEqual(initialValues)
    expect(wrapper.emitted('change')!.at(-1)).toEqual([initialValues])
  })

  it('支持动态 readonly 和字段级 readonlyRender', async () => {
    const fields = [
      defineField<AccountForm>({
        component: InputStub,
        field: 'accountName',
        label: '账户名称',
        readonly: values => values.plan === 'locked',
        readonlyRender: ({ value }) => h('strong', { 'data-testid': 'shadcn-readonly' }, `账户:${value}`),
      }),
    ]
    const wrapper = mount(ShadcnConfigForm, {
      props: {
        fields,
        modelValue: { accountName: 'Cloud', owner: 'Ada', plan: 'locked' },
      },
    })

    expect(wrapper.get('[data-testid="shadcn-readonly"]').text()).toBe('账户:Cloud')
    expect(wrapper.find('[data-testid="shadcn-input-stub"]').exists()).toBe(false)

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')![0]).toEqual([{ accountName: 'Cloud' }])
  })
})
