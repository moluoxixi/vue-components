import type { AntdConfigFormProps } from '../AntdConfigForm'
import type { ShadcnConfigFormProps } from '../ShadcnConfigForm'
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

const antdFields = [
  {
    colProps: { span: 8 },
    component: 'input',
    field: 'status',
    formItemProps: { help: '请选择状态', labelCol: { span: 6 } },
    label: '状态',
  },
] satisfies AntdConfigFormProps<UserForm>['fields']

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

const shadcnFields = [
  {
    colProps: { class: 'basis-full', style: { gridColumn: 'span 2 / span 2' } },
    component: 'input',
    field: 'name',
    formItemProps: { class: 'space-y-2' },
    label: '姓名',
  },
] satisfies ShadcnConfigFormProps<UserForm>['fields']

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

void elementInvalidFields
void antdInvalidFields
void shadcnInvalidFields

describe('config form ui prop types', () => {
  it('保留各 UI 版本的 formItemProps 和 colProps 类型示例', () => {
    expect(elementFields).toHaveLength(1)
    expect(antdFields).toHaveLength(1)
    expect(shadcnFields).toHaveLength(1)
  })
})
