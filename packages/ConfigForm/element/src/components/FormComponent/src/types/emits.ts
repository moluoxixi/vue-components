import type { ConfigFormFieldChangeRequest, ConfigFormFieldValidateRequest, ConfigFormValues } from '@moluoxixi/config-form-headless'

export interface FormComponentEmits<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 真实字段组件写回值时触发，由上层字段节点继续冒泡给根 ElementConfigForm。 */
  (event: 'fieldChange', payload: ConfigFormFieldChangeRequest<TValues>): void
  (event: 'fieldValidate', payload: ConfigFormFieldValidateRequest<TValues>): void
}
