import type { ConfigFormRendererExpose } from '../types'
import { createConfigFormController } from '@moluoxixi/config-form-headless'
import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { createConfigFormRendererExpose } from '../services'

interface TestValues {
  age: number
  name: string
}

describe('createConfigFormRendererExpose', () => {
  it('forwards methods to the latest mounted renderer while preserving field types', async () => {
    let model: TestValues = { age: 18, name: 'Ada' }
    const controller = createConfigFormController<TestValues>({
      model: {
        read: () => model,
        write: values => (model = values),
      },
    })
    const scrollToField = vi.fn()
    const scrollToFirstError = vi.fn()
    const data = {
      getVariables: vi.fn(() => ({ count: 1 })),
      getDataSourceState: vi.fn(() => ({ sourceId: 'source', status: 'idle' as const })),
      getOptionState: vi.fn(() => undefined),
      loadDataSource: vi.fn(async () => ({ sourceId: 'source', status: 'empty' as const, data: [] })),
    }
    const rendererRef = shallowRef<ConfigFormRendererExpose<TestValues> | null>(null)
    const expose = createConfigFormRendererExpose(rendererRef)

    expect(() => expose.getValues()).toThrow('ConfigFormRenderer is not mounted.')

    rendererRef.value = { ...controller, ...data, scrollToField, scrollToFirstError }
    expose.setValue('name', 'Grace')
    expose.setValues({ age: 20 })
    expose.setTouched('name')
    expose.scrollToField('name')

    expect(expose.getValue('name')).toBe('Grace')
    expect(expose.getValues()).toEqual({ age: 20, name: 'Grace' })
    expect(expose.getFieldMeta('name')).toEqual({ dirty: true, touched: true })
    expect(expose.getMeta()).toMatchObject({ dirty: true, touched: true })
    expect(scrollToField).toHaveBeenCalledWith('name')
    expect(expose.getVariables()).toEqual({ count: 1 })
    expect(expose.getDataSourceState('source')).toMatchObject({ status: 'idle' })
    expect(expose.getOptionState({ nodeId: 'name', scope: [] })).toBeUndefined()
    await expect(expose.loadDataSource('source', { force: true })).resolves.toMatchObject({ status: 'empty' })
    expect(data.loadDataSource).toHaveBeenCalledWith('source', { force: true })

    let replacementModel: TestValues = { age: 30, name: 'Lin' }
    const replacement = createConfigFormController<TestValues>({
      model: {
        read: () => replacementModel,
        write: values => (replacementModel = values),
      },
    })
    const replacementClearValidate = vi.spyOn(replacement, 'clearValidate')
    const replacementGetErrors = vi.spyOn(replacement, 'getErrors')
    const replacementGetValidating = vi.spyOn(replacement, 'getValidating')
    const replacementResetFields = vi.spyOn(replacement, 'resetFields')
    const replacementSetErrors = vi.spyOn(replacement, 'setErrors')
    const replacementSubmit = vi.spyOn(replacement, 'submit')
    const replacementValidateField = vi.spyOn(replacement, 'validateField')
    rendererRef.value = {
      ...replacement,
      ...data,
      getVariables: () => ({ count: 2 }),
      scrollToField,
      scrollToFirstError,
    }
    expect(expose.getVariables()).toEqual({ count: 2 })

    expose.setValues({ age: 31 }, false)
    expect(expose.getValues()).toEqual({ age: 31, name: 'Lin' })
    expose.setErrors({ name: ['Invalid'] })
    expect(replacementSetErrors).toHaveBeenCalledWith({ name: ['Invalid'] })
    expose.clearValidate('name')
    expect(expose.getErrors()).toEqual({})
    expect(expose.getValidating()).toBe(false)
    await expect(expose.validateField('name')).resolves.toBe(true)
    expose.resetFields('name')
    expect(replacementClearValidate).toHaveBeenCalledWith('name')
    expect(replacementGetErrors).toHaveBeenCalledOnce()
    expect(replacementGetValidating).toHaveBeenCalledOnce()
    expect(replacementResetFields).toHaveBeenCalledWith('name')
    expect(replacementValidateField).toHaveBeenCalledWith('name', undefined)
    await expect(expose.validate()).resolves.toBe(true)
    await expect(expose.submit()).resolves.toBe(true)
    expect(replacementSubmit).toHaveBeenCalledOnce()

    rendererRef.value = null
    expect(() => expose.getValues()).toThrow('ConfigFormRenderer is not mounted.')

    if (false) {
      // @ts-expect-error Known fields must preserve their value type.
      expose.setValue('age', 'invalid')
      // @ts-expect-error Replacing values requires a complete model.
      expose.setValues({ age: 21 }, true)
    }
  })

  it('forwards array and scoped instance operations to the mounted renderer', async () => {
    const rendererRef = shallowRef<ConfigFormRendererExpose<TestValues> | null>(null)
    const expose = createConfigFormRendererExpose(rendererRef)
    const address = { nodeId: 'rows', scope: [] }
    const renderer = {
      appendRow: vi.fn(),
      applyFieldInstanceChange: vi.fn(),
      clearInstanceValidate: vi.fn(),
      duplicateRow: vi.fn(),
      getInstanceErrors: vi.fn(() => []),
      getInstanceKey: vi.fn(() => 'rows'),
      getInstanceMeta: vi.fn(() => ({ dirty: false, touched: false })),
      getInstanceValue: vi.fn(() => undefined),
      getIssues: vi.fn(() => []),
      insertRow: vi.fn(),
      isInstanceValidating: vi.fn(() => false),
      listFieldInstances: vi.fn(() => []),
      listRows: vi.fn(() => []),
      moveRow: vi.fn(),
      removeRow: vi.fn(),
      setInstanceTouched: vi.fn(),
      setInstanceValue: vi.fn(),
      setTouched: vi.fn(),
      setValues: vi.fn(),
      validateInstance: vi.fn(async () => true),
    } as unknown as ConfigFormRendererExpose<TestValues>
    rendererRef.value = renderer

    expose.appendRow('rows', { name: 'first' })
    expose.applyFieldInstanceChange({ address, value: 'value' })
    expose.clearInstanceValidate(address)
    expose.duplicateRow('rows', 'row-1')
    expose.getInstanceErrors(address)
    expose.getInstanceKey(address)
    expose.getInstanceMeta(address)
    expose.getInstanceValue(address)
    expose.getIssues()
    expose.insertRow('rows', 0, { name: 'inserted' })
    expose.isInstanceValidating(address)
    expose.listFieldInstances('rows')
    expose.listRows('rows')
    expose.moveRow('rows', 'row-1', 0)
    expose.removeRow('rows', 'row-1')
    expose.setInstanceTouched(address, true)
    expose.setInstanceValue(address, 'value')
    expose.setTouched()
    expose.setTouched(true)
    expose.setValues({ age: 18, name: 'Ada' }, true)
    await expect(expose.validateInstance(address)).resolves.toBe(true)

    expect(renderer.appendRow).toHaveBeenCalledWith('rows', { name: 'first' }, undefined)
    expect(renderer.applyFieldInstanceChange).toHaveBeenCalledWith({ address, value: 'value' })
    expect(renderer.setTouched).toHaveBeenNthCalledWith(1)
    expect(renderer.setTouched).toHaveBeenNthCalledWith(2, true)
    expect(renderer.setValues).toHaveBeenCalledWith({ age: 18, name: 'Ada' }, true)
  })
})
