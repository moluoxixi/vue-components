import type { ConfigFormFieldChangeRequest, ConfigFormValues } from '../../../../../../ConfigForm'

export interface ConfigFormFieldEmits<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 字段组件或字段 slot 写回值时触发，由根 ShadcnConfigForm 合并模型。 */
  (event: 'fieldChange', payload: ConfigFormFieldChangeRequest<TValues>): void
}
