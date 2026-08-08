import type { Component } from 'vue'
import type { ConfigFormRendererExpose, ConfigFormRendererField } from '../types'
import { defineField, defineFields } from '@moluoxixi/config-form-headless'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import ConfigFormRendererSource from '../ConfigFormRenderer.vue'

const ConfigFormRenderer = ConfigFormRendererSource as Component

interface TestValues {
  enabled: boolean
  name: string
  status: string
}

const InputStub = defineComponent({
  name: 'RendererInputStub',
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
  },
  emits: ['blur', 'update:modelValue'],
  setup(props, { attrs, emit }) {
    return () => h('input', {
      ...attrs,
      'data-testid': 'renderer-input',
      'onBlur': () => emit('blur'),
      'onInput': (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      'value': props.modelValue,
    })
  },
})

const CheckedStub = defineComponent({
  name: 'RendererCheckedStub',
  props: {
    checked: Boolean,
  },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('button', {
      'data-testid': 'renderer-checked',
      'onClick': () => emit('change', !props.checked),
      'type': 'button',
    }, String(props.checked))
  },
})

const IdentityStub = defineComponent({
  name: 'RendererIdentityStub',
  props: {
    modelValue: { type: String, default: '' },
  },
  setup(props) {
    const createdFor = props.modelValue
    return () => h('span', {
      'data-created-for': createdFor,
      'data-current-value': props.modelValue,
      'data-testid': 'identity-control',
    })
  },
})

const SlotHost = defineComponent({
  name: 'RendererSlotHost',
  setup: (_props, { slots }) => () => h('section', { 'data-testid': 'slot-host' }, slots.default?.({ source: 'host' })),
})

const SlotLeaf = defineComponent({
  name: 'RendererSlotLeaf',
  props: { text: { type: String, default: '' } },
  setup: props => () => h('span', { 'data-testid': 'slot-leaf' }, props.text),
})

