import type { ComputedRef, CSSProperties } from 'vue'
import type { FormLayoutProps } from '../types/props'
import type { FormContext } from '@/composables/useFormContext'
import { computed } from 'vue'
import { useFormContext } from '@/composables/useFormContext'
import { createLayoutFormContext } from '../utils/createLayoutFormContext'

export interface UseFormLayoutResult {
  layoutCtx: FormContext
  layoutStyle: ComputedRef<CSSProperties>
}

/** 组装 FormLayout 的布局状态和可透传上下文。 */
export function useFormLayout(props: FormLayoutProps): UseFormLayoutResult {
  const parentCtx = useFormContext()

  /** 最终生效的 inline 值：显式设置优先，否则继承父级。 */
  const effectiveInline = computed(() => props.inline ?? parentCtx.inline ?? false)

  const layoutCtx = createLayoutFormContext(parentCtx, {
    get inline() { return effectiveInline.value },
  })

  const layoutStyle = computed<CSSProperties>(() => {
    if (effectiveInline.value) {
      return {
        alignItems: 'flex-start',
        display: 'flex',
        flexWrap: 'wrap',
        gap: props.gap ?? '8px 8px',
      }
    }

    return {
      display: 'grid',
      gap: props.gap ?? '8px 8px',
      gridTemplateColumns: `repeat(${props.columns ?? 24}, 1fr)`,
    }
  })

  return {
    layoutCtx,
    layoutStyle,
  }
}
