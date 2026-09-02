import type { ZodType, ZodTypeDef } from 'zod'
import type {
  ConfigFormAttrs,
  ConfigFormComponentNode,
  ConfigFormField,
  ConfigFormFieldKey,
  ConfigFormFieldValidator,
  ConfigFormReadonlyRender,
  ConfigFormValues,
} from './props'

export type ExtractConfigFormComponentProps<TComponent>
  = TComponent extends abstract new (...args: unknown[]) => { $props: infer TProps }
    ? TProps
    : TComponent extends { $props: infer TProps }
      ? TProps
      : Record<string, unknown>

type NoInferComponent<TValue> = [TValue][TValue extends unknown ? 0 : never]

interface ConfigFormComponentPart<TComponent> {
  component: TComponent
  props?: Partial<ExtractConfigFormComponentProps<NoInferComponent<TComponent>>> & Record<string, unknown>
}

export type ConfigFormFieldInput<
  TValues extends ConfigFormValues,
  TComponent,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
> = {
  [TField in ConfigFormFieldKey<TValues>]:
    & Omit<
      ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>,
      | 'component'
      | 'defaultValue'
      | 'field'
      | 'getValueFromEvent'
      | 'props'
      | 'readonlyRender'
      | 'schema'
      | 'transform'
      | 'validator'
    >
    & ConfigFormComponentPart<TComponent>
    & {
      field: TField
      defaultValue?: TValues[TField]
      getValueFromEvent?: (...args: unknown[]) => TValues[TField]
      readonlyRender?: ConfigFormReadonlyRender<
        TValues,
        TComponent,
        TFieldAttrs,
        TCellAttrs,
        TValues[TField]
      >
      schema?: ZodType<TValues[TField], ZodTypeDef, unknown>
      transform?: (value: TValues[TField], values: TValues) => unknown
      validator?: ConfigFormFieldValidator<TValues, TValues[TField]>
    }
}[ConfigFormFieldKey<TValues>]

export type ConfigFormComponentNodeInput<
  TValues extends ConfigFormValues,
  TComponent,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
>
  = & Omit<ConfigFormComponentNode<TValues, TComponent, TFieldAttrs, TCellAttrs>, 'component' | 'props'>
    & ConfigFormComponentPart<TComponent>

export interface DefineConfigFormFieldFactory<TValues extends ConfigFormValues> {
  <TComponent = unknown, TFieldAttrs = ConfigFormAttrs, TCellAttrs = ConfigFormAttrs>(
    field: ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs>,
  ): ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs>
    & ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>
  <TComponent = unknown, TFieldAttrs = ConfigFormAttrs, TCellAttrs = ConfigFormAttrs>(
    field: ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs>,
  ): ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs>
    & ConfigFormComponentNode<TValues, TComponent, TFieldAttrs, TCellAttrs>
}

export interface DefineConfigFormFieldsResult<TValues extends ConfigFormValues> {
  defineField: DefineConfigFormFieldFactory<TValues>
}
