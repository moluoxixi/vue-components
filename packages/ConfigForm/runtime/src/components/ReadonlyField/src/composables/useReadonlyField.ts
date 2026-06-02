import type { ComputedRef, VNodeChild } from 'vue'
import type { ReadonlyFieldProps } from '../types/props'
import { computed } from 'vue'
import { useFormContext } from '@/composables/useFormContext'
import { useRuntime } from '@/composables/useRuntime'
import { renderReadonlyFallback, resolveReadonlyAdapter } from '@/runtime/readonly'
import { resolveValue } from '@/utils/resolvable'

export interface UseReadonlyFieldResult {
  componentAttrs: ComputedRef<Record<string, unknown>>
  formItemComponentProps: ComputedRef<{
    field: string
    id?: string
    label: string
    required: boolean
    span: number
  }>
  hasLabel: ComputedRef<boolean>
  readonlyRenderer: ComputedRef<() => VNodeChild>
}

/**
 * 组装只读字段所需的展示上下文。
 *
 * 该 composable 只负责布局、label、raw value fallback 和适配器查找，不参与编辑事件。
 */
export function useReadonlyField(props: ReadonlyFieldProps): UseReadonlyFieldResult {
  const ctx = useFormContext()
  const runtime = useRuntime()

  /** 只读显示仍需跟随当前表单值变化，避免切换时展示旧快照。 */
  const currentValue = computed(() => ctx.getValue(props.field.field))

  const hasLabel = computed(() => props.field.label !== undefined)

  /** 无 label 的只读字段沿用 FormComponent 的布局策略。 */
  const componentAttrs = computed<Record<string, unknown>>(() => {
    if (ctx.inline) {
      return {
        'data-cf-bound-field': props.field.field,
      }
    }

    return {
      'data-cf-bound-field': props.field.field,
      'style': {
        gridColumn: `span ${props.field.span}`,
      },
    }
  })

  const formItemComponentProps = computed(() => ({
    field: props.field.field,
    id: props.field.id,
    label: props.field.label ?? '',
    required: resolveValue(props.field.required, ctx.values, false),
    span: props.field.span,
  }))

  /** 只读适配器按组件 key 查找；未命中时直接回退到 raw value 文本。 */
  const readonlyRenderer = computed<() => VNodeChild>(() => {
    const adapter = resolveReadonlyAdapter(runtime.value.readonlyAdapters, props.field)
    const value = currentValue.value

    return () => {
      const context = {
        field: props.field.field,
        node: props.field,
        value,
        values: ctx.values,
      }

      return adapter
        ? adapter(context)
        : renderReadonlyFallback(context.value)
    }
  })

  return {
    componentAttrs,
    formItemComponentProps,
    hasLabel,
    readonlyRenderer,
  }
}
