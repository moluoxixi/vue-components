<script setup lang="ts">
import type { FormLayoutProps } from './types/props'
import { provide } from 'vue'
import { FORM_CONTEXT_KEY } from '@/composables/useFormContext'
import { useBem, useNamespace } from '@/composables/useNamespace'
import { useFormLayout } from './composables/useFormLayout'

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

const props = withDefaults(defineProps<FormLayoutProps>(), {
  columns: 24,
  gap: '8px 8px',
  inline: null,
})
const ns = useNamespace()
const { b } = useBem(ns)

const { layoutCtx, layoutStyle } = useFormLayout(props)

provide(FORM_CONTEXT_KEY, layoutCtx)
</script>

<template>
  <div
    :class="b('layout')"
    :style="layoutStyle"
  >
    <slot />
  </div>
</template>
