import type { ConfigFormEmits, ConfigFormValues } from '@moluoxixi/config-form-core'

export interface AntdConfigFormEmits<TValues extends ConfigFormValues = ConfigFormValues>
  extends ConfigFormEmits<TValues> {}
