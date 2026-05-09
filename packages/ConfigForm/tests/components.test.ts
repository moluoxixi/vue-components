import type { FormContext } from '../src/composables/useFormContext'
import type { FormRuntimeOptions } from '../src/runtime'
import type { ConfigFormExpose, DefinedFormNodeConfig, FormNodeConfig, ResolvedField } from '../src/types'
import { readFileSync } from 'node:fs'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, inject, markRaw, nextTick } from 'vue'
import { z } from 'zod'
import FormComponent from '../src/components/FormComponent/src/index.vue'
import FormField from '../src/components/FormField/src/index.vue'
import FormLayout from '../src/components/FormLayout/src/index.vue'
import { VALIDATION_THROTTLE_MS } from '../src/composables/useForm'
import { FORM_CONTEXT_KEY } from '../src/composables/useFormContext'
import ConfigForm from '../src/index.vue'
import { createFormRuntime } from '../src/runtime'
import { defineField } from '../src/utils/field'

const TextInput = markRaw(defineComponent({
  name: 'TextInput',
  props: {
    disabled: Boolean,
    modelValue: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'blur'],
  setup(props, { attrs, emit, slots }) {
    return () => h('div', [
      slots.prefix?.(),
      h('input', {
        ...attrs,
        disabled: props.disabled,
        value: props.modelValue,
        onBlur: () => emit('blur'),
        onInput: (event: Event) => {
          emit('update:modelValue', (event.target as HTMLInputElement).value)
        },
      }),
      slots.default?.(),
      slots.suffix?.(),
    ])
  },
}))

const CustomControl = markRaw(defineComponent({
  name: 'CustomControl',
  props: {
    current: { type: String, default: '' },
    disabled: Boolean,
  },
  emits: ['commit', 'focusout'],
  setup(props, { attrs, emit }) {
    return () => h('button', {
      ...attrs,
      disabled: props.disabled,
      type: 'button',
      onClick: () => emit('commit', 'next'),
      onFocusout: () => emit('focusout'),
    }, props.current)
  },
}))

const IdPropControl = markRaw(defineComponent({
  name: 'IdPropControl',
  props: {
    id: Array,
    modelValue: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'blur'],
  setup(props, { attrs, emit }) {
    return () => h('input', {
      ...attrs,
      'data-prop-id': Array.isArray(props.id) ? props.id.join(',') : '',
      'value': props.modelValue,
      'onBlur': () => emit('blur'),
      'onInput': (event: Event) => {
        emit('update:modelValue', (event.target as HTMLInputElement).value)
      },
    })
  },
}))

const SlotHost = markRaw(defineComponent({
  name: 'SlotHost',
  setup(_props, { slots }) {
    return () => h('div', { 'data-testid': 'slot-host' }, [
      slots.default?.({ label: '默认作用域' }),
      slots.suffix?.({ label: '后缀作用域' }),
      slots.footer?.({ label: '底部作用域' }),
    ])
  },
}))

const SlotLeaf = markRaw(defineComponent({
  name: 'SlotLeaf',
  props: {
    role: String,
    text: String,
  },
  setup(props, { slots }) {
    return () => h('span', { 'data-role': props.role }, slots.default?.() ?? props.text)
  },
}))

const CardContainer = markRaw(defineComponent({
  name: 'CardContainer',
  props: {
    title: String,
  },
  setup(props, { slots }) {
    return () => h('section', { 'data-card': props.title }, [
      h('h2', props.title),
      slots.default?.(),
    ])
  },
}))

const LayoutProbe = markRaw(defineComponent({
  name: 'LayoutProbe',
  setup(_props, { attrs, slots }) {
    return () => h('section', { ...attrs, 'data-testid': 'layout-probe' }, slots.default?.())
  },
}))

