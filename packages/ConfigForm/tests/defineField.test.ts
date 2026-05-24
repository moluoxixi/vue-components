import type { RenderContext as ConfigFormRenderContext, FieldConfig, FieldKey, FormNodeConfig, SlotContent } from '../src/types'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import { defineField } from '../src/utils/field'

type IsAssignable<TFrom, TTo> = [TFrom] extends [TTo] ? true : false
type HasKey<TValue, TKey extends PropertyKey> = TKey extends keyof TValue ? true : false

interface RenderContext {
  getValue: (field: string) => unknown
  setValue: (field: string, value: unknown) => void
  values: Record<string, unknown>
}

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
    type FieldConfigHasFormItemProps = HasKey<FieldConfig, 'formItemProps'>

    expectTypeOf<FieldConfigHasSource>().toEqualTypeOf<false>()
    expectTypeOf<FieldConfigHasPlugins>().toEqualTypeOf<false>()
    expectTypeOf<FieldConfigHasFormItemProps>().toEqualTypeOf<false>()

    const fieldConfig: FieldConfig = {
      component: 'input',
      field: 'manual-field-config',
    }

    expect(fieldConfig.field).toBe('manual-field-config')
  })

  it('accepts render functions as component renderers', () => {
    defineField({
      field: 'role',
      component: (context: RenderContext) => {
        expectTypeOf(context.values.role).toEqualTypeOf<unknown>()
        expectTypeOf(context.getValue('role')).toEqualTypeOf<unknown>()
        return null
      },
      defaultValue: 'admin',
    })
  })

  it('accepts a field root id separately from control props', () => {
    const field = defineField({
      field: 'keyword',
      component: 'input',
      id: 'source-keyword',
      props: {
        placeholder: '请输入关键词',
      },
    })

    expect(field.id).toBe('source-keyword')
    expect(field.props?.placeholder).toBe('请输入关键词')
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

  it('accepts render functions in slot content with context first', () => {
    defineField({
      field: 'host',
      component: 'div',
      slots: {
        default: (context: RenderContext, slotProps: { label: string }) => {
          expectTypeOf(context.getValue('host')).toEqualTypeOf<unknown>()
          expectTypeOf(slotProps.label).toEqualTypeOf<string>()
          return null
        },
      },
    })
  })

  it('restricts slot content to field configs, arrays, or render functions', () => {
    type FieldConfigIsSlotContent = IsAssignable<FormNodeConfig, SlotContent>
    type FieldConfigArrayIsSlotContent = IsAssignable<FormNodeConfig[], SlotContent>
    type TextIsSlotContent = IsAssignable<string, SlotContent>
    type FunctionIsSlotContent = IsAssignable<(context: { values: Record<string, unknown> }) => unknown, SlotContent>
    type NullIsSlotContent = IsAssignable<null, SlotContent>

    expectTypeOf<FieldConfigIsSlotContent>().toEqualTypeOf<true>()
    expectTypeOf<FieldConfigArrayIsSlotContent>().toEqualTypeOf<true>()
    expectTypeOf<TextIsSlotContent>().toEqualTypeOf<false>()
    expectTypeOf<FunctionIsSlotContent>().toEqualTypeOf<true>()
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
      required: values => values.remember,
      requiredMessage: '请输入用户名',
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

    defineField<LoginForm>({
      field: 'username',
      component: (context: ConfigFormRenderContext<LoginForm>) => {
        expectTypeOf(context.values.username).toEqualTypeOf<string>()
        expectTypeOf(context.getValue('remember')).toEqualTypeOf<boolean>()
        return null
      },
      defaultValue: '',
    })

    type MissingIsLoginField = IsAssignable<'missing', FieldKey<LoginForm>>
    type StringIsAgeValue = IsAssignable<string, LoginForm['age']>

    expectTypeOf<MissingIsLoginField>().toEqualTypeOf<false>()
    expectTypeOf<StringIsAgeValue>().toEqualTypeOf<false>()
  })
})
