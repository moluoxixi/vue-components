import type { Component } from 'vue'
import type {
  ConfigFormFieldChangePayload,
  ConfigFormFieldChangeRequest,
} from './emits'
import type { ConfigFormFieldMeta, ConfigFormMeta } from './meta'
import type {
  ConfigFormAttrs,
  ConfigFormCondition,
  ConfigFormErrors,
  ConfigFormFieldKey,
  ConfigFormNode,
  ConfigFormValidateTrigger,
  ConfigFormValues,
} from './props'

export interface ConfigFormModelAdapter<TValues extends ConfigFormValues = ConfigFormValues> {
  /** Controller operations always read the latest host model, including reactive replacements. */
  read: () => TValues
  /** Write the complete next model back to the host. */
  write: (values: TValues) => void
}

export interface ConfigFormControllerOptions<TValues extends ConfigFormValues = ConfigFormValues> {
  /** Minimal host model adapter, independent of Vue refs or a state library. */
  model: ConfigFormModelAdapter<TValues>
  /** Read the current node tree for validation, reset, reactions, and submit. */
  fields?: () => ConfigFormNode<TValues, Component | string, unknown, unknown>[]
  /** Explicit reset baseline; otherwise the controller captures the first model and field defaults. */
  defaultValues?: Partial<TValues>
  /** Read the current form-level readonly condition. */
  readonly?: () => ConfigFormCondition<TValues> | undefined
  onFieldChange?: (payload: ConfigFormFieldChangePayload<TValues>) => void
  onChange?: (values: TValues) => void
  onErrorsChange?: (errors: ConfigFormErrors) => void
  onValidatingChange?: (validating: boolean) => void
  onMetaChange?: (meta: ConfigFormMeta) => void
  onSubmit?: (values: TValues) => void
  onError?: (errors: ConfigFormErrors) => void
}

export type ConfigFormFieldValue<
  TValues extends ConfigFormValues,
  TField extends string,
> = TField extends ConfigFormFieldKey<TValues> ? TValues[TField] : unknown

export type ConfigFormFieldSelector<TValues extends ConfigFormValues>
  = | ConfigFormFieldKey<TValues>
    | string
    | Array<ConfigFormFieldKey<TValues> | string>

export interface ConfigFormController<TValues extends ConfigFormValues = ConfigFormValues> {
  applyFieldChange: (request: ConfigFormFieldChangeRequest<TValues>) => void
  getValues: () => TValues
  getMeta: () => ConfigFormMeta
  getFieldMeta: (field: ConfigFormFieldKey<TValues> | string) => ConfigFormFieldMeta
  refreshMeta: () => ConfigFormMeta
  refreshReactions: () => void
  getValue: <TField extends string>(field: TField) => ConfigFormFieldValue<TValues, TField>
  getErrors: () => ConfigFormErrors
  getReactionProps: (field: ConfigFormFieldKey<TValues> | string) => ConfigFormAttrs
  getReactionState: (
    field: ConfigFormFieldKey<TValues> | string,
  ) => Partial<Record<'disabled' | 'readonly' | 'required' | 'visible', boolean>>
  getValidating: () => boolean
  isFieldValidating: (field: ConfigFormFieldKey<TValues> | string) => boolean
  setValue: <TField extends string>(
    field: TField,
    value: ConfigFormFieldValue<TValues, NoInfer<TField>>,
  ) => void
  setValues: {
    (values: Partial<TValues>, replace?: false): void
    (values: TValues, replace: true): void
  }
  validate: () => Promise<boolean>
  validateField: (
    field: ConfigFormFieldKey<TValues> | string,
    trigger?: ConfigFormValidateTrigger,
  ) => Promise<boolean>
  clearValidate: (fields?: ConfigFormFieldSelector<TValues>) => void
  setErrors: (errors: ConfigFormErrors) => void
  setTouched: {
    (): void
    (touched: boolean): void
    (fields: ConfigFormFieldSelector<TValues>, touched?: boolean): void
  }
  resetFields: (fields?: ConfigFormFieldSelector<TValues>) => void
  submit: () => Promise<boolean>
}
