import type { output, ZodTypeAny } from 'zod'
import type {
  ComponentNodeConfig,
  DefinedFormNodeConfig,
  FieldCondition,
  FieldConfig,
  FieldKey,
  FieldValidator,
  FormValues,
  NormalizedFieldConfig,
  RenderFunction,
  RuntimeText,
  SlotContent,
  ValidateTrigger,
} from '@/types'
import { applyFieldDefaults, normalizeValidateOn } from '@/plugins/builtInFieldDefaults'

export { normalizeValidateOn }

/** 从 Vue 组件中提取 props 类型；普通函数不再视作 Vue function component。 */
export type ExtractComponentProps<C> = C extends abstract new (...args: unknown[]) => { $props: infer P }
  ? P
  : C extends (...args: unknown[]) => unknown
    ? Record<string, unknown>
    : C extends { $props: infer P }
      ? P
      : Record<string, unknown>

type RuntimeResolvable<T> = T extends (...args: infer TArgs) => infer TReturn
  ? (...args: TArgs) => TReturn
  : T extends string
    ? RuntimeText
    : T extends number | boolean | bigint | symbol | null | undefined
      ? T
      : T extends readonly (infer TItem)[]
        ? RuntimeResolvable<TItem>[]
        : T extends object
          ? { [K in keyof T]: RuntimeResolvable<T[K]> }
          : T

interface ComponentFieldPart<C, TValues extends object = FormValues> {
  component: C | RenderFunction<[], TValues>
  props?: RuntimeResolvable<ExtractComponentProps<NoInfer<C>>> & {}
}

interface ComponentNodeConfigCore<C, TValues extends object = FormValues> extends ComponentFieldPart<C, TValues> {
  span?: number
  visible?: FieldCondition<TValues>
  slots?: Record<string, SlotContent>
}

type FormNodeInput = FieldConfig | ComponentNodeConfig

type DefinedFieldConfig<TConfig> = TConfig & FieldConfig
type DefinedComponentNodeConfig<TConfig> = TConfig & ComponentNodeConfig

interface DefineFieldFactory<TValues extends object> {
  <C = unknown, TSchema extends ZodTypeAny = ZodTypeAny>(
    config: ModelSchemaFieldConfigInput<TValues, TSchema> & ComponentFieldPart<C, TValues>,
  ): DefinedFieldConfig<ModelSchemaFieldConfigInput<TValues, TSchema> & ComponentFieldPart<C, TValues>>
  <C = unknown>(
    config: ModelDefaultValueFieldConfigInput<TValues> & ComponentFieldPart<C, TValues>,
  ): DefinedFieldConfig<ModelDefaultValueFieldConfigInput<TValues> & ComponentFieldPart<C, TValues>>
  <C = unknown>(
    config: ModelUnknownValueFieldConfigInput<TValues> & ComponentFieldPart<C, TValues>,
  ): DefinedFieldConfig<ModelUnknownValueFieldConfigInput<TValues> & ComponentFieldPart<C, TValues>>
  <C = unknown>(
    config: ComponentNodeConfigCore<C, TValues>,
  ): DefinedComponentNodeConfig<ComponentNodeConfigCore<C, TValues>>
}

export interface DefineFieldsFactory<TValues extends FormValues> {
  defineField: DefineFieldFactory<TValues>
}

type FieldValueFor<
  TValues extends object,
  TField extends FieldKey<TValues>,
  TFallback,
> = [FormValues] extends [TValues] ? TFallback : TValues[TField]

/**
 * 将公开字段声明委托给内置默认应用函数，保持默认值来源唯一。
 *
 * 该 helper 仅保留给插件测试和低层工具使用；组件链路统一通过 transformField(field)。
 */
export function normalizeField(input: FieldConfig): NormalizedFieldConfig {
  return applyFieldDefaults(input) as NormalizedFieldConfig
}

/** 判断字段是否需要响应当前校验触发时机。 */
export function shouldValidateOn(field: Pick<NormalizedFieldConfig, 'validateOn'>, trigger: ValidateTrigger): boolean {
  return field.validateOn.includes(trigger)
}

/** 在提交阶段执行字段 transform；未声明时原样返回。 */
export function applyFieldTransform(
  field: Pick<NormalizedFieldConfig, 'transform'>,
  value: unknown,
  allValues: FormValues,
): unknown {
  return field.transform ? field.transform(value, allValues) : value
}

interface FieldConfigBase<
  TValues extends object = FormValues,
  TValue = unknown,
  TField extends FieldKey<TValues> = FieldKey<TValues>,
> {
  field: TField
  label?: RuntimeText
  span?: number
  valueProp?: string
  trigger?: string
  blurTrigger?: string
  required?: FieldCondition<TValues>
  requiredMessage?: RuntimeText
  validateOn?: ValidateTrigger | ValidateTrigger[]
  validator?: FieldValidator<TValues, TValue>
  visible?: FieldCondition<TValues>
  disabled?: FieldCondition<TValues>
  readonly?: FieldCondition<TValues>
  transform?: (value: TValue, allValues: TValues) => unknown
  getValueFromEvent?: (...args: unknown[]) => TValue
  id?: string
  submitWhenHidden?: boolean
  submitWhenDisabled?: boolean
  slots?: Record<string, SlotContent>
}

interface SchemaFieldConfigCore<
  TValues extends object,
  TSchema extends ZodTypeAny,
  TField extends FieldKey<TValues> = FieldKey<TValues>,
> extends FieldConfigBase<TValues, FieldValueFor<TValues, TField, output<TSchema>>, TField> {
  schema: TSchema
  defaultValue?: FieldValueFor<TValues, TField, output<TSchema>>
}

interface DefaultValueFieldConfigCore<
  TValues extends object,
  TValue,
  TField extends FieldKey<TValues> = FieldKey<TValues>,
