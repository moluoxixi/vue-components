import type { Component, SetupContext, VNode } from 'vue'
import type { ZodType, ZodTypeAny, ZodTypeDef } from 'zod'
import type { FormRuntimeOptions } from '@/runtime/types'

/** ConfigForm 字段节点可接收的 Vue function component 形态。 */
export type FunctionalFieldComponent = (
  props: { modelValue?: unknown, [key: string]: unknown },
  context: SetupContext,
) => VNode

/** 表单值的标准存储结构。 */
export type FormValues = Record<string, unknown>

/** ConfigForm 支持的校验触发时机。 */
export type ValidateTrigger = 'submit' | 'blur' | 'change'

/** 自定义校验器的原始返回值，后续会统一转换为字符串数组。 */
export type FieldValidatorResult = string | string[] | void | null | undefined

/** 字段声明可接收的 Zod schema。 */
export type FieldSchema<TValue = unknown> = ZodType<TValue, ZodTypeDef, unknown>

/** 自定义校验器，可同时读取当前字段值和全量表单值。 */
export type FieldValidator<T extends object = FormValues, TValue = unknown> = (
  value: TValue,
  allValues: T,
) => FieldValidatorResult | Promise<FieldValidatorResult>

/** 字段标签文本。 */
export type RuntimeText = string

/** 字段布尔条件，支持静态值或基于 values 的派生函数。 */
export type FieldCondition<T extends object = FormValues> = boolean | ((values: T) => boolean)

/** 容器节点配置：只渲染组件和 slots，不绑定表单字段。 */
export interface ComponentNodeConfig {
  /** Vue 组件、function component、原生标签或 runtime 注册的组件 key。 */
  component: Component | FunctionalFieldComponent | string
  /** 栅格跨度；容器节点默认占满 24 列。 */
  span?: number
  /** 节点显隐条件；容器隐藏时其子树字段也按隐藏语义处理。 */
  visible?: FieldCondition<FormValues>
  /** 传给渲染组件的 props。 */
  props?: Record<string, unknown>
  /** 子级 slots；其中的表单节点配置可以来自 defineField(...) 或普通 config。 */
  slots?: Record<string, SlotContent>
}

/** slot 内容协议：与顶层 fields 一致，只接收普通节点配置或 defineField(...) 节点。 */
export type SlotContent = DefinedFormNodeConfig | DefinedFormNodeConfig[]

/** 字段节点配置：渲染组件并绑定一个表单值 key。 */
export interface FieldConfig extends ComponentNodeConfig {
  /** 当前字段控制的表单值 key。 */
  field: string
  /** 传给 FormField 外层根节点的 props；不会透传给实际字段组件。 */
  rootProps?: Record<string, unknown>
  /** 字段标签文本。 */
  label?: RuntimeText
  /** 字段校验使用的 Zod schema。 */
  schema?: ZodTypeAny
  /** 栅格跨度，由具体 UI 适配层消费。 */
  span?: number
  /** 当前模型缺少该字段时写入的默认值。 */
  defaultValue?: unknown
  /** 注入到组件的值的属性名，默认 'modelValue' */
  valueProp?: string
  /** 接收组件值的事件名，同时也作为 change 校验的触发事件，默认 'update:modelValue' */
  trigger?: string
  /** 从组件事件参数中提取字段值，默认取第一个参数 */
  getValueFromEvent?: (...args: unknown[]) => unknown
  /** 触发 blur 校验的事件名，默认 'blur' */
  blurTrigger?: string
  /** 校验触发时机列表；规范化后一定包含 submit。 */
  validateOn?: ValidateTrigger | ValidateTrigger[]
  /** schema 校验后执行的自定义校验器。 */
  validator?: FieldValidator<FormValues, unknown>
  /** 字段禁用条件；禁用字段默认跳过校验和提交。 */
  disabled?: FieldCondition<FormValues>
  /** 提交校验通过后执行的字段值映射。 */
  transform?: (value: unknown, allValues: FormValues) => unknown
  /** 隐藏时仍参与 submit 输出，默认 false */
  submitWhenHidden?: boolean
  /** 禁用时仍参与 submit 输出，默认 false */
  submitWhenDisabled?: boolean
}

/** ConfigForm 顶层节点，可以是真实字段节点或容器节点。 */
export type FormNodeConfig = FieldConfig | ComponentNodeConfig

/** 已经过 defineField(...) 或普通 config 传入的表单节点配置。 */
export type DefinedFormNodeConfig<TConfig extends FormNodeConfig = FormNodeConfig> = TConfig

