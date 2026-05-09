<script setup lang="ts">
import type { FormContext } from '@/composables/useFormContext'
import type { CSSProperties } from 'vue'
import { computed, provide } from 'vue'
import { FORM_CONTEXT_KEY, useFormContext } from '@/composables/useFormContext'
import { useBem, useNamespace } from '@/composables/useNamespace'

/**
 * FormLayout 是布局容器组件，用于在表单内切换布局模式。
 *
 * - inline=true  → flex 布局，子字段水平排列
 * - inline=false → grid 布局（默认 24 列），子字段按 span 分列
 *
 * 同时通过 provide 覆写 FormContext 中的 inline 标记，
 * 子树中的 FormField 会自动继承当前布局模式。
 */
defineOptions({ name: 'FormLayout' })

const props = withDefaults(defineProps<{
  /** 是否使用行内布局；默认继承父级上下文（默认）。 */
  inline?: boolean| null
  /** grid 列数（仅非 inline 模式生效），默认 24。 */
  columns?: number
  /** 网格间距，默认 "16px 8px"。 */
  gap?: string
}>(), {
  inline: null,
  columns: 24,
  gap: '8px 8px',
})

const parentCtx = useFormContext()
const ns = useNamespace()
const { b } = useBem(ns)

/** 最终生效的 inline 值：显式设置优先，否则继承父级。 */
const effectiveInline = computed(() => props.inline ?? parentCtx.inline ?? false)

/**
 * 创建 FormLayout 子树使用的表单上下文。
 *
 * 该函数只允许覆写布局相关字段，其余状态和行为都实时转发父级，避免 provide 快照导致错误或值失去响应。
 */
function createLayoutFormContext(
  parentCtx: FormContext,
  overrides: Pick<FormContext, 'inline'>,
): FormContext {
  return {
    get values() { return parentCtx.values },
    get errors() { return parentCtx.errors },
    get inline() { return overrides.inline },
    get labelWidth() { return parentCtx.labelWidth },
    getValue: parentCtx.getValue,
    getValues: parentCtx.getValues,
    isVisible: parentCtx.isVisible,
    isDisabled: parentCtx.isDisabled,
    setValue: parentCtx.setValue,
    setValues: parentCtx.setValues,
    validateField: parentCtx.validateField,
  }
}

const layoutCtx = createLayoutFormContext(parentCtx, {
  get inline() { return effectiveInline.value },
})

provide(FORM_CONTEXT_KEY, layoutCtx)

const layoutStyle = computed<CSSProperties>(() => {
  if (effectiveInline.value) {
    return {
      display: 'flex',
      flexWrap: 'wrap',
      gap: props.gap,
      alignItems: 'center',
    }
  }
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${props.columns}, 1fr)`,
    gap: props.gap,
  }
})
</script>

<template>
  <div
    :class="b('layout')"
    :style="layoutStyle"
  >
    <slot />
  </div>
</template>
