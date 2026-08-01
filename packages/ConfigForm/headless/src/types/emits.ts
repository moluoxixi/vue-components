import type {
  ConfigFormErrors,
  ConfigFormFieldKey,
  ConfigFormValidateTrigger,
  ConfigFormValues,
} from './props'

export interface ConfigFormFieldChangePayload<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 被更新的字段名。 */
  field: ConfigFormFieldKey<TValues> | string
  /** 本次写入的字段值。 */
  value: unknown
  /** 写入后的完整表单值。 */
  values: TValues
}

export interface ConfigFormFieldChangeRequest<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 被更新的字段名。 */
  field: ConfigFormFieldKey<TValues> | string
  /** 写入根表单模型的新字段值。 */
  value: unknown
}

export interface ConfigFormFieldValidateRequest<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 需要校验的字段名。 */
  field: ConfigFormFieldKey<TValues> | string
  /** 本次交互对应的校验触发时机。 */
  trigger: Exclude<ConfigFormValidateTrigger, 'submit'>
}

export interface ConfigFormEmits<TValues extends ConfigFormValues = ConfigFormValues> {
  /** 任意字段写入后触发，返回完整表单值。 */
  (event: 'change', values: TValues): void
  /** 单字段写入后触发，返回字段维度变更信息。 */
  (event: 'fieldChange', payload: ConfigFormFieldChangePayload<TValues>): void
  /** submit 校验通过后触发。 */
  (event: 'submit', values: TValues): void
  /** submit 校验未通过时触发，透出 Headless 标准错误集合。 */
  (event: 'error', errors: ConfigFormErrors): void
}