/** 所有节点标准化后的公共基类；props 保证非空。 */
export interface NormalizedNodeConfig extends Omit<ComponentNodeConfig, 'props'> {
  props: Record<string, unknown>
}

/** 已补全默认值并规范化标量选项后的字段配置。 */
export interface NormalizedFieldConfig extends Omit<
  FieldConfig,
  'blurTrigger' | 'props' | 'rootProps' | 'span' | 'submitWhenDisabled' | 'submitWhenHidden' | 'trigger' | 'validateOn' | 'valueProp'
>, NormalizedNodeConfig {
  field: string
  rootProps: Record<string, unknown>
  span: number
  valueProp: string
  trigger: string
  blurTrigger: string
  validateOn: ValidateTrigger[]
  submitWhenHidden: boolean
  submitWhenDisabled: boolean
}

/** runtime 处理完成后的 slot 内容，只包含可直接递归渲染的节点。 */
export type ResolvedSlotContent = ResolvedFormNode | ResolvedFormNode[]

/** 组件、props 和 slots 全部处理后的可渲染容器节点基类。 */
export interface ResolvedNodeBase extends Omit<NormalizedNodeConfig, 'slots'> {
  props: Record<string, unknown>
  /** runtime 已递归处理完毕的 slot 节点。 */
  slots?: Record<string, ResolvedSlotContent>
}

/** 组件、props、slots 和 label 全部处理后的可渲染字段节点。 */
export interface ResolvedField extends Omit<NormalizedFieldConfig, 'label' | 'slots'> {
  label?: string
  /** runtime 已递归处理完毕的 slot 节点。 */
  slots?: Record<string, ResolvedSlotContent>
}

/** 组件、props 和 slots 全部处理后的可渲染容器节点。 */
export interface ResolvedComponentNode extends ResolvedNodeBase {}

/** FormRuntime.transformField(...) 返回的节点类型。 */
export type ResolvedFormNode = ResolvedField | ResolvedComponentNode

/** 类型化表单模型中可用的字符串 key。 */
export type FieldKey<T extends object> = Extract<keyof T, string>

/** ConfigForm Vue 组件接收的 props。 */
export interface ConfigFormProps<T extends object = FormValues> {
  /** CSS 类名前缀，默认 "cf"。 */
  namespace?: string
  /** 在适配样式支持时以内联模式渲染字段。 */
  inline?: boolean
  /** grid 列数（仅非 inline 模式生效），默认 24。 */
  columns?: number
  /** 网格间距，默认 "16px 8px"。 */
  gap?: string
  /** 表单字段配置。 */
  fields: FormNodeConfig[]
  /** 传递给字段布局的 label 宽度。 */
  labelWidth?: string | number
  /** 表单初始值；仅在创建和 reset 时作为默认快照使用，不参与双向同步。 */
  defaultValues?: Partial<T>
  /** 表单运行时配置，用于组件注册和字段插件生命周期。 */
  runtime?: FormRuntimeOptions
}

/** ConfigForm 对外发出的事件。 */
export interface ConfigFormEmits<T extends object = FormValues> {
  (e: 'submit', values: T): void
  (e: 'error', errors: FormErrors): void
}

/** ConfigForm 通过模板 ref 暴露的方法。 */
export interface ConfigFormExpose<T extends object = FormValues> {
  /** 执行整表校验，并按结果触发 submit/error 事件。 */
  submit: () => Promise<boolean>
  /** 按 submit 触发时机校验全部字段。 */
  validate: () => Promise<boolean>
  /** 按指定触发时机校验单个字段。 */
  validateField: (field: FieldKey<T> | string, trigger?: ValidateTrigger) => Promise<boolean>
  /** 重置字段值为默认值并清空校验错误。 */
  reset: () => void
  /** 设置单个字段值并清除该字段校验错误。 */
  setValue: {
    <K extends FieldKey<T>>(field: K, value: T[K]): void
    (field: string, value: unknown): void
  }
  /** 合并或替换表单值，并清除被写入字段的错误。 */
  setValues: (values: Partial<T>, replace?: boolean) => void
  /** 读取单个字段值。 */
  getValue: {
    <K extends FieldKey<T>>(field: K): T[K]
    (field: string): unknown
  }
  /** 获取表单值的浅拷贝快照（保留 Date/Dayjs 等实例） */
  getValues: () => T
  /** 清除指定字段的校验错误；不传字段时清除全部 */
  clearValidate: (field?: FieldKey<T> | string) => void
}

/** 按字段名索引的校验错误。 */
export interface FormErrors {
  [field: string]: string[]
}
