import type { Component } from 'vue'
import type { AntdConfigFormExpose } from '../src/types'
import { defineField, defineFields } from '@moluoxixi/config-form-headless'
import { flushPromises, mount } from '@vue/test-utils'
import { Input, InputNumber, Segmented, Select, Switch } from 'ant-design-vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { z } from 'zod'
import {
  ANTD_CONFIG_FORM_COMPONENTS,
  ANTD_CONFIG_FORM_MATERIAL_REGISTRY,
} from '../src/components'
import AntdConfigFormSource from '../src/index.vue'

const AntdConfigForm = AntdConfigFormSource as Component

interface UserForm {
  name: string
  status: string
}

interface SwitchForm {
  enabled: boolean
}

interface SemanticForm {
  enabled: boolean
  name: string
}

const InputStub = defineComponent({
  name: 'AntdInputStub',
  props: {
    disabled: Boolean,
    value: { type: String, default: '' },
  },
  emits: ['blur', 'update:value'],
  setup(props, { emit }) {
    return () => h('input', {
      'data-testid': 'antd-input-stub',
      'disabled': props.disabled,
      'onBlur': () => emit('blur'),
      'onInput': (event: Event) => emit('update:value', (event.target as HTMLInputElement).value),
      'value': props.value,
    })
  },
})

const SwitchStub = defineComponent({
  name: 'ASwitch',
  props: { checked: Boolean },
  emits: ['update:checked'],
  setup: (props, { emit }) => () => h('button', {
    'aria-checked': String(props.checked),
    'data-testid': 'antd-switch-stub',
    'onClick': () => emit('update:checked', !props.checked),
    'type': 'button',
  }, String(props.checked)),
})

const OptionStub = defineComponent({
  name: 'AntdOptionStub',
  props: { label: { type: String, default: '' } },
  setup: props => () => h('span', { 'data-testid': 'antd-option-stub' }, props.label),
})

const ContainerStub = defineComponent({
  name: 'AntdContainerStub',
  setup: (_props, { slots }) => () => h('article', { 'data-testid': 'antd-container-stub' }, slots.default?.()),
})

