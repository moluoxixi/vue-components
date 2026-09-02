import type { output, ZodTypeAny } from 'zod'
import type {
  ComponentNodeConfig,
  FieldCondition,
  FieldConfig,
  FieldKey,
  FieldValidator,
  FormValues,
  RenderFunction,
  RuntimeText,
  SlotContent,
  ValidateTrigger,
} from './contracts'

/** 从 Vue 组件中提取 props 类型；普通函数不再视作 Vue function component。 */
export type ExtractComponentProps<TComponent>
  = TComponent extends abstract new (...args: unknown[]) => { $props: infer TProps }
    ? TProps
    : TComponent extends (...args: unknown[]) => unknown
      ? Record<string, unknown>
      : TComponent extends { $props: infer TProps }
        ? TProps
        : Record<string, unknown>

export type RuntimeResolvable<TValue> = TValue extends (...args: infer TArgs) => infer TReturn
  ? (...args: TArgs) => TReturn
  : TValue extends string
    ? RuntimeText
    : TValue extends number | boolean | bigint | symbol | null | undefined
      ? TValue
      : TValue extends readonly (infer TItem)[]
        ? RuntimeResolvable<TItem>[]
        : TValue extends object
          ? { [TKey in keyof TValue]: RuntimeResolvable<TValue[TKey]> }
          : TValue

export interface ComponentFieldPart<TComponent, TValues extends object = FormValues> {
  id: string
  component: TComponent | RenderFunction<[], TValues>
  props?: RuntimeResolvable<ExtractComponentProps<NoInfer<TComponent>>> & {}
}

export interface ComponentNodeConfigCore<TComponent, TValues extends object = FormValues>
  extends ComponentFieldPart<TComponent, TValues> {
  extensions?: ComponentNodeConfig['extensions']
  span?: number
  visible?: FieldCondition<TValues>
  slots?: Record<string, SlotContent>
}

export type FormNodeInput = FieldConfig | ComponentNodeConfig
export type DefinedFieldConfig<TConfig> = TConfig & FieldConfig
export type DefinedComponentNodeConfig<TConfig> = TConfig & ComponentNodeConfig

export type FieldValueFor<
  TValues extends object,
  TField extends FieldKey<TValues>,
  TFallback,
> = [FormValues] extends [TValues] ? TFallback : TValues[TField]

export interface FieldConfigBase<
  TValues extends object = FormValues,
  TValue = unknown,
  TField extends FieldKey<TValues> = FieldKey<TValues>,
> {
  field: TField
  extensions?: ComponentNodeConfig['extensions']
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
  submitWhenHidden?: boolean
  submitWhenDisabled?: boolean
  slots?: Record<string, SlotContent>
}

export interface SchemaFieldConfigCore<
  TValues extends object,
  TSchema extends ZodTypeAny,
  TField extends FieldKey<TValues> = FieldKey<TValues>,
> extends FieldConfigBase<TValues, FieldValueFor<TValues, TField, output<TSchema>>, TField> {
  schema: TSchema
  defaultValue?: FieldValueFor<TValues, TField, output<TSchema>>
}

export interface DefaultValueFieldConfigCore<
  TValues extends object,
  TValue,
  TField extends FieldKey<TValues> = FieldKey<TValues>,
> extends FieldConfigBase<TValues, FieldValueFor<TValues, TField, TValue>, TField> {
  schema?: undefined
  defaultValue: FieldValueFor<TValues, TField, TValue>
}

export interface UnknownValueFieldConfigCore<
  TValues extends object = FormValues,
  TField extends FieldKey<TValues> = FieldKey<TValues>,
> extends FieldConfigBase<TValues, FieldValueFor<TValues, TField, unknown>, TField> {
  schema?: undefined
  defaultValue?: undefined
}

export type ModelSchemaFieldConfigInput<
  TValues extends object,
  TSchema extends ZodTypeAny,
> = {
  [TField in FieldKey<TValues>]: SchemaFieldConfigCore<TValues, TSchema, TField>
}[FieldKey<TValues>]

export type ModelDefaultValueFieldConfigInput<TValues extends object> = {
  [TField in FieldKey<TValues>]: DefaultValueFieldConfigCore<TValues, TValues[TField], TField>
}[FieldKey<TValues>]

export type ModelUnknownValueFieldConfigInput<TValues extends object> = {
  [TField in FieldKey<TValues>]: UnknownValueFieldConfigCore<TValues, TField>
}[FieldKey<TValues>]

export type DefineFieldSchemaConfig<
  TValues extends object,
  TComponent,
  TSchema extends ZodTypeAny,
  TField extends string = string,
> = [FormValues] extends [TValues]
  ? SchemaFieldConfigCore<FormValues, TSchema, TField & FieldKey<FormValues>> & ComponentFieldPart<TComponent, FormValues>
  : ModelSchemaFieldConfigInput<NoInfer<TValues>, TSchema> & ComponentFieldPart<TComponent, NoInfer<TValues>>

export type DefineFieldDefaultValueConfig<
  TValues extends object,
  TComponent,
  TValue,
  TField extends string = string,
> = [FormValues] extends [TValues]
  ? DefaultValueFieldConfigCore<FormValues, TValue, TField & FieldKey<FormValues>> & ComponentFieldPart<TComponent, FormValues>
  : ModelDefaultValueFieldConfigInput<NoInfer<TValues>> & ComponentFieldPart<TComponent, NoInfer<TValues>>

export type DefineFieldUnknownValueConfig<
  TValues extends object,
  TComponent,
  TField extends string = string,
> = [FormValues] extends [TValues]
  ? UnknownValueFieldConfigCore<FormValues, TField & FieldKey<FormValues>> & ComponentFieldPart<TComponent, FormValues>
  : ModelUnknownValueFieldConfigInput<NoInfer<TValues>> & ComponentFieldPart<TComponent, NoInfer<TValues>>

export type DefineFieldComponentNodeConfig<
  TValues extends object,
  TComponent,
> = [FormValues] extends [TValues]
  ? ComponentNodeConfigCore<TComponent, FormValues>
  : ComponentNodeConfigCore<TComponent, NoInfer<TValues>>

export interface DefineFieldFactory<TValues extends object> {
  <TComponent = unknown, TSchema extends ZodTypeAny = ZodTypeAny, TField extends string = string>(
    config: DefineFieldSchemaConfig<NoInfer<TValues>, TComponent, TSchema, TField>,
  ): DefinedFieldConfig<DefineFieldSchemaConfig<TValues, TComponent, TSchema, TField>>
  <TComponent = unknown, TValue = unknown, TField extends string = string>(
    config: DefineFieldDefaultValueConfig<NoInfer<TValues>, TComponent, TValue, TField>,
  ): DefinedFieldConfig<DefineFieldDefaultValueConfig<TValues, TComponent, TValue, TField>>
  <TComponent = unknown, TField extends string = string>(
    config: DefineFieldUnknownValueConfig<NoInfer<TValues>, TComponent, TField>,
  ): DefinedFieldConfig<DefineFieldUnknownValueConfig<TValues, TComponent, TField>>
  <TComponent = unknown>(
    config: DefineFieldComponentNodeConfig<NoInfer<TValues>, TComponent>,
  ): DefinedComponentNodeConfig<DefineFieldComponentNodeConfig<TValues, TComponent>>
}

export interface DefineFieldsFactory<TValues extends object> {
  defineField: DefineFieldFactory<TValues>
}
