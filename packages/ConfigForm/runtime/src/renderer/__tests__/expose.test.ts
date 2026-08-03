import type { ConfigFormRendererExpose } from '../types'
import { createConfigFormController } from '@moluoxixi/config-form-headless'
import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { createConfigFormRendererExpose } from '../expose'

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
    expose.scrollToField('name')

    expect(expose.getValue('name')).toBe('Grace')
    expect(expose.getValues()).toEqual({ age: 20, name: 'Grace' })
    expect(scrollToField).toHaveBeenCalledWith('name')

    let replacementModel: TestValues = { age: 30, name: 'Lin' }
    const replacement = createConfigFormController<TestValues>({
      model: {
        read: () => replacementModel,
        write: values => replacementModel = values,
      },
    })
    const replacementSubmit = vi.spyOn(replacement, 'submit')
    rendererRef.value = { ...replacement, scrollToField }

    expose.setValues({ age: 31 }, false)
    expect(expose.getValues()).toEqual({ age: 31, name: 'Lin' })
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
