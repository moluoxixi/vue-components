import type { ConfigFormEmits, ConfigFormValues } from '../../../ConfigForm'

export interface ShadcnConfigFormEmits<TValues extends ConfigFormValues = ConfigFormValues>
  extends ConfigFormEmits<TValues> {}
