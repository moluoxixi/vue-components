import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { ConfigFormRendererProps } from '../../../renderer'
import type { FormRuntimeOptions } from '../../../runtime'

export interface ConfigFormProps<TValues extends ConfigFormValues = ConfigFormValues>
  extends ConfigFormRendererProps<TValues> {
  runtime?: FormRuntimeOptions
}
