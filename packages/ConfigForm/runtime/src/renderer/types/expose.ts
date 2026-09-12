import type { ConfigFormDataSourceState, ConfigFormScopePath } from '@moluoxixi/config-form-core'
import type {
  ConfigFormController,
  ConfigFormFieldAddress,
  ConfigFormFieldKey,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { ConfigFormPageRuntimeLoadOptions, ConfigFormPageRuntimeOptionState } from '../../runtime'

export interface ConfigFormRendererExpose<TValues extends ConfigFormValues = ConfigFormValues>
  extends Pick<
    ConfigFormController<TValues>,
    | 'appendRow'
    | 'applyFieldInstanceChange'
    | 'clearInstanceValidate'
    | 'clearValidate'
    | 'duplicateRow'
    | 'getErrors'
    | 'getFieldMeta'
    | 'getInstanceErrors'
    | 'getInstanceKey'
    | 'getInstanceMeta'
    | 'getInstanceValue'
    | 'getIssues'
    | 'getMeta'
    | 'getValidating'
    | 'getValue'
    | 'getValues'
    | 'insertRow'
    | 'isInstanceValidating'
    | 'listFieldInstances'
    | 'listRows'
    | 'moveRow'
    | 'removeRow'
    | 'resetFields'
    | 'setErrors'
    | 'setInstanceTouched'
    | 'setInstanceValue'
    | 'setTouched'
    | 'setValue'
    | 'setValues'
    | 'submit'
    | 'validate'
    | 'validateField'
    | 'validateInstance'
  > {
  getVariables: () => Readonly<Record<string, unknown>>
  /** Latest started consumer for this source/scope; per-field state uses getOptionState. */
  getDataSourceState: (sourceId: string, options?: { scope?: ConfigFormScopePath }) => ConfigFormDataSourceState
  loadDataSource: (sourceId: string, options?: ConfigFormPageRuntimeLoadOptions) => Promise<ConfigFormDataSourceState>
  getOptionState: (address: ConfigFormFieldAddress) => ConfigFormPageRuntimeOptionState | undefined
  scrollToField: (field: ConfigFormFieldKey<TValues> | string) => void
}
