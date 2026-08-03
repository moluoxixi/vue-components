import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { ConfigFormRendererExpose } from '@moluoxixi/config-form/renderer'

export type AntdConfigFormExpose<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormRendererExpose<TValues>