describe('antd config form', () => {
  it('registers default component materials from their named files', () => {
    expect(ANTD_CONFIG_FORM_MATERIAL_REGISTRY.list().map(({ name, source }) => ({ name, source }))).toEqual([
      { name: 'text', source: './materials/text.ts' },
      { name: 'textarea', source: './materials/textarea.ts' },
      { name: 'number', source: './materials/number.ts' },
      { name: 'boolean', source: './materials/boolean.ts' },
      { name: 'select', source: './materials/select.ts' },
      { name: 'segmented', source: './materials/segmented.ts' },
    ])
  })

  it('透传原生 attrs，并保持 formAttrs 与 adapter namespace 优先级', () => {
    const wrapper = mount(AntdConfigForm, {
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
    expect(form.classes()).toEqual(expect.arrayContaining(['consumer-form', 'mx-antd-config-form']))
    expect(form.classes()).not.toContain('consumer-namespace')
  })

  it('使用自有表单壳写回模型并执行 Zod 校验', async () => {
    const fields = [
      defineField<UserForm>({
        component: InputStub,
        field: 'name',
        label: '姓名',
        required: true,
        requiredMessage: '请输入姓名',
        schema: z.string().min(2, '至少两个字符'),
        span: 12,
      }),
      defineField<UserForm>({
        component: InputStub,
        disabled: values => values.status === 'locked',
        field: 'status',
        label: '状态',
      }),
    ]
    const wrapper = mount(AntdConfigForm, {
      props: { fields, modelValue: { name: '', status: 'locked' } },
    })

    expect(wrapper.find('form.mx-antd-config-form').exists()).toBe(true)
    expect(wrapper.get('.mx-antd-config-form__row').classes()).toContain('mx-antd-config-form__row--grid')
    expect(wrapper.get('.mx-antd-config-form__cell').attributes('style')).toEqual(expect.stringContaining('--mx-config-form-span-desktop: 12'))
    expect(wrapper.get('.mx-antd-config-form__cell').attributes('style')).toEqual(expect.stringContaining('grid-column: span var(--mx-config-form-active-span) / span var(--mx-config-form-active-span)'))
    expect(wrapper.findAll('[data-testid="antd-input-stub"]')[1].attributes('disabled')).toBeDefined()

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('.mx-antd-config-form__error').text()).toBe('请输入姓名')
    expect(wrapper.emitted('error')![0]).toEqual([{ name: ['请输入姓名'] }])

    await wrapper.get<HTMLInputElement>('[data-testid="antd-input-stub"]').setValue('Ada')
    expect(wrapper.emitted('fieldChange')![0][0]).toMatchObject({ field: 'name', value: 'Ada' })
    expect(wrapper.emitted('metaChange')!.at(-1)![0]).toMatchObject({ dirty: true, touched: true })
  })

  it('resolves semantic text aliases and lets consumers override adapter defaults', async () => {
    const wrapper = mount(AntdConfigForm, {
      props: {
        components: { text: InputStub },
        fields: [defineField<UserForm>({ component: 'text', field: 'name', label: '姓名' })],
        modelValue: { name: '', status: 'draft' },
      },
    })

    await wrapper.get<HTMLInputElement>('[data-testid="antd-input-stub"]').setValue('Ada')
    expect(wrapper.emitted('fieldChange')![0][0]).toMatchObject({ field: 'name', value: 'Ada' })
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([{ name: 'Ada', status: 'draft' }])
  })

  it('renders adapter defaults for every semantic alias and applies native bindings', async () => {
    expect(ANTD_CONFIG_FORM_COMPONENTS).toMatchObject({
      text: { component: Input, valueProp: 'value', trigger: 'update:value' },
      textarea: { component: Input.TextArea, valueProp: 'value', trigger: 'update:value' },
      number: { component: InputNumber, valueProp: 'value', trigger: 'change' },
      boolean: { component: Switch, valueProp: 'checked', trigger: 'change' },
      select: { component: Select, valueProp: 'value', trigger: 'change' },
      segmented: { component: Segmented, valueProp: 'value', trigger: 'change' },
    })

    const wrapper = mount(AntdConfigForm, {
      props: {
        fields: [
          defineField<SemanticForm>({ component: 'text', field: 'name' }),
          defineField<SemanticForm>({ component: 'boolean', field: 'enabled' }),
        ],
        modelValue: { enabled: false, name: '' },
      },
    })

    wrapper.getComponent(Input).vm.$emit('update:value', 'Ada')
    await wrapper.vm.$nextTick()
    wrapper.getComponent(Switch).vm.$emit('change', true)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('fieldChange')).toEqual([
      [expect.objectContaining({ field: 'name', value: 'Ada' })],
      [expect.objectContaining({ field: 'enabled', value: true })],
    ])
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([{ enabled: true, name: 'Ada' }])
  })

  it('applies reactions through real Ant Design Vue bindings', async () => {
    const fields = [
      defineField<SemanticForm>({
        component: 'boolean',
        field: 'enabled',
        reactions: [{
          id: 'enable-name',
          when: {
            kind: 'compare',
            operator: 'eq',
            left: { kind: 'field', field: 'enabled' },
            right: { kind: 'literal', value: true },
          },
          then: [
            { kind: 'setValue', target: 'name', value: { kind: 'literal', value: 'linked' } },
            { kind: 'setState', target: 'name', state: { disabled: true, required: true } },
            { kind: 'setProps', target: 'name', props: { placeholder: { kind: 'literal', value: 'Reaction placeholder' } } },
          ],
        }],
      }),
      defineField<SemanticForm>({ component: 'text', field: 'name', props: { placeholder: 'Static placeholder' } }),
    ]
    const wrapper = mount(AntdConfigForm, {
      props: { fields, modelValue: { enabled: false, name: 'initial' } },
    })

    wrapper.getComponent(Switch).vm.$emit('change', true)
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')![0]).toEqual([{ enabled: true, name: 'linked' }])
    expect(wrapper.getComponent(Input).props()).toMatchObject({
      disabled: true,
      placeholder: 'Reaction placeholder',
      value: 'linked',
    })
    expect(wrapper.get('[data-field="name"]').attributes('data-required')).toBe('true')
    expect(wrapper.find('[reactions]').exists()).toBe(false)
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
        h(AntdConfigForm, { fields, modelValue: { name: '', status: 'draft' } }),
        h(AntdConfigForm, { fields, modelValue: { name: '', status: 'draft' } }),
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
      const control = form.get('[data-testid="antd-input-stub"]')
      const error = form.get('.mx-antd-config-form__error')
      const label = form.get('.mx-antd-config-form__label')

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

  it('保留 Ant Design Vue checked 绑定并使用原生 Grid', async () => {
    const fields = [defineField<SwitchForm>({
      component: SwitchStub,
      field: 'enabled',
      label: '启用',
    })]
    const wrapper = mount(AntdConfigForm, {
      props: { fields, modelValue: { enabled: false } },
    })

    expect(wrapper.get('.mx-antd-config-form__row').classes()).toContain('mx-antd-config-form__row--grid')
    expect(wrapper.find('.mx-antd-config-form__cell').exists()).toBe(true)
    expect(wrapper.find('.ant-form').exists()).toBe(false)
    await wrapper.get('[data-testid="antd-switch-stub"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([{ enabled: true }])
    expect(wrapper.emitted('fieldChange')![0][0]).toMatchObject({ field: 'enabled', value: true })
    expect(wrapper.find('.ant-form').exists()).toBe(false)
  })

  it('uses registered boolean binding defaults for string aliases', async () => {
    const wrapper = mount(AntdConfigForm, {
      props: {
        components: {
          boolean: {
            component: SwitchStub,
            valueProp: 'checked',
            trigger: 'update:checked',
          },
        },
        fields: [defineField<SwitchForm>({ component: 'boolean', field: 'enabled' })],
        modelValue: { enabled: false },
      },
    })

    await wrapper.get('[data-testid="antd-switch-stub"]').trigger('click')
    expect(wrapper.emitted('fieldChange')![0][0]).toMatchObject({ field: 'enabled', value: true })
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([{ enabled: true }])
  })

  it('递归渲染 slot，并支持表单级 readonlyRender fallback', async () => {
    const { defineField: defineUserField } = defineFields<UserForm>()
    const fields = [
      defineUserField({
        component: ContainerStub,
        slots: {
          default: defineUserField({ component: OptionStub, props: { label: '说明' } }),
        },
      }),
      defineUserField({ component: InputStub, field: 'status', label: '状态' }),
    ]
    const wrapper = mount(AntdConfigForm, {
      props: {
        fields,
        modelValue: { name: 'Ada', status: 'enabled' },
        readonly: true,
        readonlyRender: ({ value }: { value: unknown }) => h('em', { 'data-testid': 'antd-readonly' }, `状态:${value}`),
      },
    })

    expect(wrapper.find('[data-testid="antd-container-stub"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="antd-readonly"]').text()).toBe('状态:enabled')
    expect(wrapper.find('[data-testid="antd-input-stub"]').exists()).toBe(false)

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submit')![0]).toEqual([{ status: 'enabled' }])
  })

  it('通过统一 expose 清理错误和重置', async () => {
    const initial: UserForm = { name: 'Ada', status: 'draft' }
    const fields = [defineField<UserForm>({
      component: InputStub,
      field: 'name',
      required: true,
      requiredMessage: '请输入姓名',
    })]
    const wrapper = mount(AntdConfigForm, {
      props: { fields, modelValue: initial },
    })
    const form = wrapper.vm as unknown as AntdConfigFormExpose<UserForm>

    form.setValue('name', '')
    expect(form.getValue('name')).toBe('')
    expect(await form.validate()).toBe(false)
    expect(form.getErrors()).toEqual({ name: ['请输入姓名'] })
    form.clearValidate('name')
    expect(form.getErrors()).toEqual({})
    form.resetFields()
    expect(form.getValues()).toEqual(initial)
  })
})
