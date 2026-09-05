import type { VNode } from 'vue'
import type { ConfigFormProps, FormErrors } from '../../../types'
import ConfigFormComponent from '../index.vue'

const ConfigForm = ConfigFormComponent as unknown as {
  <T extends object = Record<string, unknown>>(
    props: ConfigFormProps<T> & {
      onError?: (errors: FormErrors) => unknown
      onSubmit?: (values: T) => unknown
    },
  ): VNode
}

export default ConfigForm
