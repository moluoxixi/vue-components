import type { ConfigFormFieldValidator } from '../index'
import { describe, expect, it, vi } from 'vitest'
import { createConfigFormController } from '../index'
import { createControllerValidationService } from '../src/services/controller-validation'

interface Values {
  name: string
}

function createValidation(validator: ConfigFormFieldValidator<Values>) {
  const values = { name: 'Ada' }
  const onErrorsChange = vi.fn()
  const onIssuesChange = vi.fn()
  const onValidatingChange = vi.fn()
  const service = createControllerValidationService<Values>({
    getFieldStates: () => [{
      address: { nodeId: 'name-node', scope: [] },
      disabled: false,
      field: { component: 'input', field: 'name', id: 'name-node', validator },
      instanceKey: 'name',
      readonly: false,
      required: false,
      validatable: true,
      valuePath: ['name'],
      visible: true,
    }],
    onErrorsChange,
    onIssuesChange,
    onValidatingChange,
    readValues: () => values,
  })
  return { onErrorsChange, onIssuesChange, onValidatingChange, service, values }
}

async function beforeNextTask<T>(pending: Promise<T>): Promise<T> {
  let timeout!: ReturnType<typeof setTimeout>
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Cancelled validation did not settle.')), 0)
      }),
    ])
  }
  finally {
    clearTimeout(timeout)
  }
}

describe.each(['field', 'values'] as const)('controller %s validation cancellation', (target) => {
  function validate(service: ReturnType<typeof createValidation>['service'], values: Values): Promise<boolean | string> {
    return target === 'field'
      ? service.validateField('name')
      : service.validateValues(values).then(result => result.status)
  }

  it.each(['invalidate', 'clearValidate', 'dispose'] as const)('settles after %s when the validator never settles', async (cancel) => {
    let signal!: AbortSignal
    const validator: ConfigFormFieldValidator<Values> = (_value, _values, context) => {
      signal = context.signal
      return new Promise<never>(() => {})
    }
    const { service, values, onErrorsChange, onIssuesChange, onValidatingChange } = createValidation(validator)
    const pending = validate(service, values)
    expect(service.getValidating()).toBe(true)
    const removeListener = vi.spyOn(signal, 'removeEventListener')

    service[cancel]()

    expect(signal.aborted).toBe(true)
    await expect(beforeNextTask(pending)).resolves.toBe(target === 'field' ? false : 'stale')
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(service.getValidating()).toBe(false)
    expect(service.isFieldValidating('name')).toBe(false)
    expect(service.getErrors()).toEqual({})
    expect(service.getIssues()).toEqual([])
    expect(onErrorsChange).not.toHaveBeenCalled()
    expect(onIssuesChange).not.toHaveBeenCalled()
    expect(onValidatingChange.mock.calls).toEqual(cancel === 'dispose' ? [[true]] : [[true], [false]])
  })

  it('settles when the validator cancels before the wait is registered', async () => {
    const { service, values, onErrorsChange, onIssuesChange } = createValidation(() => {
      service.invalidate()
      return new Promise<never>(() => {})
    })

    await expect(beforeNextTask(validate(service, values))).resolves.toBe(target === 'field' ? false : 'stale')
    expect(service.getValidating()).toBe(false)
    expect(onErrorsChange).not.toHaveBeenCalled()
    expect(onIssuesChange).not.toHaveBeenCalled()
  })

  it('removes the abort listener after successful validation', async () => {
    let signal!: AbortSignal
    const { service, values } = createValidation((_value, _values, context) => {
      signal = context.signal
      return undefined
    })
    const pending = validate(service, values)
    const removeListener = vi.spyOn(signal, 'removeEventListener')

    await expect(pending).resolves.toBe(target === 'field' ? true : 'valid')
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(service.getValidating()).toBe(false)
    expect(service.getIssues()).toEqual([])
  })

  it.each(['resolve', 'reject'] as const)('observes a late %s without replacing newer errors', async (completion) => {
    let resolve!: (message: string) => void
    let reject!: (cause: Error) => void
    const { service, values, onErrorsChange, onIssuesChange } = createValidation(() => new Promise<string>((accept, fail) => {
      resolve = accept
      reject = fail
    }))
    const pending = validate(service, values)
    service.setErrors({ name: ['newer error'] })
    await expect(beforeNextTask(pending)).resolves.toBe(target === 'field' ? false : 'stale')
    const errorChanges = onErrorsChange.mock.calls.length
    const issueChanges = onIssuesChange.mock.calls.length

    if (completion === 'resolve')
      resolve('late error')
    else
      reject(new Error('late rejection'))
    await new Promise<void>(done => setTimeout(done, 0))

    expect(service.getErrors()).toEqual({ name: ['newer error'] })
    expect(onErrorsChange).toHaveBeenCalledTimes(errorChanges)
    expect(onIssuesChange).toHaveBeenCalledTimes(issueChanges)
  })

  it.each(['throw', 'reject'] as const)('preserves diagnostics when an active validator fails by %s', async (failure) => {
    let signal!: AbortSignal
    const { service, values } = createValidation((_value, _values, context) => {
      signal = context.signal
      if (failure === 'throw')
        throw new Error('validator failed')
      return Promise.reject(new Error('validator failed'))
    })
    const pending = validate(service, values)
    const removeListener = vi.spyOn(signal, 'removeEventListener')

    await expect(pending).resolves.toBe(target === 'field' ? false : 'invalid')
    expect(signal.aborted).toBe(false)
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(service.getIssues()).toEqual([expect.objectContaining({
      code: 'validation_exception',
      instanceKey: 'name',
      message: 'validator failed',
      valuePath: ['name'],
    })])
    expect(service.getErrors()).toEqual({ name: ['validator failed'] })
    expect(service.getValidating()).toBe(false)
  })
})

describe('controller validation lifetime', () => {
  it.each(['validateField', 'validate', 'submit'] as const)('settles %s after reset and permits a subsequent submit', async (operation) => {
    let model: Values = { name: 'Ada' }
    let signal!: AbortSignal
    const validator = vi.fn<ConfigFormFieldValidator<Values>>()
      .mockImplementationOnce((_value, _values, context) => {
        signal = context.signal
        return new Promise<never>(() => {})
      })
      .mockResolvedValue(undefined)
    const onSubmit = vi.fn()
    const onError = vi.fn()
    const onErrorsChange = vi.fn()
    const controller = createConfigFormController<Values>({
      fields: () => [{ component: 'input', field: 'name', id: 'name-node', validator }],
      model: { read: () => model, write: values => model = values },
      onError,
      onErrorsChange,
      onSubmit,
    })
    const pending = operation === 'validateField' ? controller.validateField('name') : controller[operation]()

    await expect(controller.resetFields()).resolves.toBe(true)
    await expect(beforeNextTask(pending)).resolves.toBe(false)
    expect(signal.aborted).toBe(true)
    expect(controller.getValidating()).toBe(false)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(onErrorsChange).not.toHaveBeenCalled()
    await expect(controller.submit()).resolves.toBe(true)
    expect(validator).toHaveBeenCalledTimes(2)
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ name: 'Ada' })
    controller.dispose()
  })
})
