import { describe, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
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

  it('preserves model value types across schema, unknown, and container nodes', () => {
    interface LoginForm {
      age: number
      remember: boolean
      username: string
    }

    const { defineField: defineLoginField } = defineFields<LoginForm>()

    defineLoginField({
      field: 'age',
      component: 'input',
      schema: z.number(),
      validator: (value, values) => {
        expectTypeOf(value).toEqualTypeOf<number>()
        expectTypeOf(values.username).toEqualTypeOf<string>()

        return value > 0 ? undefined : '年龄必须大于 0'
      },
      transform: (value, values) => {
        expectTypeOf(value).toEqualTypeOf<number>()
        expectTypeOf(values.remember).toEqualTypeOf<boolean>()

        return value
      },
    })

    defineLoginField({
      field: 'remember',
      component: 'input',
      validator: (value, values) => {
        expectTypeOf(value).toEqualTypeOf<boolean>()
        expectTypeOf(values.age).toEqualTypeOf<number>()

        return undefined
      },
    })

    defineLoginField({
      component: 'section',
      visible: (values) => {
        expectTypeOf(values.remember).toEqualTypeOf<boolean>()

        return values.remember
      },
    })
  })
})
