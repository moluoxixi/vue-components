import type { ElementConfigFormProps } from './index'
import { describe, expect, it } from 'vitest'

interface UserForm {
  name: string
  status: string
}

const elementFields = [
  {
    colProps: { span: 12 },
    component: 'input',
    field: 'name',
    formItemProps: { labelWidth: 120 },
    label: '姓名',
  },
] satisfies ElementConfigFormProps<UserForm>['fields']

const elementInvalidFields = [
  {
    colProps: {
      // @ts-expect-error Element Plus Col props do not accept Row gutter.
      gutter: 16,
    },
    component: 'input',
    field: 'name',
    formItemProps: {
      // @ts-expect-error label is controlled by the field config, not formItemProps.
      label: '姓名',
    },
    label: '姓名',
  },
] satisfies ElementConfigFormProps<UserForm>['fields']

void elementInvalidFields

describe('config form ui prop types', () => {
  it('保留 Element Plus 版本的 formItemProps 和 colProps 类型示例', () => {
    expect(elementFields).toHaveLength(1)
  })
})
