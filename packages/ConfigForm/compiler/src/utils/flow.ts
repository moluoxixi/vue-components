import type { ConfigFormFlow } from '@moluoxixi/config-form-core'
import { clone } from './immutable'

export function withoutFlowPositions(flow: ConfigFormFlow): ConfigFormFlow {
  return {
    ...clone(flow),
    nodes: flow.nodes.map(({ position: _position, ...node }) => clone(node)),
  }
}
