import type { ConfigFormFieldChangeRequest, ConfigFormValues } from '../../../../../../ConfigForm'

export interface ConfigFormNodeEmits<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 任意递归字段写回值时触发，由根 ElementConfigForm 合并模型。 */
  (event: 'fieldChange', payload: ConfigFormFieldChangeRequest<TValues>): void
}
