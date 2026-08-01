import type { ShadcnConfigFormProps } from '../index'
import { describe, expect, it } from 'vitest'

interface UserForm {
  name: string
}

const shadcnFields = [
  {
    cellAttrs: { class: 'basis-full', style: { gridColumn: 'span 2 / span 2' } },
    component: 'input',
    field: 'name',
    fieldAttrs: { class: 'space-y-2' },
    label: '姓名',
  },
] satisfies ShadcnConfigFormProps<UserForm>['fields']

const shadcnProps = {
  cellAttrs: { class: 'default-cell' },
  fields: shadcnFields,
  formAttrs: { autocomplete: 'off' },
  inline: true,
  layoutAttrs: { class: 'flex flex-wrap' },
} satisfies ShadcnConfigFormProps<UserForm>

const shadcnInvalidFields = [
  {
    cellAttrs: {
      // @ts-expect-error ShadcnConfigForm grid cell props are DOM attributes, not UI Row props.
      gutter: 16,
    },
    component: 'input',
    field: 'name',
    fieldAttrs: {
      // @ts-expect-error ShadcnConfigForm field shell props are DOM attributes.
      labelCol: { span: 6 },
    },
    label: '姓名',
  },
] satisfies ShadcnConfigFormProps<UserForm>['fields']

const shadcnInvalidProps = {
  fields: shadcnFields,
  formAttrs: {
    // @ts-expect-error Native form attrs do not accept component-only props.
    orientation: 'vertical',
  },
  layoutAttrs: {
    // @ts-expect-error Native layout attrs do not accept UI Row gutter.
    gutter: 16,
  },
} satisfies ShadcnConfigFormProps<UserForm>

void shadcnInvalidFields
void shadcnInvalidProps

describe('config form ui prop types', () => {
  it('使用原生 Grid/Flex 布局与字段壳类型', () => {
    expect(shadcnFields).toHaveLength(1)
    expect(shadcnProps.formAttrs.autocomplete).toBe('off')
    expect(shadcnProps.inline).toBe(true)
  })
})
