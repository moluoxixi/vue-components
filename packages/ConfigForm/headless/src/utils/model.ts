import type { Ref } from 'vue'
import type { ConfigFormModelAdapter, ConfigFormValues } from '../types'

/** Bind the controller directly to a host-owned ref; no local value store or event echo. */
export function createConfigFormModel<TValues extends ConfigFormValues>(
  source: Ref<TValues>,
): ConfigFormModelAdapter<TValues> {
  return { read: () => source.value, write: values => source.value = values }
}
