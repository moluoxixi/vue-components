import type { ConfigFormValues } from '../../../../../../ConfigForm'
import type { ShadcnConfigFormField } from '../../../../types'

export interface FormComponentProps<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 当前要渲染和绑定的 shadcn-vue 字段配置。 */
  field: ShadcnConfigFormField<TValues>
  /** 当前表单模型，由根 ShadcnConfigForm 统一持有。 */
  model: TValues
}
