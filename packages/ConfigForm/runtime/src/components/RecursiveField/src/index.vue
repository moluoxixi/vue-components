<script setup lang="ts">
import type { RecursiveFieldProps } from './types/props'
import { useRecursiveField } from './composables/useRecursiveField'

/**
 * RecursiveField 基于 runtime 守卫做三路分派，并在递归入口剪枝不可见节点。
 *
 * - Field（有 field + 有 label）→ FormField（外壳 + 可选 label/error + 值绑定）
 * - Component（有 field + 无 label）→ FormComponent（值绑定）
 * - Container（无 field）→ FormNode（纯容器）
 *
 * 三者 props 统一为 { field }，用 <component :is> 分派。
 * 插槽通用转发，不感知具体插槽名。
 * 递归节点已由 ConfigForm 根组件提前处理。
 */
defineOptions({ name: 'RecursiveField' })

const props = defineProps<RecursiveFieldProps>()

const { visible, resolvedComponent } = useRecursiveField(props)
</script>

<template>
  <component :is="resolvedComponent" v-if="visible" :field="field" />
</template>
