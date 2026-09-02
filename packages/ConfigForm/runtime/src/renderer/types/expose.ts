import type {
  ConfigFormController,
  ConfigFormFieldKey,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'

export interface ConfigFormRendererExpose<TValues extends ConfigFormValues = ConfigFormValues>
  extends Pick<
    ConfigFormController<TValues>,
    | 'clearValidate'
    | 'getErrors'
    | 'getFieldMeta'
    | 'getMeta'
    | 'getValidating'
    | 'getValue'
    | 'getValues'
    | 'resetFields'
    | 'setErrors'
    | 'setValue'
    | 'setValues'
    | 'setTouched'
    | 'submit'
    | 'validate'
    | 'validateField'
  > {
  scrollToField: (field: ConfigFormFieldKey<TValues> | string) => void
}
