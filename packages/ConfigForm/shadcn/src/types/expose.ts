import type {
  ConfigFormErrors,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { ConfigFormRendererExpose } from '@moluoxixi/config-form/renderer'

export type ShadcnConfigFormErrors = ConfigFormErrors

export type ShadcnConfigFormExpose<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormRendererExpose<TValues>
