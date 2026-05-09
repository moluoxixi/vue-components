import type { FieldConfig, FieldKey, FormNodeConfig, SlotContent } from '../src/types'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import { defineField } from '../src/utils/field'

type IsAssignable<TFrom, TTo> = [TFrom] extends [TTo] ? true : false
type HasKey<TValue, TKey extends PropertyKey> = TKey extends keyof TValue ? true : false

describe('defineField typing', () => {
  it('infers field value from schema', () => {
    defineField({
      field: 'name',
      component: 'input',
      schema: z.string(),
      validator: (value) => {
        expectTypeOf(value).toEqualTypeOf<string>()
        const text: string = value
        type ValueIsNumber = IsAssignable<typeof value, number>
        expectTypeOf(text).toEqualTypeOf<string>()
        expectTypeOf<ValueIsNumber>().toEqualTypeOf<false>()
        return value.length > 0 ? undefined : '必填'
      },
      transform: (value) => {
        expectTypeOf(value).toEqualTypeOf<string>()
        const text: string = value
        type ValueIsNumber = IsAssignable<typeof value, number>
        expectTypeOf(text).toEqualTypeOf<string>()
        expectTypeOf<ValueIsNumber>().toEqualTypeOf<false>()
        return value.trim()
      },
    })
  })

  it('infers field value from defaultValue', () => {
    defineField({
      field: 'age',
      component: 'input',
      defaultValue: 18,
      validator: (value) => {
        expectTypeOf(value).toEqualTypeOf<number>()
        const count: number = value
        type ValueIsString = IsAssignable<typeof value, string>
        expectTypeOf(count).toEqualTypeOf<number>()
        expectTypeOf<ValueIsString>().toEqualTypeOf<false>()
        return value > 0 ? undefined : '年龄必须大于 0'
      },
    })
  })

  it('keeps field value unknown when there is no inference source', () => {
    defineField({
      field: 'remark',
      component: 'input',
      validator: (value) => {
        expectTypeOf(value).toEqualTypeOf<unknown>()
        type ValueIsString = IsAssignable<typeof value, string>
        expectTypeOf<ValueIsString>().toEqualTypeOf<false>()
        return undefined
      },
    })
  })

  it('preserves inferred config types on returned fields', () => {
    const nameField = defineField({
      field: 'name',
      component: 'input',
      schema: z.string(),
    })

    expectTypeOf(nameField.field).toEqualTypeOf<'name'>()
    expectTypeOf(nameField.schema).toMatchTypeOf<z.ZodString>()
    expectTypeOf(nameField.defaultValue).toEqualTypeOf<string | undefined>()

    const ageField = defineField({
      field: 'age',
      component: 'input',
      defaultValue: 18,
    })

    expectTypeOf(ageField.field).toEqualTypeOf<'age'>()
    expectTypeOf(ageField.defaultValue).toEqualTypeOf<number>()
  })

  it('rejects devtools source metadata in public defineField inputs', () => {
    type FieldConfigHasSource = HasKey<FieldConfig, '__source'>
    type FieldConfigHasPlugins = HasKey<FieldConfig, 'plugins'>

    expectTypeOf<FieldConfigHasSource>().toEqualTypeOf<false>()
    expectTypeOf<FieldConfigHasPlugins>().toEqualTypeOf<false>()

    const fieldConfig: FieldConfig = {
      component: 'input',
      field: 'manual-field-config',
    }

    expect(fieldConfig.field).toBe('manual-field-config')
  })

  it('keeps inferred component props plain after token support is removed', () => {
    /**
     * 模拟带 options/placeholder props 的选择组件。
     *
     * 只用于 defineField 的 props 类型推导，不执行真实渲染。
     */
    const selectComponent = (
      _props: {
        options?: Array<{ label: string, value: string }>
        placeholder?: string
      },
    ) => null

    const roleField = defineField({
      field: 'role',
      component: selectComponent,
      defaultValue: 'admin',
      props: {
        placeholder: '请选择角色',
        options: [
          { label: '管理员', value: 'admin' },
          { label: '普通用户', value: 'user' },
        ],
      },
    })

    expectTypeOf(roleField.defaultValue).toEqualTypeOf<string>()
  })

  it('accepts known props when component props are inferable', () => {
    /**
     * 模拟带 placeholder prop 的输入组件。
     *
     * 只用于验证组件 props 可被 defineField 正确推导。
     */
    const inputComponent = (
      _props: {
        placeholder?: string
      },
    ) => null

    defineField({
      field: 'keyword',
      component: inputComponent,
      defaultValue: '',
      props: {
        placeholder: '请输入关键词',
      },
    })
  })

  it('accepts field root props without mixing them into component props', () => {
    const field = defineField({
      field: 'keyword',
      component: 'input',
      rootProps: {
        'data-root': 'keyword-root',
        'class': 'keyword-field',
      },
    })

    expect(field.rootProps).toEqual({
      'data-root': 'keyword-root',
      'class': 'keyword-field',
    })
    expect(field.props).toBeUndefined()
  })

  it('preserves validateOn arrays that already include submit', () => {
    const field = defineField({
      field: 'name',
      component: 'input',
      validateOn: ['submit', 'blur'],
    })

    expect(field.validateOn).toEqual(['submit', 'blur'])
  })

  it('returns plain field configs without hidden brands or runtime behavior helpers', () => {
    /** 保留字段可见性函数引用，用于断言 defineField 不包装运行时行为。 */
    const visible = (values: Record<string, unknown>) => values.role === 'admin'
    const field = defineField({
      disabled: false,
      field: 'mode',
      component: 'input',
      validateOn: ['submit', 'blur'],
      visible,
    })

    expect(field).toMatchObject({
      component: 'input',
      disabled: false,
      field: 'mode',
      validateOn: ['submit', 'blur'],
      visible,
    })
    expect('isVisible' in field).toBe(false)
    expect('isDisabled' in field).toBe(false)
    expect('applyTransform' in field).toBe(false)
    expect(Object.getOwnPropertySymbols(field)).toEqual([])
  })

  it('infers slot field configs at the defineField call site', () => {
    defineField({
      field: 'host',
      component: 'div',
      slots: {
        default: [
          defineField({
            field: 'host-option',
            component: 'input',
            defaultValue: 'option',
            validator: (value) => {
              expectTypeOf(value).toEqualTypeOf<string>()
              return undefined
            },
          }),
        ],
      },
    })
  })

  it('restricts slot content to field configs or field config arrays', () => {
    type FieldConfigIsSlotContent = IsAssignable<FormNodeConfig, SlotContent>
    type FieldConfigArrayIsSlotContent = IsAssignable<FormNodeConfig[], SlotContent>
    type TextIsSlotContent = IsAssignable<string, SlotContent>
    type FunctionIsSlotContent = IsAssignable<() => FormNodeConfig, SlotContent>
    type NullIsSlotContent = IsAssignable<null, SlotContent>

    expectTypeOf<FieldConfigIsSlotContent>().toEqualTypeOf<true>()
    expectTypeOf<FieldConfigArrayIsSlotContent>().toEqualTypeOf<true>()
    expectTypeOf<TextIsSlotContent>().toEqualTypeOf<false>()
    expectTypeOf<FunctionIsSlotContent>().toEqualTypeOf<false>()
    expectTypeOf<NullIsSlotContent>().toEqualTypeOf<false>()
  })

  it('binds field names and callbacks to a form model through defineField generics', () => {
    interface LoginForm {
      age: number
      remember: boolean
      username: string
    }

    defineField<LoginForm>({
      field: 'username',
      component: 'input',
      defaultValue: '',
      validator: (value, values) => {
        expectTypeOf(value).toEqualTypeOf<string>()
        expectTypeOf(values.age).toEqualTypeOf<number>()
        expectTypeOf(values.remember).toEqualTypeOf<boolean>()
        return value === values.username ? undefined : '用户名不一致'
      },
      transform: (value, values) => {
        expectTypeOf(value).toEqualTypeOf<string>()
        expectTypeOf(values.username).toEqualTypeOf<string>()
        return value.trim()
      },
    })

    defineField<LoginForm>({
      field: 'age',
      component: 'input',
      defaultValue: 18,
      validator: (value) => {
        expectTypeOf(value).toEqualTypeOf<number>()
        return value > 0 ? undefined : '年龄必须大于 0'
      },
      visible: (values) => {
        expectTypeOf(values.remember).toEqualTypeOf<boolean>()
        return values.remember
      },
      disabled: (values) => {
        expectTypeOf(values.username).toEqualTypeOf<string>()
        return values.username.length === 0
      },
    })

    defineField<LoginForm>({
      field: 'remember',
      component: 'input',
      defaultValue: false,
      transform: (value, values) => {
        expectTypeOf(value).toEqualTypeOf<boolean>()
        expectTypeOf(values.username).toEqualTypeOf<string>()
        return value && values.username.length > 0
      },
    })

    /**
     * 模拟登录表单输入组件。
     *
     * 只用于验证 defineField<TValues> 能把组件 props 和字段模型一起推导。
     */
    const inputComponent = (
      _props: {
        placeholder?: string
      },
    ) => null

    defineField<LoginForm>({
      field: 'username',
      component: inputComponent,
      defaultValue: '',
      props: {
        placeholder: '请输入用户名',
      },
    })

    type MissingIsLoginField = IsAssignable<'missing', FieldKey<LoginForm>>
    type StringIsAgeValue = IsAssignable<string, LoginForm['age']>

    expectTypeOf<MissingIsLoginField>().toEqualTypeOf<false>()
    expectTypeOf<StringIsAgeValue>().toEqualTypeOf<false>()
  })
})
