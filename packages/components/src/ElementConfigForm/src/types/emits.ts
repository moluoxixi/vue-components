import type { ConfigFormEmits, ConfigFormValues } from '../../../ConfigForm'

export interface ElementConfigFormEmits<TValues extends ConfigFormValues = ConfigFormValues>
  extends ConfigFormEmits<TValues> {}
