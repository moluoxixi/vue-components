import type { ElementConfigFormProps } from '../index'
import { describe, expect, it } from 'vitest'

interface UserForm {
  name: string
  status: string
}

const elementFields = [
  {
    colProps: { class: 'profile-cell' },
    component: 'input',
    field: 'name',
    formItemProps: { class: 'profile-field' },
    label: '姓名',
    span: 12,
  },
] satisfies ElementConfigFormProps<UserForm>['fields']

const elementProps = {
  columns: 12,
  fields: elementFields,
  gap: '12px',
  inline: true,
  rowProps: { class: 'profile-grid' },
} satisfies ElementConfigFormProps<UserForm>

const elementInvalidFields = [
  {
    colProps: {
      // @ts-expect-error Native grid cell props do not accept UI Row gutter.
      gutter: 16,
    },
    component: 'input',
    field: 'name',
    label: '姓名',
  },
] satisfies ElementConfigFormProps<UserForm>['fields']

void elementInvalidFields

describe('config form ui prop types', () => {
  it('使用原生 Grid/Flex 布局与字段壳类型', () => {
    expect(elementFields).toHaveLength(1)
    expect(elementProps.columns).toBe(12)
  })
})
