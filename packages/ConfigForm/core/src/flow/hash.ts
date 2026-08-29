import type { ConfigFormFlow, ConfigFormFlowNode } from './types'

/**
 * Stable semantic identity for cache keys and export snapshots. Node positions
 * are intentionally excluded because they are editor presentation state.
 */
export function getConfigFormFlowSemanticHash(flow: ConfigFormFlow): string {
  const semantic = {
    ...flow,
    nodes: flow.nodes.map(({ position: _position, ...node }) => node).sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...flow.edges].sort((left, right) => left.id.localeCompare(right.id)),
  }
  return fnv1a(stableStringify(semantic))
}

/** Serialize JSON values with sorted object keys for key-order-independent hashes. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(item => stableStringify(item)).join(',')}]`
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function fnv1a(value: string): string {
  let hash = 0x811C9DC5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// Keep the public import useful to declaration emitters without exposing an
// implementation-only structural helper.
export type ConfigFormFlowSemanticNode = Omit<ConfigFormFlowNode, 'position'>
