import type { Component } from 'vue'
import { defineField, defineFields } from '@moluoxixi/config-form-core'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import ElementConfigFormSource from './src/index.vue'

const ElementConfigForm = ElementConfigFormSource as Component

interface UserForm {
  name: string
  status: string
}

const InputStub = defineComponent({
  name: 'InputStub',
  props: {
    disabled: Boolean,
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    /**
     * 模拟 Element Plus 输入类组件的 v-model 契约。
     */
    function handleInput(event: Event): void {
      emit('update:modelValue', (event.target as HTMLInputElement).value)
    }

    return () => h('input', {
      'data-testid': 'input-stub',
      'disabled': props.disabled,
      'onInput': handleInput,
      'placeholder': props.placeholder,
      'value': props.modelValue,
    })
  },
})

const SelectStub = defineComponent({
  name: 'SelectStub',
  props: {
    modelValue: { type: String, default: '' },
  },
  emits: ['change'],
  setup(props, { emit, slots }) {
    /**
     * 模拟使用 change 作为写回事件的组件，并暴露默认 slot。
     */
    return () => h('div', { 'data-testid': 'select-stub' }, [
      h('button', {
        'data-testid': 'select-change',
        'onClick': () => emit('change', { value: 'enabled' }),
        'type': 'button',
      }, props.modelValue),
      slots.default?.({ source: 'select' }),
    ])
  },
})

const BareInputStub = defineComponent({
  name: 'BareInputStub',
  props: {
    disabled: Boolean,
    modelValue: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    function handleInput(event: Event): void {
      emit('update:modelValue', (event.target as HTMLInputElement).value)
    }

    return () => h('input', {
      'data-testid': 'bare-input-stub',
      'disabled': props.disabled,
      'onInput': handleInput,
      'value': props.modelValue,
    })
  },
})

const OptionStub = defineComponent({
  name: 'OptionStub',
  props: {
    label: { type: String, default: '' },
    value: { type: String, default: '' },
  },
  setup(props) {
    return () => h('span', {
      'data-label': props.label,
      'data-testid': 'option-stub',
      'data-value': props.value,
    }, props.label)
  },
})

const ContainerStub = defineComponent({
  name: 'ContainerStub',
  props: {
    role: { type: String, default: '' },
  },
  setup(props, { slots }) {
    return () => h('article', {
      'data-role': props.role,
      'data-testid': 'container-stub',
    }, slots.default?.({ source: 'container' }))
  },
})

function createElementStubs(validateResult = true) {
  const validate = vi.fn(async (callback?: (valid: boolean, fields?: unknown) => void) => {
    callback?.(validateResult, validateResult ? undefined : { name: [{ message: '请输入姓名' }] })
    return validateResult
  })
  const validateField = vi.fn(async () => true)
  const resetFields = vi.fn()
  const clearValidate = vi.fn()
  const scrollToField = vi.fn()

  const ElForm = defineComponent({
    name: 'ElForm',
    props: ['inline', 'model', 'rules'],
    emits: ['submit'],
    setup(props, { emit, expose, slots }) {
      /**
       * 暴露 Element Plus Form 实例方法，供 ElementConfigForm 的 ref API 调用。
       */
      expose({
        clearValidate,
        resetFields,
        scrollToField,
        validate,
        validateField,
      })

      return () => h('form', {
        'data-inline': String(Boolean(props.inline)),
        'data-rules': Object.keys(props.rules ?? {}).join(','),
        'data-testid': 'element-form',
        'onSubmit': (event: Event) => emit('submit', event),
      }, slots.default?.())
    },
  })

  const ElFormItem = defineComponent({
    name: 'ElFormItem',
    props: ['label', 'prop', 'required', 'rules'],
    setup(props, { slots }) {
      return () => h('section', {
        'data-label': props.label,
        'data-prop': props.prop,
        'data-required': String(props.required),
        'data-rules': String(Boolean(props.rules)),
        'data-testid': `form-item-${props.prop}`,
      }, slots.default?.())
    },
  })

  const ElRow = defineComponent({
    name: 'ElRow',
    props: ['gutter'],
    setup(props, { slots }) {
      return () => h('div', {
        'data-gutter': props.gutter,
        'data-testid': 'element-row',
      }, slots.default?.())
    },
  })

  const ElCol = defineComponent({
    name: 'ElCol',
    props: ['span'],
    setup(props, { slots }) {
      return () => h('div', {
        'data-span': props.span,
        'data-testid': 'element-col',
      }, slots.default?.())
    },
  })

  return {
    methods: {
      clearValidate,
      resetFields,
      scrollToField,
      validate,
      validateField,
    },
    stubs: {
      ElCol,
      ElForm,
      ElFormItem,
      ElRow,
    },
  }
}

