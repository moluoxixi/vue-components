import type { ShadcnConfigFormProps } from './index'
import { describe, expect, it } from 'vitest'

interface UserForm {
  name: string
}

const shadcnFields = [
  {
    colProps: { class: 'basis-full', style: { gridColumn: 'span 2 / span 2' } },
    component: 'input',
    field: 'name',
    formItemProps: { class: 'space-y-2' },
    label: '姓名',
  },
] satisfies ShadcnConfigFormProps<UserForm>['fields']

const shadcnProps = {
  fields: shadcnFields,
  inline: true,
  rowProps: { class: 'flex flex-wrap' },
} satisfies ShadcnConfigFormProps<UserForm>

const shadcnInvalidFields = [
  {
    colProps: {
      // @ts-expect-error ShadcnConfigForm grid cell props are DOM attributes, not UI Row props.
      gutter: 16,
    },
    component: 'input',
    field: 'name',
    formItemProps: {
      // @ts-expect-error ShadcnConfigForm field shell props are DOM attributes.
      labelCol: { span: 6 },
    },
    label: '姓名',
  },
] satisfies ShadcnConfigFormProps<UserForm>['fields']

void shadcnInvalidFields

describe('config form ui prop types', () => {
  it('保留 shadcn-vue 版本的 formItemProps 和 colProps 类型示例', () => {
    expect(shadcnFields).toHaveLength(1)
    expect(shadcnProps.inline).toBe(true)
  })
})
