import type { ConfigFormController, ConfigFormFieldKey, ConfigFormValues } from '@moluoxixi/config-form-headless'

export interface AntdConfigFormExpose<TValues extends ConfigFormValues = ConfigFormValues>
  extends Pick<
    ConfigFormController<TValues>,
    | 'clearValidate'
    | 'getErrors'
    | 'getValidating'
    | 'getValue'
    | 'getValues'
    | 'resetFields'
    | 'setValue'
    | 'setValues'
    | 'submit'
    | 'validate'
    | 'validateField'
  > {
  /** 滚动到指定字段壳。 */
  scrollToField: (field: ConfigFormFieldKey<TValues> | string) => void
}
