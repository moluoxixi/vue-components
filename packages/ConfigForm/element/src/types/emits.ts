import type { ConfigFormEmits, ConfigFormValues } from '@moluoxixi/config-form-headless'

export interface ElementConfigFormEmits<TValues extends ConfigFormValues = ConfigFormValues>
  extends ConfigFormEmits<TValues> {}
