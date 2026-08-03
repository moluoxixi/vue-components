import type { Component } from 'vue'
import type { ElementConfigFormExpose } from '../src/types'
import { defineField, defineFields } from '@moluoxixi/config-form-headless'
import { flushPromises, mount } from '@vue/test-utils'
import { ElCheckbox } from 'element-plus'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { z } from 'zod'
import ElementConfigFormSource from '../src/index.vue'

const ElementConfigForm = ElementConfigFormSource as Component

interface UserForm {
  name: string
  status: string
}

interface CheckboxForm {
  enabled: boolean
}

const InputStub = defineComponent({
  name: 'InputStub',
  props: {
    disabled: Boolean,
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
  },
  emits: ['blur', 'update:modelValue'],
  setup(props, { emit }) {
    return () => h('input', {
      'data-testid': 'input-stub',
      'disabled': props.disabled,
      'onBlur': () => emit('blur'),
      'onInput': (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      'placeholder': props.placeholder,
      'value': props.modelValue,
    })
  },
})

const OptionStub = defineComponent({
  name: 'OptionStub',
  props: { label: { type: String, default: '' } },
  setup: props => () => h('span', { 'data-testid': 'option-stub' }, props.label),
})

const ContainerStub = defineComponent({
  name: 'ContainerStub',
  setup: (_props, { slots }) => () => h('article', { 'data-testid': 'container-stub' }, slots.default?.()),
})

describe('element config form', () => {
  it('透传原生 attrs，并保持 formAttrs 与 adapter namespace 优先级', () => {
    const wrapper = mount(ElementConfigForm, {
      attrs: {
        'class': 'consumer-form',
        'data-consumer': 'true',
        'id': 'consumer-id',
        'namespace': 'consumer-namespace',
      },
      props: {
        fields: [],
        formAttrs: { 'data-form-attrs': 'true', 'id': 'form-attrs-id' },
        modelValue: { name: '', status: 'draft' },
      },
    })

    const form = wrapper.get('form')
    expect(form.attributes()).toMatchObject({
      'data-consumer': 'true',
      'data-form-attrs': 'true',
      'id': 'form-attrs-id',
    })
    expect(form.classes()).toEqual(expect.arrayContaining(['consumer-form', 'mx-element-config-form']))
    expect(form.classes()).not.toContain('consumer-namespace')
  })

  it('使用自有表单壳渲染字段、写回模型并执行 Zod 校验', async () => {
    const fields = [
      defineField<UserForm>({
        component: InputStub,
        field: 'name',
        label: '姓名',
        props: { placeholder: '请输入姓名' },
        required: true,
        requiredMessage: '请输入姓名',
        schema: z.string().min(2, '至少两个字符'),
        span: 12,
        validateOn: 'blur',
      }),
      defineField<UserForm>({
        component: InputStub,
        field: 'status',
        hidden: true,
        label: '隐藏状态',
      }),
    ]
    const wrapper = mount(ElementConfigForm, {
      props: { fields, modelValue: { name: '', status: 'draft' } },
    })

    expect(wrapper.find('form.mx-element-config-form').exists()).toBe(true)
    expect(wrapper.get('[data-field="name"]').text()).toContain('姓名')
    expect(wrapper.get('.mx-element-config-form__row').classes()).toContain('mx-element-config-form__row--grid')
    expect(wrapper.get('.mx-element-config-form__cell').attributes('style')).toContain('grid-column: span 12 / span 12')
    expect(wrapper.find('[data-field="status"]').exists()).toBe(false)

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('.mx-element-config-form__error').text()).toBe('请输入姓名')
    expect(wrapper.emitted('error')![0]).toEqual([{ name: ['请输入姓名'] }])

    await wrapper.get<HTMLInputElement>('[data-testid="input-stub"]').setValue('Ada')
    expect(wrapper.emitted('fieldChange')![0][0]).toMatchObject({ field: 'name', value: 'Ada' })
    expect(wrapper.emitted('metaChange')!.at(-1)![0]).toMatchObject({ dirty: true, touched: true })
    expect(wrapper.find('.mx-element-config-form__error').exists()).toBe(false)
  })

  it('同页同名字段生成唯一 control/error id 并关联本字段错误', async () => {
    const fields = [defineField<UserForm>({
      component: InputStub,
      field: 'name',
      label: '姓名',
      required: true,
      requiredMessage: '请输入姓名',
    })]
    const Host = defineComponent({
      setup: () => () => h('div', [
        h(ElementConfigForm, { fields, modelValue: { name: '', status: 'draft' } }),
        h(ElementConfigForm, { fields, modelValue: { name: '', status: 'draft' } }),
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
      const control = form.get('[data-testid="input-stub"]')
      const error = form.get('.mx-element-config-form__error')
      const label = form.get('.mx-element-config-form__label')

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

  it('element Checkbox 与字段标签使用唯一 id 并独立写回', async () => {
    const fields = [defineField<CheckboxForm>({
      component: ElCheckbox,
      field: 'enabled',
      label: '启用',
    })]
    const Host = defineComponent({
      setup() {
        const first = ref<CheckboxForm>({ enabled: false })
        const second = ref<CheckboxForm>({ enabled: false })
        return () => h('div', [
          h(ElementConfigForm, {
            fields,
            'modelValue': first.value,
            'onUpdate:modelValue': (value: unknown) => first.value = value as CheckboxForm,
          }),
          h(ElementConfigForm, {
            fields,
            'modelValue': second.value,
            'onUpdate:modelValue': (value: unknown) => second.value = value as CheckboxForm,
          }),
        ])
      },
    })
    const wrapper = mount(Host)
    await flushPromises()
    const formFields = wrapper.findAll('.mx-element-config-form__field')
    const firstInput = formFields[0].get<HTMLInputElement>('input[type="checkbox"]')
    const secondInput = formFields[1].get<HTMLInputElement>('input[type="checkbox"]')
    const secondLabel = formFields[1].get('.mx-element-config-form__label')

    expect(firstInput.attributes('id')).not.toBe(secondInput.attributes('id'))
    expect(secondLabel.attributes('for')).toBe(secondInput.attributes('id'))

    await secondInput.trigger('click')
    await flushPromises()

    expect(firstInput.element.checked).toBe(false)
    expect(secondInput.element.checked).toBe(true)
  })

  it('inline 布局使用原生 Flex，不依赖 Form/FormItem/Row/Col', () => {
    const fields = [
      defineField<UserForm>({ component: InputStub, field: 'name', label: '姓名' }),
      defineField<UserForm>({ component: InputStub, field: 'status', label: '状态' }),
    ]
    const wrapper = mount(ElementConfigForm, {
      props: { fields, inline: true, modelValue: { name: 'Ada', status: 'draft' } },
    })

    expect(wrapper.get('.mx-element-config-form__row').classes()).toContain('mx-element-config-form__row--inline')
    expect(wrapper.get('.mx-element-config-form__row').attributes('style')).toContain('display: flex')
    expect(wrapper.find('.mx-element-config-form__cell').exists()).toBe(false)
    expect(wrapper.findAll('.mx-element-config-form__field')).toHaveLength(2)
    expect(wrapper.find('.el-form').exists()).toBe(false)
  })

  it('递归收集 slot 字段，并通过字段 readonlyRender 展示', async () => {
    const { defineField: defineUserField } = defineFields<UserForm>()
    const fields = [
      defineUserField({
        component: ContainerStub,
        slots: {
          default: [
            defineUserField({ component: OptionStub, props: { label: '说明' } }),
            defineUserField({
              component: InputStub,
              field: 'name',
              label: '姓名',
              readonly: true,
              readonlyRender: ({ value }) => h('strong', { 'data-testid': 'name-readonly' }, `只读:${value}`),
            }),
          ],
        },
      }),
    ]
    const wrapper = mount(ElementConfigForm, {
      props: { fields, modelValue: { name: 'Ada', status: 'draft' } },
    })

    expect(wrapper.find('[data-testid="container-stub"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="name-readonly"]').text()).toBe('只读:Ada')
    expect(wrapper.find('[data-testid="input-stub"]').exists()).toBe(false)

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')![0]).toEqual([{ name: 'Ada' }])
  })

  it('通过统一 expose 重置和读取错误', async () => {
    const initial: UserForm = { name: 'Ada', status: 'draft' }
    const fields = [defineField<UserForm>({
      component: InputStub,
      field: 'name',
      required: true,
      requiredMessage: '请输入姓名',
    })]
    const wrapper = mount(ElementConfigForm, {
      props: { fields, modelValue: initial },
    })
    const form = wrapper.vm as unknown as ElementConfigFormExpose<UserForm>

    form.setValue('name', '')
    expect(form.getValue('name')).toBe('')
    expect(await form.validate()).toBe(false)
    expect(form.getErrors()).toEqual({ name: ['请输入姓名'] })
    form.resetFields()
    expect(form.getValues()).toEqual(initial)
    expect(form.getErrors()).toEqual({})
  })
})
