import type { ConfigFormEmits, ConfigFormValues } from '@moluoxixi/config-form-core'

export interface ElementConfigFormEmits<TValues extends ConfigFormValues = ConfigFormValues>
  extends ConfigFormEmits<TValues> {}
