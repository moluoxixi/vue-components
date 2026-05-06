import type { FormRuntimeOptions } from '../src/runtime'
import type { ConfigFormExpose, DefinedFormNodeConfig, FormNodeConfig, ResolvedField, RuntimeToken } from '../src/types'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, markRaw, nextTick } from 'vue'
import { z } from 'zod'
import FormField from '../src/components/FormField/src/index.vue'
import { FORM_CONTEXT_KEY } from '../src/composables/useFormContext'
import ConfigForm from '../src/index.vue'
import { defineField } from '../src/models/field'
import { createFormRuntime, createRuntimeToken } from '../src/runtime'

interface MessageToken extends RuntimeToken<string, 'message'> {
  key: string
  fallback?: string
}

/**
 * 创建测试用 message runtime token。
 *
 * token resolver 在对应用例内注册，缺失 resolver 时应保持 runtime 抛错语义。
 */
function message(key: string, fallback?: string): MessageToken {
  return createRuntimeToken<string, 'message', Omit<MessageToken, '__configFormToken'>>('message', { fallback, key })
}

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
  },
  setup(props, { slots }) {
    return () => h('span', { 'data-role': props.role }, slots.default?.())
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

/**
 * 使用默认 runtime 解析测试字段。
 *
 * 只为 FormField 单测提供最小 ResolvedField，不包含外部插件和动态表单值。
 */
function resolveTestField(field: DefinedFormNodeConfig): ResolvedField {
  const runtime = createFormRuntime()
  return runtime.resolveNode(field, runtime.createResolveSnap({ errors: {}, values: {} })) as ResolvedField
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
        modelValue: {},
      },
    })

    const card = wrapper.get('[data-card="基础信息"]')
    expect(card.attributes('data-card')).toBe('基础信息')
    expect(card.attributes('data-cf-devtools-source-id')).toBeUndefined()
  })

  it('binds devtools source ids on the field root element', () => {
    const source = {
      column: 5,
      file: 'D:/project-new/ConfigForm/playgrounds/demo.vue',
      id: 'source-username',
      line: 32,
    }
    const fields: FormNodeConfig[] = [
      {
        ...defineField({
          component: TextInput,
          field: 'username',
          label: '用户名',
        }),
        __source: source,
      } as FormNodeConfig,
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        modelValue: {},
        namespace: 'moluoxixi',
      },
    })

    const field = wrapper.get('.moluoxixi-field')
    expect(field.attributes('data-cf-devtools-source-id')).toBe('source-username')
    expect(wrapper.get('#moluoxixi-username-field').attributes('data-cf-devtools-source-id')).toBeUndefined()
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
        modelValue: {},
      },
    })

    expect(wrapper.find('[data-card="基础信息"]').exists()).toBe(true)
    expect(wrapper.find('[data-card="账号信息"]').exists()).toBe(true)
    expect(wrapper.findAll('label')).toHaveLength(1)
    expect(wrapper.get('label').text()).toBe('用户名')
    expect(wrapper.find('[data-card="基础信息"]').attributes('modelvalue')).toBeUndefined()

    await wrapper.get('input').setValue('Ada')
    await wrapper.get('input').trigger('blur')
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ username: 'Ada' }])
    expect(wrapper.text()).toContain('用户名至少 4 个字符')
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
        modelValue: {},
        namespace: 'strict',
      },
    })

    const input = wrapper.get('input')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(wrapper.get('label').attributes('style')).toContain('width: 88px')

    await input.setValue('a')
    await input.trigger('blur')
    await flushPromises()

    expect(wrapper.text()).toContain('用户名至少 2 个字符')
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ username: 'a' }])

    await wrapper.get('input').setValue('Ada')
    await wrapper.get('input').trigger('blur')
    await flushPromises()

    expect(wrapper.text()).not.toContain('用户名至少 2 个字符')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ username: 'Ada' }])
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
        modelValue: {},
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
        modelValue: {},
      },
    })

    const api = wrapper.vm as unknown as ConfigFormExpose<Record<string, unknown>>

    await expect(api.validateField('name')).resolves.toBe(false)
    expect(wrapper.get('form').classes()).toContain('cf-form--inline')

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

  it('resolves runtime registry, tokens, predicates, and nested slot configs', async () => {
    const runtime = {
      components: {
        SlotLeaf,
        TextInput,
      },
      plugins: [
        {
          name: 'test-messages',
          tokens: {
            message: (token) => {
              const { fallback, key } = token as MessageToken
              const messages: Record<string, string> = {
                'field.nickname': '昵称',
                'field.nickname.placeholder': '请输入昵称',
                'slot.prefix': '前缀',
              }
              return messages[key] ?? fallback ?? key
            },
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
        label: message('field.nickname', 'Nickname'),
        component: 'TextInput',
        props: {
          placeholder: message('field.nickname.placeholder', 'Nickname placeholder'),
        },
        visible: values => values.role === 'admin',
        slots: {
          prefix: defineField({
            component: 'SlotLeaf',
            props: { 'data-role': 'runtime-prefix' },
            slots: { default: message('slot.prefix', 'Prefix') },
          }),
        },
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        modelValue: { role: 'admin' },
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
        node: resolveTestField(field),
        resolveSnap: undefined,
      },
      global: {
        provide: {
          [FORM_CONTEXT_KEY]: {
            values: { status: 'ready' },
            errors: {},
            visibilityMap: { status: true },
            disabledMap: {},
            setValue,
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
        node: resolveTestField(field),
        resolveSnap: undefined,
      },
      global: {
        provide: {
          [FORM_CONTEXT_KEY]: {
            values: { nativeInput: '' },
            errors: {},
            visibilityMap: { nativeInput: true },
            disabledMap: {},
            setValue,
            validateField,
          },
        },
      },
    })

    await wrapper.get('input').setValue('Ada')

    expect(setValue).toHaveBeenCalledWith('nativeInput', 'Ada')
    expect(validateField).toHaveBeenCalledWith('nativeInput', 'change')
  })

  it('renders field slot configs recursively including scoped slot functions', () => {
    const field = defineField({
      component: SlotHost,
      field: 'choice',
      slots: {
        default: [
          defineField({
            field: 'choice-first',
            component: SlotLeaf,
            props: { role: 'first' },
            slots: { default: '第一个选项' },
          }),
          defineField({
            field: 'choice-second',
            component: SlotLeaf,
            props: { role: 'second' },
            slots: { default: '第二个选项' },
          }),
        ],
        suffix: scope => defineField({
          field: 'choice-suffix',
          component: SlotLeaf,
          props: { role: 'suffix' },
          slots: { default: String(scope?.label) },
        }),
        footer: '纯文本插槽',
      },
    })

    const wrapper = mount(ConfigForm, {
      props: {
        fields: [field],
        modelValue: {},
      },
    })

    expect(wrapper.text()).toContain('第一个选项')
    expect(wrapper.text()).toContain('第二个选项')
    expect(wrapper.text()).toContain('后缀作用域')
    expect(wrapper.text()).toContain('纯文本插槽')
    expect(wrapper.find('[data-role="first"]').exists()).toBe(true)
    expect(wrapper.find('[data-role="suffix"]').exists()).toBe(true)
  })

  it('tracks real fields returned from scoped slot functions through values, validation, and submit', async () => {
    const fields = [
      defineField({
        component: SlotHost,
        field: 'group',
        slots: {
          suffix: scope => defineField({
            component: TextInput,
            defaultValue: '',
            field: 'scopedName',
            label: String(scope?.label),
            schema: z.string().min(2, '作用域姓名至少 2 个字符'),
            validateOn: 'blur',
          }),
        },
      }),
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        modelValue: {},
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
    await flushPromises()

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
        modelValue: {},
      },
    })

    await wrapper.get('input').setValue('A')
    await wrapper.get('input').trigger('blur')
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{
      group: undefined,
      nestedName: 'A',
    }])
    expect(wrapper.text()).toContain('嵌套姓名至少 2 个字符')

    await wrapper.get('input').setValue('Ada')
    await wrapper.get('input').trigger('blur')
    await flushPromises()

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
              props: { role: 'slot-child' },
              slots: { default: '嵌入选项' },
            }),
          ],
        },
      },
    ]

    const wrapper = mount(ConfigForm, {
      props: {
        fields,
        modelValue: {},
      },
    })

    expect(wrapper.text()).toContain('嵌入选项')
    expect(wrapper.find('[data-role="slot-child"]').exists()).toBe(true)
    expect(wrapper.find('.cf-field').exists()).toBe(false)
  })
})
