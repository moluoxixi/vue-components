import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createConfigFormController } from '../src/controller'
import { defineFields } from '../src/utils/field'

interface UserForm {
  age: number
  name: string
}

interface DynamicForm {
  extra?: string
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

  it('stores __proto__ as a regular own field', () => {
    let model: ConfigFormPrototypeField = { name: 'Ada' }
    const controller = createConfigFormController<ConfigFormPrototypeField>({
      fields: () => [{
        component: 'input',
        defaultValue: 'initial',
        field: '__proto__',
      }],
      model: {
        read: () => model,
        write: values => model = values,
      },
    })

    expect(Object.hasOwn(model, '__proto__')).toBe(true)
    expect(Object.getOwnPropertyDescriptor(model, '__proto__')?.value).toBe('initial')
    expect(Object.getPrototypeOf(model)).toBe(Object.prototype)

    controller.setValue('__proto__', 'changed')
    expect(Object.hasOwn(model, '__proto__')).toBe(true)
    expect(Object.getOwnPropertyDescriptor(model, '__proto__')?.value).toBe('changed')
    expect(Object.getPrototypeOf(model)).toBe(Object.prototype)
  })

  it('owns Zod validation, readonly submission and reset lifecycle', async () => {
    let model: UserForm = { age: 17, name: '' }
    const onError = vi.fn()
    const onSubmit = vi.fn()
    const onErrorsChange = vi.fn()
    const controller = createConfigFormController<UserForm>({
      fields: () => [
        {
          component: 'input',
          field: 'age',
          readonly: true,
          schema: z.number().min(18),
        },
        {
          component: 'input',
          defaultValue: 'initial',
          field: 'name',
          required: true,
          requiredMessage: '请输入姓名',
          schema: z.string().min(2, '至少两个字符'),
        },
      ],
      model: {
        read: () => model,
        write: (values) => {
          model = values
        },
      },
      onError,
      onErrorsChange,
      onSubmit,
    })

    await expect(controller.submit()).resolves.toBe(false)
    expect(controller.getErrors()).toEqual({ name: ['请输入姓名'] })
    expect(onError).toHaveBeenCalledWith({ name: ['请输入姓名'] })

    controller.setValue('name', 'Ada')
    await expect(controller.submit()).resolves.toBe(true)
    expect(onSubmit).toHaveBeenCalledWith({ age: 17, name: 'Ada' })

    controller.resetFields('name')
    expect(model).toEqual({ age: 17, name: '' })
    expect(controller.getErrors()).toEqual({})
    expect(onErrorsChange).toHaveBeenCalled()
  })

  it('does not commit stale async cross-field validation results', async () => {
    let model: UserForm = { age: 18, name: 'Ada' }
    let releaseValidation!: () => void
    const controller = createConfigFormController<UserForm>({
      fields: () => [{
        component: 'input',
        field: 'name',
        validator: async (_value, values) => {
          await new Promise<void>((resolve) => {
            releaseValidation = resolve
          })
          return values.age >= 18 ? undefined : '未成年'
        },
      }],
      model: {
        read: () => model,
        write: (values) => {
          model = values
        },
      },
    })

    const pending = controller.validateField('name')
    controller.setValue('age', 16)
    releaseValidation()

    await expect(pending).resolves.toBe(false)
    expect(controller.getErrors()).toEqual({})
  })

  it('does not submit a model that replaced the validated snapshot', async () => {
    let model: UserForm = { age: 18, name: 'Ada' }
    let releaseValidation!: () => void
    const onError = vi.fn()
    const onSubmit = vi.fn()
    const controller = createConfigFormController<UserForm>({
      fields: () => [{
        component: 'input',
        field: 'name',
        validator: async () => {
          await new Promise<void>((resolve) => {
            releaseValidation = resolve
          })
        },
      }],
      model: {
        read: () => model,
        write: values => model = values,
      },
      onError,
      onSubmit,
    })

    const pending = controller.submit()
    model = { age: 18, name: '' }
    releaseValidation()

    await expect(pending).resolves.toBe(false)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('applies hidden and disabled submission filters before readonly semantics', async () => {
    let model: UserForm = { age: 18, name: 'private' }
    const onSubmit = vi.fn()
    const controller = createConfigFormController<UserForm>({
      fields: () => [
        { component: 'input', field: 'age' },
        { component: 'input', field: 'name', hidden: true, readonly: true },
      ],
      model: {
        read: () => model,
        write: values => model = values,
      },
      onSubmit,
    })

    await expect(controller.submit()).resolves.toBe(true)
    expect(onSubmit).toHaveBeenCalledWith({ age: 18 })
  })

  it('uses defaults from fields added after controller creation when resetting', () => {
    let model: DynamicForm = { name: 'Ada' }
    const fields: Array<Record<string, unknown>> = [
      { component: 'input', field: 'name' },
    ]
    const controller = createConfigFormController<DynamicForm>({
      fields: () => fields as never,
      model: {
        read: () => model,
        write: values => model = values,
      },
    })

    fields.push({ component: 'input', defaultValue: 'new default', field: 'extra' })
    controller.setValue('extra', 'changed')
    controller.resetFields('extra')
    expect(model).toEqual({ extra: 'new default', name: 'Ada' })

    controller.setValue('extra', 'changed again')
    controller.resetFields()
    expect(model).toEqual({ extra: 'new default', name: 'Ada' })
  })

  it('keeps field helpers typed against the model', () => {
    const { defineField } = defineFields<UserForm>()
    const field = defineField({
      component: 'input',
      field: 'age',
      schema: z.number(),
    })

    expect(field.field).toBe('age')

    if (false) {
      // @ts-expect-error The schema output must match the model field type.
      defineField({
        component: 'input',
        field: 'age',
        schema: z.string(),
      })
    }
  })
})

interface ConfigFormPrototypeField {
  [field: string]: unknown
  name: string
}
