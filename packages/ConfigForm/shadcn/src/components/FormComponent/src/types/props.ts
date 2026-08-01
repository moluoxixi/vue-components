import type { ConfigFormCondition, ConfigFormErrors, ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { ShadcnConfigFormField, ShadcnConfigFormReadonlyRender } from '../../../../types'

export interface FormComponentProps<TValues extends ConfigFormValues = ConfigFormValues> {
  controlId?: string
  errorId?: string
  /** 当前要渲染和绑定的 shadcn-vue 字段配置。 */
  field: ShadcnConfigFormField<TValues>
  /** 当前表单模型，由根 ShadcnConfigForm 统一持有。 */
  model: TValues
  errors: ConfigFormErrors
  readonly?: ConfigFormCondition<TValues>
  readonlyRender?: ShadcnConfigFormReadonlyRender<TValues>
}