describe('element config form', () => {
  it('使用 Element Plus 表单组件渲染字段并写回模型', async () => {
    const { stubs } = createElementStubs()
    const fields = [
      defineField<UserForm>({
        component: InputStub,
        field: 'name',
        label: '姓名',
        props: { placeholder: '请输入姓名' },
        rules: [{ message: '请输入姓名', required: true, trigger: 'blur' }],
        span: 12,
      }),
      defineField<UserForm>({
        component: InputStub,
        disabled: true,
        field: 'status',
        hidden: true,
        label: '隐藏状态',
      }),
    ]

    const wrapper = mount(ElementConfigForm, {
      props: {
        fields,
        modelValue: {
          name: '旧名称',
          status: 'draft',
        },
      },
      global: { stubs },
    })

    expect(wrapper.get('[data-testid="form-item-name"]').attributes('data-label')).toBe('姓名')
    expect(wrapper.get('[data-testid="form-item-name"]').attributes('data-rules')).toBe('true')
    expect(wrapper.get('[data-testid="element-col"]').attributes('data-span')).toBe('12')
    expect(wrapper.find('[data-testid="form-item-status"]').exists()).toBe(false)

    await wrapper.get<HTMLInputElement>('[data-testid="input-stub"]').setValue('新名称')

    const nextValues = {
      name: '新名称',
      status: 'draft',
    }

    expect(wrapper.emitted('update:modelValue')![0]).toEqual([nextValues])
    expect(wrapper.emitted('fieldChange')![0]).toEqual([{
      field: 'name',
      value: '新名称',
      values: nextValues,
    }])
    expect(wrapper.emitted('change')![0]).toEqual([nextValues])
  })

  it('inline 布局只使用 Element Plus Row，不为顶层节点包裹 Col', () => {
    const { stubs } = createElementStubs()
    const fields = [
      defineField<UserForm>({
        component: InputStub,
        field: 'name',
        label: '姓名',
        span: 12,
      }),
      defineField<UserForm>({
        component: InputStub,
        field: 'status',
        label: '状态',
        span: 12,
      }),
    ]

    const wrapper = mount(ElementConfigForm, {
      props: {
        fields,
        formProps: { inline: true },
        modelValue: {
          name: '表单',
          status: 'draft',
        },
        rowProps: { gutter: 24 },
      },
      global: { stubs },
    })

    expect(wrapper.get('[data-testid="element-form"]').attributes('data-inline')).toBe('true')
    expect(wrapper.get('[data-testid="element-row"]').attributes('data-gutter')).toBeUndefined()
    expect(wrapper.find('[data-testid="element-col"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid^="form-item-"]')).toHaveLength(2)
  })

  it('支持自定义值事件、字段 slot 和 Element Plus 提交校验', async () => {
    const { methods, stubs } = createElementStubs()
    const fields = [
      defineField<UserForm>({
        component: SelectStub,
        field: 'status',
        getValueFromEvent: payload => (payload as { value: string }).value,
        label: '状态',
        slots: {
          default: ({ setValue, slotProps }) => h('button', {
            'data-source': slotProps.source,
            'data-testid': 'slot-option',
            'onClick': () => setValue('slot-enabled'),
            'type': 'button',
          }, 'slot option'),
        },
        trigger: 'change',
      }),
    ]

    const wrapper = mount(ElementConfigForm, {
      props: {
        fields,
        modelValue: {
          name: '表单',
          status: 'draft',
        },
      },
      global: { stubs },
    })

    await wrapper.get('[data-testid="select-change"]').trigger('click')
    expect(wrapper.emitted('fieldChange')![0][0]).toMatchObject({
      field: 'status',
      value: 'enabled',
    })

    await wrapper.get('[data-testid="slot-option"]').trigger('click')
    expect(wrapper.emitted('fieldChange')![1][0]).toMatchObject({
      field: 'status',
      value: 'slot-enabled',
    })

    await wrapper.get('[data-testid="element-form"]').trigger('submit')

    expect(methods.validate).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('submit')![0]).toEqual([{
      name: '表单',
      status: 'slot-enabled',
    }])
  })

  it('支持 defineFields、容器节点和配置化 slot 递归渲染', async () => {
    const { stubs } = createElementStubs()
    const { defineField: defineUserField } = defineFields<UserForm>()
    const fields = [
      defineUserField({
        component: ContainerStub,
        props: { role: 'profile-panel' },
        span: 8,
        slots: {
          default: [
            defineUserField({
              component: OptionStub,
              props: { label: '容器选项', value: 'container-option' },
            }),
            defineUserField({
              component: InputStub,
              field: 'name',
              label: '嵌套姓名',
              rules: [{ message: '请输入姓名', required: true, trigger: 'blur' }],
            }),
          ],
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
            defineUserField({
              component: OptionStub,
              props: { label: '停用', value: 'disabled' },
            }),
          ],
        },
        trigger: 'change',
        getValueFromEvent: payload => (payload as { value: string }).value,
      }),
    ]

    const wrapper = mount(ElementConfigForm, {
      props: {
        fields,
        modelValue: {
          name: '旧名称',
          status: 'draft',
        },
      },
      global: { stubs },
    })

    expect(wrapper.get('[data-testid="container-stub"]').attributes('data-role')).toBe('profile-panel')
    expect(wrapper.find('[data-testid="form-item-undefined"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="form-item-name"]').attributes('data-label')).toBe('嵌套姓名')
    expect(wrapper.get('[data-testid="element-form"]').attributes('data-rules')).toBe('name')
    expect(wrapper.findAll('[data-testid="option-stub"]').map(option => option.text())).toEqual([
      '容器选项',
      '启用',
      '停用',
    ])
    expect(wrapper.findAll('[data-testid="element-col"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="element-col"]')[0].attributes('data-span')).toBe('8')

    await wrapper.get<HTMLInputElement>('[data-testid="input-stub"]').setValue('新名称')
    expect(wrapper.emitted('fieldChange')![0][0]).toMatchObject({
      field: 'name',
      value: '新名称',
    })
  })

  it('无 label 的字段节点按 FormComponent 渲染，不生成 FormItem', async () => {
    const { stubs } = createElementStubs()
    const fields = [
      defineField<UserForm>({
        component: BareInputStub,
        field: 'status',
      }),
    ]

    const wrapper = mount(ElementConfigForm, {
      props: {
        fields,
        modelValue: {
          name: '表单',
          status: 'draft',
        },
      },
      global: { stubs },
    })

    expect(wrapper.find('[data-testid="form-item-status"]').exists()).toBe(false)

    await wrapper.get<HTMLInputElement>('[data-testid="bare-input-stub"]').setValue('enabled')
    expect(wrapper.emitted('fieldChange')![0][0]).toMatchObject({
      field: 'status',
      value: 'enabled',
    })
  })

  it('支持 visible 和 disabled 基于当前表单值计算', async () => {
    const { stubs } = createElementStubs()
    const fields = [
      defineField<UserForm>({
        component: BareInputStub,
        disabled: values => values.status === 'locked',
        field: 'name',
        label: '姓名',
        visible: values => values.status !== 'hidden',
      }),
    ]

    const wrapper = mount(ElementConfigForm, {
      props: {
        fields,
        modelValue: {
          name: '表单',
          status: 'hidden',
        },
      },
      global: { stubs },
    })

    expect(wrapper.find('[data-testid="form-item-name"]').exists()).toBe(false)

    await wrapper.setProps({
      modelValue: {
        name: '表单',
        status: 'locked',
      },
    })

    expect(wrapper.find('[data-testid="form-item-name"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="bare-input-stub"]').attributes('disabled')).toBeDefined()
  })

  it('提交校验失败时暴露 Element Plus invalidFields', async () => {
    const { stubs } = createElementStubs(false)
    const fields = [
      defineField<UserForm>({
        component: InputStub,
        field: 'name',
        label: '姓名',
        rules: [{ message: '请输入姓名', required: true, trigger: 'blur' }],
      }),
    ]

    const wrapper = mount(ElementConfigForm, {
      props: {
        fields,
        modelValue: {
          name: '',
          status: 'draft',
        },
      },
      global: { stubs },
    })

    await wrapper.get('[data-testid="element-form"]').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.emitted('error')![0]).toEqual([{ name: [{ message: '请输入姓名' }] }])
  })
})
