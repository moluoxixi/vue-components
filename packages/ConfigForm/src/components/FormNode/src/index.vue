<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { ResolvedFormNode } from '@/types'
import { computed } from 'vue'
import RecursiveField from '@/components/RecursiveField'
import { useFormContext } from '@/composables/useFormContext'
import { resolveSlotNodes } from '@/utils/slot'
import { mergeStyle, readStyleValue } from '@/utils/style'

/**
 * FormNode 渲染已经解析过的节点组件，slot 中的 defineField 节点交给 RecursiveField 递归处理。
 */
defineOptions({ name: 'FormNode' })

const props = defineProps<{
  field: ResolvedFormNode
  componentAttrs?: Record<string, unknown>
  componentListeners?: Record<string, (...args: unknown[]) => Promise<boolean> | void>
}>()

const ctx = useFormContext()

/** 容器节点在 grid 模式下使用 runtime 已补齐的 span。 */
const containerStyle = computed<CSSProperties | undefined>(() => {
  if (ctx.inline) return undefined
  if ('field' in props.field) return undefined
  return { gridColumn: `span ${props.field.span}` }
})

/** 所有节点从无头控制器读取有效可见性，容器隐藏会同时隐藏整棵子树。 */
const visible = computed(() => ctx.isVisible(props.field))

const attrs = computed(() => {
  const baseStyle = containerStyle.value
  const existingStyle = readStyleValue(props.field.props?.style)
  return {
    ...props.field.props,
    ...(props.componentAttrs ?? {}),
    style: mergeStyle(baseStyle, existingStyle),
  }
})

</script>

<template>
  <component
    v-if="visible"
    :is="field.component"
    v-bind="attrs"
    v-on="componentListeners ?? {}"
  >
    <template v-for="(slotValue, slotName) in field.slots" :key="slotName" #[slotName]>
      <template
        v-for="slotField in resolveSlotNodes(slotValue, String(slotName))"
        :key="slotField.key"
      >
        <RecursiveField
          :field="slotField.field"
        />
      </template>
    </template>
  </component>
</template>
