import type {
  ConfigFormErrors,
  ConfigFormFieldChangePayload,
  ConfigFormMeta,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { ConfigFormRuntimeEventPayload } from './contracts'

export interface ConfigFormRendererEmits<TValues extends ConfigFormValues = ConfigFormValues> {
  (event: 'change', values: TValues): void
  (event: 'error', errors: ConfigFormErrors): void
  (event: 'errorsChange', errors: ConfigFormErrors): void
  (event: 'fieldChange', payload: ConfigFormFieldChangePayload<TValues>): void
  (event: 'metaChange', meta: ConfigFormMeta): void
  (event: 'runtimeEvent', context: ConfigFormRuntimeEventPayload<TValues>): void
  (event: 'submit', values: TValues): void
}
