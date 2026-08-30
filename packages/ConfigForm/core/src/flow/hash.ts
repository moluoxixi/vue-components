import type { ConfigFormFlow, ConfigFormFlowNode } from './types'
import { getConfigFormJsonSemanticHash } from '../json'

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
  return getConfigFormJsonSemanticHash(semantic)
}

// Keep the public import useful to declaration emitters without exposing an
// implementation-only structural helper.
export type ConfigFormFlowSemanticNode = Omit<ConfigFormFlowNode, 'position'>
