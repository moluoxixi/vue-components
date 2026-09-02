import type { Component } from 'vue'
import type {
  ConfigFormAttrs,
  ConfigFormField,
  ConfigFormValues,
} from './props'

export interface ConfigFormResolvedFieldState<
  TValues extends ConfigFormValues = ConfigFormValues,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
  TComponent = Component | string,
> {
  field: ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>
  visible: boolean
  disabled: boolean
  readonly: boolean
  required: boolean
  validatable: boolean
}
