import type { ConfigFormFlow } from '../types'
import { getConfigFormJsonSemanticHash } from '../../json'

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
