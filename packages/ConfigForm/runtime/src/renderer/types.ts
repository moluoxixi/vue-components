import type {
  ConfigFormCondition,
  ConfigFormController,
  ConfigFormDataAttributes,
  ConfigFormErrors,
  ConfigFormField,
  ConfigFormFieldChangePayload,
  ConfigFormFieldKey,
  ConfigFormNode,
  ConfigFormReadonlyRender,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { Component, FormHTMLAttributes, HTMLAttributes } from 'vue'

export type ConfigFormRendererFormAttrs = FormHTMLAttributes
export type ConfigFormRendererLayoutAttrs = HTMLAttributes & ConfigFormDataAttributes
export type ConfigFormRendererCellAttrs = HTMLAttributes & ConfigFormDataAttributes
export type ConfigFormRendererFieldAttrs = HTMLAttributes & ConfigFormDataAttributes

export type ConfigFormRendererNode<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormNode<
    TValues,
    Component | string,
    ConfigFormRendererFieldAttrs,
    ConfigFormRendererCellAttrs
  >

export type ConfigFormRendererField<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormField<
    TValues,
    Component | string,
    ConfigFormRendererFieldAttrs,
    ConfigFormRendererCellAttrs
  >

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
  readonlyRender?: ConfigFormReadonlyRender<
    TValues,
    Component | string,
    ConfigFormRendererFieldAttrs,
    ConfigFormRendererCellAttrs
  >
  formAttrs?: ConfigFormRendererFormAttrs
  inline?: boolean
  columns?: number
  gap?: string
  fieldSpan?: number
  /** 透传给原生 Grid/Flex 布局容器。 */
  layoutAttrs?: ConfigFormRendererLayoutAttrs
  /** 透传给原生 grid cell；inline 布局不消费。 */
  cellAttrs?: ConfigFormRendererCellAttrs
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
