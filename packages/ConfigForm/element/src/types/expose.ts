import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { ConfigFormRendererExpose } from '@moluoxixi/config-form/renderer'

export type ElementConfigFormExpose<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormRendererExpose<TValues>
