import type { ConfigFormExpose, ResolvedFormNode } from '@/types'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h, markRaw, nextTick, ref, toRaw } from 'vue'
import ConfigForm from '@/index.vue'
import { createFormRuntime } from '@/runtime/createFormRuntime'
import { useForm } from '../index'

function resolveFields(fields: Parameters<ReturnType<typeof createFormRuntime>['transformField']>[0][]): ResolvedFormNode[] {
  const runtime = createFormRuntime()
  return fields.map(field => runtime.transformField(field))
}

afterEach(() => {
  vi.useRealTimers()
})

describe('field validation lifecycle', () => {
  it.each(['change', 'blur'] as const)('skips queue allocation for excluded %s triggers', async (trigger) => {
    vi.useFakeTimers()
    const visible = vi.fn(() => true)
    const validator = vi.fn(() => '不应执行')
    const form = useForm({
      fields: ref(resolveFields([{
        component: 'input',
        field: 'name',
        validator,
        visible,
      }])),
    })

    await expect(form.validateSingleField('name', trigger)).resolves.toBe(true)
    expect(visible).toHaveBeenCalledTimes(1)
    expect(validator).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves state-based stale error cleanup during trigger preflight', async () => {
    for (const trigger of ['change', 'blur'] as const) {
      for (const state of [
        { disabled: true },
        { hidden: true },
        { readonly: true },
        { visible: false },
      ]) {
        const form = useForm({
          fields: ref(resolveFields([{
            component: 'input',
            field: 'name',
            validator: () => '错误',
            ...state,
          }])),
        })
        form.errors.value = { name: ['旧错误'] }

        await expect(form.validateSingleField('name', trigger)).resolves.toBe(true)
        expect(form.errors.value).toEqual({})
      }
    }
  })

  it('clears stale errors immediately when a field no longer has rules', async () => {
    const form = useForm({
      fields: ref(resolveFields([{
        component: 'input',
        field: 'name',
      }])),
    })
    form.errors.value = { name: ['旧错误'] }

    await expect(form.validateSingleField('name', 'change')).resolves.toBe(true)
    expect(form.errors.value).toEqual({})
  })

  it.each(['change', 'blur'] as const)('checks only the target parent chain for %s visibility', async (trigger) => {
    vi.useFakeTimers()
    const parentVisible = vi.fn(() => true)
    const unrelatedVisible = vi.fn(() => true)
    const validator = vi.fn(() => undefined)
    const form = useForm({
      fields: ref(resolveFields([
        {
          component: 'section',
          slots: {
            default: {
              component: 'input',
              field: 'target',
              validateOn: ['submit', trigger],
              validator,
            },
          },
          visible: parentVisible,
        },
        {
          component: 'input',
          field: 'unrelated',
          validateOn: ['submit', 'change'],
          validator: () => undefined,
          visible: unrelatedVisible,
        },
      ])),
    })

    const result = form.validateSingleField('target', trigger)
    await vi.advanceTimersByTimeAsync(16)

    await expect(result).resolves.toBe(true)
    expect(parentVisible).toHaveBeenCalledTimes(1)
    expect(unrelatedVisible).not.toHaveBeenCalled()
    expect(validator).toHaveBeenCalledTimes(1)
  })

  it('rejects pending validation and cancels its timer when the scope stops', async () => {
    vi.useFakeTimers()
    const validator = vi.fn(() => undefined)
    const scope = effectScope()
    let form!: ReturnType<typeof useForm>
    scope.run(() => {
      form = useForm({
        fields: ref(resolveFields([{
          component: 'input',
          field: 'name',
          validateOn: ['submit', 'change'],
          validator,
        }])),
      })
    })

    const pending = form.validateSingleField('name', 'change')
    scope.stop()

    await expect(pending).rejects.toMatchObject({ code: 'CONFIG_FORM_VALIDATION_DISPOSED' })
    expect(vi.getTimerCount()).toBe(0)
    await vi.runAllTimersAsync()
    expect(validator).not.toHaveBeenCalled()
  })

  it('rejects active validation and ignores its eventual result after scope disposal', async () => {
    vi.useFakeTimers()
    let resolveValidator!: (value: string | undefined) => void
    const validator = vi.fn(() => new Promise<string | undefined>((resolve) => {
      resolveValidator = resolve
    }))
    const scope = effectScope()
    let form!: ReturnType<typeof useForm>
    scope.run(() => {
      form = useForm({
        fields: ref(resolveFields([{
          component: 'input',
          field: 'name',
          validateOn: ['submit', 'change'],
          validator,
        }])),
      })
    })

    const active = form.validateSingleField('name', 'change')
    await vi.advanceTimersByTimeAsync(16)
    expect(validator).toHaveBeenCalledTimes(1)

    scope.stop()
    await expect(active).rejects.toMatchObject({ code: 'CONFIG_FORM_VALIDATION_DISPOSED' })

    resolveValidator('迟到错误')
    await Promise.resolve()
    await Promise.resolve()
    expect(form.errors.value).toEqual({})
  })

  it('rejects active and merged pending listeners when the scope stops', async () => {
    vi.useFakeTimers()
    let resolveValidator!: (value: string | undefined) => void
    const validator = vi.fn(() => new Promise<string | undefined>((resolve) => {
      resolveValidator = resolve
    }))
    const scope = effectScope()
    let form!: ReturnType<typeof useForm>
    scope.run(() => {
      form = useForm({
        fields: ref(resolveFields([{
          component: 'input',
          field: 'name',
          validateOn: ['submit', 'change'],
          validator,
        }])),
      })
    })

    const active = form.validateSingleField('name', 'change')
    await vi.advanceTimersByTimeAsync(16)
    const pendingA = form.validateSingleField('name', 'change')
    const pendingB = form.validateSingleField('name', 'change')

    scope.stop()
    const results = await Promise.allSettled([active, pendingA, pendingB])

    expect(results).toHaveLength(3)
    for (const result of results) {
      expect(result.status).toBe('rejected')
      if (result.status === 'rejected')
        expect(result.reason).toMatchObject({ code: 'CONFIG_FORM_VALIDATION_DISPOSED' })
    }
    expect(vi.getTimerCount()).toBe(0)

    resolveValidator('迟到错误')
    await Promise.resolve()
    await Promise.resolve()
    expect(form.errors.value).toEqual({})
  })

  it('rejects validation and submit after an empty form scope is disposed', async () => {
    const onSubmit = vi.fn()
    const scope = effectScope()
    let form!: ReturnType<typeof useForm>
    scope.run(() => {
      form = useForm({
        fields: ref([]),
        onSubmit,
      })
    })

    scope.stop()

    await expect(form.validate()).rejects.toMatchObject({ code: 'CONFIG_FORM_VALIDATION_DISPOSED' })
    await expect(form.submit()).rejects.toMatchObject({ code: 'CONFIG_FORM_VALIDATION_DISPOSED' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects in-flight validation and submit when an empty form scope is disposed', async () => {
    const onSubmit = vi.fn()
    const scope = effectScope()
    let form!: ReturnType<typeof useForm>
    scope.run(() => {
      form = useForm({
        fields: ref([]),
        onSubmit,
      })
    })

    const validation = expect(form.validate())
      .rejects
      .toMatchObject({ code: 'CONFIG_FORM_VALIDATION_DISPOSED' })
    const submission = expect(form.submit())
      .rejects
      .toMatchObject({ code: 'CONFIG_FORM_VALIDATION_DISPOSED' })
    scope.stop()

    await validation
    await submission
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not write an active validation result after the field value changes', async () => {
    vi.useFakeTimers()
    let resolveValidator!: (value: string | undefined) => void
    const form = useForm({
      defaultValues: { name: 'old' },
      fields: ref(resolveFields([{
        component: 'input',
        field: 'name',
        validateOn: ['submit', 'change'],
        validator: () => new Promise<string | undefined>((resolve) => {
          resolveValidator = resolve
        }),
      }])),
    })

    const active = form.validateSingleField('name', 'change')
    await vi.advanceTimersByTimeAsync(16)
    form.setValue('name', 'new')
    resolveValidator('旧值错误')

    await expect(active).resolves.toBe(true)
    expect(form.errors.value).toEqual({})
  })

  it('does not write an active validation result after the field is removed', async () => {
    vi.useFakeTimers()
    let resolveValidator!: (value: string | undefined) => void
    const fields = ref(resolveFields([{
      component: 'input',
      field: 'name',
      validateOn: ['submit', 'change'],
      validator: () => new Promise<string | undefined>((resolve) => {
        resolveValidator = resolve
      }),
    }]))
    const form = useForm({ fields })

    const active = form.validateSingleField('name', 'change')
    await vi.advanceTimersByTimeAsync(16)
    fields.value = []
    await nextTick()
    resolveValidator('已删除字段错误')

    await expect(active).resolves.toBe(true)
    expect(form.errors.value).toEqual({})
  })

  it('keeps submit snapshots separate from later change requests', async () => {
    vi.useFakeTimers()
    let resolveFirst!: (value: string | undefined) => void
    let calls = 0
    const submitted = vi.fn()
    const validator = vi.fn((value: unknown) => {
      calls += 1
      if (calls === 1) {
        return new Promise<string | undefined>((resolve) => {
          resolveFirst = resolve
        })
      }
      return value === 'first' ? 'first is invalid' : undefined
    })
    const form = useForm({
      defaultValues: { name: 'first' },
      fields: ref(resolveFields([{
        component: 'input',
        field: 'name',
        validateOn: ['submit', 'change'],
        validator,
      }])),
      onSubmit: submitted,
    })

    const activeChange = form.validateSingleField('name', 'change')
    await vi.advanceTimersByTimeAsync(16)
    const submit = form.submit()
    form.setValue('name', 'second')
    const latestChange = form.validateSingleField('name', 'change')

    resolveFirst(undefined)
    await vi.runAllTimersAsync()

    await expect(activeChange).resolves.toBe(true)
    await expect(submit).resolves.toBe(false)
    await expect(latestChange).resolves.toBe(true)
    expect(submitted).not.toHaveBeenCalled()
    expect(validator.mock.calls.map(([value]) => value)).toEqual(['first', 'first', 'second'])
  })

  it('incrementally refreshes merged snapshots after cross-field and direct writes', async () => {
    vi.useFakeTimers()
    const snapshots: Array<Record<string, unknown>> = []
    const form = useForm({
      defaultValues: { name: 'first', role: 'reader' },
      fields: ref(resolveFields([{
        component: 'input',
        field: 'name',
        validateOn: ['submit', 'change'],
        validator: (_value, values) => {
          snapshots.push({ ...values })
          return undefined
        },
      }])),
    })

    const first = form.validateSingleField('name', 'change')
    form.values.role = 'admin'
    form.setValue('name', 'second')
    const second = form.validateSingleField('name', 'change')
    await vi.advanceTimersByTimeAsync(16)

    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)
    expect(snapshots).toEqual([{ name: 'second', role: 'admin' }])
  })

  it('falls back to full snapshots when an enumerable accessor can change externally', async () => {
    vi.useFakeTimers()
    let role = 'reader'
    const snapshots: Array<Record<string, unknown>> = []
    const form = useForm({
      defaultValues: { name: 'first', role },
      fields: ref(resolveFields([{
        component: 'input',
        field: 'name',
        validateOn: ['submit', 'change'],
        validator: (_value, values) => {
          snapshots.push({ ...values })
          return undefined
        },
      }])),
    })
    const first = form.validateSingleField('name', 'change')
    Object.defineProperty(toRaw(form.values), 'role', {
      configurable: true,
      enumerable: true,
      get: () => role,
    })
    const second = form.validateSingleField('name', 'change')
    role = 'admin'
    const third = form.validateSingleField('name', 'change')
    await vi.advanceTimersByTimeAsync(16)

    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)
    await expect(third).resolves.toBe(true)
    expect(snapshots).toEqual([{ name: 'first', role: 'admin' }])
  })

  it('keeps non-enumerable data properties out of incrementally refreshed snapshots', async () => {
    vi.useFakeTimers()
    const snapshots: Array<Record<string, unknown>> = []
    const form = useForm({
      defaultValues: { name: 'first' },
      fields: ref(resolveFields([{
        component: 'input',
        field: 'name',
        validateOn: ['submit', 'change'],
        validator: (_value, values) => {
          snapshots.push({ ...values })
          return undefined
        },
      }])),
    })
    const rawValues = toRaw(form.values)
    Object.defineProperty(rawValues, 'internal', {
      configurable: true,
      enumerable: false,
      value: 'old',
      writable: true,
    })

    const first = form.validateSingleField('name', 'change')
    rawValues.internal = 'new'
    const second = form.validateSingleField('name', 'change')
    await vi.advanceTimersByTimeAsync(16)

    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)
    expect(snapshots).toEqual([{ name: 'first' }])
  })

  it('does not refresh a pending snapshot without a later validation call', async () => {
    vi.useFakeTimers()
    const snapshots: Array<Record<string, unknown>> = []
    const form = useForm({
      defaultValues: { name: 'first', role: 'reader' },
      fields: ref(resolveFields([{
        component: 'input',
        field: 'name',
        validateOn: ['submit', 'change'],
        validator: (_value, values) => {
          snapshots.push({ ...values })
          return undefined
        },
      }])),
    })

    const validation = form.validateSingleField('name', 'change')
    form.values.role = 'admin'
    await vi.advanceTimersByTimeAsync(16)

    await expect(validation).resolves.toBe(true)
    expect(snapshots).toEqual([{ name: 'first', role: 'reader' }])
  })

  it('keeps a form validation result isolated from later field validation', async () => {
    vi.useFakeTimers()
    let resolveSlow!: (value: string | undefined) => void
    const onError = vi.fn()
    const fastValidator = vi.fn((value: unknown) => value === 'bad' ? 'fast error' : undefined)
    const slowValidator = vi.fn(() => new Promise<string | undefined>((resolve) => {
      resolveSlow = resolve
    }))
    const form = useForm({
      defaultValues: { fast: 'bad', slow: 'bad' },
      fields: ref(resolveFields([
        {
          component: 'input',
          field: 'fast',
          validateOn: ['submit', 'change'],
          validator: fastValidator,
        },
        {
          component: 'input',
          field: 'slow',
          validator: slowValidator,
        },
      ])),
      onError,
    })

    const firstValidation = form.validate()
    expect(fastValidator).toHaveBeenCalledWith('bad', { fast: 'bad', slow: 'bad' })
    expect(slowValidator).toHaveBeenCalledTimes(1)

    form.setValue('fast', 'good')
    const latestFieldValidation = form.validateSingleField('fast', 'change')
    await vi.advanceTimersByTimeAsync(16)
    await expect(latestFieldValidation).resolves.toBe(true)

    resolveSlow('slow error')
    await expect(firstValidation).resolves.toBe(false)

    expect(onError).toHaveBeenCalledWith({
      fast: ['fast error'],
      slow: ['slow error'],
    })
    expect(form.errors.value).toEqual({ slow: ['slow error'] })
  })

  it('keeps submit error ownership when a later excluded trigger does no work', async () => {
    let resolveValidator!: (value: string | undefined) => void
    const form = useForm({
      fields: ref(resolveFields([{
        component: 'input',
        field: 'name',
        validator: () => new Promise<string | undefined>((resolve) => {
          resolveValidator = resolve
        }),
      }])),
    })

    const submitValidation = form.validate()
    await expect(form.validateSingleField('name', 'blur')).resolves.toBe(true)

    resolveValidator('submit error')
    await expect(submitValidation).resolves.toBe(false)
    expect(form.errors.value).toEqual({ name: ['submit error'] })
  })

  it('recovers after a submit visibility resolver throws', async () => {
    let shouldThrow = true
    const form = useForm({
      fields: ref(resolveFields([{
        component: 'input',
        field: 'name',
        validator: () => 'field error',
        visible: () => {
          if (shouldThrow)
            throw new Error('visibility unavailable')
          return true
        },
      }])),
    })

    await expect(form.validate()).rejects.toThrow('visibility unavailable')

    shouldThrow = false
    await expect(form.validate()).resolves.toBe(false)
    expect(form.errors.value).toEqual({ name: ['field error'] })
  })

  it('clears errors for an empty-string field key without clearing other fields', async () => {
    vi.useFakeTimers()
    const form = useForm({
      defaultValues: { '': 'bad', 'other': 'bad' },
      fields: ref(resolveFields([
        {
          component: 'input',
          field: '',
          validateOn: ['submit', 'change'],
          validator: value => value === 'bad' ? 'empty-key error' : undefined,
        },
        {
          component: 'input',
          field: 'other',
          validator: () => 'other error',
        },
      ])),
    })

    await expect(form.validate()).resolves.toBe(false)
    expect(form.errors.value).toEqual({
      '': ['empty-key error'],
      'other': ['other error'],
    })

    form.setValue('', 'good')
    expect(form.errors.value).toEqual({ other: ['other error'] })

    const emptyFieldValidation = form.validateSingleField('', 'change')
    await vi.advanceTimersByTimeAsync(16)
    await expect(emptyFieldValidation).resolves.toBe(true)
    expect(form.errors.value).toEqual({ other: ['other error'] })
  })

  it('does not report normal component disposal through Vue error handling', async () => {
    vi.useFakeTimers()
    const errorHandler = vi.fn()
    const Input = markRaw(defineComponent({
      emits: ['update:modelValue'],
      setup(_props, { emit }) {
        return () => h('button', {
          onClick: () => emit('update:modelValue', 'next'),
        }, 'change')
      },
    }))
    const wrapper = mount(ConfigForm, {
      global: {
        config: { errorHandler },
      },
      props: {
        fields: [{
          component: Input,
          field: 'name',
          validateOn: ['submit', 'change'],
          validator: () => undefined,
        }],
      },
    })
    const api = wrapper.vm as unknown as ConfigFormExpose<Record<string, unknown>>

    const interaction = wrapper.get('button').trigger('click')
    wrapper.unmount()
    await interaction
    await Promise.resolve()

    expect(errorHandler).not.toHaveBeenCalled()
    expect(api.getValues()).toEqual({ name: 'next' })
  })
})
