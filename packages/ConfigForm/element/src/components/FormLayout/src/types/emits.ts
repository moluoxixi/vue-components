import type { ConfigFormFieldChangeRequest, ConfigFormValues } from '@moluoxixi/config-form-core'

export interface FormLayoutEmits<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 顶层或递归字段写回值时触发，由根 ElementConfigForm 合并模型。 */
  (event: 'fieldChange', payload: ConfigFormFieldChangeRequest<TValues>): void
}
