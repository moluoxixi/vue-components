import type { ConfigFormValues } from '@moluoxixi/config-form-core'

export interface ElementConfigFormDefaultSlotContext<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 当前表单值快照。 */
  model: TValues
  /** 触发表单提交。 */
  submit: () => Promise<boolean>
  /** 重置 Element Plus 字段值和校验状态。 */
  resetFields: () => void
}

export interface ElementConfigFormSlots<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 默认 slot 通常用于放置提交、重置等表单操作区。 */
  default?: (context: ElementConfigFormDefaultSlotContext<TValues>) => unknown
}
