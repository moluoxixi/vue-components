import type { AntdConfigFormProps } from '../index'
import { describe, expect, it } from 'vitest'

interface UserForm {
  status: string
}

const antdFields = [
  {
    colProps: { span: 8 },
    component: 'input',
    field: 'status',
    formItemProps: { class: 'status-field' },
    label: '状态',
  },
] satisfies AntdConfigFormProps<UserForm>['fields']

const antdProps = {
  fields: antdFields,
  inline: true,
  rowProps: { justify: 'start' },
} satisfies AntdConfigFormProps<UserForm>

const antdInvalidFields = [
  {
    colProps: {
      // @ts-expect-error Ant Design Vue Col props do not accept Row gutter.
      gutter: 16,
    },
    component: 'input',
    field: 'status',
    label: '状态',
  },
] satisfies AntdConfigFormProps<UserForm>['fields']

void antdInvalidFields

describe('config form ui prop types', () => {
  it('保留 Ant Design Vue Row/Col 与原生字段壳类型示例', () => {
    expect(antdFields).toHaveLength(1)
    expect(antdProps.inline).toBe(true)
  })
})
