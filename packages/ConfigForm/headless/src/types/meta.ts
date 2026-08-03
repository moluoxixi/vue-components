/** 单字段的交互状态。 */
export interface ConfigFormFieldMeta {
  /** 当前字段值是否偏离 reset 基准。 */
  dirty: boolean
  /** 当前字段是否已被用户触达或由调用方显式标记。 */
  touched: boolean
}

/** 当前表单的聚合交互状态。 */
export interface ConfigFormMeta {
  /** 任一字段为 dirty 时为 true。 */
  dirty: boolean
  /** 任一字段为 touched 时为 true。 */
  touched: boolean
  /** 按字段名索引的状态快照。 */
  fields: Record<string, ConfigFormFieldMeta>
}
