import type {
  ConfigFormController,
  ConfigFormControllerDiagnostic,
  ConfigFormLifecycleKind,
} from '../index'
import { describe, expect, it, vi } from 'vitest'
import { createConfigFormController } from '../index'

interface LifecycleValues {
  name: string
  nested?: { label: string }
}

function createModel<T extends object>(initial: T) {
  let value = initial
  return {
    adapter: {
      read: () => value,
      write: (next: T) => value = next,
    },
    read: () => value,
  }
}

describe('configForm controller lifecycle', () => {
  it('runs successful and failed validation lifecycles in submit order', async () => {
    const validModel = createModel<LifecycleValues>({ name: 'Ada' })
    const order: string[] = []
    const valid = createConfigFormController<LifecycleValues>({
      fields: () => [{ component: 'input', field: 'name', id: 'name', required: true }],
      model: validModel.adapter,
      onLifecycle: async (kind) => { order.push(kind) },
      onSubmit: async () => order.push('host.submit'),
    })

    await expect(valid.submit()).resolves.toBe(true)
    expect(order).toEqual([
      'form.beforeSubmit',
      'form.validationSuccess',
      'form.submit',
      'host.submit',
    ])

    const invalidModel = createModel<LifecycleValues>({ name: '' })
    const invalidOrder: string[] = []
    const onSubmit = vi.fn()
    const invalid = createConfigFormController<LifecycleValues>({
      fields: () => [{ component: 'input', field: 'name', id: 'name', required: true }],
      model: invalidModel.adapter,
      onLifecycle: (kind) => { invalidOrder.push(kind) },
      onSubmit,
    })

    await expect(invalid.submit()).resolves.toBe(false)
    expect(invalidOrder).toEqual(['form.beforeSubmit', 'form.validationFailure'])
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it.each(['form.beforeSubmit', 'form.submit'] as const)('blocks host submission when %s returns false', async (blockedKind) => {
    const model = createModel<LifecycleValues>({ name: 'Ada' })
    const onSubmit = vi.fn()
    const controller = createConfigFormController<LifecycleValues>({
      fields: () => [{ component: 'input', field: 'name', id: 'name' }],
      model: model.adapter,
      onLifecycle: kind => kind === blockedKind ? false : undefined,
      onSubmit,
    })

    await expect(controller.submit()).resolves.toBe(false)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('validates values written by beforeSubmit and rejects changes made after validation', async () => {
    const model = createModel<LifecycleValues>({ name: '' })
    const validated = vi.fn()
    const onSubmit = vi.fn()
    const controller: ConfigFormController<LifecycleValues> = createConfigFormController<LifecycleValues>({
      fields: () => [{
        component: 'input',
        field: 'name',
        id: 'name',
        validator: (value) => {
          validated(value)
          return value === 'Grace' ? undefined : 'invalid'
        },
      }],
      model: model.adapter,
      onLifecycle: (kind) => {
        if (kind === 'form.beforeSubmit')
          controller.setValue('name', 'Grace')
      },
      onSubmit,
    })

    await expect(controller.submit()).resolves.toBe(true)
    expect(validated).toHaveBeenLastCalledWith('Grace')
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Grace' })

    const staleModel = createModel<LifecycleValues>({ name: 'Ada' })
    const staleSubmit = vi.fn()
    const stale: ConfigFormController<LifecycleValues> = createConfigFormController<LifecycleValues>({
      fields: () => [{ component: 'input', field: 'name', id: 'name' }],
      model: staleModel.adapter,
      onLifecycle: (kind) => {
        if (kind === 'form.submit')
          stale.setValue('name', 'changed after validation')
      },
      onSubmit: staleSubmit,
    })

    await expect(stale.submit()).resolves.toBe(false)
    expect(staleSubmit).not.toHaveBeenCalled()
  })

  it('ignores a repeated submit while the first submission is pending', async () => {
    const model = createModel<LifecycleValues>({ name: 'Ada' })
    let release!: () => void
    const onSubmit = vi.fn()
    const controller = createConfigFormController<LifecycleValues>({
      fields: () => [{ component: 'input', field: 'name', id: 'name' }],
      model: model.adapter,
      onLifecycle: async (kind) => {
        if (kind === 'form.beforeSubmit')
          await new Promise<void>(resolve => release = resolve)
      },
      onSubmit,
    })

    const first = controller.submit()
    await expect(controller.submit()).resolves.toBe(false)
    release()
    await expect(first).resolves.toBe(true)
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('restores deep reset snapshots and clears errors and touched state atomically', async () => {
    const initial = { name: 'Ada', nested: { label: 'baseline' } }
    const model = createModel<LifecycleValues>(initial)
    const lifecycle = vi.fn()
    const controller = createConfigFormController<LifecycleValues>({
      fields: () => [
        { component: 'input', field: 'name', id: 'name' },
        { component: 'input', field: 'nested', id: 'nested' },
      ],
      model: model.adapter,
      onLifecycle: lifecycle,
    })

    const valuesSnapshot = controller.getValues()
    valuesSnapshot.nested!.label = 'outside mutation'
    expect(model.read().nested?.label).toBe('baseline')

    initial.nested.label = 'mutated source'
    controller.setValue('nested', { label: 'changed' })
    controller.setTouched()
    controller.setErrors({ nested: ['invalid'] })
    const reset = controller.resetFields()

    expect(model.read()).toEqual({ name: 'Ada', nested: { label: 'baseline' } })
    expect(controller.getErrors()).toEqual({})
    expect(controller.getMeta()).toMatchObject({ dirty: false, touched: false })
    await expect(reset).resolves.toBe(true)
    expect(lifecycle).toHaveBeenLastCalledWith('form.reset', expect.objectContaining({
      errors: {},
      values: { name: 'Ada', nested: { label: 'baseline' } },
    }))
  })

  it('aborts custom async validation on reset and never publishes its late result', async () => {
    const model = createModel<LifecycleValues>({ name: 'Ada' })
    const onErrorsChange = vi.fn()
    let validationSignal!: AbortSignal
    const controller = createConfigFormController<LifecycleValues>({
      fields: () => [{
        component: 'input',
        field: 'name',
        id: 'name',
        validator: (_value, _values, context) => new Promise<string>((_resolve, reject) => {
          validationSignal = context.signal
          context.signal.addEventListener('abort', () => reject(context.signal.reason), { once: true })
        }),
      }],
      model: model.adapter,
      onErrorsChange,
    })

    const pending = controller.validate()
    expect(validationSignal.aborted).toBe(false)
    await expect(controller.resetFields()).resolves.toBe(true)
    expect(validationSignal.aborted).toBe(true)
    await expect(pending).resolves.toBe(false)
    expect(controller.getErrors()).toEqual({})
    expect(onErrorsChange).not.toHaveBeenCalled()
  })

  it('dispatches explicit validation lifecycle and reports awaited host failures', async () => {
    const model = createModel<LifecycleValues>({ name: '' })
    const kinds: ConfigFormLifecycleKind[] = []
    const diagnostics: ConfigFormControllerDiagnostic[] = []
    const controller = createConfigFormController<LifecycleValues>({
      fields: () => [{ component: 'input', field: 'name', id: 'name', required: true }],
      model: model.adapter,
      onDiagnostic: diagnostic => diagnostics.push(diagnostic),
      onLifecycle: (kind) => { kinds.push(kind) },
      onSubmit: async () => { throw new Error('host failed') },
    })

    await expect(controller.validate()).resolves.toBe(false)
    controller.setValue('name', 'Ada')
    await expect(controller.validate()).resolves.toBe(true)
    await expect(controller.submit()).resolves.toBe(false)
    expect(kinds.filter(kind => kind.startsWith('form.validation'))).toEqual([
      'form.validationFailure',
      'form.validationSuccess',
      'form.validationSuccess',
    ])
    expect(diagnostics).toEqual([expect.objectContaining({
      code: 'CONFIG_FORM_SUBMIT_ERROR',
      message: 'host failed',
    })])
  })

  it('bounds lifecycle reentry and reports a stable diagnostic', async () => {
    const model = createModel({ count: 0 })
    const diagnostics: ConfigFormControllerDiagnostic[] = []
    const controller: ConfigFormController<{ count: number }> = createConfigFormController({
      model: model.adapter,
      onDiagnostic: diagnostic => diagnostics.push(diagnostic),
      onLifecycle: (kind) => {
        if (kind === 'form.valuesChange')
          controller.setValue('count', controller.getValue('count') + 1)
      },
    })

    controller.setValue('count', 1)
    await Promise.resolve()
    expect(model.read().count).toBeLessThanOrEqual(33)
    expect(diagnostics).toContainEqual(expect.objectContaining({
      code: 'CONFIG_FORM_LIFECYCLE_REENTRY_LIMIT',
      kind: 'form.valuesChange',
    }))
  })
})
