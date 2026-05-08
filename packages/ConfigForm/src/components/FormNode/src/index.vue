<script setup lang="ts">
import type { CSSProperties, VNode } from 'vue'
import type { ResolvedField, ResolvedFormNode, SlotContent } from '@/types'
import { computed, defineComponent } from 'vue'
import RecursiveField from '@/components/RecursiveField'
import { useFormContext } from '@/composables/useFormContext'
import { isFormNodeConfig } from '@/utils/node'

/**
 * FormNode 渲染已经解析过的节点组件，slot 中的 defineField 节点交给 RecursiveField 递归处理。
 */
defineOptions({ name: 'FormNode' })

const SlotRender = defineComponent({
  name: 'SlotRender',
  props: {
    fn: { type: Function, required: true },
  },
  setup(props: { fn: (scope?: Record<string, unknown>) => VNode | string | number }) {
    return () => props.fn()
  },
})

const props = defineProps<{
  node: ResolvedFormNode
  componentAttrs?: Record<string, unknown>
  componentListeners?: Record<string, (...args: unknown[]) => void>
}>()

const ctx = useFormContext()

/** 容器节点在 grid 模式下默认 span: 24，占满整行 */
const containerStyle = computed<CSSProperties | undefined>(() => {
  if (ctx.inline) return undefined
  if ('field' in props.node) return undefined
  return { gridColumn: `span ${props.node.span ?? 24}` }
})

/** 有 field 的节点从 visibilityMap 读取可见性，容器节点始终可见 */
const visible = computed(() => {
  if (!('field' in props.node)) return true
  return ctx.visibilityMap[(props.node as ResolvedField).field] !== false
})

const attrs = computed(() => {
  const baseStyle = containerStyle.value
  const existingStyle = props.node.props?.style as CSSProperties | undefined
  return {
    ...props.node.props,
    ...(props.componentAttrs ?? {}),
    style: baseStyle ? { ...baseStyle, ...existingStyle } : existingStyle,
  }
})

type NormalizedSlotNode =
  | { key: string, kind: 'node', node: ResolvedFormNode }
  | { fn: () => VNode | string | number, key: string, kind: 'render' }

/**
 * 将 runtime 解析后的 slot 返回值统一成渲染节点。
 *
 * - defineField 节点 → kind:'node' → 交给 RecursiveField 递归渲染
 * - VNode/文本/数字 → kind:'render' → 交给 SlotRender 渲染
 */
function normalizeResolvedSlotValue(value: SlotContent, slotName: string, path = '0'): NormalizedSlotNode[] {
  if (value == null || value === false)
    return []

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      normalizeResolvedSlotValue(item as SlotContent, slotName, `${path}-${index}`),
    )
  }

  if (isFormNodeConfig(value)) {
    return [{
      key: `node-${slotName}-${path}`,
      kind: 'node',
      node: value as ResolvedFormNode,
    }]
  }

  return [{
    fn: () => {
      // value 已经由 ConfigForm 根组件处理过，可能是 VNode、文本、数字等。
      return value as VNode | string | number
    },
    key: `render-${slotName}-${path}`,
    kind: 'render',
  }]
}

/**
 * 将单个 slot 配置转换为渲染节点列表。
 *
 * 函数 slot 会在当前 scope 下执行；返回的 defineField 节点交给 RecursiveField。
 */
function normalizeSlotValue(slotValue: SlotContent, scope: Record<string, unknown> | undefined, slotName: string): NormalizedSlotNode[] {
  if (typeof slotValue === 'function')
    return normalizeResolvedSlotValue(slotValue(scope), slotName)

  return normalizeResolvedSlotValue(slotValue, slotName)
}
</script>

<template>
  <component
    v-if="visible"
    :is="node.component"
    v-bind="attrs"
    v-on="componentListeners ?? {}"
  >
    <template v-for="(slotValue, slotName) in node.slots" :key="slotName" #[slotName]="scope">
      <template
        v-for="slotNode in normalizeSlotValue(slotValue, scope, String(slotName))"
        :key="slotNode.key"
      >
        <RecursiveField
          v-if="slotNode.kind === 'node'"
          :node="slotNode.node"
        />
        <SlotRender v-else :fn="slotNode.fn" />
      </template>
    </template>
  </component>
</template>
