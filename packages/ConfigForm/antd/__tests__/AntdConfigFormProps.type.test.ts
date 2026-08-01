import type { AntdConfigFormProps } from '../index'
import { describe, expect, it } from 'vitest'

interface UserForm {
  status: string
}

const antdFields = [
  {
    cellAttrs: { class: 'status-cell' },
    component: 'input',
    field: 'status',
    fieldAttrs: { class: 'status-field' },
    label: '状态',
    span: 8,
  },
] satisfies AntdConfigFormProps<UserForm>['fields']

const antdProps = {
  cellAttrs: { class: 'default-cell' },
  fields: antdFields,
  formAttrs: { autocomplete: 'off' },
  inline: true,
  layoutAttrs: { class: 'status-grid' },
} satisfies AntdConfigFormProps<UserForm>

const antdInvalidFields = [
  {
    cellAttrs: {
      // @ts-expect-error Native grid cell props do not accept UI Row gutter.
      gutter: 16,
    },
    component: 'input',
    field: 'status',
    fieldAttrs: {
      // @ts-expect-error Native field shell attrs do not accept UI FormItem layout props.
      labelCol: { span: 6 },
    },
    label: '状态',
  },
] satisfies AntdConfigFormProps<UserForm>['fields']

const antdInvalidProps = {
  fields: antdFields,
  formAttrs: {
    // @ts-expect-error Native form attrs do not accept UI Form props.
    labelCol: { span: 6 },
  },
  layoutAttrs: {
    // @ts-expect-error Native layout attrs do not accept UI Row gutter.
    gutter: 16,
  },
} satisfies AntdConfigFormProps<UserForm>

void antdInvalidFields
void antdInvalidProps

describe('config form ui prop types', () => {
  it('使用原生 Grid/Flex 布局与字段壳类型', () => {
    expect(antdFields).toHaveLength(1)
    expect(antdProps.formAttrs.autocomplete).toBe('off')
    expect(antdProps.inline).toBe(true)
  })
})
