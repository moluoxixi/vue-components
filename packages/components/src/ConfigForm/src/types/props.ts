import type { Component, VNodeChild } from 'vue'

export type ConfigFormValues = Record<string, any>
export type ConfigFormFieldKey<TValues extends ConfigFormValues = ConfigFormValues> = Extract<keyof TValues, string>
export type ConfigFormCondition<TValues extends ConfigFormValues = ConfigFormValues> = boolean | ((values: TValues) => boolean)
export type ConfigFormColumnSpan = number
export type ConfigFormAttrs = Record<string, unknown>
export type ConfigFormRule = ConfigFormAttrs
export type ConfigFormRules<TValues extends ConfigFormValues = ConfigFormValues> = Partial<
  Record<ConfigFormFieldKey<TValues> | string, ConfigFormRule | ConfigFormRule[]>
>

export interface ConfigFormComponentSlotContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
> {
  /** 当前容器节点配置，供 render slot 读取容器元信息。 */
  node: ConfigFormComponentNode<TValues, TComponent, TFormItemProps, TColProps>
  /** 当前表单值快照。 */
  model: TValues
  /** 真实 Vue 组件传出的原始 slot 作用域参数。 */
  slotProps: Record<string, unknown>
}

export interface ConfigFormFieldSlotContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
> {
  /** 当前字段配置，供 slot 读取字段元信息。 */
  field: ConfigFormField<TValues, TComponent, TFormItemProps, TColProps>
  /** 当前表单值快照。 */
  model: TValues
  /** 当前字段值。 */
  value: unknown
  /** 真实 Vue 组件传出的原始 slot 作用域参数。 */
  slotProps: Record<string, unknown>
  /** 在 slot 内主动写回当前字段值。 */
  setValue: (value: unknown) => void
}

export type ConfigFormComponentSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
> = (
  context: ConfigFormComponentSlotContext<TValues, TComponent, TFormItemProps, TColProps>,
) => VNodeChild

export type ConfigFormFieldSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
> = (
  context: ConfigFormFieldSlotContext<TValues, TComponent, TFormItemProps, TColProps>,
) => VNodeChild

export type ConfigFormSlotConfig<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>
  = | ConfigFormNode<TValues, TComponent, TFormItemProps, TColProps>
    | ConfigFormNode<TValues, TComponent, TFormItemProps, TColProps>[]

export type ConfigFormComponentSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>
  = | ConfigFormSlotConfig<TValues, TComponent, TFormItemProps, TColProps>
    | ConfigFormComponentSlot<TValues, TComponent, TFormItemProps, TColProps>

export type ConfigFormFieldSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>
  = | ConfigFormSlotConfig<TValues, TComponent, TFormItemProps, TColProps>
    | ConfigFormFieldSlot<TValues, TComponent, TFormItemProps, TColProps>

export type ConfigFormComponentSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
> = Record<
  string,
  ConfigFormComponentSlotContent<TValues, TComponent, TFormItemProps, TColProps>
>

export type ConfigFormFieldSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
> = Record<
  string,
  ConfigFormFieldSlotContent<TValues, TComponent, TFormItemProps, TColProps>
>

export interface ConfigFormNodeBase<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TColProps = ConfigFormAttrs,
> {
  /** 真实渲染的 UI 组件、业务组件或原生标签。 */
  component: TComponent
  /** 透传给真实字段组件的 props。 */
  props?: ConfigFormAttrs
  /** 透传给当前 UI 版本列容器的 props。 */
  colProps?: TColProps
  /** 栅格跨度，默认使用 ConfigForm.fieldSpan。 */
  span?: ConfigFormColumnSpan
  /** 控制当前节点是否渲染；函数形式可基于当前表单值动态计算。 */
  visible?: ConfigFormCondition<TValues>
  /** 控制当前节点及其 slot 子树是否渲染。 */
  hidden?: ConfigFormCondition<TValues>
}

export interface ConfigFormComponentNode<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
> extends ConfigFormNodeBase<TValues, TComponent, TColProps> {
  /** 容器节点的子级 slots；不绑定表单值，也不生成字段壳。 */
  slots?: ConfigFormComponentSlots<TValues, Component | string, TFormItemProps, TColProps>
}

export interface ConfigFormField<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
> extends ConfigFormNodeBase<TValues, TComponent, TColProps> {
  /** 当前字段绑定的模型 key。 */
  field: ConfigFormFieldKey<TValues> | string
  /** 当前 UI 版本 FormItem/字段壳 label。 */
  label?: string
  /** 透传给真实字段组件的 slots，支持 render 函数或配置化节点。 */
  slots?: ConfigFormFieldSlots<TValues, Component | string, TFormItemProps, TColProps>
  /** 透传给当前 UI 版本 FormItem/字段壳的 props，field/label/rules 由字段契约统一接管。 */
  formItemProps?: TFormItemProps
  /** 字段级校验规则，由当前 UI 版本的表单实现消费。 */
  rules?: ConfigFormRule | ConfigFormRule[]
  /** 必填标记；函数形式可基于当前表单值动态计算。 */
  required?: ConfigFormCondition<TValues>
  /** 控制字段组件是否禁用。 */
  disabled?: ConfigFormCondition<TValues>
  /** 写入字段值的 prop 名，默认 modelValue。 */
  valueProp?: string
  /** 写回字段值的事件名，默认 update:modelValue。 */
  trigger?: string
  /** 从组件事件参数中提取字段值，默认取第一个参数。 */
  getValueFromEvent?: (...args: unknown[]) => unknown
}

export type ConfigFormNode<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>
  = | ConfigFormField<TValues, TComponent, TFormItemProps, TColProps>
    | ConfigFormComponentNode<TValues, TComponent, TFormItemProps, TColProps>

export interface ConfigFormProps<
  TValues extends ConfigFormValues = ConfigFormValues,
  TFormProps = ConfigFormAttrs,
  TRowProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
  TFormItemProps = ConfigFormAttrs,
  TComponent = Component | string,
> {
  /** 表单节点配置；字段节点绑定表单值，容器节点只渲染组件和 slots。 */
  fields: ConfigFormNode<TValues, TComponent, TFormItemProps, TColProps>[]
  /** 当前 UI 版本 Form 全局校验规则。 */
  rules?: ConfigFormRules<TValues>
  /** 透传给当前 UI 版本 Form 的 props，model/rules 由 ConfigForm 托管。 */
  formProps?: TFormProps
  /** 透传给当前 UI 版本 Row/布局容器的 props。 */
  rowProps?: TRowProps
  /** 透传给当前 UI 版本 Col/单元格的默认 props。 */
  colProps?: TColProps
  /** 字段默认栅格跨度。 */
  fieldSpan?: ConfigFormColumnSpan
}
