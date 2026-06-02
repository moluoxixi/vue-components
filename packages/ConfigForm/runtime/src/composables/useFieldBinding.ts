import type { ComputedRef } from 'vue'
import type { ResolvedBoundNode } from '@/types'
import { computed } from 'vue'
import { useFormContext } from '@/composables/useFormContext'

export type FieldComponentListeners = Record<string, (...args: unknown[]) => Promise<boolean> | void>

export interface FieldBinding {
  modelValue: ComputedRef<unknown>
  disabled: ComputedRef<boolean>
  attrs: ComputedRef<Record<string, unknown>>
  listeners: ComputedRef<FieldComponentListeners>
}

/**
 * 从字段组件事件参数中解析需要写回表单的值。
 *
 * 默认采用组件事件的第一个参数；字段声明提供 getValueFromEvent 时交给调用方自定义解析。
 */
function resolveFieldEventValue(field: ResolvedBoundNode, args: unknown[]): unknown {
  return field.getValueFromEvent
    ? field.getValueFromEvent(...args)
    : args[0]
}

/**
 * 统一生成真实字段组件需要消费的 attrs 和 listeners。
 *
 * 该 hook 只处理已解析字段的值绑定、禁用态、事件回写和字段级校验触发；
 * label 和 error 外包装由 FormItem 独立处理。
 */
export function useFieldBinding(
  field: ComputedRef<ResolvedBoundNode>,
): FieldBinding {
  const ctx = useFormContext()
  const modelValue = computed(() => ctx.getValue(field.value.field))
  const disabled = computed(() => ctx.isDisabled(field.value))

  const attrs = computed<Record<string, unknown>>(() => {
    const next = {
      ...field.value.props,
    }

    if (disabled.value)
      next.disabled = true

    return {
      ...next,
      [field.value.valueProp]: modelValue.value,
    }
  })

  const listeners = computed<FieldComponentListeners>(() => ({
    [field.value.blurTrigger]: () => {
      const currentField = field.value
      return ctx.validateField(currentField.field, 'blur')
    },
    [field.value.trigger]: (...args: unknown[]) => {
      const currentField = field.value
      const value = resolveFieldEventValue(currentField, args)
      ctx.setValue(currentField.field, value)
      return ctx.validateField(currentField.field, 'change')
    },
  }))

  return {
    modelValue,
    disabled,
    attrs,
    listeners,
  }
}
