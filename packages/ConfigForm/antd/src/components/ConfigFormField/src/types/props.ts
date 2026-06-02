import type { ConfigFormValues } from '@moluoxixi/config-form-core'
import type { AntdConfigFormField } from '../../../../types'

export interface ConfigFormFieldProps<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 当前要渲染和绑定的 Ant Design Vue 字段配置。 */
  field: AntdConfigFormField<TValues>
  /** 当前表单模型，由根 antdConfigForm 统一持有。 */
  model: TValues
}
