<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { ResolvedField, ResolvedFormNode, SlotContent } from '@/types'
import { computed } from 'vue'
import RecursiveField from '@/components/RecursiveField'
import { useFormContext } from '@/composables/useFormContext'
import { isFormNodeConfig } from '@/utils/node'

/**
 * FormNode 渲染已经解析过的节点组件，slot 中的 defineField 节点交给 RecursiveField 递归处理。
 */
defineOptions({ name: 'FormNode' })

const props = defineProps<{
  field: ResolvedFormNode
  componentAttrs?: Record<string, unknown>
  componentListeners?: Record<string, (...args: unknown[]) => void>
}>()

const ctx = useFormContext()

/** 容器节点在 grid 模式下默认 span: 24，占满整行 */
const containerStyle = computed<CSSProperties | undefined>(() => {
  if (ctx.inline) return undefined
  if ('field' in props.field) return undefined
  return { gridColumn: `span ${props.field.span ?? 24}` }
})

/** 有 field 的节点从 visibilityMap 读取可见性，容器节点始终可见 */
const visible = computed(() => {
  if (!('field' in props.field)) return true
  return ctx.visibilityMap[(props.field as ResolvedField).field] !== false
})

const attrs = computed(() => {
  const baseStyle = containerStyle.value
  const existingStyle = props.field.props?.style as CSSProperties | undefined
  return {
    ...props.field.props,
    ...(props.componentAttrs ?? {}),
    style: baseStyle ? { ...baseStyle, ...existingStyle } : existingStyle,
  }
})

interface NormalizedSlotField {
  field: ResolvedFormNode
  key: string
}

/**
 * 将 runtime 解析后的 slot 配置统一成递归渲染节点。
 *
 * slot 只接受与顶层 fields 一致的节点配置；非配置值直接抛错，避免旧 render slot 语义继续生效。
 */
function normalizeResolvedSlotValue(value: SlotContent, slotName: string, path = '0'): NormalizedSlotField[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      normalizeResolvedSlotValue(item as SlotContent, slotName, `${path}-${index}`),
    )
  }

  if (!isFormNodeConfig(value))
    throw new TypeError(`Slot "${slotName}" must be a field config or an array of field configs`)

  return [{
    field: value as ResolvedFormNode,
    key: `field-${slotName}-${path}`,
  }]
}

/**
 * 将单个 slot 配置转换为渲染节点列表。
 *
 * 该函数只处理已经由 runtime 转换过的节点配置，不再执行函数 slot。
 */
function normalizeSlotValue(slotValue: SlotContent, slotName: string): NormalizedSlotField[] {
  return normalizeResolvedSlotValue(slotValue, slotName)
}
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
        v-for="slotField in normalizeSlotValue(slotValue, String(slotName))"
        :key="slotField.key"
      >
        <RecursiveField
          :field="slotField.field"
        />
      </template>
    </template>
  </component>
</template>
