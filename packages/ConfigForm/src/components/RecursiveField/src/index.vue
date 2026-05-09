<script setup lang="ts">
import type { ResolvedFormNode } from '@/types'
import { computed } from 'vue'
import FormComponent from '@/components/FormComponent'
import FormField from '@/components/FormField'
import FormNode from '@/components/FormNode'
import { useFormContext } from '@/composables/useFormContext'
import { isResolvedComponent, isResolvedField } from '@/utils/node'

/**
 * RecursiveField 基于 runtime 守卫做三路分派，并在递归入口剪枝不可见节点。
 *
 * - Field（有 field + 有 label）→ FormField（label + error + 值绑定）
 * - Component（有 field + 无 label）→ FormComponent（值绑定）
 * - Container（无 field）→ FormNode（纯容器）
 *
 * 三者 props 统一为 { field }，用 <component :is> 分派。
 * 插槽通用转发，不感知具体插槽名。
 * 递归节点已由 ConfigForm 根组件提前处理。
 */
defineOptions({ name: 'RecursiveField' })

const props = defineProps<{
  field: ResolvedFormNode
}>()

const ctx = useFormContext()

/** 当前节点的有效可见性由 useForm 统一解析，隐藏时不再创建下游节点组件。 */
const visible = computed(() => ctx.isVisible(props.field))

const resolvedComponent = computed(() => {
  if (isResolvedField(props.field)) return FormField
  if (isResolvedComponent(props.field)) return FormComponent
  return FormNode
})
</script>

<template>
  <component v-if="visible" :is="resolvedComponent" :field="field" />
</template>
