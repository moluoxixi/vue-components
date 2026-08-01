import type { ConfigFormCondition, ConfigFormErrors, ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { AntdConfigFormField, AntdConfigFormReadonlyRender } from '../../../../types'

export interface FormComponentProps<TValues extends ConfigFormValues = ConfigFormValues> {
  controlId?: string
  errorId?: string
  /** 当前要渲染和绑定的 Ant Design Vue 字段配置。 */
  field: AntdConfigFormField<TValues>
  /** 当前表单模型，由根 antdConfigForm 统一持有。 */
  model: TValues
  errors: ConfigFormErrors
  readonly?: ConfigFormCondition<TValues>
  readonlyRender?: AntdConfigFormReadonlyRender<TValues>
}
