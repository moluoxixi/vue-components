import type { ResolvedFormNode, ResolvedSlotContent, ResolvedSlotNode } from '../types'
import { ConfigFormError } from '../errors'
import { isFormNodeConfig } from './node'

/** 生成节点渲染 key，优先使用业务 field 或显式 id，否则使用结构路径。 */
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

  if (!isFormNodeConfig(value)) {
    throw new ConfigFormError(
      'CONFIG_FORM_INVALID_SLOT_NODE',
      `Slot "${slotName}" must be a field config, render function, or an array of them`,
      { slotName },
    )
  }

  return [{
    field: value,
    key: getResolvedNodeRenderKey(value, `${slotName}.${path}`),
  }]
}
