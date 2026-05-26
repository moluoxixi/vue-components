import type { FormContext } from '../src/composables'
import type { FormRuntimeOptions } from '../src/runtime'
import type { ConfigFormExpose, DefinedFormNodeConfig, FormNodeConfig, ResolvedBoundNode, ResolvedField } from '../src/types'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, inject, markRaw, nextTick, shallowRef } from 'vue'
import { z } from 'zod'
import FormComponent from '../src/components/FormComponent/src/index.vue'
import FormField from '../src/components/FormField/src/index.vue'
import FormLayout from '../src/components/FormLayout/src/index.vue'
import FormNode from '../src/components/FormNode/src/index.vue'
import RecursiveField from '../src/components/RecursiveField/src/index.vue'
import { useRuntime } from '../src/composables'
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
    placeholder: String,
  },
  emits: ['update:modelValue', 'blur'],
  setup(props, { attrs, emit, slots }) {
    return () => h('div', [
      slots.prefix?.(),
      h('input', {
        ...attrs,
        disabled: props.disabled,
        placeholder: props.placeholder,
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

const MultiArgSlotHost = markRaw(defineComponent({
  name: 'MultiArgSlotHost',
  setup(_props, { slots }) {
    return () => h('div', { 'data-testid': 'multi-arg-slot-host' }, [
      slots.default?.({ label: '默认作用域' }, '第二参数'),
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

const RuntimeProbe = markRaw(defineComponent({
  name: 'RuntimeProbe',
  setup() {
    const runtime = useRuntime()

    return () => {
      const transformed = runtime.value.transformField(defineField({
        component: 'input',
        field: 'runtimeProbe',
      }))

      return h('span', {
        'data-testid': 'runtime-probe',
        'data-value-prop': 'field' in transformed ? transformed.valueProp : undefined,
      }, 'runtime')
    }
  },
}))

/**
 * 使用默认 runtime 解析测试字段。
 *
 * 只为 FormField 单测提供最小 ResolvedField，不包含外部插件和动态表单值。
 */
function resolveTestField(field: DefinedFormNodeConfig): ResolvedBoundNode {
  const runtime = createFormRuntime()
  return runtime.transformField(field) as ResolvedBoundNode
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

  it('passes field id to FormItem root without leaking it to controls', () => {
    const fields: FormNodeConfig[] = [
      {
        component: TextInput,
        field: 'username',
        id: 'source-username',
        label: '用户名',
        props: {
          'data-control': 'username-input',
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

    expect(field.attributes('style')).toContain('grid-column: span 8')
    expect(field.attributes('id')).toBe('source-username')
    expect(input.attributes('data-control')).toBe('username-input')
    expect(input.attributes('id')).not.toBe('source-username')
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

  it('reactively renders app-owned translated field configs without i18n runtime plugins', async () => {
    const messages = {
      'en-US': {
        label: 'Username',
        placeholder: 'Enter username',
      },
      'zh-CN': {
        label: '用户名',
        placeholder: '请输入用户名',
      },
    } satisfies Record<string, { label: string, placeholder: string }>

    const Harness = defineComponent({
      name: 'TranslatedConfigHarness',
      setup() {
        const locale = shallowRef<'zh-CN' | 'en-US'>('zh-CN')
        const fields = computed<FormNodeConfig[]>(() => [
          defineField({
            component: TextInput,
            field: 'username',
            label: messages[locale.value].label,
            props: {
              placeholder: messages[locale.value].placeholder,
            },
          }),
        ])

        /**
         * 切换上层应用语言。
         *
         * ConfigForm 只接收 computed 产出的最终字段文案，不依赖 runtime i18n 插件。
         */
        function switchLocale() {
          locale.value = 'en-US'
        }

        return () => h('div', [
          h(ConfigForm, {
            defaultValues: {},
            fields: fields.value,
          }),
          h('button', { onClick: switchLocale, type: 'button' }, 'switch locale'),
        ])
      },
    })

    const wrapper = mount(Harness)

    expect(wrapper.get('label').text()).toBe('用户名')
    expect(wrapper.get('input').attributes('placeholder')).toBe('请输入用户名')

    await wrapper.get('button').trigger('click')
    await nextTick()

    expect(wrapper.get('label').text()).toBe('Username')
    expect(wrapper.get('input').attributes('placeholder')).toBe('Enter username')
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

  it('lets componentAttrs.style override container span and field props style', () => {
    const field = createFormRuntime().transformField(defineField({
      component: LayoutProbe,
      props: {
        style: {
          color: 'blue',
          gridColumn: 'span 10',
        },
      },
      span: 12,
    }))

    const wrapper = mount(FormNode, {
      props: {
        field,
        componentAttrs: {
          style: {
            color: 'green',
            gridColumn: 'span 6',
          },
        },
      },
      global: {
        provide: {
          [FORM_CONTEXT_KEY]: {
            errors: {},
            getValue: () => undefined,
            getValues: () => ({}),
            inline: false,
            isDisabled: () => false,
            isVisible: () => true,
            setValue: () => {},
            setValues: () => {},
            validateField: async () => true,
            values: {},
          } satisfies FormContext,
        },
      },
    })

    const style = wrapper.get('[data-testid="layout-probe"]').attributes('style')
    expect(style).toContain('grid-column: span 6')
    expect(style).toContain('color: green')
  })

  it('forwards fallthrough attrs to the rendered node', () => {
    const field = createFormRuntime().transformField(defineField({
      component: LayoutProbe,
      props: {
        style: {
          color: 'blue',
        },
      },
    }))

    const wrapper = mount(FormNode, {
      attrs: {
        'data-origin': 'outer',
      },
      props: {
        field,
      },
      global: {
        provide: {
          [FORM_CONTEXT_KEY]: {
            errors: {},
            getValue: () => undefined,
            getValues: () => ({}),
            inline: false,
            isDisabled: () => false,
            isVisible: () => true,
            setValue: () => {},
            setValues: () => {},
            validateField: async () => true,
            values: {},
          } satisfies FormContext,
        },
      },
    })

    expect(wrapper.get('[data-testid="layout-probe"]').attributes('data-origin')).toBe('outer')
  })

  it('uses built-in field defaults for container span', () => {
    const resolved = createFormRuntime().transformField(defineField({ component: LayoutProbe }))
    const wrapper = mount(ConfigForm, {
      props: {
        fields: [defineField({ component: LayoutProbe })],
        defaultValues: {},
      },
    })

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
    expect(wrapper.get('label').attributes('style')).toContain('width: 88px')

    await input.setValue('a')
    await input.trigger('blur')
    await flushValidation()

    expect(wrapper.text()).toContain('用户名至少 2 个字符')
    expect(api.getValues()).toEqual({ username: 'a' })

    await wrapper.get('input').setValue('Ada')
    await wrapper.get('input').trigger('blur')
    await flushValidation()

    expect(wrapper.text()).not.toContain('用户名至少 2 个字符')
    expect(api.getValues()).toEqual({ username: 'Ada' })
  })

  it('renders readonly labeled fields as display text inside the normal FormItem layout', () => {
    const fields = [
      defineField({
        component: TextInput,
        defaultValue: 'Ada',
        field: 'username',
        label: '用户名',
        readonly: true,
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })

    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.get('.cf-field').text()).toContain('Ada')
    expect(wrapper.get('.cf-field__readonly').text()).toBe('Ada')
    expect(wrapper.findAll('.cf-field__error')).toHaveLength(1)
    expect(wrapper.get('.cf-field__error').text()).toBe('')
  })

  it('renders readonly component-only fields without adding a form field wrapper', () => {
    const fields = [
      defineField({
        component: TextInput,
        defaultValue: 'Ada',
        field: 'nickname',
        readonly: true,
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })

    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('.cf-field').exists()).toBe(false)
    expect(wrapper.get('.cf-field__readonly').text()).toBe('Ada')
    expect(wrapper.get('[data-cf-bound-field="nickname"]').text()).toContain('Ada')
  })

  it('renders required marks and keeps validation error space reserved', async () => {
    const fields = [
      defineField({
        field: 'username',
        label: '用户名',
        component: TextInput,
        required: true,
        requiredMessage: '请输入用户名',
      }),
      defineField({
        field: 'nickname',
        label: '昵称',
        component: TextInput,
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })

    expect(wrapper.findAll('.cf-field__error')).toHaveLength(2)
    expect(wrapper.findAll('.cf-field__required')).toHaveLength(1)
    expect(wrapper.get('label').text()).toBe('*用户名')
    expect(wrapper.findAll('label')[1].text()).toBe('昵称')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('请输入用户名')
    expect(wrapper.findAll('.cf-field__error')).toHaveLength(2)
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
    expect(wrapper.get('form').attributes('style')).toContain('align-items: flex-start')
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
        submitWhenDisabled: true,
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

  it('provides the normalized runtime to rendered field components', () => {
    const fields = [
      defineField({
        component: RuntimeProbe,
      }),
    ]
    const runtime = {
      plugins: [
        {
          name: 'probe-binding',
          transformField: field => ({
            ...field,
            valueProp: 'value',
          }),
        },
      ],
    } satisfies FormRuntimeOptions

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
        runtime,
      },
    })

    expect(wrapper.get('[data-testid="runtime-probe"]').attributes('data-value-prop')).toBe('value')
  })
})

describe('form field component', () => {
  it('renders labelled fields through FormItem and FormComponent composition', () => {
    const field = resolveTestField(defineField({
      component: TextInput,
      field: 'username',
      label: '用户名',
    })) as ResolvedField

    const wrapper = mount(FormField, {
      props: {
        field,
      },
      global: {
        provide: {
          [FORM_CONTEXT_KEY]: {
            values: { username: 'Ada' },
            errors: { username: ['名称错误'] },
            getValue: (field: string) => ({ username: 'Ada' } as Record<string, unknown>)[field],
            getValues: () => ({ username: 'Ada' }),
            isVisible: () => true,
            isDisabled: () => false,
            setValue: vi.fn(),
            setValues: vi.fn(),
            validateField: vi.fn(),
          },
        },
      },
    })

    expect(wrapper.findComponent(FormComponent).exists()).toBe(true)
    expect(wrapper.find('label').text()).toBe('用户名')
    expect(wrapper.text()).toContain('名称错误')
    expect(wrapper.find('.cf-field').exists()).toBe(true)
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('emits custom value and blur triggers through the public field contract', async () => {
    const field = resolveTestField(defineField({
      blurTrigger: 'focusout',
      component: CustomControl,
      field: 'status',
      label: '状态',
      trigger: 'commit',
      valueProp: 'current',
    })) as ResolvedField

    const setValue = vi.fn()
    const validateField = vi.fn()

    const wrapper = mount(FormField, {
      props: {
        field,
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
    const field = resolveTestField(defineField({
      component: 'input',
      field: 'nativeInput',
      getValueFromEvent: event => ((event as Event).target as HTMLInputElement).value,
      label: '原生输入',
      trigger: 'input',
    })) as ResolvedField

    const setValue = vi.fn()
    const validateField = vi.fn()

    const wrapper = mount(FormField, {
      props: {
        field,
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

  it('renders render-function components with form context helpers', async () => {
    const fields = [
      defineField({
        component: (context: {
          getValue: (field: string) => unknown
          setValue: (field: string, value: unknown) => void
        }) => h('button', {
          'data-testid': 'render-component',
          'onClick': () => context.setValue('nickname', `${String(context.getValue('nickname'))}!`),
          'type': 'button',
        }, String(context.getValue('nickname'))),
        defaultValue: 'Ada',
        field: 'nickname',
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })
    const api = wrapper.vm as unknown as ConfigFormExpose<Record<string, unknown>>

    expect(wrapper.get('[data-testid="render-component"]').text()).toBe('Ada')

    await wrapper.get('[data-testid="render-component"]').trigger('click')

    expect(api.getValues()).toEqual({
      nickname: 'Ada!',
    })
  })

  it('forwards slot render args after the shared context', () => {
    const fields = [
      defineField({
        component: MultiArgSlotHost,
        field: 'choice',
        defaultValue: '初始值',
        slots: {
          default: (context: {
            getValue: (field: string) => unknown
          }, slotProps: { label: string }, suffix: string) => h('span', {
            'data-testid': 'slot-render',
          }, `${String(context.getValue('choice'))}|${slotProps.label}|${suffix}`),
        },
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })

    expect(wrapper.get('[data-testid="slot-render"]').text()).toBe('初始值|默认作用域|第二参数')
  })

  it('keeps unlabelled field ids out of FormItem classification', () => {
    const fields = [
      defineField({
        component: TextInput,
        field: 'username',
        id: 'source-username',
        props: {
          placeholder: '用户名',
        },
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })

    const input = wrapper.get('input')

    expect(wrapper.find('label').exists()).toBe(false)
    expect(wrapper.find('.cf-field').exists()).toBe(false)
    expect(input.attributes('placeholder')).toBe('用户名')
    expect(input.attributes('id')).not.toBe('source-username')
  })

  it('applies grid span to unlabelled field controls', () => {
    const fields = [
      defineField({
        component: TextInput,
        field: 'username',
        props: {
          placeholder: '用户名',
        },
        span: 8,
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        defaultValues: {},
      },
    })

    expect(wrapper.find('.cf-field').exists()).toBe(false)
    expect(wrapper.get('[data-cf-bound-field="username"]').attributes('style')).toContain('grid-column: span 8')
  })

  it('does not add an extra wrapper around unlabelled slot fields', () => {
    const fields = [
      defineField({
        component: SlotHost,
        slots: {
          default: [
            defineField({
              component: TextInput,
              field: 'username',
              props: {
                placeholder: '用户名',
              },
              span: 8,
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

    expect(wrapper.get('input').attributes('placeholder')).toBe('用户名')
    expect(wrapper.find('[data-testid="slot-host"] > [data-cf-bound-field="username"] > div > input').exists()).toBe(false)
  })
})

describe('recursive field component', () => {
  it('prunes invisible nodes before dispatching to node components', () => {
    const field = resolveTestField(defineField({
      component: TextInput,
      field: 'hiddenName',
      label: '隐藏姓名',
    }))

    const wrapper = mount(RecursiveField, {
      props: { field },
      global: {
        provide: {
          [FORM_CONTEXT_KEY]: {
            values: { hiddenName: '' },
            errors: {},
            getValue: (field: string) => ({ hiddenName: '' } as Record<string, unknown>)[field],
            getValues: () => ({ hiddenName: '' }),
            isVisible: () => false,
            isDisabled: () => false,
            setValue: vi.fn(),
            setValues: vi.fn(),
            validateField: vi.fn(),
          },
        },
      },
    })

    expect(wrapper.findComponent(FormField).exists()).toBe(false)
    expect(wrapper.find('input').exists()).toBe(false)
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
    expect(inlineWrapper.attributes('style')).toContain('align-items: flex-start')
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
