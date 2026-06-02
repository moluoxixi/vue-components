import type { ConfigFormEmits, ConfigFormValues } from '../../../ConfigForm'

export interface AntdConfigFormEmits<TValues extends ConfigFormValues = ConfigFormValues>
  extends ConfigFormEmits<TValues> {}
