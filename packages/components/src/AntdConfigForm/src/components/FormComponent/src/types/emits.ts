import type { ConfigFormFieldChangeRequest, ConfigFormValues } from '../../../../../../ConfigForm'

export interface FormComponentEmits<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 真实字段组件写回值时触发，由上层字段节点继续冒泡给根 antdConfigForm。 */
  (event: 'fieldChange', payload: ConfigFormFieldChangeRequest<TValues>): void
}
