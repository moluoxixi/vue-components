import type { ConfigFormEmits, ConfigFormValues } from '@moluoxixi/config-form-core'

export interface ShadcnConfigFormEmits<TValues extends ConfigFormValues = ConfigFormValues>
  extends ConfigFormEmits<TValues> {}
