import type { ElementConfigFormProps } from '../index'
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
    formItemProps: { class: 'profile-field' },
    label: '姓名',
  },
] satisfies ElementConfigFormProps<UserForm>['fields']

const elementProps = {
  fields: elementFields,
  inline: true,
  rowProps: { justify: 'start' },
} satisfies ElementConfigFormProps<UserForm>

const elementInvalidFields = [
  {
    colProps: {
      // @ts-expect-error Element Plus Col props do not accept Row gutter.
      gutter: 16,
    },
    component: 'input',
    field: 'name',
    label: '姓名',
  },
] satisfies ElementConfigFormProps<UserForm>['fields']

void elementInvalidFields

describe('config form ui prop types', () => {
  it('保留 Element Plus Row/Col 与原生字段壳类型示例', () => {
    expect(elementFields).toHaveLength(1)
    expect(elementProps.inline).toBe(true)
  })
})
