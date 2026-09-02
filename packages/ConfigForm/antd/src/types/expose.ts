import type { ConfigFormRendererExpose } from '@moluoxixi/config-form'
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'

export type AntdConfigFormExpose<TValues extends ConfigFormValues = ConfigFormValues>
  = ConfigFormRendererExpose<TValues>
