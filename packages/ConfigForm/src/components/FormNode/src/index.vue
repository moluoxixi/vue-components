<script setup lang="ts">
import type { CSSProperties, VNode } from 'vue'
import type { FormRuntimeResolveSnap } from '@/runtime'
import type { ResolvedField, ResolvedFormNode, SlotContent } from '@/types'
import { computed, defineComponent } from 'vue'
import RecursiveField from '@/components/RecursiveField'
import { useFormContext } from '@/composables/useFormContext'
import { useRuntime } from '@/composables/useRuntime'
import { isFormNodeConfig } from '@/models/node'

/**
 * FormNode 渲染已经解析过的节点组件，slot 中的 defineField 节点交给 RecursiveField 递归处理。
 */
defineOptions({ name: 'FormNode' })

const SlotRender = defineComponent({
  name: 'SlotRender',
  props: {
    fn: { type: Function, required: true },
    resolveSnap: { type: Object, default: undefined },
  },
  setup(props: { fn: (scope?: Record<string, unknown>, snap?: FormRuntimeResolveSnap) => VNode | string | number, resolveSnap?: FormRuntimeResolveSnap }) {
    return () => props.fn(props.resolveSnap?.slotScope, props.resolveSnap)
  },
})

const props = defineProps<{
  node: ResolvedFormNode
  componentAttrs?: Record<string, unknown>
  componentListeners?: Record<string, (...args: unknown[]) => void>
  resolveSnap?: FormRuntimeResolveSnap
}>()

const runtimeRef = useRuntime()
const ctx = useFormContext()

const currentResolveSnap = computed<FormRuntimeResolveSnap>(() =>
  props.resolveSnap ?? runtimeRef.value.createResolveSnap(),
)

/** 容器节点在 grid 模式下默认 span: 24，占满整行 */
const containerStyle = computed<CSSProperties | undefined>(() => {
  if (ctx.inline) return undefined
  if ('field' in props.node) return undefined
  return { gridColumn: 'span 24' }
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
  | { key: string, kind: 'node', node: ResolvedFormNode, resolveSnap: FormRuntimeResolveSnap }
  | { fn: (scope?: Record<string, unknown>, snap?: FormRuntimeResolveSnap) => VNode | string | number, key: string, kind: 'render', resolveSnap: FormRuntimeResolveSnap }

type SlotResolveSnap = FormRuntimeResolveSnap & { slotName: string }

/**
 * 将 runtime 解析后的 slot 返回值统一成渲染节点。
 *
 * - defineField 节点 → kind:'node' → 交给 RecursiveField 递归渲染
 * - VNode/文本/数字 → kind:'render' → 交给 SlotRender 渲染
 */
function normalizeResolvedSlotValue(value: SlotContent, resolveSnap: SlotResolveSnap, path = '0'): NormalizedSlotNode[] {
  if (value == null || value === false)
    return []

  const { slotName } = resolveSnap

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      normalizeResolvedSlotValue(item as SlotContent, resolveSnap, `${path}-${index}`),
    )
  }

  if (isFormNodeConfig(value)) {
    return [{
      key: `node-${slotName}-${path}`,
      kind: 'node',
      node: runtimeRef.value.resolveNode(value as any, resolveSnap, `${slotName}.${path}`),
      resolveSnap,
    }]
  }

  return [{
    fn: (scope?: Record<string, unknown>, snap?: FormRuntimeResolveSnap) => {
      // value 已经被 resolveSlot 解析过，可能是 VNode、文本、数字等
      // boolean false 已在开头过滤，true 不应该出现，RuntimeToken 应该已被解析
      return value as VNode | string | number
    },
    key: `render-${slotName}-${path}`,
    kind: 'render',
    resolveSnap,
  }]
}

/**
 * 将单个 slot 配置转换为渲染节点列表。
 *
 * 函数 slot 会在当前 scope 下执行；返回的 defineField 节点交给 RecursiveField。
 */
function normalizeSlotValue(slotValue: SlotContent, scope: Record<string, unknown> | undefined, slotName: string): NormalizedSlotNode[] {
  const resolveSnap: SlotResolveSnap = {
    ...currentResolveSnap.value,
    slotName,
    slotScope: scope,
  }
  const resolvedSlot = runtimeRef.value.resolveSlot(slotValue, resolveSnap, `slots.${slotName}`)

  if (typeof resolvedSlot === 'function')
    return normalizeResolvedSlotValue(resolvedSlot(scope, resolveSnap), resolveSnap)

  return normalizeResolvedSlotValue(resolvedSlot, resolveSnap)
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
          :resolve-snap="slotNode.resolveSnap"
        />
        <SlotRender v-else :fn="slotNode.fn" :resolve-snap="slotNode.resolveSnap" />
      </template>
    </template>
  </component>
</template>
