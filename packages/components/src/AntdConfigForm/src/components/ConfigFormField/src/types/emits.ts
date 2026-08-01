import type { ConfigFormFieldChangeRequest, ConfigFormFieldValidateRequest, ConfigFormValues } from '@moluoxixi/config-form-headless'

export interface ConfigFormFieldEmits<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 字段组件或字段 slot 写回值时触发，由根 antdConfigForm 合并模型。 */
  (event: 'fieldChange', payload: ConfigFormFieldChangeRequest<TValues>): void
  (event: 'fieldValidate', payload: ConfigFormFieldValidateRequest<TValues>): void
}
