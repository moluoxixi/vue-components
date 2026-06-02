import type { FormInstance, FormItemProp } from 'element-plus'
import type { ConfigFormFieldKey, ConfigFormValues } from '../../../ConfigForm'

export interface ElementConfigFormExpose<TValues extends ConfigFormValues = ConfigFormValues> {
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
  /** 写入单个字段值。 */
  setValue: {
    <K extends ConfigFormFieldKey<TValues>>(field: K, value: TValues[K]): void
    (field: string, value: unknown): void
  }
  /** 批量写入字段值；replace=true 时整体替换模型。 */
  setValues: (values: Partial<TValues>, replace?: boolean) => void
  /** 读取单个字段值。 */
  getValue: {
    <K extends ConfigFormFieldKey<TValues>>(field: K): TValues[K]
    (field: string): unknown
  }
  /** 获取当前表单值浅拷贝。 */
  getValues: () => TValues
}
