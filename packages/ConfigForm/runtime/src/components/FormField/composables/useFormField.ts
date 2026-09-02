import type { FormFieldProps, UseFormFieldResult } from '../types'
import { computed } from 'vue'
import { useFormContext } from '../../../composables/useFormContext'
import { resolveValue } from '../../../utils/resolvable'

/** 组装 FormItem 需要消费的最小 props，避免把完整字段配置透传给外壳。 */
export function useFormField(props: FormFieldProps): UseFormFieldResult {
  const ctx = useFormContext()

  const formItemComponentProps = computed(() => ({
    field: props.field.field,
    id: props.field.id,
    label: props.field.label,
    required: resolveValue(props.field.required, ctx.values, false),
    span: props.field.span,
  }))

  return {
    formItemComponentProps,
  }
}
