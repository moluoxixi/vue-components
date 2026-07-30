import type { FormValueChange } from '../state'
import type { FormErrors, FormNodeConfig, FormValues, NormalizedFieldConfig, ResolvedFormNode } from '@/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, toRaw } from 'vue'
import { createFormRuntime } from '@/runtime/createFormRuntime'
import { collectFieldConfigs } from '@/utils/node'
import { useForm } from '../index'
import { useFormState } from '../state'
import { createNodeTopology } from '../topology'
import { appendValidationListeners, useFormValidation } from '../validation'

function resolveFields(fields: FormNodeConfig[]): ResolvedFormNode[] {
  const runtime = createFormRuntime()
  return fields.map(field => runtime.transformField(field))
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useForm performance invariants', () => {
  it('does no validation or visibility work for a submit-only change in 1000 fields', async () => {
    vi.useFakeTimers()
    const targetValidator = vi.fn(() => undefined)
    const visibilityPredicates = Array.from({ length: 1000 }, () => vi.fn(() => true))
    const fields = visibilityPredicates.map((visible, index): FormNodeConfig => ({
      component: 'input',
      field: `field-${index}`,
      validator: index === 500 ? targetValidator : undefined,
      visible,
    }))
    const form = useForm({ fields: ref(resolveFields(fields)) })

    await expect(form.validateSingleField('field-500', 'change')).resolves.toBe(true)

    expect(targetValidator).not.toHaveBeenCalled()
    expect(visibilityPredicates[500]).toHaveBeenCalledTimes(1)
    expect(visibilityPredicates.filter((_, index) => index !== 500).every(predicate => predicate.mock.calls.length === 0)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('coalesces 100 rapid requests into one validator execution', async () => {
    vi.useFakeTimers()
    const validator = vi.fn(() => undefined)
    const form = useForm({
      fields: ref(resolveFields([{
        component: 'input',
        field: 'keyword',
        validateOn: ['submit', 'change'],
        validator,
      }])),
    })

    const results = Array.from({ length: 100 }, () => form.validateSingleField('keyword', 'change'))
    await vi.advanceTimersByTimeAsync(16)

    await expect(Promise.all(results)).resolves.toEqual(Array.from({ length: 100 }).fill(true))
    expect(validator).toHaveBeenCalledTimes(1)
  })

  it('copies large values once while coalescing 100 changed-value requests', async () => {
    vi.useFakeTimers()
    const valuesTarget = Object.fromEntries(
      Array.from({ length: 999 }, (_, index) => [`other-${index}`, index]),
    ) as FormValues
    valuesTarget.keyword = ''
    let snapshotEnumerations = 0
    const values = new Proxy(valuesTarget, {
      ownKeys(target) {
        snapshotEnumerations += 1
        return Reflect.ownKeys(target)
      },
    })
    let valuesRevision = 0
    const changes: FormValueChange[] = []
    const validator = vi.fn((_value: unknown, values: Record<string, unknown>) => {
      return values['other-998'] === 998 ? undefined : 'snapshot mismatch'
    })
    const field = resolveFields([{
      component: 'input',
      field: 'keyword',
      validateOn: ['submit', 'change'],
      validator,
    }])[0] as NormalizedFieldConfig
    const errors = ref<FormErrors>({})
    const validation = useFormValidation({
      clearFieldError: () => {
        errors.value = {}
      },
      errors,
      fieldConfigMap: computed(() => new Map([['keyword', field]])),
      fields: computed(() => [field]),
      getFieldRevision: () => valuesRevision,
      getValueChangesSince: revision => changes.filter(change => change.revision > revision),
      getValuesRevision: () => valuesRevision,
      nodeTopology: computed(() => createNodeTopology([field as ResolvedFormNode])),
      setValueChangeRetention: () => {},
      values,
    })

    const requests = Array.from({ length: 100 }, (_, index) => {
      const value = String(index)
      values.keyword = value
      valuesRevision += 1
      changes.push({
        fieldName: 'keyword',
        present: true,
        requiresFullSnapshot: false,
        revision: valuesRevision,
        value,
      })
      return validation.validateSingleField('keyword', 'change')
    })
    await vi.advanceTimersByTimeAsync(16)

    await expect(Promise.all(requests)).resolves.toEqual(Array.from({ length: 100 }).fill(true))
    expect(validator).toHaveBeenCalledTimes(1)
    expect(validator.mock.calls[0][0]).toBe('99')
    expect(snapshotEnumerations).toBeLessThanOrEqual(3)
  })

  it('does not rescan every value descriptor for each field in a large submit', async () => {
    const fieldCount = 500
    const fields = resolveFields(Array.from({ length: fieldCount }, (_, index) => ({
      component: 'input',
      field: `field-${index}`,
    }))) as NormalizedFieldConfig[]
    const valuesTarget = Object.fromEntries(
      fields.map((field, index) => [field.field, index]),
    ) as FormValues
    let valueEnumerations = 0
    const values = new Proxy(valuesTarget, {
      ownKeys(target) {
        valueEnumerations += 1
        return Reflect.ownKeys(target)
      },
    })
    const errors = ref<FormErrors>({})
    const validation = useFormValidation({
      clearFieldError: () => {},
      errors,
      fieldConfigMap: computed(() => new Map(fields.map(field => [field.field, field]))),
      fields: computed(() => fields),
      getFieldRevision: () => 0,
      getValueChangesSince: () => [],
      getValuesRevision: () => 0,
      nodeTopology: computed(() => createNodeTopology(fields as ResolvedFormNode[])),
      setValueChangeRetention: () => {},
      values,
    })

    await expect(validation.validate()).resolves.toBe(true)
    expect(valueEnumerations).toBeLessThanOrEqual(2)
  })

  it('retains only the journal suffix required by pending validation', () => {
    const state = useFormState({ fields: ref([]) })
    const baseRevision = state.getValuesRevision()
    state.setValueChangeRetention(baseRevision)
    const arrayFilter = vi.spyOn(Array.prototype, 'filter')
    try {
      for (let index = 0; index < 100; index += 1) {
        state.setValue('field-b', index)
        const currentRevision = state.getValuesRevision()
        const latestChanges = state.getValueChangesSince(currentRevision - 1)
        expect(latestChanges).toHaveLength(1)
        expect(latestChanges?.[0].value).toBe(index)
      }
      expect(state.getValueChangesSince(baseRevision)).toHaveLength(100)
      expect(arrayFilter).not.toHaveBeenCalled()
    }
    finally {
      arrayFilter.mockRestore()
    }
  })

  it('does not retain direct writes while no pending snapshot consumes the journal', () => {
    const state = useFormState({ fields: ref([]) })
    const idleRevision = state.getValuesRevision()

    for (let index = 0; index < 2000; index += 1)
      state.values.keyword = index

    expect(state.getValueChangesSince(idleRevision)).toBeUndefined()

    const retainedRevision = state.getValuesRevision()
    state.setValueChangeRetention(retainedRevision)
    state.values.keyword = 'pending'
    expect(state.getValueChangesSince(retainedRevision)).toMatchObject([
      { fieldName: 'keyword', present: true, value: 'pending' },
    ])

    state.setValueChangeRetention(undefined)
    const releasedRevision = state.getValuesRevision()
    state.values.keyword = 'idle again'
    expect(state.getValueChangesSince(releasedRevision)).toBeUndefined()
  })

  it('releases retention after an accessor snapshot performs a reentrant write', async () => {
    vi.useFakeTimers()
    const snapshots: Array<Record<string, unknown>> = []
    const validator = vi.fn((_value: unknown, values: Record<string, unknown>) => {
      snapshots.push({ ...values })
      return undefined
    })
    const field = resolveFields([{
      component: 'input',
      field: 'keyword',
      validateOn: ['submit', 'change'],
      validator,
    }])[0] as NormalizedFieldConfig
    const state = useFormState({
      defaultValues: { audit: 0, keyword: '', role: 'reader' },
      fields: ref([field]),
    })
    const validation = useFormValidation({
      clearFieldError: state.clearFieldError,
      errors: state.errors,
      fieldConfigMap: computed(() => new Map([['keyword', field]])),
      fields: computed(() => [field]),
      getFieldRevision: state.getFieldRevision,
      getValueChangesSince: state.getValueChangesSince,
      getValuesRevision: state.getValuesRevision,
      nodeTopology: computed(() => createNodeTopology([field as ResolvedFormNode])),
      setValueChangeRetention: state.setValueChangeRetention,
      values: state.values,
    })

    const first = validation.validateSingleField('keyword', 'change')
    Object.defineProperty(toRaw(state.values), 'role', {
      configurable: true,
      enumerable: true,
      get() {
        state.values.audit = Number(state.values.audit) + 1
        return 'reader'
      },
    })
    const second = validation.validateSingleField('keyword', 'change')
    await vi.advanceTimersByTimeAsync(16)

    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)
    expect(validator).toHaveBeenCalledTimes(1)
    expect(snapshots).toEqual([{ audit: 1, keyword: '', role: 'reader' }])

    const completedRevision = state.getValuesRevision()
    state.values.idle = true
    expect(state.getValueChangesSince(completedRevision)).toBeUndefined()
  })

  it('drains a large multi-revision non-merge queue and releases every journal cursor', async () => {
    vi.useFakeTimers()
    const validator = vi.fn(() => undefined)
    const field = resolveFields([{
      component: 'input',
      field: 'keyword',
      validateOn: ['submit', 'change', 'blur'],
      validator,
    }])[0] as NormalizedFieldConfig
    const errors = ref<FormErrors>({})
    const values = { keyword: '' }
    let valuesRevision = 0
    const retentionRevisions: Array<number | undefined> = []
    const validation = useFormValidation({
      clearFieldError: () => {},
      errors,
      fieldConfigMap: computed(() => new Map([['keyword', field]])),
      fields: computed(() => [field]),
      getFieldRevision: () => valuesRevision,
      getValueChangesSince: () => [],
      getValuesRevision: () => valuesRevision,
      nodeTopology: computed(() => createNodeTopology([field as ResolvedFormNode])),
      setValueChangeRetention: revision => retentionRevisions.push(revision),
      values,
    })

    const requests: Promise<boolean>[] = []
    for (let index = 0; index < 2048; index += 1) {
      values.keyword = String(index)
      valuesRevision += 1
      requests.push(validation.validateSingleField(
        'keyword',
        index % 2 === 0 ? 'change' : 'blur',
      ))
    }

    expect(retentionRevisions).toHaveLength(2048)
    expect(retentionRevisions.every(revision => revision === 1)).toBe(true)

    await vi.runAllTimersAsync()
    await expect(Promise.all(requests)).resolves.toEqual(Array.from({ length: 2048 }).fill(true))
    expect(validator).toHaveBeenCalledTimes(2048)
    expect(retentionRevisions).toContain(2048)
    expect(retentionRevisions.at(-1)).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reuses the listener array while appending merged callers', () => {
    const listeners = [{ id: 1 }]
    const merged = appendValidationListeners(listeners, [{ id: 2 }, { id: 3 }])

    expect(merged).toBe(listeners)
    expect(merged).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
  })

  it('evaluates field collection and topology once during initialization', () => {
    const resolved = resolveFields([{ component: 'input', field: 'name' }])
    let rootTraversalCount = 0
    const instrumented = new Proxy(resolved, {
      get(target, key, receiver) {
        if (key === 'flatMap' || key === 'forEach')
          rootTraversalCount += 1
        return Reflect.get(target, key, receiver)
      },
    })
    const form = useForm({ fields: ref(instrumented) })

    form.isVisible(resolved[0])
    expect(rootTraversalCount).toBe(2)
  })

  it.each([50, 200, 1000])('collects a %i-level slot chain with linear intermediate copying', (depth) => {
    const renderSlot = vi.fn()
    let root: FormNodeConfig | undefined

    for (let index = depth - 1; index >= 0; index -= 1) {
      const node: FormNodeConfig = index % 5 === 0
        ? { component: 'section', id: `container-${index}` }
        : { component: 'input', field: `field-${index}` }
      node.slots = {
        ...(root === undefined
          ? {}
          : { default: index % 2 === 0 ? root : [root] }),
        helper: renderSlot,
      }
      root = node
    }

    if (!root)
      throw new Error('Expected a root field fixture')

    const flatMap = vi.spyOn(Array.prototype, 'flatMap')
    let fields: ReturnType<typeof collectFieldConfigs>
    let copiedElements = 0
    try {
      fields = collectFieldConfigs([root])
      copiedElements = flatMap.mock.results.reduce((total, result) => {
        return result.type === 'return' && Array.isArray(result.value)
          ? total + result.value.length
          : total
      }, 0)
    }
    finally {
      flatMap.mockRestore()
    }

    const expectedFields = Array.from({ length: depth }, (_, index) => index)
      .filter(index => index % 5 !== 0)
      .map(index => `field-${index}`)
    expect(fields.map(field => field.field)).toEqual(expectedFields)
    expect(copiedElements).toBeLessThanOrEqual(depth * 4)
    expect(renderSlot).not.toHaveBeenCalled()
  })
})
