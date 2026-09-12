import type { ConfigFormScopePath } from '@moluoxixi/config-form-core'
import type { ConfigFormErrors, ConfigFormValues } from './props'
import type { ConfigFormFieldAddress } from './scope'

export type ConfigFormLifecycleKind
  = | 'form.initialize'
    | 'form.valuesChange'
    | 'form.beforeSubmit'
    | 'form.validationSuccess'
    | 'form.validationFailure'
    | 'form.reset'
    | 'form.submit'

export interface ConfigFormLifecycleContext<
  TValues extends ConfigFormValues = ConfigFormValues,
> {
  kind: ConfigFormLifecycleKind
  values: TValues
  previousValues?: TValues
  errors: ConfigFormErrors
  fields?: readonly string[]
  address?: ConfigFormFieldAddress
  scope?: ConfigFormScopePath
  signal: AbortSignal

}
export interface ConfigFormLifecycleInput<
  TValues extends ConfigFormValues = ConfigFormValues,
> {
  values?: TValues
  previousValues?: TValues
  errors?: ConfigFormErrors
  fields?: readonly string[]
  address?: ConfigFormFieldAddress
  scope?: ConfigFormScopePath
}

export type ConfigFormLifecycleHook<
  TValues extends ConfigFormValues = ConfigFormValues,
> = (
  kind: ConfigFormLifecycleKind,
  context: ConfigFormLifecycleContext<TValues>,
) => boolean | void | Promise<boolean | void>

export type ConfigFormControllerDiagnosticCode
  = | 'CONFIG_FORM_LIFECYCLE_ERROR'
    | 'CONFIG_FORM_LIFECYCLE_REENTRY_LIMIT'
    | 'CONFIG_FORM_SUBMIT_ERROR'

export interface ConfigFormControllerDiagnostic {
  code: ConfigFormControllerDiagnosticCode
  message: string
  kind?: ConfigFormLifecycleKind
  cause?: unknown
}
