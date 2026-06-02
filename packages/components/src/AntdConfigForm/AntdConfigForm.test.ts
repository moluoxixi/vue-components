import type { Component } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { defineField, defineFields } from '../ConfigForm'
import AntdConfigFormSource from './src/index.vue'

const AntdConfigForm = AntdConfigFormSource as Component

interface UserForm {
  name: string
  status: string
}

const InputStub = defineComponent({
  name: 'AntdInputStub',
  props: {
    disabled: Boolean,
    placeholder: { type: String, default: '' },
    value: { type: String, default: '' },
  },
  emits: ['update:value'],
  setup(props, { emit }) {
    /**
     * 模拟 Ant Design Vue 输入组件的 value/update:value 契约。
     */
    function handleInput(event: Event): void {
      emit('update:value', (event.target as HTMLInputElement).value)
    }

    return () => h('input', {
      'data-testid': 'antd-input-stub',
      'disabled': props.disabled,
      'onInput': handleInput,
      'placeholder': props.placeholder,
      'value': props.value,
    })
  },
})

const SelectStub = defineComponent({
  name: 'AntdSelectStub',
  props: {
    value: { type: String, default: '' },
  },
  emits: ['update:value'],
  setup(props, { emit, slots }) {
    return () => h('div', { 'data-testid': 'antd-select-stub' }, [
      h('button', {
        'data-testid': 'antd-select-change',
        'onClick': () => emit('update:value', 'enabled'),
        'type': 'button',
      }, props.value),
      slots.default?.({ source: 'select' }),
    ])
  },
})

const OptionStub = defineComponent({
  name: 'AntdOptionStub',
  props: {
    label: { type: String, default: '' },
    value: { type: String, default: '' },
  },
  setup(props) {
    return () => h('span', {
      'data-label': props.label,
      'data-testid': 'antd-option-stub',
      'data-value': props.value,
    }, props.label)
  },
})

const ContainerStub = defineComponent({
  name: 'AntdContainerStub',
  setup(_props, { slots }) {
    return () => h('article', { 'data-testid': 'antd-container-stub' }, slots.default?.())
  },
})

function createAntdStubs(validateReject = false) {
  const validationError = Object.assign(new Error('Ant Design Vue validate failed'), {
    invalidFields: { name: [{ message: '请输入姓名' }] },
  })
  const validate = vi.fn(async () => {
    if (validateReject)
      throw validationError

    return true
  })
  const validateFields = vi.fn(async () => ({}))
  const resetFields = vi.fn()
  const clearValidate = vi.fn()
  const scrollToField = vi.fn()

  const AForm = defineComponent({
    name: 'AForm',
    props: ['model', 'rules'],
    emits: ['submit'],
    setup(props, { emit, expose, slots }) {
      expose({
        clearValidate,
        resetFields,
        scrollToField,
        validate,
        validateFields,
      })

      return () => h('form', {
        'data-rules': Object.keys(props.rules ?? {}).join(','),
        'data-testid': 'antd-form',
        'onSubmit': (event: Event) => emit('submit', event),
      }, slots.default?.())
    },
  })

  const AFormItem = defineComponent({
    name: 'AFormItem',
    props: ['label', 'name', 'required', 'rules'],
    setup(props, { slots }) {
      return () => h('section', {
        'data-label': props.label,
        'data-name': props.name,
        'data-required': String(props.required),
        'data-rules': String(Boolean(props.rules)),
        'data-testid': `antd-form-item-${props.name}`,
      }, slots.default?.())
    },
  })

  const ARow = defineComponent({
    name: 'ARow',
    props: ['gutter'],
    setup(props, { slots }) {
      return () => h('div', {
        'data-gutter': props.gutter,
        'data-testid': 'antd-row',
      }, slots.default?.())
    },
  })

  const ACol = defineComponent({
    name: 'ACol',
    props: ['span'],
    setup(props, { slots }) {
      return () => h('div', {
        'data-span': props.span,
        'data-testid': 'antd-col',
      }, slots.default?.())
    },
  })

  return {
    methods: {
      validate,
    },
    stubs: {
      ACol,
      AForm,
      AFormItem,
      ARow,
    },
    validationError,
  }
}

