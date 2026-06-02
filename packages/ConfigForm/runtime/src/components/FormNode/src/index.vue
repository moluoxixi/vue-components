<script setup lang="ts">
import type { FormNodeProps } from './types/props'
import { useFormNode } from './composables/useFormNode'

/**
 * FormNode 作为 ConfigForm 的内部复杂节点渲染器。
 *
 * 本组件只保留 props 声明和最终 render 入口，所有节点上下文、slot 递归、
 * render-function 分流和监听映射都收敛在私有 composable 里。
 */
defineOptions({
  name: 'FormNode',
  inheritAttrs: false,
})

const props = defineProps<FormNodeProps>()

const { renderNode } = useFormNode(props)
</script>

<template>
  <component :is="renderNode" v-bind="$attrs" />
</template>
