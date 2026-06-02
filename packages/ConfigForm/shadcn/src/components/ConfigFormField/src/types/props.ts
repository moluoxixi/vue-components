import type { ConfigFormValues } from '@moluoxixi/config-form-core'
import type { ShadcnConfigFormErrors, ShadcnConfigFormField } from '../../../../types'

export interface ConfigFormFieldProps<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 当前要渲染和绑定的 shadcn-vue 字段配置。 */
  field: ShadcnConfigFormField<TValues>
  /** 当前表单模型，由根 ShadcnConfigForm 统一持有。 */
  model: TValues
  /** 当前字段错误集合，由根 ShadcnConfigForm 统一持有。 */
  errors: ShadcnConfigFormErrors
}
