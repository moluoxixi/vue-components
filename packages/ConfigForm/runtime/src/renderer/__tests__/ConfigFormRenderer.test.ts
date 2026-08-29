import type { ConfigFormComponentSlotContext } from '@moluoxixi/config-form-headless'
import type { Component } from 'vue'
import type {
  ConfigFormRendererExpose,
  ConfigFormRendererField,
  ConfigFormRuntimeEditorBridge,
} from '../types'
import { defineField, defineFields } from '@moluoxixi/config-form-headless'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  ConfigFormRenderer as ConfigFormRendererEntry,
  RuntimeSurface as RuntimeSurfaceEntry,
} from '../../renderer-entry'
import ConfigFormRendererSource from '../ConfigFormRenderer.vue'

const ConfigFormRenderer = ConfigFormRendererSource as Component
const RuntimeSurface = RuntimeSurfaceEntry as Component

interface TestValues {
  enabled: boolean
  name: string
  notes?: string
  status: string
  summary?: string
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
  it('exports RuntimeSurface as the stable ConfigFormRenderer component', () => {
    expect(RuntimeSurfaceEntry).toBe(ConfigFormRendererEntry)
  })

  it('synchronizes controlled model replacements without recursive update feedback', async () => {
    const model = ref<TestValues>({ enabled: false, name: 'Ada', status: 'draft' })
    const handleUpdate = vi.fn((values: TestValues) => {
      model.value = values
    })
    const Host = defineComponent({
      setup: () => () => h(ConfigFormRenderer, {
        'fields': [defineField<TestValues>({ component: InputStub, field: 'name' })],
        'modelValue': model.value,
        'onUpdate:modelValue': handleUpdate,
      }),
    })
    const wrapper = mount(Host)

    model.value = { ...model.value, name: 'Flow preview' }
    await flushPromises()

    expect((wrapper.get('[data-testid="renderer-input"]').element as HTMLInputElement).value).toBe('Flow preview')
    expect(handleUpdate).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="renderer-input"]').setValue('User edit')
    await flushPromises()

    expect(model.value.name).toBe('User edit')
    expect(handleUpdate).toHaveBeenCalledTimes(1)
  })

  it('runtimeSurface exposes stable node metadata and editor registration hooks', () => {
    const editor: ConfigFormRuntimeEditorBridge<TestValues> = {
      registerNode: vi.fn(),
    }
    const fields = [{
      id: 'section-node',
      component: SlotHost,
      slots: {
        default: {
          id: 'name-node',
          component: InputStub,
          field: 'name',
        },
      },
    }]
    const wrapper = mount(RuntimeSurface, {
      props: {
        editor,
        fields,
        mode: 'design',
        modelValue: { enabled: false, name: 'Ada', status: 'draft' },
        namespace: 'surface-form',
      },
    })

    const section = wrapper.get('[data-config-node-id="section-node"]')
    const field = wrapper.get('[data-config-node-id="name-node"]')
    expect(section.attributes()).toMatchObject({
      'data-config-node-kind': 'component',
      'data-config-path': 'fields.0',
      'data-node-id': 'section-node',
    })
    expect(field.attributes()).toMatchObject({
      'data-config-node-kind': 'field',
      'data-config-path': 'fields.0.slots.default',
      'data-config-slot': 'default',
      'data-node-id': 'name-node',
    })
    expect(editor.registerNode).toHaveBeenCalledTimes(2)
    expect(editor.registerNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'name-node', nodeId: 'name-node', path: 'fields.0.slots.default', slot: 'default' }),
      expect.any(HTMLElement),
    )
  })

  it('design mode blocks control events by default while the bridge may explicitly allow them', async () => {
    const editor: ConfigFormRuntimeEditorBridge<TestValues> = {
      interceptEvent: vi.fn(),
    }
    const wrapper = mount(RuntimeSurface, {
      props: {
        editor,
        fields: [defineField<TestValues>({ component: InputStub, field: 'name' })],
        mode: 'design',
        modelValue: { enabled: false, name: 'Ada', status: 'draft' },
      },
    })

    await wrapper.get('[data-testid="renderer-input"]').setValue('Grace')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(editor.interceptEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'update:modelValue' }))

    vi.mocked(editor.interceptEvent!).mockReturnValue(false)
    await wrapper.get('[data-testid="renderer-input"]').setValue('Lin')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ enabled: false, name: 'Lin', status: 'draft' }])
  })

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
    expect(wrapper.get('.test-form__row').attributes('style')).toContain('--mx-config-form-columns-desktop: 12')
    expect(wrapper.get('.test-form__row').attributes('style')).toContain('grid-template-columns: repeat(var(--mx-config-form-active-columns), minmax(0, 1fr))')
    expect(wrapper.get('.test-form__row').attributes('style')).toContain('gap: 8px')
    expect(wrapper.get('.test-form__cell').attributes()).toMatchObject({
      'data-cell': 'default',
      'data-node-cell': 'name',
    })
    expect(wrapper.get('.test-form__cell').attributes('style')).toContain('--mx-config-form-span-desktop: 6')
    expect(wrapper.get('.test-form__cell').attributes('style')).toContain('grid-column: span var(--mx-config-form-active-span) / span var(--mx-config-form-active-span)')
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

  it('emits matching desktop, tablet, and mobile grid variables', () => {
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        columns: 24,
        fieldSpan: 24,
        fields: [defineField<TestValues>({
          component: InputStub,
          field: 'name',
          span: 20,
        })],
        modelValue: { enabled: false, name: 'Ada', status: 'draft' },
        namespace: 'responsive-form',
        responsive: {
          tablet: { columns: 12, fieldSpan: 6 },
          mobile: { columns: 4, fieldSpan: 4 },
        },
      },
    })

    const rowStyle = wrapper.get('.responsive-form__row').attributes('style')
    expect(rowStyle).toContain('--mx-config-form-columns-desktop: 24')
    expect(rowStyle).toContain('--mx-config-form-columns-tablet: 12')
    expect(rowStyle).toContain('--mx-config-form-columns-mobile: 4')

    const cellStyle = wrapper.get('.responsive-form__cell').attributes('style')
    expect(cellStyle).toContain('--mx-config-form-span-desktop: 20')
    expect(cellStyle).toContain('--mx-config-form-span-tablet: 12')
    expect(cellStyle).toContain('--mx-config-form-span-mobile: 4')
  })

  it('lays out a full-width root field before three 8-column fields', () => {
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        columns: 24,
        fieldSpan: 8,
        fields: [
          defineField<TestValues>({ component: InputStub, field: 'name', span: 24 }),
          defineField<TestValues>({ component: InputStub, field: 'status', span: 8 }),
          defineField<TestValues>({ component: InputStub, field: 'summary', span: 8 }),
          defineField<TestValues>({ component: InputStub, field: 'notes', span: 8 }),
        ],
        modelValue: { enabled: false, name: 'Ada', status: 'draft' },
        namespace: 'root-span-form',
      },
    })

    expect(wrapper.findAll('.root-span-form__cell').map(cell => cell.attributes('style'))).toEqual([
      expect.stringContaining('--mx-config-form-span-desktop: 24'),
      expect.stringContaining('--mx-config-form-span-desktop: 8'),
      expect.stringContaining('--mx-config-form-span-desktop: 8'),
      expect.stringContaining('--mx-config-form-span-desktop: 8'),
    ])
  })

  it('clamps external layout values to the 24-column contract', () => {
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        columns: 30,
        fieldSpan: 28,
        fields: [defineField<TestValues>({ component: InputStub, field: 'name' })],
        modelValue: { enabled: false, name: 'Ada', status: 'draft' },
        namespace: 'bounded-form',
      },
    })

    expect(wrapper.get('.bounded-form__row').attributes('style')).toContain('--mx-config-form-columns-desktop: 24')
    expect(wrapper.get('.bounded-form__cell').attributes('style')).toContain('--mx-config-form-span-desktop: 24')
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
        component: 'RegistryInput',
        extensions: { 'test.source': 'readonly' },
        field: 'status',
        label: 'Status',
        readonly: true,
        readonlyRender: ({ componentProps, field, model, value }) => h('strong', {
          'data-extension': field.extensions?.['test.source'],
          'data-model-name': model.name,
          'data-placeholder': componentProps.placeholder,
          'data-testid': 'readonly-value',
        }, `Status: ${value}`),
        props: { placeholder: 'Status placeholder' },
      }),
    ]
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        components: {
          RegistryInput: {
            component: InputStub,
            props: { placeholder: 'Registry placeholder' },
          },
        },
        fields,
        modelValue: { enabled: false, name: 'Ada', status: 'active' },
        reactionProjection: {
          props: { status: { placeholder: 'Reaction placeholder' } },
          states: {},
          validate: [],
          values: { enabled: false, name: 'Ada', status: 'active' },
        },
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
      'data-extension': 'readonly',
      'data-model-name': 'Ada',
      'data-placeholder': 'Reaction placeholder',
    })
    expect(wrapper.get('[data-testid="readonly-value"]').text()).toBe('Status: active')
  })

  it('resolves registered field and container aliases with binding defaults and direct registrations', async () => {
    const registeredChange = vi.fn()
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        components: {
          RegistryChecked: {
            component: CheckedStub,
            props: { onChange: [registeredChange] },
            trigger: 'change',
            valueProp: 'checked',
          },
          RegistryLeaf: {
            component: SlotLeaf,
            props: { text: 'Registry default' },
          },
          DirectLeaf: SlotLeaf,
        },
        fields: [
          defineField<TestValues>({
            component: 'RegistryChecked',
            extensions: { designer: { locked: true } },
            field: 'enabled',
          }),
          { component: 'RegistryLeaf', extensions: { designer: { source: 'palette' } }, props: { text: 'Field override' } },
          { component: 'DirectLeaf', props: { text: 'Direct component' } },
        ],
        modelValue: { enabled: false, name: 'Ada', status: 'draft' },
      },
    })

    expect(wrapper.get('[data-testid="renderer-checked"]').text()).toBe('false')
    expect(wrapper.findAll('[data-testid="slot-leaf"]').map(node => node.text())).toEqual([
      'Field override',
      'Direct component',
    ])
    expect(wrapper.find('[extensions]').exists()).toBe(false)

    await wrapper.get('[data-testid="renderer-checked"]').trigger('click')
    expect(registeredChange).toHaveBeenCalledWith(true)
    expect(wrapper.emitted('fieldChange')![0][0]).toMatchObject({ field: 'enabled', value: true })
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([{ enabled: true, name: 'Ada', status: 'draft' }])
  })

  it('exposes extensions to configured field and container slot contexts without forwarding them', () => {
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        components: { RegistryHost: SlotHost },
        fields: [
          defineField<TestValues>({
            component: 'RegistryHost',
            extensions: { source: 'field' },
            field: 'status',
            slots: {
              default: ({ field }) => h('span', { 'data-testid': 'field-extension' }, String(field.extensions?.source)),
            },
          }),
          {
            component: 'RegistryHost',
            extensions: { source: 'container' },
            slots: {
              default: ({ node }: ConfigFormComponentSlotContext<TestValues>) => h('span', { 'data-testid': 'container-extension' }, String(node.extensions?.source)),
            },
          },
        ],
        modelValue: { enabled: false, name: 'Ada', status: 'draft' },
      },
    })

    expect(wrapper.get('[data-testid="field-extension"]').text()).toBe('field')
    expect(wrapper.get('[data-testid="container-extension"]').text()).toBe('container')
    expect(wrapper.find('[extensions]').exists()).toBe(false)
  })

  it('applies chained reaction values, states and props without leaking declarations', async () => {
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        fields: [
          defineField<TestValues>({
            component: CheckedStub,
            field: 'enabled',
            reactions: [{
              id: 'enable-details',
              when: {
                kind: 'compare',
                operator: 'eq',
                left: { kind: 'field', field: 'enabled' },
                right: { kind: 'literal', value: true },
              },
              then: [
                { kind: 'setValue', target: 'summary', value: { kind: 'literal', value: 'derived' } },
                { kind: 'setState', target: 'name', state: { disabled: true, required: true } },
                { kind: 'setProps', target: 'name', props: { placeholder: { kind: 'literal', value: 'Reaction placeholder' } } },
                { kind: 'setState', target: 'notes', state: { visible: false } },
                { kind: 'setState', target: 'status', state: { readonly: true } },
              ],
              else: [
                { kind: 'clearValue', target: 'summary' },
                { kind: 'setState', target: 'name', state: { disabled: false, required: false } },
                { kind: 'setState', target: 'notes', state: { visible: true } },
                { kind: 'setState', target: 'status', state: { readonly: false } },
              ],
            }],
          }),
          defineField<TestValues>({ component: InputStub, field: 'name', props: { placeholder: 'Static placeholder' } }),
          defineField<TestValues>({ component: InputStub, field: 'notes' }),
          defineField<TestValues>({ component: InputStub, field: 'status' }),
        ],
        modelValue: { enabled: false, name: 'Ada', notes: 'Visible', status: 'draft' },
        resolveBinding: (field: ConfigFormRendererField<TestValues>) => field.field === 'enabled'
          ? { trigger: 'change', valueProp: 'checked' }
          : undefined,
      },
    })

    expect(wrapper.find('[reactions]').exists()).toBe(false)
    expect(wrapper.get('[data-field="name"] input').attributes('placeholder')).toBe('Static placeholder')
    expect(wrapper.get('[data-field="notes"]').isVisible()).toBe(true)

    await wrapper.get('[data-testid="renderer-checked"]').trigger('click')
    await nextTick()

    expect(wrapper.emitted('update:modelValue')![0]).toEqual([{
      enabled: true,
      name: 'Ada',
      notes: 'Visible',
      status: 'draft',
      summary: 'derived',
    }])
    const name = wrapper.get('[data-field="name"]')
    expect(name.attributes('data-required')).toBe('true')
    expect(name.get('input').attributes()).toMatchObject({
      'aria-required': 'true',
      'disabled': '',
      'placeholder': 'Reaction placeholder',
    })
    expect(wrapper.find('[data-field="notes"]').exists()).toBe(false)
    expect(wrapper.find('[data-field="status"] input').exists()).toBe(false)
    expect(wrapper.get('[data-field="status"] .mx-config-form__readonly').text()).toBe('draft')
    expect(wrapper.find('[reactions]').exists()).toBe(false)
  })

  it('refreshes reactions when the configured field tree changes', async () => {
    const source = defineField<TestValues>({ component: CheckedStub, field: 'enabled' })
    const name = defineField<TestValues>({ component: InputStub, field: 'name' })
    const wrapper = mount(ConfigFormRenderer, {
      props: {
        fields: [source, name],
        modelValue: { enabled: true, name: 'Ada', status: 'draft' },
        resolveBinding: (field: ConfigFormRendererField<TestValues>) => field.field === 'enabled'
          ? { trigger: 'change', valueProp: 'checked' }
          : undefined,
      },
    })

    await wrapper.setProps({
      fields: [{
        ...source,
        reactions: [{
          id: 'dynamic-fields',
          when: { kind: 'literal', value: true },
          then: [
            { kind: 'setValue', target: 'summary', value: { kind: 'literal', value: 'dynamic' } },
            { kind: 'setProps', target: 'name', props: { placeholder: { kind: 'literal', value: 'Dynamic placeholder' } } },
          ],
        }],
      }, name],
    })
    await nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{
      enabled: true,
      name: 'Ada',
      status: 'draft',
      summary: 'dynamic',
    }])
    expect(wrapper.get('[data-field="name"] input').attributes('placeholder')).toBe('Dynamic placeholder')
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