describe('config form renderer', () => {
  it('同步写回受控模型，并统一处理 Grid、attrs、校验和 expose', async () => {
    const initial: TestValues = { enabled: false, name: 'Ada', status: 'draft' }
    const fields = [defineField<TestValues>({
      cellAttrs: { 'data-node-cell': 'name' },
      component: InputStub,
      field: 'name',
      fieldAttrs: { 'data-field-shell': 'name' },
      label: 'Name',
      required: true,
      requiredMessage: 'Name is required',
      span: 6,
    })]
    const wrapper = mount(ConfigFormRenderer, {
      attrs: {
        'class': 'consumer-form',
        'data-consumer': 'true',
        'id': 'profile-form',
      },
      props: {
        cellAttrs: { 'data-cell': 'default' },
        columns: 12,
        fields,
        formAttrs: { autocomplete: 'off', id: 'form-attrs-id' },
        gap: '8px',
        modelValue: initial,
        namespace: 'test-form',
        layoutAttrs: { 'data-layout': 'root' },
      },
    })
    const form = wrapper.vm as unknown as ConfigFormRendererExpose<TestValues>

    expect(wrapper.get('form').attributes()).toMatchObject({
      'autocomplete': 'off',
      'data-consumer': 'true',
      'id': 'form-attrs-id',
    })
    expect(wrapper.get('form').classes()).toEqual(expect.arrayContaining(['test-form', 'consumer-form']))
    expect(wrapper.get('.test-form__row').attributes('data-layout')).toBe('root')
    expect(wrapper.get('.test-form__row').attributes('style')).toContain('grid-template-columns: repeat(12, minmax(0, 1fr))')
    expect(wrapper.get('.test-form__row').attributes('style')).toContain('gap: 8px')
    expect(wrapper.get('.test-form__cell').attributes()).toMatchObject({
      'data-cell': 'default',
      'data-node-cell': 'name',
    })
    expect(wrapper.get('.test-form__cell').attributes('style')).toContain('grid-column: span 6 / span 6')
    expect(wrapper.get('[data-field="name"]').attributes('data-field-shell')).toBe('name')

    form.setValue('name', '')
    expect(form.getValue('name')).toBe('')
    expect(form.getValues()).toEqual({ ...initial, name: '' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([{ ...initial, name: '' }])
    expect(await form.validate()).toBe(false)
    expect(form.getErrors()).toEqual({ name: ['Name is required'] })

    form.setValue('name', 'Grace')
    form.setValue('status', 'published')
    expect(form.getValues()).toEqual({ enabled: false, name: 'Grace', status: 'published' })
    form.resetFields()
    expect(form.getValues()).toEqual(initial)
  })

  it('支持 label 左右和上下布局，并保持真实 label/control 结构', async () => {
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        fields: [defineField<TestValues>({
          component: InputStub,
          field: 'name',
          label: 'Name',
        })],
        labelPosition: 'left',
        modelValue: { enabled: false, name: 'Ada', status: 'draft' },
        namespace: 'layout-form',
      },
    })

    const field = wrapper.get('[data-field="name"]')
    expect(field.classes()).toContain('layout-form__field--label-left')
    expect(field.attributes('data-label-position')).toBe('left')
    expect(field.attributes('style')).toContain('grid-template-columns: max-content minmax(0, 1fr)')
    expect(field.get('.layout-form__label').text()).toBe('Name')
    expect(field.get('.layout-form__control').attributes('style')).toContain('grid-column: 2')

    await wrapper.setProps({ labelPosition: 'top' })
    expect(field.classes()).toContain('layout-form__field--label-top')
    expect(field.attributes('data-label-position')).toBe('top')
    expect(field.attributes('style')).not.toContain('grid-template-columns')
    expect(field.get('.layout-form__control').attributes('style')).not.toContain('grid-column')
  })

  it('同时提供 change/blur 校验触发与 dirty/touched 状态', async () => {
    const initial: TestValues = { enabled: false, name: 'Ada', status: 'draft' }
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        fields: [defineField<TestValues>({
          component: InputStub,
          field: 'name',
          validateOn: ['change', 'blur'],
        })],
        modelValue: initial,
      },
      slots: {
        default: ({ meta }: { meta: { dirty: boolean, touched: boolean } }) => h('output', {
          'data-dirty': String(meta.dirty),
          'data-testid': 'form-meta',
          'data-touched': String(meta.touched),
        }),
      },
    })
    const form = wrapper.vm as unknown as ConfigFormRendererExpose<TestValues>
    const input = wrapper.get('[data-testid="renderer-input"]')

    expect(form.getMeta()).toMatchObject({ dirty: false, touched: false })
    expect(wrapper.get('form').attributes()).toMatchObject({
      'data-dirty': 'false',
      'data-touched': 'false',
    })

    await input.setValue('Grace')
    expect(form.getFieldMeta('name')).toEqual({ dirty: true, touched: false })
    expect(wrapper.emitted('metaChange')!.at(-1)![0]).toMatchObject({ dirty: true, touched: false })
    expect(wrapper.get('[data-field="name"]').attributes()).toMatchObject({
      'data-dirty': 'true',
      'data-touched': 'false',
    })

    await input.trigger('blur')
    expect(form.getFieldMeta('name')).toEqual({ dirty: true, touched: true })
    expect(wrapper.get('[data-testid="form-meta"]').attributes()).toMatchObject({
      'data-dirty': 'true',
      'data-touched': 'true',
    })

    form.setValue('name', 'Ada')
    form.setTouched(false)
    await nextTick()
    expect(form.getMeta()).toMatchObject({ dirty: false, touched: false })

    await wrapper.setProps({ modelValue: { ...initial, name: 'External' } })
    expect(form.getMeta()).toMatchObject({ dirty: true, touched: false })
    expect(wrapper.emitted('metaChange')!.at(-1)![0]).toMatchObject({ dirty: true, touched: false })

    form.setValue('name', 'Ada')
    await nextTick()
    expect(form.getMeta()).toMatchObject({ dirty: false, touched: false })
    expect(wrapper.get('[data-testid="form-meta"]').attributes('data-dirty')).toBe('false')
    expect(wrapper.emitted('metaChange')!.at(-1)![0]).toMatchObject({ dirty: false, touched: false })
  })

  it('同页实例生成唯一 control/error id，并建立完整 ARIA 关联', async () => {
    const fields = [defineField<TestValues>({
      component: InputStub,
      field: 'name',
      label: 'Name',
      props: { 'aria-describedby': 'name-hint' },
      required: true,
      requiredMessage: 'Required',
    })]
    const Host = defineComponent({
      setup: () => () => h('div', [
        h(ConfigFormRenderer, { fields, modelValue: { enabled: false, name: '', status: '' } }),
        h(ConfigFormRenderer, { fields, modelValue: { enabled: false, name: '', status: '' } }),
      ]),
    })
    const wrapper = mount(Host)

    for (const form of wrapper.findAll('form'))
      await form.trigger('submit')
    await flushPromises()

    const controls = wrapper.findAll('[data-testid="renderer-input"]')
    const errors = wrapper.findAll('.mx-config-form__error')
    expect(controls).toHaveLength(2)
    expect(errors).toHaveLength(2)
    expect(new Set(controls.map(control => control.attributes('id'))).size).toBe(2)
    expect(new Set(errors.map(error => error.attributes('id'))).size).toBe(2)
    controls.forEach((control, index) => {
      expect(control.attributes('aria-required')).toBe('true')
      expect(control.attributes('aria-invalid')).toBe('true')
      expect(control.attributes('aria-describedby')?.split(' ')).toEqual(['name-hint', errors[index].attributes('id')])
    })
  })

  it('无 label 字段仍生成字段壳、错误 DOM 和 ARIA 关联', async () => {
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        fields: [defineField<TestValues>({
          component: InputStub,
          field: 'name',
          required: true,
          requiredMessage: 'Required without label',
        })],
        modelValue: { enabled: false, name: '', status: '' },
      },
    })
    const form = wrapper.vm as unknown as ConfigFormRendererExpose<TestValues>

    expect(await form.validate()).toBe(false)
    await nextTick()
    const field = wrapper.get('[data-field="name"]')
    const control = field.get('[data-testid="renderer-input"]')
    const error = field.get('.mx-config-form__error')
    expect(error.text()).toBe('Required without label')
    expect(control.attributes('aria-describedby')).toBe(error.attributes('id'))
  })

  it('外部替换 v-model 时清理旧错误并拒绝提交旧校验对应的新模型', async () => {
    let releaseValidation!: () => void
    const fields = [defineField<TestValues>({
      component: InputStub,
      field: 'name',
      label: 'Name',
      required: true,
      requiredMessage: 'Required',
      validator: async () => {
        await new Promise<void>((resolve) => {
          releaseValidation = resolve
        })
      },
    })]
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        fields,
        modelValue: { enabled: false, name: '', status: 'draft' },
      },
    })
    const form = wrapper.vm as unknown as ConfigFormRendererExpose<TestValues>

    expect(await form.validate()).toBe(false)
    await nextTick()
    expect(form.getErrors()).toEqual({ name: ['Required'] })

    await wrapper.setProps({ modelValue: { enabled: false, name: 'Grace', status: 'published' } })
    expect(form.getErrors()).toEqual({})

    const pending = form.submit()
    await wrapper.setProps({ modelValue: { enabled: false, name: 'Lin', status: 'archived' } })
    releaseValidation()

    await expect(pending).resolves.toBe(false)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('inline 使用原生 Flex 且不消费 span/cellAttrs，并递归渲染配置化 slot', () => {
    const { defineField: field } = defineFields<TestValues>()
    const fields = [
      field({
        cellAttrs: { 'data-ignored-cell': 'true' },
        component: InputStub,
        field: 'name',
        label: 'Name',
        span: 3,
      }),
      field({
        component: SlotHost,
        slots: {
          default: field({ component: SlotLeaf, props: { text: 'Nested content' } }),
        },
      }),
    ]
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        fields,
        inline: true,
        modelValue: { enabled: false, name: 'Ada', status: 'draft' },
        namespace: 'inline-form',
        layoutAttrs: { 'data-layout': 'inline' },
      },
    })

    expect(wrapper.get('.inline-form__row').classes()).toContain('inline-form__row--inline')
    expect(wrapper.get('.inline-form__row').attributes('style')).toContain('display: flex')
    expect(wrapper.find('.inline-form__cell').exists()).toBe(false)
    expect(wrapper.find('[data-ignored-cell]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="slot-host"]').text()).toBe('Nested content')
  })

  it('字段重排时按字段 key 保留组件实例，不按数组位置串状态', async () => {
    const nameField = defineField<TestValues>({ component: IdentityStub, field: 'name' })
    const statusField = defineField<TestValues>({ component: IdentityStub, field: 'status' })
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        fields: [nameField, statusField],
        modelValue: { enabled: false, name: 'Ada', status: 'draft' },
      },
    })

    await wrapper.setProps({ fields: [statusField, nameField] })
    const controls = wrapper.findAll('[data-testid="identity-control"]')
    expect(controls.map(control => control.attributes('data-created-for'))).toEqual(['draft', 'Ada'])
    expect(controls.map(control => control.attributes('data-current-value'))).toEqual(['draft', 'Ada'])
  })

  it('通过 binding resolver 适配组件事件，并优先使用字段 readonlyRender', async () => {
    const fields = [
      defineField<TestValues>({ component: CheckedStub, field: 'enabled', label: 'Enabled' }),
      defineField<TestValues>({
        component: InputStub,
        field: 'status',
        label: 'Status',
        readonly: true,
        readonlyRender: ({ componentProps, model, value }) => h('strong', {
          'data-model-name': model.name,
          'data-placeholder': componentProps.placeholder,
          'data-testid': 'readonly-value',
        }, `Status: ${value}`),
        props: { placeholder: 'Status placeholder' },
      }),
    ]
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        fields,
        modelValue: { enabled: false, name: 'Ada', status: 'active' },
        resolveBinding: (field: ConfigFormRendererField<TestValues>) => field.field === 'enabled'
          ? { trigger: 'change', valueProp: 'checked' }
          : undefined,
      },
    })

    expect(wrapper.get('[data-testid="renderer-checked"]').text()).toBe('false')
    await wrapper.get('[data-testid="renderer-checked"]').trigger('click')
    expect(wrapper.emitted('fieldChange')![0][0]).toMatchObject({ field: 'enabled', value: true })
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([{ enabled: true, name: 'Ada', status: 'active' }])
    expect(wrapper.findAll('[data-testid="renderer-input"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="readonly-value"]').attributes()).toMatchObject({
      'data-model-name': 'Ada',
      'data-placeholder': 'Status placeholder',
    })
    expect(wrapper.get('[data-testid="readonly-value"]').text()).toBe('Status: active')
  })

  it('动态进入 readonly 后不再展示编辑态旧错误', async () => {
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        fields: [
          defineField<TestValues>({ component: CheckedStub, field: 'enabled' }),
          defineField<TestValues>({
            component: InputStub,
            field: 'name',
            label: 'Name',
            readonly: values => values.enabled,
            required: true,
            requiredMessage: 'Required',
          }),
        ],
        modelValue: { enabled: false, name: '', status: '' },
        resolveBinding: (field: ConfigFormRendererField<TestValues>) => field.field === 'enabled'
          ? { trigger: 'change', valueProp: 'checked' }
          : undefined,
      },
    })
    const form = wrapper.vm as unknown as ConfigFormRendererExpose<TestValues>

    expect(await form.validate()).toBe(false)
    await nextTick()
    expect(wrapper.text()).toContain('Required')

    await wrapper.get('[data-testid="renderer-checked"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).not.toContain('Required')
    expect(wrapper.get('.mx-config-form__readonly').text()).toBe('')
  })
})
