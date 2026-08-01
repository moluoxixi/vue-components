import type { ConfigFormCondition, ConfigFormErrors, ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { ElementConfigFormField, ElementConfigFormReadonlyRender } from '../../../../types'

export interface FormComponentProps<TValues extends ConfigFormValues = ConfigFormValues> {
  controlId?: string
  errorId?: string
  /** 当前要渲染和绑定的真实字段配置。 */
  field: ElementConfigFormField<TValues>
  /** 当前表单模型，由根 ElementConfigForm 统一持有。 */
  model: TValues
  errors: ConfigFormErrors
  readonly?: ConfigFormCondition<TValues>
  readonlyRender?: ElementConfigFormReadonlyRender<TValues>
}
