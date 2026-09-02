import type { ConfigFormRendererExpose } from '@moluoxixi/config-form'
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'

export type ElementConfigFormExpose<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormRendererExpose<TValues>