const ContextProbe = markRaw(defineComponent({
  name: 'ContextProbe',
  setup() {
    const ctx = inject<FormContext>(FORM_CONTEXT_KEY)
    if (!ctx)
      throw new Error('FormContext not provided')

    return () => h('span', { 'data-testid': 'context-probe' }, [
      String(ctx.inline),
      String(ctx.labelWidth),
      String(ctx.values.name),
      ctx.errors.name?.[0],
    ].join('|'))
  },
}))

/**
 * 使用默认 runtime 解析测试字段。
 *
 * 只为 FormField 单测提供最小 ResolvedField，不包含外部插件和动态表单值。
 */
function resolveTestField(field: DefinedFormNodeConfig): ResolvedField {
  const runtime = createFormRuntime()
  return runtime.transformField(field) as ResolvedField
}

/** 等待字段交互校验的节流窗口和后续异步校验 Promise 完成。 */
async function flushValidation() {
  await new Promise(resolve => setTimeout(resolve, VALIDATION_THROTTLE_MS))
  await flushPromises()
}

describe('config form component', () => {
  it('keeps devtools source ids out of core component container rendering', () => {
    const source = {
      column: 9,
      file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
      id: 'source-card',
      line: 20,
    }
    const fields: FormNodeConfig[] = [
      {
        ...defineField({
          component: CardContainer,
          props: { title: '基础信息' },
          slots: {
            default: [
              defineField({
                component: TextInput,
                field: 'username',
                label: '用户名',
              }),
            ],
          },
        }),
        __source: source,
      } as FormNodeConfig,
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })

    const card = wrapper.get('[data-card="基础信息"]')
    expect(card.attributes('data-card')).toBe('基础信息')
    expect(card.attributes('data-cf-devtools-source-id')).toBeUndefined()
  })

  it('binds devtools source ids on the field root element', () => {
    const fields: FormNodeConfig[] = [
      {
        component: TextInput,
        field: 'username',
        label: '用户名',
        rootProps: {
          'data-cf-devtools-source-id': 'source-username',
        },
      },
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
        namespace: 'moluoxixi',
      },
    })

    const field = wrapper.get('.moluoxixi-field')
    expect(field.attributes('data-cf-devtools-source-id')).toBe('source-username')
    expect(wrapper.get('#moluoxixi-username-field').attributes('data-cf-devtools-source-id')).toBeUndefined()
  })

  it('merges field root props style with the grid span style', () => {
    const fields: FormNodeConfig[] = [
      {
        component: TextInput,
        field: 'username',
        label: '用户名',
        props: {
          'data-control': 'username-input',
        },
        rootProps: {
          'class': 'custom-field-root',
          'data-root': 'username-root',
          'style': 'color: red;',
        },
        span: 8,
      },
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })

    const field = wrapper.get('.cf-field')
    const input = wrapper.get('input')

    expect(field.classes()).toContain('custom-field-root')
    expect(field.attributes('data-root')).toBe('username-root')
    expect(field.attributes('style')).toContain('grid-column: span 8')
    expect(field.attributes('style')).toContain('color: red')
    expect(input.attributes('data-control')).toBe('username-input')
    expect(input.attributes('data-root')).toBeUndefined()
  })

  it('renders component containers around real fields without binding container values', async () => {
    const fields = [
      {
        component: CardContainer,
        props: { title: '基础信息' },
        slots: {
          default: [
            defineField({
              component: CardContainer,
              props: { title: '账号信息' },
              slots: {
                default: [
                  defineField({
                    component: TextInput,
                    field: 'username',
                    label: '用户名',
                    schema: z.string().min(4, '用户名至少 4 个字符'),
                    validateOn: 'blur',
                  }),
                ],
              },
            }),
          ],
        },
      },
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })
    const api = wrapper.vm as unknown as ConfigFormExpose<Record<string, unknown>>

    expect(wrapper.find('[data-card="基础信息"]').exists()).toBe(true)
    expect(wrapper.find('[data-card="账号信息"]').exists()).toBe(true)
    expect(wrapper.findAll('label')).toHaveLength(1)
    expect(wrapper.get('label').text()).toBe('用户名')
    expect(wrapper.find('[data-card="基础信息"]').attributes('modelvalue')).toBeUndefined()

    await wrapper.get('input').setValue('Ada')
    await wrapper.get('input').trigger('blur')
    await flushValidation()

    expect(api.getValues()).toEqual({ username: 'Ada' })
    expect(wrapper.text()).toContain('用户名至少 4 个字符')
  })

  it('applies container visibility to rendered subtrees and submit behavior', async () => {
    const fields = [
      defineField({
        component: TextInput,
        defaultValue: 'guest',
        field: 'role',
      }),
      defineField({
        component: CardContainer,
        props: { title: '管理员区域' },
        visible: values => values.role === 'admin',
        slots: {
          default: [
            defineField({
              component: TextInput,
              defaultValue: 'token',
              field: 'secret',
              label: '密钥',
              validator: () => '可见后需要校验',
            }),
          ],
        },
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })
    const api = wrapper.vm as unknown as ConfigFormExpose<Record<string, unknown>>

    expect(wrapper.find('[data-card="管理员区域"]').exists()).toBe(false)

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('submit')?.at(-1)).toEqual([{ role: 'guest' }])
    expect(wrapper.emitted('error')).toBeUndefined()

    api.setValue('role', 'admin')
    await nextTick()

    expect(wrapper.find('[data-card="管理员区域"]').exists()).toBe(true)

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('error')?.at(-1)).toEqual([{ secret: ['可见后需要校验'] }])
  })

  it('applies explicit container span in grid layouts', () => {
    const fields = [
      defineField({
        component: LayoutProbe,
        span: 12,
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })

    expect(wrapper.get('[data-testid="layout-probe"]').attributes('style')).toContain('grid-column: span 12')
  })

  it('preserves Vue string and array styles when adding container grid span', () => {
    const fields = [
      defineField({
        component: LayoutProbe,
        props: { style: 'color: red;' },
        span: 12,
      }),
      defineField({
        component: LayoutProbe,
        props: { style: [{ color: 'blue' }, { backgroundColor: 'white' }] },
        span: 6,
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })

    const probes = wrapper.findAll('[data-testid="layout-probe"]')
    expect(probes[0].attributes('style')).toContain('grid-column: span 12')
    expect(probes[0].attributes('style')).toContain('color: red')
    expect(probes[1].attributes('style')).toContain('grid-column: span 6')
    expect(probes[1].attributes('style')).toContain('color: blue')
    expect(probes[1].attributes('style')).toContain('background-color: white')
  })

  it('uses built-in field defaults for container span instead of FormNode fallbacks', () => {
    const formNodeSource = readFileSync('src/components/FormNode/src/index.vue', 'utf8')
    const defaultsSource = readFileSync('src/plugins/builtInFieldDefaults.ts', 'utf8')
    const resolved = createFormRuntime().transformField(defineField({ component: LayoutProbe }))
    const wrapper = mount(ConfigForm, {
      props: {
        fields: [defineField({ component: LayoutProbe })],
        defaultValues: {},
      },
    })

    expect(formNodeSource).not.toContain('?? 24')
    expect(defaultsSource).not.toContain('?? 24')
    expect(resolved.span).toBe(24)
    expect(wrapper.get('[data-testid="layout-probe"]').attributes('style')).toContain('grid-column: span 24')
  })

  it('updates model values and renders blur validation errors', async () => {
    const fields = [
      defineField({
        field: 'username',
        label: '用户名',
        component: TextInput,
        schema: z.string().min(2, '用户名至少 2 个字符'),
        validateOn: 'blur',
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        labelWidth: 88,
        defaultValues: {},
        namespace: 'strict',
      },
    })
    const api = wrapper.vm as unknown as ConfigFormExpose<Record<string, unknown>>

    const input = wrapper.get('input')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(wrapper.get('label').attributes('style')).toContain('width: 88px')

    await input.setValue('a')
    await input.trigger('blur')
    await flushValidation()

    expect(wrapper.text()).toContain('用户名至少 2 个字符')
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
    expect(api.getValues()).toEqual({ username: 'a' })

    await wrapper.get('input').setValue('Ada')
    await wrapper.get('input').trigger('blur')
    await flushValidation()

    expect(wrapper.text()).not.toContain('用户名至少 2 个字符')
    expect(api.getValues()).toEqual({ username: 'Ada' })
  })

  it('keeps generated ids out of components that declare their own id prop', () => {
    const fields = [
      defineField({
        field: 'dateRange',
        label: '日期范围',
        component: IdPropControl,
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
        namespace: 'moluoxixi',
      },
    })

    const fieldRoot = wrapper.get('.moluoxixi-field')
    const input = wrapper.get('input')

    expect(fieldRoot.attributes('id')).toBe('moluoxixi-dateRange-field')
    expect(input.attributes('id')).toBeUndefined()
    expect(input.attributes('data-prop-id')).toBe('')
    expect(wrapper.get('label').attributes('for')).toBe('moluoxixi-dateRange-field')
  })

  it('keeps root form context inline and labelWidth reactive after prop updates', async () => {
    const fields = [
      defineField({
        component: TextInput,
        field: 'username',
        label: '用户名',
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
        inline: false,
        labelWidth: 88,
      },
    })

    expect(wrapper.get('label').attributes('style')).toContain('width: 88px')
    expect(wrapper.get('.cf-field').classes()).not.toContain('cf-field--inline')

    await wrapper.setProps({ inline: true, labelWidth: 144 })
    await nextTick()

    expect(wrapper.get('label').attributes('style')).toContain('width: 144px')
    expect(wrapper.get('.cf-field').classes()).toContain('cf-field--inline')
  })

  it('submits transformed visible values and respects hidden or disabled submit options', async () => {
    const fields = [
      defineField({
        field: 'visible',
        component: TextInput,
        defaultValue: 'ok',
        transform: value => value.toUpperCase(),
      }),
      defineField({
        field: 'hiddenSkipped',
        component: TextInput,
        defaultValue: 'skip',
        visible: () => false,
      }),
      defineField({
        field: 'disabledSkipped',
        component: TextInput,
        defaultValue: 'skip',
        disabled: () => true,
        submitWhenDisabled: false,
      }),
      defineField({
        field: 'hiddenKept',
        component: TextInput,
        defaultValue: 'keep-hidden',
        submitWhenHidden: true,
        visible: () => false,
      }),
      defineField({
        field: 'disabledKept',
        component: TextInput,
        defaultValue: 'keep-disabled',
        disabled: () => true,
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('submit')?.[0]).toEqual([{
      disabledKept: 'keep-disabled',
      hiddenKept: 'keep-hidden',
      visible: 'OK',
    }])
  })

  it('exposes the imperative form API', async () => {
    const fields = [
      defineField({
        field: 'name',
        label: '姓名',
        component: TextInput,
        defaultValue: '',
        schema: z.string().min(2, '姓名至少 2 个字符'),
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        inline: true,
        defaultValues: {},
      },
    })

    const api = wrapper.vm as unknown as ConfigFormExpose<Record<string, unknown>>

    await expect(api.validateField('name')).resolves.toBe(false)
    expect(wrapper.get('form').attributes('style')).toContain('flex')

    api.setValue('name', 'Ada')
    await nextTick()
    expect(api.getValue('name')).toBe('Ada')
    await expect(api.validate()).resolves.toBe(true)

    api.setValues({ name: 'Grace' })
    await nextTick()
    expect(api.getValues()).toEqual({ name: 'Grace' })

    api.clearValidate('name')
    api.reset()
    await nextTick()
    expect(api.getValues()).toEqual({ name: '' })
  })

  it('resolves runtime registry, plugin transforms, predicates, and nested slot configs', async () => {
    const runtime = {
      components: {
        SlotLeaf,
        TextInput,
      },
      plugins: [
        {
          name: 'test-field-copy',
          transformField: (field) => {
            if ('field' in field && field.field === 'nickname') {
              return {
                ...field,
                label: '昵称',
                props: {
                  ...field.props,
                  placeholder: '请输入昵称',
                },
              }
            }
            if (field.component === 'SlotLeaf') {
              return {
                ...field,
                props: {
                  ...field.props,
                  text: '前缀',
                },
              }
            }
            return undefined
          },
        },
      ],
    } satisfies FormRuntimeOptions

    const fields = [
      defineField({
        field: 'role',
        component: TextInput,
        defaultValue: 'admin',
      }),
      defineField({
        field: 'nickname',
        component: 'TextInput',
        visible: values => values.role === 'admin',
        slots: {
          prefix: defineField({
            component: 'SlotLeaf',
            props: { 'data-role': 'runtime-prefix' },
          }),
        },
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: { role: 'admin' },
        runtime,
      },
    })

    expect(wrapper.text()).toContain('昵称')
    expect(wrapper.find('input[placeholder="请输入昵称"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="runtime-prefix"]').text()).toBe('前缀')

    const api = wrapper.vm as unknown as ConfigFormExpose<Record<string, unknown>>
    api.setValue('role', 'guest')
    await nextTick()

    expect(wrapper.text()).not.toContain('昵称')
  })
})

describe('form field component', () => {
  it('renders fields without depending on FormNode container logic', () => {
    const source = readFileSync('src/components/FormField/src/index.vue', 'utf8')

    expect(source).not.toContain('@/components/FormNode')
    expect(source).not.toContain('<FormNode')
  })

  it('keeps shared component attrs and listeners in the field binding composable', () => {
    const formFieldSource = readFileSync('src/components/FormField/src/index.vue', 'utf8')
    const formComponentSource = readFileSync('src/components/FormComponent/src/index.vue', 'utf8')

    expect(formFieldSource).toContain('@/composables/useFieldBinding')
    expect(formComponentSource).toContain('@/composables/useFieldBinding')
    expect(formFieldSource).not.toContain('getValueFromEvent')
    expect(formComponentSource).not.toContain('getValueFromEvent')
  })

  it('keeps FormComponent props narrowed to resolved fields without local casts', () => {
    const formComponentSource = readFileSync('src/components/FormComponent/src/index.vue', 'utf8')

    expect(formComponentSource).toContain('field: ResolvedField')
    expect(formComponentSource).not.toContain('ResolvedFormNode')
    expect(formComponentSource).not.toContain('as ResolvedField')
  })

  it('uses resolved slot content types after runtime transforms', () => {
    const typesSource = readFileSync('src/types/index.ts', 'utf8')
    const slotSource = readFileSync('src/utils/slot.ts', 'utf8')
    const transformSource = readFileSync('src/runtime/transform.ts', 'utf8')

    expect(typesSource).toContain('ResolvedSlotContent')
    expect(slotSource).toContain('ResolvedSlotContent')
    expect(slotSource).not.toContain('as SlotContent')
    expect(slotSource).not.toContain('as ResolvedFormNode')
    expect(transformSource).toContain('ResolvedSlotContent')
  })

  it('emits custom value and blur triggers through the public field contract', async () => {
    const field = defineField({
      blurTrigger: 'focusout',
      component: CustomControl,
      field: 'status',
      trigger: 'commit',
      valueProp: 'current',
    })

    const setValue = vi.fn()
    const validateField = vi.fn()

    const wrapper = mount(FormField, {
      props: {
        field: resolveTestField(field),
      },
      global: {
        provide: {
          [FORM_CONTEXT_KEY]: {
            values: { status: 'ready' },
            errors: {},
            getValue: (field: string) => ({ status: 'ready' } as Record<string, unknown>)[field],
            getValues: () => ({ status: 'ready' }),
            isVisible: () => true,
            isDisabled: () => false,
            setValue,
            setValues: vi.fn(),
            validateField,
          },
        },
      },
    })

    expect(wrapper.get('button').text()).toBe('ready')

    await wrapper.get('button').trigger('click')
    await wrapper.get('button').trigger('focusout')

    expect(setValue).toHaveBeenCalledWith('status', 'next')
    expect(validateField).toHaveBeenCalledWith('status', 'change')
    expect(validateField).toHaveBeenCalledWith('status', 'blur')
  })

  it('extracts component values from custom event payloads', async () => {
    const field = defineField({
      component: 'input',
      field: 'nativeInput',
      getValueFromEvent: event => ((event as Event).target as HTMLInputElement).value,
      trigger: 'input',
    })

    const setValue = vi.fn()
    const validateField = vi.fn()

    const wrapper = mount(FormField, {
      props: {
        field: resolveTestField(field),
      },
      global: {
        provide: {
          [FORM_CONTEXT_KEY]: {
            values: { nativeInput: '' },
            errors: {},
            getValue: (field: string) => ({ nativeInput: '' } as Record<string, unknown>)[field],
            getValues: () => ({ nativeInput: '' }),
            isVisible: () => true,
            isDisabled: () => false,
            setValue,
            setValues: vi.fn(),
            validateField,
          },
        },
      },
    })

    await wrapper.get('input').setValue('Ada')

    expect(setValue).toHaveBeenCalledWith('nativeInput', 'Ada')
    expect(validateField).toHaveBeenCalledWith('nativeInput', 'change')
  })

  it('renders field slot configs recursively with config-only slots', () => {
    const field = defineField({
      component: SlotHost,
      field: 'choice',
      slots: {
        default: [
          defineField({
            field: 'choice-first',
            component: SlotLeaf,
            props: { role: 'first', text: '第一个选项' },
          }),
          defineField({
            field: 'choice-second',
            component: SlotLeaf,
            props: { role: 'second', text: '第二个选项' },
          }),
        ],
        suffix: defineField({
          field: 'choice-suffix',
          component: SlotLeaf,
          props: { role: 'suffix', text: '后缀插槽' },
        }),
        footer: defineField({
          component: SlotLeaf,
          props: { role: 'footer', text: '底部插槽' },
        }),
      },
    })

    const wrapper = mount(ConfigForm, {
      props: {
        fields: [field],
        defaultValues: {},
      },
    })

    expect(wrapper.text()).toContain('第一个选项')
    expect(wrapper.text()).toContain('第二个选项')
    expect(wrapper.text()).toContain('后缀插槽')
    expect(wrapper.text()).toContain('底部插槽')
    expect(wrapper.find('[data-role="first"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="suffix"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="footer"]').exists()).toBe(true)
  })

  it('tracks real fields from named slot configs through values, validation, and submit', async () => {
    const fields = [
      defineField({
        component: SlotHost,
        field: 'group',
        slots: {
          suffix: defineField({
            component: TextInput,
            defaultValue: '',
            field: 'scopedName',
            label: '插槽姓名',
            schema: z.string().min(2, '作用域姓名至少 2 个字符'),
            validateOn: 'blur',
          }),
        },
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })
    const api = wrapper.vm as unknown as ConfigFormExpose<Record<string, unknown>>

    await nextTick()

    expect(api.getValues()).toEqual({
      group: undefined,
      scopedName: '',
    })

    await wrapper.get('input').setValue('A')
    await wrapper.get('input').trigger('blur')
    await flushValidation()

    expect(wrapper.text()).toContain('作用域姓名至少 2 个字符')

    await wrapper.get('input').setValue('Ada')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('submit')?.at(-1)).toEqual([{
      group: undefined,
      scopedName: 'Ada',
    }])
  })

  it('validates real fields rendered inside another field slot', async () => {
    const fields = [
      defineField({
        component: SlotHost,
        field: 'group',
        slots: {
          default: [
            defineField({
              component: TextInput,
              field: 'nestedName',
              label: '嵌套姓名',
              schema: z.string().min(2, '嵌套姓名至少 2 个字符'),
              validateOn: 'blur',
            }),
          ],
        },
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })
    const api = wrapper.vm as unknown as ConfigFormExpose<Record<string, unknown>>

    await wrapper.get('input').setValue('A')
    await wrapper.get('input').trigger('blur')
    await flushValidation()

    expect(api.getValues()).toEqual({
      group: undefined,
      nestedName: 'A',
    })
    expect(wrapper.text()).toContain('嵌套姓名至少 2 个字符')

    await wrapper.get('input').setValue('Ada')
    await wrapper.get('input').trigger('blur')
    await flushValidation()

    expect(wrapper.text()).not.toContain('嵌套姓名至少 2 个字符')
  })

  it('renders component slot nodes without adding form field wrappers', () => {
    const fields = [
      {
        component: SlotHost,
        slots: {
          default: [
            defineField({
              component: SlotLeaf,
              props: { role: 'slot-child', text: '嵌入选项' },
            }),
          ],
        },
      },
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })

    expect(wrapper.text()).toContain('嵌入选项')
    expect(wrapper.find('[data-role="slot-child"]').exists()).toBe(true)
    expect(wrapper.find('.cf-field').exists()).toBe(false)
  })
})

describe('form component component', () => {
  it('binds component-only field values and events through form context actions', async () => {
    const field = defineField({
      blurTrigger: 'focusout',
      component: CustomControl,
      field: 'status',
      trigger: 'commit',
      valueProp: 'current',
    })
    const setValue = vi.fn()
    const validateField = vi.fn()

    const wrapper = mount(FormComponent, {
      props: {
        field: resolveTestField(field),
      },
      global: {
        provide: {
          [FORM_CONTEXT_KEY]: {
            values: { status: 'ready' },
            errors: {},
            getValue: (field: string) => ({ status: 'ready' } as Record<string, unknown>)[field],
            getValues: () => ({ status: 'ready' }),
            isVisible: () => true,
            isDisabled: () => false,
            setValue,
            setValues: vi.fn(),
            validateField,
          },
        },
      },
    })

    expect(wrapper.get('button').text()).toBe('ready')
    expect(wrapper.find('.cf-field').exists()).toBe(false)

    await wrapper.get('button').trigger('click')
    await wrapper.get('button').trigger('focusout')

    expect(setValue).toHaveBeenCalledWith('status', 'next')
    expect(validateField).toHaveBeenCalledWith('status', 'change')
    expect(validateField).toHaveBeenCalledWith('status', 'blur')
  })
})

describe('form layout', () => {
  it('renders grid layout by default and applies flex style when inline=true', () => {
    const gridWrapper = mount(FormLayout, {
      props: { inline: false },
      global: {
        provide: {
          [FORM_CONTEXT_KEY]: {
            values: {},
            errors: {},
            setValue: vi.fn(),
            validateField: vi.fn(),
            inline: false,
          },
        },
      },
      slots: { default: 'grid content' },
    })

    expect(gridWrapper.classes()).toContain('cf-layout')
    expect(gridWrapper.attributes('style')).toContain('grid')
    expect(gridWrapper.find('.cf-layout').exists()).toBe(true)

    const inlineWrapper = mount(FormLayout, {
      props: { inline: true },
      global: {
        provide: {
          [FORM_CONTEXT_KEY]: {
            values: {},
            errors: {},
            setValue: vi.fn(),
            validateField: vi.fn(),
            inline: false,
          },
        },
      },
      slots: { default: 'inline content' },
    })

    expect(inlineWrapper.attributes('style')).toContain('flex')
  })

  it('inherits inline from parent context when inline prop is not set', () => {
    const wrapper = mount(FormLayout, {
      global: {
        provide: {
          [FORM_CONTEXT_KEY]: {
            values: {},
            errors: {},
            setValue: vi.fn(),
            validateField: vi.fn(),
            inline: true,
          },
        },
      },
      slots: { default: 'inherited' },
    })

    expect(wrapper.attributes('style')).toContain('flex')
  })

  it('forwards parent context getters while overriding inline for children', () => {
    const wrapper = mount(FormLayout, {
      props: { inline: false },
      global: {
        provide: {
          [FORM_CONTEXT_KEY]: {
            values: { name: 'Ada' },
            errors: { name: ['名称错误'] },
            getValue: (field: string) => ({ name: 'Ada' } as Record<string, unknown>)[field],
            getValues: () => ({ name: 'Ada' }),
            isVisible: () => true,
            isDisabled: () => false,
            labelWidth: '96px',
            setValue: vi.fn(),
            setValues: vi.fn(),
            validateField: vi.fn(),
            inline: true,
          },
        },
      },
      slots: { default: () => h(ContextProbe) },
    })

    expect(wrapper.get('[data-testid="context-probe"]').text()).toBe('false|96px|Ada|名称错误')
  })

  it('overrides parent context inline for child fields', () => {
    const fields = [
      defineField({
        field: 'name',
        component: TextInput,
        label: '姓名',
      }),
      defineField({
        component: 'FormLayout',
        props: { inline: true },
        slots: {
          default: [
            defineField({
              field: 'city',
              component: TextInput,
              label: '城市',
            }),
            defineField({
              field: 'district',
              component: TextInput,
              label: '区域',
            }),
          ],
        },
      }),
      defineField({
        field: 'email',
        component: TextInput,
        label: '邮箱',
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })

    // 顶层 form 不是 inline → grid 样式
    expect(wrapper.get('form').attributes('style')).toContain('grid')

    // FormLayout 内的字段应该是 inline 模式 → flex 样式
    const layoutEl = wrapper.find('.cf-layout')
    expect(layoutEl.exists()).toBe(true)
    expect(layoutEl.attributes('style')).toContain('flex')

    // FormLayout 外的字段不受影响
    const fieldDivs = wrapper.findAll('.cf-field')
    expect(fieldDivs.length).toBeGreaterThanOrEqual(3)
  })

  it('keeps provided validation errors reactive for fields inside FormLayout', async () => {
    const fields = [
      defineField({
        component: 'FormLayout',
        props: { inline: true },
        slots: {
          default: [
            defineField({
              component: TextInput,
              field: 'city',
              label: '城市',
              schema: z.string().min(2, '城市至少 2 个字符'),
              validateOn: 'blur',
            }),
          ],
        },
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })

    await wrapper.get('input').setValue('A')
    await wrapper.get('input').trigger('blur')
    await flushValidation()

    expect(wrapper.text()).toContain('城市至少 2 个字符')
  })

  it('supports nested FormLayout with different layout modes', () => {
    const fields = [
      defineField({
        field: 'top',
        component: TextInput,
        label: '顶层字段',
      }),
      defineField({
        component: 'FormLayout',
        props: { inline: true },
        slots: {
          default: [
            defineField({
              field: 'inlineA',
              component: TextInput,
              label: '行内A',
            }),
            // 嵌套 FormLayout 切回 grid
            defineField({
              component: 'FormLayout',
              props: { inline: false, columns: 3 },
              slots: {
                default: [
                  defineField({
                    field: 'gridB',
                    component: TextInput,
                    label: '网格B',
                  }),
                ],
              },
            }),
          ],
        },
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: { fields, defaultValues: {} },
    })

    // 外层 FormLayout 是 inline → flex 样式
    const layoutEls = wrapper.findAll('.cf-layout')
    const inlineLayout = layoutEls.find(el => el.attributes('style')?.includes('flex'))
    expect(inlineLayout).toBeDefined()

    // 内层 FormLayout 是 grid → grid 样式
    expect(layoutEls.length).toBeGreaterThanOrEqual(2)
    const innerGrid = layoutEls.find(el => el.attributes('style')?.includes('grid') && !el.attributes('style')?.includes('flex'))
    expect(innerGrid).toBeDefined()
  })
})
