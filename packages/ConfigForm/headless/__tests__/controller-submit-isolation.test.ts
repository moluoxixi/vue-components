import type { ConfigFormController, ConfigFormControllerOptions, ConfigFormLifecycleKind } from '../index'
import { describe, expect, it, vi } from 'vitest'
import { createConfigFormController } from '../index'

type Values = { name: string }
type Boundary = 'reset' | 'clear' | 'clear instance' | 'schema' | 'dispose'

function fixture(options: Partial<ConfigFormControllerOptions<Values>> = {}) {
  let values: Values = { name: 'unchanged' }
  const onSubmit = vi.fn()
  const onError = vi.fn()
  const onDiagnostic = vi.fn()
  const controller = createConfigFormController<Values>({
    model: { read: () => values, write: next => values = next },
    fields: () => [{ id: 'name', field: 'name', component: 'input', required: true }],
    onSubmit, onError, onDiagnostic,
    ...options,
  })
  return { controller, onSubmit, onError, onDiagnostic }
}

function cancel(controller: ConfigFormController<Values>, boundary: Boundary): void {
  if (boundary === 'reset') void controller.resetFields()
  if (boundary === 'clear') controller.clearValidate()
  if (boundary === 'clear instance') controller.clearInstanceValidate({ nodeId: 'name', scope: [] })
  if (boundary === 'schema') controller.updateValueSchema({
    valueScopes: [], scopedFields: [{ nodeId: 'name', field: 'name' }],
  })
  if (boundary === 'dispose') controller.dispose()
}

const boundaries: Boundary[] = ['reset', 'clear', 'clear instance', 'schema', 'dispose']

describe('Headless submit operation isolation', () => {
  it.each(boundaries)('rejects a same-value %s inside onValidatingChange(false)', async (boundary) => {
    let once = true
    const { controller, onSubmit, onError } = fixture({
      onValidatingChange: (validating) => {
        if (!validating && once) {
          once = false
          cancel(controller, boundary)
        }
      },
    })
    await expect(controller.submit()).resolves.toBe(false)
    expect(controller.getValues()).toEqual({ name: 'unchanged' })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(controller.getValidating()).toBe(false)
    if (boundary !== 'dispose') {
      await expect(controller.submit()).resolves.toBe(true)
      expect(onSubmit).toHaveBeenCalledOnce()
    }
  })

  it.each(boundaries)('rejects %s queued in the validation completion microtask', async (boundary) => {
    let once = true
    const { controller, onSubmit } = fixture({
      onValidatingChange: (validating) => {
        if (!validating && once) {
          once = false
          queueMicrotask(() => cancel(controller, boundary))
        }
      },
    })
    await expect(controller.submit()).resolves.toBe(false)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(controller.getValues()).toEqual({ name: 'unchanged' })
  })

  it.each(['form.beforeSubmit', 'form.validationSuccess', 'form.submit'] as const)(
    'rejects reset from %s even when reset restores the same values', async (kind) => {
      let once = true
      const { controller, onSubmit } = fixture({
        onLifecycle: (current) => {
          if (current === kind && once) {
            once = false
            void controller.resetFields()
          }
        },
      })
      await expect(controller.submit()).resolves.toBe(false)
      expect(onSubmit).not.toHaveBeenCalled()
      await expect(controller.submit()).resolves.toBe(true)
      expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ name: 'unchanged' })
    },
  )

  const pendingCases: Array<[ConfigFormLifecycleKind, Boundary]> = [
    ['form.beforeSubmit', 'reset'], ['form.validationSuccess', 'reset'], ['form.submit', 'reset'],
    ['form.beforeSubmit', 'clear'], ['form.validationSuccess', 'clear instance'],
    ['form.submit', 'schema'], ['form.beforeSubmit', 'dispose'],
  ]
  it.each(pendingCases)('settles a permanent %s hook on %s and releases the submit lock', async (kind, boundary) => {
    let started!: () => void
    const entered = new Promise<void>(resolve => started = resolve)
    let first = true
    let signal!: AbortSignal
    const { controller, onSubmit, onDiagnostic } = fixture({
      onLifecycle: (current, context) => {
        if (current !== kind || !first) return
        first = false
        signal = context.signal
        started()
        return new Promise<void>(() => {})
      },
    })
    const pending = controller.submit()
    await entered
    expect(signal.aborted).toBe(false)
    await expect(controller.submit()).resolves.toBe(false)
    cancel(controller, boundary)
    expect(signal.aborted).toBe(true)
    await expect(pending).resolves.toBe(false)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onDiagnostic).not.toHaveBeenCalled()
    if (boundary !== 'dispose') {
      await expect(controller.submit()).resolves.toBe(true)
      expect(onSubmit).toHaveBeenCalledOnce()
    }
  })

  it.each(boundaries)('releases the lock after %s cancels an abort-ignoring permanent validator', async (boundary) => {
    let first = true
    const { controller, onSubmit } = fixture({ fields: () => [{
      id: 'name', field: 'name', component: 'input',
      validator: () => {
        if (!first) return undefined
        first = false
        return new Promise<string>(() => {})
      },
    }] })
    const pending = controller.submit()
    expect(controller.getValidating()).toBe(true)
    cancel(controller, boundary)
    await expect(pending).resolves.toBe(false)
    expect(controller.getValidating()).toBe(false)
    expect(onSubmit).not.toHaveBeenCalled()
    if (boundary !== 'dispose') {
      await expect(controller.submit()).resolves.toBe(true)
      expect(onSubmit).toHaveBeenCalledOnce()
    }
  })

  it('checks lifetime again after touched notifications and transforms', async () => {
    let resetOnTouched = true
    const { controller, onSubmit } = fixture({
      onMetaChange: (meta) => {
        if (meta.touched && resetOnTouched) {
          resetOnTouched = false
          void controller.resetFields()
        }
      },
    })
    await expect(controller.submit()).resolves.toBe(false)
    expect(onSubmit).not.toHaveBeenCalled()
    let transformOnce = true
    const transformed = fixture({ fields: () => [{
      id: 'name', field: 'name', component: 'input',
      transform: (value) => {
        if (transformOnce) {
          transformOnce = false
          void transformed.controller.resetFields()
        }
        return value
      },
    }] })
    await expect(transformed.controller.submit()).resolves.toBe(false)
    expect(transformed.onSubmit).not.toHaveBeenCalled()
  })
})
