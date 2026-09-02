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
        write: values => model = values,
      },
    })
    const scrollToField = vi.fn()
    const rendererRef = shallowRef<ConfigFormRendererExpose<TestValues> | null>(null)
    const expose = createConfigFormRendererExpose(rendererRef)

    expect(() => expose.getValues()).toThrow('ConfigFormRenderer is not mounted.')

    rendererRef.value = { ...controller, scrollToField }
    expose.setValue('name', 'Grace')
    expose.setValues({ age: 20 })
    expose.setTouched('name')
    expose.scrollToField('name')

    expect(expose.getValue('name')).toBe('Grace')
    expect(expose.getValues()).toEqual({ age: 20, name: 'Grace' })
    expect(expose.getFieldMeta('name')).toEqual({ dirty: true, touched: true })
    expect(expose.getMeta()).toMatchObject({ dirty: true, touched: true })
    expect(scrollToField).toHaveBeenCalledWith('name')

    let replacementModel: TestValues = { age: 30, name: 'Lin' }
    const replacement = createConfigFormController<TestValues>({
      model: {
        read: () => replacementModel,
        write: values => replacementModel = values,
      },
    })
    const replacementClearValidate = vi.spyOn(replacement, 'clearValidate')
    const replacementGetErrors = vi.spyOn(replacement, 'getErrors')
    const replacementGetValidating = vi.spyOn(replacement, 'getValidating')
    const replacementResetFields = vi.spyOn(replacement, 'resetFields')
    const replacementSubmit = vi.spyOn(replacement, 'submit')
    const replacementValidateField = vi.spyOn(replacement, 'validateField')
    rendererRef.value = { ...replacement, scrollToField }

    expose.setValues({ age: 31 }, false)
    expect(expose.getValues()).toEqual({ age: 31, name: 'Lin' })
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
})
