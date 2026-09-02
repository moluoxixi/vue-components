import type { Ref } from 'vue'
import type { FormErrors, FormValues, ResolvedFormNode } from '../../../types'

export interface UseFormOptions<T extends object = FormValues> {
  fields: Ref<ResolvedFormNode[]>
  defaultValues?: Partial<T> | Ref<Partial<T> | undefined>
  onSubmit?: (values: T) => void
  onError?: (errors: FormErrors) => void
}
