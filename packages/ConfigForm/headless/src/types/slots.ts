import type { ConfigFormMeta } from './meta'
import type { ConfigFormValues } from './props'

export interface ConfigFormDefaultSlotContext<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 当前表单值快照。 */
  model: TValues
  /** 当前表单的 dirty/touched 状态。 */
  meta: ConfigFormMeta
  /** 触发表单提交。 */
  submit: () => Promise<boolean>
  /** 重置当前 UI 版本字段值和校验状态。 */
  resetFields: () => void
}

export interface ConfigFormSlots<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 默认 slot 通常用于放置提交、重置等表单操作区。 */
  default?: (context: ConfigFormDefaultSlotContext<TValues>) => unknown
}
