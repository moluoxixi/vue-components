import type { Component, VNodeChild } from 'vue'
import type { ZodTypeAny } from 'zod'

export type ConfigFormValues = Record<string, any>
export type ConfigFormFieldKey<TValues extends ConfigFormValues = ConfigFormValues> = Extract<keyof TValues, string>
export type ConfigFormCondition<TValues extends ConfigFormValues = ConfigFormValues> = boolean | ((values: TValues) => boolean)
export type ConfigFormColumnSpan = number
export type ConfigFormAttrs = Record<string, unknown>
export type ConfigFormDataAttributes = { [TKey in `data-${string}`]?: unknown }
export type ConfigFormValidateTrigger = 'submit' | 'blur' | 'change'
export type ConfigFormFieldValidatorResult = string | string[] | void | null | undefined

export interface ConfigFormErrors {
  [field: string]: string[]
}

export type ConfigFormFieldValidator<
  TValues extends ConfigFormValues = ConfigFormValues,
  TValue = unknown,
> = (
  value: TValue,
  values: TValues,
) => ConfigFormFieldValidatorResult | Promise<ConfigFormFieldValidatorResult>

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

export interface ConfigFormReadonlyRenderContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
  TValue = unknown,
> {
  /** 当前字段配置。 */
  field: ConfigFormField<TValues, TComponent, TFormItemProps, TColProps>
  /** 当前表单值快照。 */
  model: TValues
  /** 当前字段值。 */
  value: TValue
  /** 编辑组件原本会收到的静态 props，不包含值和事件监听。 */
  componentProps: ConfigFormAttrs
}

export type ConfigFormReadonlyRender<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
  TValue = unknown,
> = (
  context: ConfigFormReadonlyRenderContext<TValues, TComponent, TFormItemProps, TColProps, TValue>,
) => VNodeChild

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
  /** 透传给 renderer grid cell 的 props；inline 布局不消费。 */
  colProps?: TColProps
  /** grid 布局下的栅格跨度，默认使用 ConfigForm.fieldSpan。 */
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
  /** 共享字段壳 label；未提供时仍保留字段壳、错误 DOM 与 ARIA。 */
  label?: string
  /** 透传给真实字段组件的 slots，支持 render 函数或配置化节点。 */
  slots?: ConfigFormFieldSlots<TValues, Component | string, TFormItemProps, TColProps>
  /** 透传给共享字段壳的 props，field/label/error 由 renderer 统一接管。 */
  formItemProps?: TFormItemProps
  /** 必填标记；函数形式可基于当前表单值动态计算。 */
  required?: ConfigFormCondition<TValues>
  /** 必填校验失败时展示的错误文案。 */
  requiredMessage?: string
  /** 字段值的 Zod schema。 */
  schema?: ZodTypeAny
  /** schema 通过后执行的同步或异步业务校验。 */
  validator?: ConfigFormFieldValidator<TValues>
  /** 字段校验触发时机；submit 始终会执行。 */
  validateOn?: ConfigFormValidateTrigger | ConfigFormValidateTrigger[]
  /** 当前模型缺少该字段时采用的默认值，同时作为 reset 基准。 */
  defaultValue?: unknown
  /** 控制字段组件是否禁用。 */
  disabled?: ConfigFormCondition<TValues>
  /** 控制字段是否进入展示态；展示态跳过校验但仍参与提交。 */
  readonly?: ConfigFormCondition<TValues>
  /** 当前字段进入展示态时优先使用的渲染函数。 */
  readonlyRender?: ConfigFormReadonlyRender<TValues, TComponent, TFormItemProps, TColProps>
  /** 隐藏字段是否仍参与提交和 submit 校验。 */
  submitWhenHidden?: boolean
  /** 禁用字段是否仍参与提交和 submit 校验。 */
  submitWhenDisabled?: boolean
  /** 校验通过后，在提交快照中转换当前字段值。 */
  transform?: (value: unknown, values: TValues) => unknown
  /** 写入字段值的 prop 名，默认 modelValue。 */
  valueProp?: string
  /** 写回字段值的事件名，默认 update:modelValue。 */
  trigger?: string
  /** 触发 blur 校验的事件名，默认 blur。 */
  blurTrigger?: string
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
  /** reset 使用的显式初始值；未提供时捕获首次 model。 */
  defaultValues?: Partial<TValues>
  /** 表单级展示态；命中后所有字段进入 readonly。 */
  readonly?: ConfigFormCondition<TValues>
  /** 字段未声明 readonlyRender 时使用的表单级展示渲染函数。 */
  readonlyRender?: ConfigFormReadonlyRender<TValues, TComponent, TFormItemProps, TColProps>
  /** 透传给 renderer 原生 form 壳的 props。 */
  formProps?: TFormProps
  /** 是否使用行内布局；行内布局使用 Flex 容器，不消费 span 或 colProps。 */
  inline?: boolean
  /** 透传给 renderer 原生 Grid/Flex 布局容器的 props。 */
  rowProps?: TRowProps
  /** 透传给 renderer 原生 grid cell 的默认 props；仅 grid 布局消费。 */
  colProps?: TColProps
  /** grid 布局下的字段默认栅格跨度。 */
  fieldSpan?: ConfigFormColumnSpan
}
