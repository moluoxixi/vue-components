import type { FormNodeConfig, NormalizedFieldConfig, ResolvedFormNode } from '../src/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { z } from 'zod'
import { useForm, VALIDATION_THROTTLE_MS } from '../src/composables/useForm'
import { createFormRuntime } from '../src/runtime'
import { defineField } from '../src/utils/field'

const defaultRuntime = createFormRuntime()

/** 使用默认 runtime 递归解析测试节点，保持 useForm 单测输入与 ConfigForm 真实入口一致。 */
function resolveTestFields(fields: FormNodeConfig[]): ResolvedFormNode[] {
  return fields.map(field => defaultRuntime.transformField(field) as ResolvedFormNode)
}

/** 创建已解析字段树的响应式引用，避免 useForm 单测绕过 ConfigForm 的字段处理边界。 */
function createResolvedFieldRef(fields: FormNodeConfig[]) {
  return ref<ResolvedFormNode[]>(resolveTestFields(fields))
}

describe('useForm', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('throws when the same resolved node object is reused in multiple positions', () => {
    const reusedNode = resolveTestFields([
      defineField({ component: 'section' }),
    ])[0]
    const fields = ref<ResolvedFormNode[]>([reusedNode, reusedNode])

    expect(() => useForm({ fields })).toThrow(/Duplicate field node reference at fields\.1/)
  })

  it('fails fast when resolved nodes contain a circular slot reference', () => {
    const child = resolveTestFields([
      defineField({ component: 'section' }),
    ])[0] as ResolvedFormNode & { slots?: Record<string, unknown> }
    child.slots = { default: child }

    expect(() => resolveTestFields([
      defineField({ component: 'section', slots: { default: child as never } }),
    ])).toThrow(/contains a circular plain-object reference/)
  })

  it('collects real fields from nested component containers', async () => {
    const fields = createResolvedFieldRef([
      {
        component: 'section',
        slots: {
          default: [
            defineField({
              component: 'article',
              slots: {
                default: [
                  defineField({
                    component: 'input',
                    defaultValue: '',
                    field: 'username',
                    validator: value => value ? undefined : '用户名必填',
                  }),
                ],
              },
            }),
          ],
        },
      },
    ])
    const onSubmit = vi.fn()

    const form = useForm({ fields, onSubmit })

    expect(form.getValues()).toEqual({ username: '' })
    await expect(form.submit()).resolves.toBe(false)
    expect(form.errors.value.username).toEqual(['用户名必填'])

    form.setValue('username', 'Ada')

    await expect(form.submit()).resolves.toBe(true)
    expect(onSubmit).toHaveBeenCalledWith({ username: 'Ada' })
  })

  it('initializes from defaultValues without watching external replacements', async () => {
    const fields = createResolvedFieldRef([
      defineField({ field: 'name', component: 'input', defaultValue: 'default name' }),
      defineField({ field: 'age', component: 'input', defaultValue: 18 }),
    ])
    const defaultValues: Record<string, unknown> = { name: 'Ada' }

    const form = useForm({ fields, defaultValues })

    expect(form.getValues()).toEqual({ name: 'Ada', age: 18 })

    defaultValues.name = 'Grace'
    defaultValues.age = 37
    await nextTick()

    expect(form.getValues()).toEqual({ name: 'Ada', age: 18 })

    form.setValue('name', 'Edited')
    await nextTick()
    form.reset()

    expect(form.getValues()).toEqual({ name: 'Ada', age: 18 })
  })

  it('preserves edited values when field metadata changes or fields are appended', async () => {
    const fields = createResolvedFieldRef([
      defineField({
        field: 'name',
        component: 'input',
        defaultValue: 'default name',
        props: { placeholder: 'initial' },
      }),
    ])

    const form = useForm({ fields })

    form.setValue('name', 'Grace')
    fields.value = resolveTestFields([
      defineField({
        field: 'name',
        component: 'input',
        defaultValue: 'changed default',
        props: { placeholder: 'changed' },
      }),
      defineField({
        field: 'age',
        component: 'input',
        defaultValue: 37,
      }),
    ])
    await nextTick()

    expect(form.getValues()).toEqual({
      age: 37,
      name: 'Grace',
    })
  })

  it('supports validators that can inspect all field values', async () => {
    const fields = createResolvedFieldRef([
      defineField({ field: 'password', component: 'input', defaultValue: 'secret' }),
      defineField({
        field: 'confirm',
        component: 'input',
        defaultValue: 'nope',
        validator: (value, values) => value === values.password ? undefined : '两次密码不一致',
      }),
    ])

    const form = useForm({ fields })

    await expect(form.validate()).resolves.toBe(false)
    expect(form.errors.value.confirm).toEqual(['两次密码不一致'])

    form.setValue('confirm', 'secret')

    await expect(form.validate()).resolves.toBe(true)
    expect(form.errors.value.confirm).toBeUndefined()
  })

  it('lets fields opt into submitting hidden or disabled values', async () => {
    const onSubmit = vi.fn()
    const fields = createResolvedFieldRef([
      defineField({ field: 'visible', component: 'input', defaultValue: 'ok' }),
      defineField({ field: 'hidden', component: 'input', defaultValue: 'skip', visible: () => false }),
      defineField({ field: 'disabled', component: 'input', defaultValue: 'skip', disabled: () => true, submitWhenDisabled: false }),
      defineField({
        field: 'hiddenKept',
        component: 'input',
        defaultValue: 'keep',
        visible: () => false,
        submitWhenHidden: true,
      }),
      defineField({
        field: 'disabledKept',
        component: 'input',
        defaultValue: 'keep',
        disabled: () => true,
        submitWhenDisabled: true,
      }),
    ])

    const form = useForm({ fields, onSubmit })

    await expect(form.submit()).resolves.toBe(true)
    expect(onSubmit).toHaveBeenCalledWith({
      visible: 'ok',
      hiddenKept: 'keep',
      disabledKept: 'keep',
    })
  })

  it('validates submit fields concurrently while preserving per-field serialization', async () => {
    const calls: string[] = []
    let active = 0
    let maxActive = 0
    const fields = createResolvedFieldRef([
      defineField({
        field: 'first',
        component: 'input',
        validator: async () => {
          calls.push('first:start')
          active += 1
          maxActive = Math.max(maxActive, active)
          await new Promise(resolve => setTimeout(resolve, 20))
          active -= 1
          calls.push('first:end')
          return undefined
        },
      }),
      defineField({
        field: 'second',
        component: 'input',
        validator: async () => {
          calls.push('second:start')
          active += 1
          maxActive = Math.max(maxActive, active)
          await new Promise(resolve => setTimeout(resolve, 20))
          active -= 1
          calls.push('second:end')
          return undefined
        },
      }),
    ])

    const form = useForm({ fields })

    await expect(form.validate()).resolves.toBe(true)
    expect(maxActive).toBe(2)
    expect(calls).toContain('first:start')
    expect(calls).toContain('second:start')
  })

  it('validates hidden or disabled fields when they opt into submit output', async () => {
    const fields = createResolvedFieldRef([
      defineField({
        field: 'hiddenSkipped',
        component: 'input',
        visible: () => false,
        validator: () => '不会出现',
      }),
      defineField({
        field: 'hiddenKept',
        component: 'input',
        visible: () => false,
        submitWhenHidden: true,
        validator: () => '隐藏字段需要校验',
      }),
      defineField({
        field: 'disabledKept',
        component: 'input',
        disabled: () => true,
        submitWhenDisabled: true,
        validator: () => '禁用字段需要校验',
      }),
    ])

    const form = useForm({ fields })

    await expect(form.submit()).resolves.toBe(false)
    expect(form.errors.value.hiddenSkipped).toBeUndefined()
    expect(form.errors.value.hiddenKept).toEqual(['隐藏字段需要校验'])
    expect(form.errors.value.disabledKept).toEqual(['禁用字段需要校验'])
  })

  it('validates single fields by trigger and clears errors on value changes', async () => {
    const fields = createResolvedFieldRef([
      defineField({
        field: 'name',
        component: 'input',
        defaultValue: '',
        schema: z.string().min(2, '姓名至少 2 个字符'),
        validateOn: 'blur',
      }),
    ])

    const form = useForm({ fields })

    await expect(form.validateSingleField('name', 'change')).resolves.toBe(true)
    expect(form.errors.value.name).toBeUndefined()

    await expect(form.validateSingleField('name', 'blur')).resolves.toBe(false)
    expect(form.errors.value.name).toEqual(['姓名至少 2 个字符'])

    form.setValue('name', 'Ada')
    expect(form.errors.value.name).toBeUndefined()

    await expect(form.validateSingleField('name', 'blur')).resolves.toBe(true)
    expect(form.errors.value.name).toBeUndefined()
  })

  it('throttles rapid single-field validation calls and only runs the latest validator chain', async () => {
    vi.useFakeTimers()
    const calls: unknown[] = []
    let active = 0
    let maxActive = 0
    const fields = createResolvedFieldRef([
      defineField({
        field: 'name',
        component: 'input',
        defaultValue: '',
        validateOn: 'change',
        validator: async (value) => {
          calls.push(value)
          active += 1
          maxActive = Math.max(maxActive, active)
          await new Promise(resolve => setTimeout(resolve, 20))
          active -= 1
          return value === 'bad' ? '错误' : undefined
        },
      }),
    ])
    const form = useForm({ fields })

    form.setValue('name', 'first')
    const first = form.validateSingleField('name', 'change')
    form.setValue('name', 'bad')
    const second = form.validateSingleField('name', 'change')

    expect(calls).toEqual([])

    await vi.advanceTimersByTimeAsync(VALIDATION_THROTTLE_MS)
    expect(calls).toEqual(['bad'])
    await vi.advanceTimersByTimeAsync(20)

    await expect(first).resolves.toBe(false)
    await expect(second).resolves.toBe(false)
    expect(maxActive).toBe(1)
    expect(form.errors.value.name).toEqual(['错误'])
  })

  it('serializes validation chains for the same field while preserving the latest pending request', async () => {
    vi.useFakeTimers()
    const calls: unknown[] = []
    let active = 0
    let maxActive = 0
    const fields = createResolvedFieldRef([
      defineField({
        field: 'name',
        component: 'input',
        defaultValue: '',
        validateOn: 'change',
        validator: async (value) => {
          calls.push(value)
          active += 1
          maxActive = Math.max(maxActive, active)
          await new Promise(resolve => setTimeout(resolve, 30))
          active -= 1
          return value === 'second' ? '第二次错误' : undefined
        },
      }),
    ])
    const form = useForm({ fields })

    form.setValue('name', 'first')
    const first = form.validateSingleField('name', 'change')
    await vi.advanceTimersByTimeAsync(VALIDATION_THROTTLE_MS)
    expect(calls).toEqual(['first'])

    form.setValue('name', 'second')
    const second = form.validateSingleField('name', 'change')
    await vi.advanceTimersByTimeAsync(VALIDATION_THROTTLE_MS)
    expect(calls).toEqual(['first'])

    await vi.advanceTimersByTimeAsync(30)
    await vi.advanceTimersByTimeAsync(VALIDATION_THROTTLE_MS)
    expect(calls).toEqual(['first', 'second'])
    await vi.advanceTimersByTimeAsync(30)

    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(false)
    expect(maxActive).toBe(1)
    expect(form.errors.value.name).toEqual(['第二次错误'])
  })

  it('supports merge and replace value updates with explicit error clearing', async () => {
    const onError = vi.fn()
    const fields = createResolvedFieldRef([
      defineField({
        field: 'name',
        component: 'input',
        defaultValue: 'default name',
        schema: z.string().min(2, '姓名至少 2 个字符'),
      }),
      defineField({ field: 'age', component: 'input', defaultValue: 18 }),
      defineField({ field: 'obsolete', component: 'input', defaultValue: 'old' }),
    ])

    const form = useForm({ fields, onError })

    form.setValue('name', '')
    await expect(form.validate()).resolves.toBe(false)
    expect(onError).toHaveBeenCalledWith({ name: ['姓名至少 2 个字符'] })

    form.setValues({ name: 'Ada' })
    expect(form.getValue('name')).toBe('Ada')
    expect(form.errors.value.name).toBeUndefined()

    form.setValue('name', '')
    await expect(form.validate()).resolves.toBe(false)
    expect(form.errors.value.name).toEqual(['姓名至少 2 个字符'])

    form.clearFieldError()
    expect(form.errors.value).toEqual({})

    form.setValues({ age: 42 }, true)
    expect(form.getValues()).toEqual({
      age: 42,
      name: 'default name',
      obsolete: 'old',
    })
  })

  it('clears stale errors when validation rules are removed from a field', async () => {
    const fields = createResolvedFieldRef([
      defineField({
        component: 'input',
        field: 'name',
        schema: z.string().min(2, '姓名至少 2 个字符'),
      }),
    ])

    const form = useForm({ fields })

    await expect(form.validateSingleField('name', 'submit')).resolves.toBe(false)
    expect(form.errors.value.name).toEqual(['Required'])

    fields.value = resolveTestFields([
      defineField({
        component: 'input',
        field: 'name',
      }),
    ])
    await nextTick()

    await expect(form.validateSingleField('name', 'submit')).resolves.toBe(true)
    expect(form.errors.value.name).toBeUndefined()
  })

  it('prunes errors when fields are removed from the topology', async () => {
    const fields = createResolvedFieldRef([
      defineField({
        component: 'input',
        field: 'name',
        schema: z.string().min(2, '姓名至少 2 个字符'),
      }),
    ])

    const form = useForm({ fields })

    await expect(form.validateSingleField('name', 'submit')).resolves.toBe(false)
    expect(form.errors.value.name).toEqual(['Required'])

    fields.value = []
    await nextTick()

    expect(form.getValues()).toEqual({})
    expect(form.errors.value).toEqual({})
  })

  it('skips inactive single-field validation unless the field opts into submit validation', async () => {
    const fields = createResolvedFieldRef([
      defineField({
        field: 'missingValue',
        component: 'input',
        validator: () => '不会校验',
      }),
      defineField({
        field: 'hidden',
        component: 'input',
        defaultValue: 'hidden',
        visible: () => false,
        validator: () => '隐藏字段默认跳过',
      }),
      defineField({
        field: 'disabled',
        component: 'input',
        defaultValue: 'disabled',
        disabled: () => true,
        submitWhenDisabled: false,
        validator: () => '禁用字段默认跳过',
      }),
      defineField({
        field: 'hiddenRequired',
        component: 'input',
        defaultValue: '',
        visible: () => false,
        submitWhenHidden: true,
        validator: () => '隐藏字段提交时校验',
      }),
    ])

    const form = useForm({ fields })

    await expect(form.validateSingleField('unknown', 'submit')).resolves.toBe(true)
    await expect(form.validateSingleField('hidden', 'submit')).resolves.toBe(true)
    await expect(form.validateSingleField('disabled', 'submit')).resolves.toBe(true)
    expect(form.errors.value).toEqual({})

    await expect(form.validateSingleField('hiddenRequired', 'submit')).resolves.toBe(false)
    expect(form.errors.value.hiddenRequired).toEqual(['隐藏字段提交时校验'])

    form.reset()
    expect(form.getValues()).toEqual({
      disabled: 'disabled',
      hidden: 'hidden',
      hiddenRequired: '',
      missingValue: undefined,
    })
    expect(form.errors.value).toEqual({})
  })

  it('propagates validator exceptions without converting them into successful validation', async () => {
    const syncFailure = new Error('sync validator failed')
    const asyncFailure = new Error('async validator failed')
    const fields = createResolvedFieldRef([
      defineField({
        field: 'syncFailure',
        component: 'input',
        validator: () => {
          throw syncFailure
        },
      }),
      defineField({
        field: 'asyncFailure',
        component: 'input',
        validator: async () => {
          throw asyncFailure
        },
      }),
    ])

    const form = useForm({ fields })

    await expect(form.validateSingleField('syncFailure', 'submit')).rejects.toThrow('sync validator failed')
    await expect(form.validateSingleField('asyncFailure', 'submit')).rejects.toThrow('async validator failed')
    expect(form.errors.value).toEqual({})
  })

  it('short-circuits child visible predicates when a parent container is hidden', () => {
    let childVisibleCalls = 0
    const fields = createResolvedFieldRef([
      defineField({
        component: 'section',
        visible: () => false,
        slots: {
          default: defineField({
            component: 'input',
            field: 'secret',
            visible: () => {
              childVisibleCalls += 1
              return true
            },
          }),
        },
      }),
    ])

    const form = useForm({ fields })

    expect(form.isVisible(fields.value[0])).toBe(false)
    expect(childVisibleCalls).toBe(0)
  })

  it('uses field predicates for visibility, disabled, validation skips, and submit output', async () => {
    const fields = createResolvedFieldRef([
      defineField({
        field: 'role',
        component: 'input',
        defaultValue: 'guest',
      }),
      defineField({
        field: 'adminNote',
        component: 'input',
        defaultValue: 'visible for admins',
        submitWhenHidden: false,
        visible: values => values.role === 'admin',
        validator: () => '隐藏时不应校验',
      }),
      defineField({
        field: 'guestNote',
        component: 'input',
        defaultValue: 'disabled for guests',
        disabled: values => values.role === 'guest',
        submitWhenDisabled: false,
        validator: () => '禁用时不应校验',
      }),
    ])
    const onSubmit = vi.fn()

    const form = useForm({ fields, onSubmit })

    expect(form.isVisible(fields.value[1])).toBe(false)
    expect(form.isDisabled(fields.value[2])).toBe(true)

    await expect(form.submit()).resolves.toBe(true)
    expect(onSubmit).toHaveBeenCalledWith({ role: 'guest' })

    form.setValue('role', 'admin')

    expect(form.isVisible(fields.value[1])).toBe(true)
    expect(form.isDisabled(fields.value[2])).toBe(false)

    await expect(form.submit()).resolves.toBe(false)
    expect(form.errors.value.adminNote).toEqual(['隐藏时不应校验'])
    expect(form.errors.value.guestNote).toEqual(['禁用时不应校验'])
  })

  it('uses transformed fields consistently for dynamic state, validation, and submit output', async () => {
    const onSubmit = vi.fn()
    const runtime = createFormRuntime({
      plugins: [
        {
          name: 'submit-policy',
          transformField: (field) => {
            if ((field as NormalizedFieldConfig).field === 'dynamicHidden') {
              return {
                ...field,
                submitWhenHidden: true,
                transform: (value: unknown) => `kept:${String(value)}`,
                visible: false,
              }
            }

            if ((field as NormalizedFieldConfig).field === 'dynamicDisabled') {
              return {
                ...field,
                disabled: true,
                submitWhenDisabled: true,
                validator: () => 'transformed validator',
              }
            }

            return undefined
          },
        },
      ],
    })
    const rawFields: FormNodeConfig[] = [
      defineField({
        component: 'input',
        defaultValue: 'hidden value',
        field: 'dynamicHidden',
      }),
      defineField({
        component: 'input',
        defaultValue: 'disabled value',
        field: 'dynamicDisabled',
      }),
    ]
    const fields = ref<ResolvedFormNode[]>(rawFields.map(field => runtime.transformField(field)) as ResolvedFormNode[])

    const form = useForm({ fields, onSubmit })

    expect(form.isVisible(fields.value[0])).toBe(false)
    expect(form.isDisabled(fields.value[1])).toBe(true)

    await expect(form.submit()).resolves.toBe(false)
    expect(form.errors.value.dynamicDisabled).toEqual(['transformed validator'])

    fields.value = [
      rawFields[0],
      defineField({
        component: 'input',
        defaultValue: 'active value',
        field: 'active',
      }),
    ].map(field => runtime.transformField(field)) as ResolvedFormNode[]
    await nextTick()

    await expect(form.submit()).resolves.toBe(true)
    expect(onSubmit).toHaveBeenCalledWith({
      active: 'active value',
      dynamicHidden: 'kept:hidden value',
    })
  })
})
