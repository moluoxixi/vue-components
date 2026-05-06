<script setup lang="ts">
import type { FormRuntimeResolveSnap } from '@/runtime'
import type { ResolvedFormNode } from '@/types'
import { computed } from 'vue'
import FormComponent from '@/components/FormComponent'
import FormField from '@/components/FormField'
import FormNode from '@/components/FormNode'
import { isResolvedComponent, isResolvedField } from '@/models/node'

/**
 * RecursiveField 基于 runtime 守卫做三路分派，递归渲染子节点。
 *
 * - Field（有 field + 有 label）→ FormField（label + error + 值绑定）
 * - Component（有 field + 无 label）→ FormComponent（值绑定）
 * - Container（无 field）→ FormNode（纯容器）
 *
 * 三者 props 统一为 { node, resolveSnap }，用 <component :is> 分派。
 * 插槽通用转发，不感知具体插槽名。
 * 递归由 FormNode 内部 slot 解析自动完成。
 */
defineOptions({ name: 'RecursiveField' })

const props = defineProps<{
  node: ResolvedFormNode
  resolveSnap?: FormRuntimeResolveSnap
}>()

const resolvedComponent = computed(() => {
  if (isResolvedField(props.node)) return FormField
  if (isResolvedComponent(props.node)) return FormComponent
  return FormNode
})
</script>

<template>
  <component :is="resolvedComponent" :node="node" :resolve-snap="resolveSnap" />
</template>
