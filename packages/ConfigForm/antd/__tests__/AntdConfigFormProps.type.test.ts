import type { AntdConfigFormProps } from '../index'
import { describe, expect, it } from 'vitest'

interface UserForm {
  status: string
}

const antdFields = [
  {
    colProps: { class: 'status-cell' },
    component: 'input',
    field: 'status',
    formItemProps: { class: 'status-field' },
    label: '状态',
    span: 8,
  },
] satisfies AntdConfigFormProps<UserForm>['fields']

const antdProps = {
  fields: antdFields,
  inline: true,
  rowProps: { class: 'status-grid' },
} satisfies AntdConfigFormProps<UserForm>

const antdInvalidFields = [
  {
    colProps: {
      // @ts-expect-error Native grid cell props do not accept UI Row gutter.
      gutter: 16,
    },
    component: 'input',
    field: 'status',
    label: '状态',
  },
] satisfies AntdConfigFormProps<UserForm>['fields']

void antdInvalidFields

describe('config form ui prop types', () => {
  it('使用原生 Grid/Flex 布局与字段壳类型', () => {
    expect(antdFields).toHaveLength(1)
    expect(antdProps.inline).toBe(true)
  })
})
