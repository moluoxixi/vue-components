import type { AntdConfigFormProps } from './index'
import { describe, expect, it } from 'vitest'

interface UserForm {
  status: string
}

const antdFields = [
  {
    colProps: { span: 8 },
    component: 'input',
    field: 'status',
    formItemProps: { help: '请选择状态', labelCol: { span: 6 } },
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
    formItemProps: {
      // @ts-expect-error name is controlled by the field config, not formItemProps.
      name: 'status',
    },
    label: '状态',
  },
] satisfies AntdConfigFormProps<UserForm>['fields']

void antdInvalidFields

describe('config form ui prop types', () => {
  it('保留 Ant Design Vue 版本的 formItemProps 和 colProps 类型示例', () => {
    expect(antdFields).toHaveLength(1)
    expect(antdProps.inline).toBe(true)
  })
})
