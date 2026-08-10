import type { Component, VNodeChild } from 'vue'
import type { ZodTypeAny } from 'zod'
import type { ConfigFormFieldMeta, ConfigFormMeta } from './meta'

export type ConfigFormValues = Record<string, any>
export type ConfigFormFieldKey<TValues extends ConfigFormValues = ConfigFormValues> = Extract<keyof TValues, string>
export type ConfigFormCondition<TValues extends ConfigFormValues = ConfigFormValues> = boolean | ((values: TValues) => boolean)
export type ConfigFormColumnSpan = number
export type ConfigFormAttrs = Record<string, unknown>
/**
 * 字符串组件别名的注册项。
 *
 * 注册项除了真实组件，还可以声明默认 props 和值绑定协议。字段自身显式声明的
 * 绑定配置拥有更高优先级；extensions 等非渲染元数据不会进入这里。
 */
export interface ConfigFormComponentRegistration<TComponent = Component> {
  component: TComponent
  props?: ConfigFormAttrs
  valueProp?: string
  trigger?: string
  blurTrigger?: string
  getValueFromEvent?: (...args: unknown[]) => unknown
}

/** 按字符串别名解析真实组件或带默认绑定协议的注册项。 */
export type ConfigFormComponentRegistry<TComponent = Component> = Record<
  string,
  TComponent | ConfigFormComponentRegistration<TComponent>
>
/**
 * 供设计器、适配器和业务插件消费的非渲染元数据。
 *
 * extensions 不会自动传给真实组件或 DOM；需要持久化的内容应保持 JSON 可序列化，
 * 并使用命名空间避免不同扩展之间发生 key 冲突。
 */
export type ConfigFormExtensions = Record<string, unknown>
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
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
> {
  /** 当前容器节点配置，供 render slot 读取容器元信息。 */
  node: ConfigFormComponentNode<TValues, TComponent, TFieldAttrs, TCellAttrs>
  /** 当前表单值快照。 */
  model: TValues
  /** 当前表单的 dirty/touched 状态。 */
  meta: ConfigFormMeta
  /** 真实 Vue 组件传出的原始 slot 作用域参数。 */
  slotProps: Record<string, unknown>
}

export interface ConfigFormFieldSlotContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
> {
  /** 当前字段配置，供 slot 读取字段元信息。 */
  field: ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>
  /** 当前表单值快照。 */
  model: TValues
  /** 当前字段的 dirty/touched 状态。 */
  meta: ConfigFormFieldMeta
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
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
  TValue = unknown,
> {
  /** 当前字段配置。 */
  field: ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>
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
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
  TValue = unknown,
> = (
  context: ConfigFormReadonlyRenderContext<TValues, TComponent, TFieldAttrs, TCellAttrs, TValue>,
) => VNodeChild

export type ConfigFormComponentSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
> = (
  context: ConfigFormComponentSlotContext<TValues, TComponent, TFieldAttrs, TCellAttrs>,
) => VNodeChild

export type ConfigFormFieldSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
> = (
  context: ConfigFormFieldSlotContext<TValues, TComponent, TFieldAttrs, TCellAttrs>,
) => VNodeChild

export type ConfigFormSlotConfig<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
>
  = | ConfigFormNode<TValues, TComponent, TFieldAttrs, TCellAttrs>
    | ConfigFormNode<TValues, TComponent, TFieldAttrs, TCellAttrs>[]

export type ConfigFormComponentSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
>
  = | ConfigFormSlotConfig<TValues, TComponent, TFieldAttrs, TCellAttrs>
    | ConfigFormComponentSlot<TValues, TComponent, TFieldAttrs, TCellAttrs>

export type ConfigFormFieldSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
>
  = | ConfigFormSlotConfig<TValues, TComponent, TFieldAttrs, TCellAttrs>
    | ConfigFormFieldSlot<TValues, TComponent, TFieldAttrs, TCellAttrs>

export type ConfigFormComponentSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
> = Record<
  string,
  ConfigFormComponentSlotContent<TValues, TComponent, TFieldAttrs, TCellAttrs>
>

export type ConfigFormFieldSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
> = Record<
  string,
  ConfigFormFieldSlotContent<TValues, TComponent, TFieldAttrs, TCellAttrs>
>

export interface ConfigFormNodeBase<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TCellAttrs = ConfigFormAttrs,
> {
  /** 真实渲染的 UI 组件、业务组件或原生标签。 */
  component: TComponent
  /** 透传给真实字段组件的 props。 */
  props?: ConfigFormAttrs
  /** 不参与渲染的扩展元数据；由 designer/adapter/plugin 按命名空间消费。 */
  extensions?: ConfigFormExtensions
  /** 透传给 renderer grid cell 的 attributes；inline 布局不消费。 */
  cellAttrs?: TCellAttrs
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
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
> extends ConfigFormNodeBase<TValues, TComponent, TCellAttrs> {
  /** 容器节点的子级 slots；不绑定表单值，也不生成字段壳。 */
  slots?: ConfigFormComponentSlots<TValues, Component | string, TFieldAttrs, TCellAttrs>
}

export interface ConfigFormField<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
> extends ConfigFormNodeBase<TValues, TComponent, TCellAttrs> {
  /** 当前字段绑定的模型 key。 */
  field: ConfigFormFieldKey<TValues> | string
  /** 共享字段壳 label；未提供时仍保留字段壳、错误 DOM 与 ARIA。 */
  label?: string
  /** 透传给真实字段组件的 slots，支持 render 函数或配置化节点。 */
  slots?: ConfigFormFieldSlots<TValues, Component | string, TFieldAttrs, TCellAttrs>
  /** 透传给共享字段壳的 attributes，field/label/error 由 renderer 统一接管。 */
  fieldAttrs?: TFieldAttrs
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
  readonlyRender?: ConfigFormReadonlyRender<TValues, TComponent, TFieldAttrs, TCellAttrs>
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
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
>
  = | ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>
    | ConfigFormComponentNode<TValues, TComponent, TFieldAttrs, TCellAttrs>

export interface ConfigFormProps<
  TValues extends ConfigFormValues = ConfigFormValues,
  TFormAttrs = ConfigFormAttrs,
  TLayoutAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
  TFieldAttrs = ConfigFormAttrs,
  TComponent = Component | string,
> {
  /** 表单节点配置；字段节点绑定表单值，容器节点只渲染组件和 slots。 */
  fields: ConfigFormNode<TValues, TComponent, TFieldAttrs, TCellAttrs>[]
  /** reset 使用的显式初始值；未提供时捕获首次 model。 */
  defaultValues?: Partial<TValues>
  /** 表单级展示态；命中后所有字段进入 readonly。 */
  readonly?: ConfigFormCondition<TValues>
  /** 字段未声明 readonlyRender 时使用的表单级展示渲染函数。 */
  readonlyRender?: ConfigFormReadonlyRender<TValues, TComponent, TFieldAttrs, TCellAttrs>
  /** 透传给 renderer 原生 form 壳的 attributes。 */
  formAttrs?: TFormAttrs
  /** 是否使用行内布局；行内布局使用 Flex 容器，不消费 span 或 cellAttrs。 */
  inline?: boolean
  /** 透传给 renderer 原生 Grid/Flex 布局容器的 attributes。 */
  layoutAttrs?: TLayoutAttrs
  /** 透传给 renderer 原生 grid cell 的默认 attributes；仅 grid 布局消费。 */
  cellAttrs?: TCellAttrs
  /** grid 布局下的字段默认栅格跨度。 */
  fieldSpan?: ConfigFormColumnSpan
}
