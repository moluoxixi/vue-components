import type { ConfigFormController, ConfigFormFieldKey, ConfigFormValues } from '@moluoxixi/config-form-headless'

export type ShadcnConfigFormErrors = Record<string, string[]>

export interface ShadcnConfigFormExpose<TValues extends ConfigFormValues = ConfigFormValues>
  extends Pick<ConfigFormController<TValues>, 'getValue' | 'getValues' | 'setValue' | 'setValues'> {
  /** 触发表单提交；校验通过时触发 submit，失败时触发 error 并返回 false。 */
  submit: () => Promise<boolean>
  /** 校验当前所有可见且未禁用字段。 */
  validate: () => Promise<boolean>
  /** 校验指定字段。 */
  validateField: (field: ConfigFormFieldKey<TValues> | string) => Promise<boolean>
  /** 重置字段值为初始快照并清理校验状态。 */
  resetFields: (fields?: ConfigFormFieldKey<TValues> | string | Array<ConfigFormFieldKey<TValues> | string>) => void
  /** 清理全部或指定字段校验状态。 */
  clearValidate: (fields?: ConfigFormFieldKey<TValues> | string | Array<ConfigFormFieldKey<TValues> | string>) => void
  /** 滚动到指定字段壳。 */
  scrollToField: (field: ConfigFormFieldKey<TValues> | string) => void
  /** 获取当前字段错误浅拷贝。 */
  getErrors: () => ShadcnConfigFormErrors
}