describe('antd config form', () => {
  it('使用 Ant Design Vue 表单壳渲染字段并写回模型', async () => {
    const { stubs } = createAntdStubs()
    const fields = [
      defineField<UserForm>({
        component: InputStub,
        field: 'name',
        label: '姓名',
        props: { placeholder: '请输入姓名' },
        rules: [{ message: '请输入姓名', required: true }],
        span: 12,
      }),
      defineField<UserForm>({
        component: InputStub,
        disabled: values => values.status === 'locked',
        field: 'status',
        label: '状态',
        visible: values => values.status !== 'hidden',
      }),
    ]

    const wrapper = mount(AntdConfigForm, {
      props: {
        fields,
        modelValue: {
          name: '旧名称',
          status: 'locked',
        },
      },
      global: { stubs },
    })

    expect(wrapper.get('[data-testid="antd-form-item-name"]').attributes('data-label')).toBe('姓名')
    expect(wrapper.get('[data-testid="antd-form-item-name"]').attributes('data-rules')).toBe('true')
    expect(wrapper.get('[data-testid="antd-col"]').attributes('data-span')).toBe('12')
    expect(wrapper.get('[data-testid="antd-form-item-status"]').attributes('data-required')).toBe('false')
    expect(wrapper.get('[data-testid="antd-form"]').attributes('data-rules')).toBe('name')
    expect(wrapper.findAll('[data-testid="antd-input-stub"]')[1].attributes('disabled')).toBeDefined()

    await wrapper.get<HTMLInputElement>('[data-testid="antd-input-stub"]').setValue('新名称')

    const nextValues = {
      name: '新名称',
      status: 'locked',
    }

    expect(wrapper.emitted('update:modelValue')![0]).toEqual([nextValues])
    expect(wrapper.emitted('fieldChange')![0]).toEqual([{
      field: 'name',
      value: '新名称',
      values: nextValues,
    }])
    expect(wrapper.emitted('change')![0]).toEqual([nextValues])
  })

  it('支持容器节点、配置化 slot 和 Ant Design Vue 提交校验', async () => {
    const { methods, stubs } = createAntdStubs()
    const { defineField: defineUserField } = defineFields<UserForm>()
    const fields = [
      defineUserField({
        component: ContainerStub,
        slots: {
          default: defineUserField({
            component: OptionStub,
            props: { label: '容器选项', value: 'container-option' },
          }),
        },
      }),
      defineUserField({
        component: SelectStub,
        field: 'status',
        label: '状态',
        slots: {
          default: [
            defineUserField({
              component: OptionStub,
              props: { label: '启用', value: 'enabled' },
            }),
          ],
        },
      }),
    ]

    const wrapper = mount(AntdConfigForm, {
      props: {
        fields,
        modelValue: {
          name: '表单',
          status: 'draft',
        },
      },
      global: { stubs },
    })

    expect(wrapper.find('[data-testid="antd-container-stub"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="antd-option-stub"]').map(option => option.text())).toEqual(['容器选项', '启用'])

    await wrapper.get('[data-testid="antd-select-change"]').trigger('click')
    expect(wrapper.emitted('fieldChange')![0][0]).toMatchObject({
      field: 'status',
      value: 'enabled',
    })

    await wrapper.get('[data-testid="antd-form"]').trigger('submit')

    expect(methods.validate).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('submit')![0]).toEqual([{
      name: '表单',
      status: 'enabled',
    }])
  })

  it('提交校验失败时暴露 Ant Design Vue 错误对象', async () => {
    const { stubs, validationError } = createAntdStubs(true)
    const fields = [
      defineField<UserForm>({
        component: InputStub,
        field: 'name',
        label: '姓名',
      }),
    ]

    const wrapper = mount(AntdConfigForm, {
      props: {
        fields,
        modelValue: {
          name: '',
          status: 'draft',
        },
      },
      global: { stubs },
    })

    await wrapper.get('[data-testid="antd-form"]').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.emitted('error')![0]).toEqual([validationError])
  })
})