> extends FieldConfigBase<TValues, FieldValueFor<TValues, TField, TValue>, TField> {
  schema?: undefined
  defaultValue: FieldValueFor<TValues, TField, TValue>
}

interface UnknownValueFieldConfigCore<
  TValues extends object = FormValues,
  TField extends FieldKey<TValues> = FieldKey<TValues>,
> extends FieldConfigBase<TValues, FieldValueFor<TValues, TField, unknown>, TField> {
  schema?: undefined
  defaultValue?: undefined
}

type ModelSchemaFieldConfigInput<
  TValues extends object,
  TSchema extends ZodTypeAny,
> = {
  [TField in FieldKey<TValues>]: SchemaFieldConfigCore<TValues, TSchema, TField>
}[FieldKey<TValues>]

type ModelDefaultValueFieldConfigInput<
  TValues extends object,
> = {
  [TField in FieldKey<TValues>]: DefaultValueFieldConfigCore<TValues, TValues[TField], TField>
}[FieldKey<TValues>]

type ModelUnknownValueFieldConfigInput<
  TValues extends object,
> = {
  [TField in FieldKey<TValues>]: UnknownValueFieldConfigCore<TValues, TField>
}[FieldKey<TValues>]

/**
 * 根据 schema/defaultValue 自动推导字段值类型，根据 component 自动推导 props 类型。
 *
 * 返回值保持为普通对象；不传 `field` 时创建容器节点，仅渲染结构，不绑定表单值。
 *
 * @example
 * ```ts
 * const nameField = defineField({
 *   field: 'name',
 *   component: Input,
 *   defaultValue: '',
 *   validator: value => value.length > 0 ? undefined : '必填',
 * })
 * ```
 */

/** 未传表单模型泛型时，根据 schema 推导字段值类型。 */
export function defineField<
  C = unknown,
  TSchema extends ZodTypeAny = ZodTypeAny,
  TField extends FieldKey<FormValues> = FieldKey<FormValues>,
>(
  config: SchemaFieldConfigCore<FormValues, TSchema, TField> & ComponentFieldPart<C, FormValues>,
): DefinedFieldConfig<SchemaFieldConfigCore<FormValues, TSchema, TField> & ComponentFieldPart<C, FormValues>>

/** 未传表单模型泛型且无 schema 时，根据 defaultValue 推导字段值类型。 */
export function defineField<
  C = unknown,
  TValue = unknown,
  TField extends FieldKey<FormValues> = FieldKey<FormValues>,
>(
  config: DefaultValueFieldConfigCore<FormValues, TValue, TField> & ComponentFieldPart<C, FormValues>,
): DefinedFieldConfig<DefaultValueFieldConfigCore<FormValues, TValue, TField> & ComponentFieldPart<C, FormValues>>

/** 未传表单模型泛型、schema 和 defaultValue 时，字段值类型保持 unknown。 */
export function defineField<
  C = unknown,
  TField extends FieldKey<FormValues> = FieldKey<FormValues>,
>(
  config: UnknownValueFieldConfigCore<FormValues, TField> & ComponentFieldPart<C, FormValues>,
): DefinedFieldConfig<UnknownValueFieldConfigCore<FormValues, TField> & ComponentFieldPart<C, FormValues>>

/** 定义用于 slot 或顶层布局的容器节点。 */
export function defineField<C = unknown>(
  config: ComponentNodeConfigCore<C>,
): DefinedComponentNodeConfig<ComponentNodeConfigCore<C>>

/** 传入表单模型泛型时，按模型字段和 schema 推导字段配置。 */
export function defineField<
  TValues extends object,
  C = unknown,
  TSchema extends ZodTypeAny = ZodTypeAny,
>(
  config: ModelSchemaFieldConfigInput<TValues, TSchema> & ComponentFieldPart<C, TValues>,
): DefinedFieldConfig<ModelSchemaFieldConfigInput<TValues, TSchema> & ComponentFieldPart<C, TValues>>

/** 传入表单模型泛型且无 schema 时，按模型字段和 defaultValue 推导字段配置。 */
export function defineField<
  TValues extends object,
  C = unknown,
>(
  config: ModelDefaultValueFieldConfigInput<TValues> & ComponentFieldPart<C, TValues>,
): DefinedFieldConfig<ModelDefaultValueFieldConfigInput<TValues> & ComponentFieldPart<C, TValues>>

/** 传入表单模型泛型但无 schema/defaultValue 时，按模型字段约束字段名和值类型。 */
export function defineField<
  TValues extends object,
  C = unknown,
>(
  config: ModelUnknownValueFieldConfigInput<TValues> & ComponentFieldPart<C, TValues>,
): DefinedFieldConfig<ModelUnknownValueFieldConfigInput<TValues> & ComponentFieldPart<C, TValues>>

/** 传入表单模型泛型时定义容器节点；模型类型只用于保持调用形态一致。 */
export function defineField<_TValues extends object, C = unknown>(
  config: ComponentNodeConfigCore<C, _TValues>,
): DefinedComponentNodeConfig<ComponentNodeConfigCore<C, _TValues>>

/** 所有 defineField 重载共用的运行时实现，只负责复制配置，不写入隐藏标记。 */
export function defineField(config: FormNodeInput): DefinedFormNodeConfig {
  return { ...config }
}

/**
 * 先绑定表单模型，再返回可解构的字段工厂。
 *
 * 工厂只提供类型上下文，不保存运行时状态；返回的 defineField 仍然只复制字段配置。
 */
export function defineFields<TValues extends FormValues = FormValues>(): DefineFieldsFactory<TValues> {
  return {
    defineField: defineField as DefineFieldFactory<TValues>,
  }
}
