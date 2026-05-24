import type { ResolvedFormNode, ResolvedSlotContent } from '@/types'
import { isFormNodeConfig } from '@/utils/node'

/** 可递归渲染的 slot 节点，包含稳定 key 和已解析字段配置。 */
export interface ResolvedSlotNode {
  /** 传给 RecursiveField 的字段或容器配置。 */
  field: ResolvedFormNode
  /** 当前 slot 内的稳定渲染 key，不参与业务字段标识。 */
  key: string
}

/** 生成节点渲染 key，优先使用业务 field 或显式 id，否则回退到结构路径。 */
export function getResolvedNodeRenderKey(field: ResolvedFormNode, path: string): string {
  if ('field' in field)
    return `field:${field.field}:path:${path}`

  if (field.id)
    return `node:${field.id}:path:${path}`

  return `node:path:${path}`
}

/**
 * 将 runtime 已处理的 slot 配置转换为递归渲染节点。
 *
 * slot 只接受与顶层 fields 一致的节点配置；非配置值直接抛错，避免旧 render slot 语义静默生效。
 */
export function resolveSlotNodes(value: ResolvedSlotContent, slotName: string, path = slotName): ResolvedSlotNode[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      resolveSlotNodes(item, slotName, `${path}.${index}`),
    )
  }

  if (typeof value === 'function')
    return []

  if (!isFormNodeConfig(value))
    throw new TypeError(`Slot "${slotName}" must be a field config, render function, or an array of them`)

  return [{
    field: value,
    key: getResolvedNodeRenderKey(value, `${slotName}.${path}`),
  }]
}
