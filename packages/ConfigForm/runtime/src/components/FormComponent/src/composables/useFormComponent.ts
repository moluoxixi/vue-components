import type { ComputedRef } from 'vue'
import type { FormComponentProps } from '../types/props'
import type { FieldComponentListeners } from '@/composables/useFieldBinding'
import { computed } from 'vue'
import { useFieldBinding } from '@/composables/useFieldBinding'
import { useFormContext } from '@/composables/useFormContext'

export interface UseFormComponentResult {
  componentAttrs: ComputedRef<Record<string, unknown>>
  componentListeners: ComputedRef<FieldComponentListeners>
}

/**
 * 组装 FormComponent 的值绑定、禁用态和布局 attrs。
 *
 * 外壳逻辑已经交给 FormNode / FormField，当前层只负责无 label 字段的真实控件节点。
 */
export function useFormComponent(props: FormComponentProps): UseFormComponentResult {
  const ctx = useFormContext()

  /** 无 label 字段没有 FormItem 外壳，布局属性必须直接透传给真实控件。 */
  const layoutAttrs = computed(() => {
    if (ctx.inline) {
      return {
        'data-cf-bound-field': props.field.field,
      }
    }

    return {
      'data-cf-bound-field': props.field.field,
      'style': { gridColumn: `span ${props.field.span}` },
    }
  })

  const { attrs: boundAttrs, listeners: componentListeners } = useFieldBinding(
    computed(() => props.field),
  )

  const componentAttrs = computed(() => ({
    ...boundAttrs.value,
    ...layoutAttrs.value,
  }))

  return {
    componentAttrs,
    componentListeners,
  }
}
