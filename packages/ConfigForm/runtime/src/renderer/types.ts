import type {
  ConfigFormAttrs,
  ConfigFormCondition,
  ConfigFormController,
  ConfigFormErrors,
  ConfigFormField,
  ConfigFormFieldChangePayload,
  ConfigFormFieldKey,
  ConfigFormNode,
  ConfigFormReadonlyRender,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { Component, FormHTMLAttributes, HTMLAttributes } from 'vue'

export type ConfigFormRendererNode<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormNode<TValues, Component | string, HTMLAttributes, HTMLAttributes>

export type ConfigFormRendererField<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormField<TValues, Component | string, HTMLAttributes, HTMLAttributes>

export interface ConfigFormControlBinding {
  trigger: string
  valueProp: string
}

export type ConfigFormControlBindingResolver<TValues extends ConfigFormValues = ConfigFormValues>
  = (field: ConfigFormRendererField<TValues>) => Partial<ConfigFormControlBinding> | undefined

export interface ConfigFormRendererProps<TValues extends ConfigFormValues = ConfigFormValues> {
  fields: ConfigFormRendererNode<TValues>[]
  defaultValues?: Partial<TValues>
  readonly?: ConfigFormCondition<TValues>
  readonlyRender?: ConfigFormReadonlyRender<TValues, Component | string, HTMLAttributes, HTMLAttributes>
  formProps?: FormHTMLAttributes & ConfigFormAttrs
  inline?: boolean
  columns?: number
  gap?: string
  fieldSpan?: number
  /** 透传给原生布局 div。保留名称以兼容现有 ConfigForm API。 */
  rowProps?: HTMLAttributes & ConfigFormAttrs
  /** 透传给原生字段单元格 div。保留名称以兼容现有 ConfigForm API。 */
  colProps?: HTMLAttributes & ConfigFormAttrs
  namespace?: string
  defaultValueProp?: string
  defaultTrigger?: string
  resolveBinding?: ConfigFormControlBindingResolver<TValues>
}

export interface ConfigFormRendererEmits<TValues extends ConfigFormValues = ConfigFormValues> {
  (event: 'change', values: TValues): void
  (event: 'error', errors: ConfigFormErrors): void
  (event: 'fieldChange', payload: ConfigFormFieldChangePayload<TValues>): void
  (event: 'submit', values: TValues): void
}

export interface ConfigFormRendererExpose<TValues extends ConfigFormValues = ConfigFormValues>
  extends Pick<
    ConfigFormController<TValues>,
    | 'clearValidate'
    | 'getErrors'
    | 'getValidating'
    | 'getValue'
    | 'getValues'
    | 'resetFields'
    | 'setValue'
    | 'setValues'
    | 'submit'
    | 'validate'
    | 'validateField'
  > {
  scrollToField: (field: ConfigFormFieldKey<TValues> | string) => void
}
