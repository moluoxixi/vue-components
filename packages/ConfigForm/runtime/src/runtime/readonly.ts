import type { VNodeChild } from 'vue'
import type {
  ReadonlyAdapter,
  ReadonlyAdapterRegistry,
  ReadonlyRenderContext,
} from './types'
import type { FormValues, ResolvedBoundNode } from '@/types'
import { h, toDisplayString } from 'vue'

/** 读取字段对应的只读适配器 key；未命中稳定名称时交给默认文本展示。 */
export function resolveReadonlyAdapterKey(component: ResolvedBoundNode['component']): string | undefined {
  if (typeof component === 'string')
    return component

  const name = (component as { name?: unknown }).name
  return typeof name === 'string' ? name : undefined
}

/** 创建只读适配器上下文；读取当前字段值时始终基于最新表单状态。 */
export function createReadonlyRenderContext(
  node: ResolvedBoundNode,
  values: FormValues,
): ReadonlyRenderContext {
  return {
    field: node.field,
    node,
    value: values[node.field],
    values,
  }
}

/** 从只读适配器表里按当前组件 key 解析适配器。 */
export function resolveReadonlyAdapter(
  adapters: ReadonlyAdapterRegistry,
  node: ResolvedBoundNode,
): ReadonlyAdapter | undefined {
  const key = resolveReadonlyAdapterKey(node.component)
  return key ? adapters[key] : undefined
}

/** 默认只读文本渲染器；只负责把原始值输出成稳定的文本节点。 */
export function renderReadonlyFallback(value: unknown): VNodeChild {
  return h('span', toDisplayString(value))
}
