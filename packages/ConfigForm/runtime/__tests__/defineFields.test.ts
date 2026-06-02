import { describe, expectTypeOf, it } from 'vitest'
import { defineFields } from '../index'

describe('defineFields typing', () => {
  it('returns a factory that threads the model into destructured defineField', () => {
    interface LoginForm {
      age: number
      remember: boolean
      username: string
    }

    const { defineField: defineLoginField } = defineFields<LoginForm>()

    defineLoginField({
      field: 'username',
      component: 'input',
      defaultValue: '',
      validator: (value, values) => {
        expectTypeOf(value).toEqualTypeOf<string>()
        expectTypeOf(values.age).toEqualTypeOf<number>()
        expectTypeOf(values.remember).toEqualTypeOf<boolean>()

        return values.remember && value.length === 0 ? '请输入用户名' : undefined
      },
    })
  })
})
