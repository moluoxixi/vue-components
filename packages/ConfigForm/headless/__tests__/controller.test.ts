import { describe, expect, it, vi } from 'vitest'
import { createConfigFormController } from '../src/controller'

interface UserForm {
  age: number
  name: string
}

describe('createConfigFormController', () => {
  it('reads the latest model and writes immutable field updates', () => {
    let model: UserForm = { age: 18, name: 'Ada' }
    const initialModel = model
    const onChange = vi.fn()
    const onFieldChange = vi.fn()
    const controller = createConfigFormController<UserForm>({
      model: {
        read: () => model,
        write: (values) => {
          model = values
        },
      },
      onChange,
      onFieldChange,
    })

    controller.setValue('age', 19)

    expect(model).toEqual({ age: 19, name: 'Ada' })
    expect(model).not.toBe(initialModel)
    expect(onFieldChange).toHaveBeenCalledWith({
      field: 'age',
      value: 19,
      values: model,
    })
    expect(onChange).toHaveBeenCalledWith(model)
    expect(onFieldChange.mock.invocationCallOrder[0]).toBeLessThan(onChange.mock.invocationCallOrder[0])
  })

  it('supports merge, replace and defensive reads', () => {
    let model: UserForm = { age: 18, name: 'Ada' }
    const controller = createConfigFormController<UserForm>({
      model: {
        read: () => model,
        write: (values) => {
          model = values
        },
      },
    })

    const snapshot = controller.getValues()
    snapshot.name = 'changed outside'
    expect(model.name).toBe('Ada')

    controller.setValues({ name: 'Grace' })
    expect(model).toEqual({ age: 18, name: 'Grace' })

    controller.setValues({ age: 20, name: 'Lin' }, true)
    expect(model).toEqual({ age: 20, name: 'Lin' })
    expect(controller.getValue('name')).toBe('Lin')

    if (false) {
      controller.setValue('age', 21)
      controller.setValue('customField', { any: 'value' })

      // @ts-expect-error Known fields must preserve their value type.
      controller.setValue('age', 'invalid')
      // @ts-expect-error Replacing the model requires a complete TValues object.
      controller.setValues({ age: 21 }, true)
    }
  })
})
