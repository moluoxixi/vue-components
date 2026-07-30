import type { ConfigFormController, ConfigFormFieldKey, ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { FormInstance, FormItemProp } from 'element-plus'

export interface ElementConfigFormExpose<TValues extends ConfigFormValues = ConfigFormValues>
  extends Pick<ConfigFormController<TValues>, 'getValue' | 'getValues' | 'setValue' | 'setValues'> {
  /** 触发表单提交；校验通过时触发 submit，失败时触发 error 并返回 false。 */
  submit: () => Promise<boolean>
  /** 直接调用 Element Plus Form.validate。 */
  validate: FormInstance['validate']
  /** 直接调用 Element Plus Form.validateField。 */
  validateField: FormInstance['validateField']
  /** 重置 Element Plus 字段值和校验状态。 */
  resetFields: FormInstance['resetFields']
  /** 清理 Element Plus 字段校验状态。 */
  clearValidate: FormInstance['clearValidate']
  /** 滚动到指定 Element Plus 字段。 */
  scrollToField: (field: ConfigFormFieldKey<TValues> | FormItemProp) => void
}
