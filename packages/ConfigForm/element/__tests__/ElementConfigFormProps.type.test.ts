import type { ConfigFormRendererProps } from '@moluoxixi/config-form/renderer'
import type { ElementConfigFormDefaultSlotContext, ElementConfigFormProps } from '../index'
import { describe, expect, it } from 'vitest'

interface UserForm {
  name: string
  status: string
}

const elementMeta: ElementConfigFormDefaultSlotContext<UserForm>['meta'] = {
  dirty: false,
  fields: {},
  touched: false,
}

const elementFields = [
  {
    cellAttrs: { class: 'profile-cell' },
    component: 'input',
    field: 'name',
    fieldAttrs: { class: 'profile-field' },
    label: '姓名',
    span: 12,
  },
] satisfies ElementConfigFormProps<UserForm>['fields']

const elementProps = {
  cellAttrs: { class: 'default-cell' },
  fields: elementFields,
  formAttrs: { autocomplete: 'off' },
  inline: true,
  layoutAttrs: { class: 'profile-grid' },
} satisfies ElementConfigFormProps<UserForm>

const rendererAttrs: Pick<
  ConfigFormRendererProps<UserForm>,
  'cellAttrs' | 'formAttrs' | 'layoutAttrs'
> = {} as Pick<
  ElementConfigFormProps<UserForm>,
  'cellAttrs' | 'formAttrs' | 'layoutAttrs'
>

const elementInvalidFields = [
  {
    cellAttrs: {
      // @ts-expect-error Native grid cell props do not accept UI Row gutter.
      gutter: 16,
    },
    component: 'input',
    field: 'name',
    fieldAttrs: {
      // @ts-expect-error Native field shell attrs do not accept UI FormItem layout props.
      labelWidth: 120,
    },
    label: '姓名',
  },
] satisfies ElementConfigFormProps<UserForm>['fields']

const elementInvalidProps = {
  fields: elementFields,
  formAttrs: {
    // @ts-expect-error Native form attrs do not accept UI Form props.
    labelPosition: 'top',
  },
  layoutAttrs: {
    // @ts-expect-error Native layout attrs do not accept UI Row gutter.
    gutter: 16,
  },
} satisfies ElementConfigFormProps<UserForm>

void elementInvalidFields
void elementInvalidProps
void elementMeta
void rendererAttrs

describe('config form ui prop types', () => {
  it('使用原生 Grid/Flex 布局与字段壳类型', () => {
    expect(elementFields).toHaveLength(1)
    expect(elementProps.formAttrs.autocomplete).toBe('off')
    expect(elementProps.inline).toBe(true)
  })
})
