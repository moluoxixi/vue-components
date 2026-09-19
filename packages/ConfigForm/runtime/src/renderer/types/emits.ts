import type {
  ConfigFormErrors,
  ConfigFormFieldChangePayload,
  ConfigFormMeta,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { ConfigFormSurfaceRuntimeDataSourceStateChange } from '../../runtime'

export interface ConfigFormRendererEmits<TValues extends ConfigFormValues = ConfigFormValues> {
  (event: 'change', values: TValues): void
  (event: 'error', errors: ConfigFormErrors): void
  (event: 'errorsChange', errors: ConfigFormErrors): void
  (event: 'fieldChange', payload: ConfigFormFieldChangePayload<TValues>): void
  (event: 'metaChange', meta: ConfigFormMeta): void
  (event: 'variablesChange', variables: Readonly<Record<string, unknown>>): void
  (event: 'dataSourceStateChange', change: ConfigFormSurfaceRuntimeDataSourceStateChange): void
  (event: 'submit', values: TValues): void
}
