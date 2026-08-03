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
  it('forwards methods to the mounted renderer while preserving field types', () => {
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

    if (false) {
      // @ts-expect-error Known fields must preserve their value type.
      expose.setValue('age', 'invalid')
      // @ts-expect-error Replacing values requires a complete model.
      expose.setValues({ age: 21 }, true)
    }
  })
})
