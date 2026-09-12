import type { ConfigFormFlowDiagnostic, ConfigFormFlowDispatchResult, ConfigFormFlowTraceEvent } from '@moluoxixi/config-form-core'
import type {
  ConfigFormErrors,
  ConfigFormFieldChangePayload,
  ConfigFormMeta,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { ConfigFormPageRuntimeDataSourceStateChange } from '../../runtime'
import type { ConfigFormRuntimeEventPayload } from './contracts'

export interface ConfigFormRendererEmits<TValues extends ConfigFormValues = ConfigFormValues> {
  (event: 'change', values: TValues): void
  (event: 'error', errors: ConfigFormErrors): void
  (event: 'errorsChange', errors: ConfigFormErrors): void
  (event: 'fieldChange', payload: ConfigFormFieldChangePayload<TValues>): void
  (event: 'metaChange', meta: ConfigFormMeta): void
  (event: 'runtimeEvent', context: ConfigFormRuntimeEventPayload<TValues>): void
  (event: 'flowResult', result: ConfigFormFlowDispatchResult): void
  (event: 'flowError', diagnostic: ConfigFormFlowDiagnostic): void
  (event: 'flowTrace', trace: ConfigFormFlowTraceEvent): void
  (event: 'variablesChange', variables: Readonly<Record<string, unknown>>): void
  (event: 'dataSourceStateChange', change: ConfigFormPageRuntimeDataSourceStateChange): void
  (event: 'submit', values: TValues): void
}
