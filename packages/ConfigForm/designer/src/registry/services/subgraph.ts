import type { NodeSubgraph, PageNode } from '@moluoxixi/config-form-model'
import type {
  DesignerCreateNodeContext,
  DesignerMaterialDefinition,
} from '../types'
import { DesignerRegistryError } from '../../graph'

function normalizeNode(node: PageNode | Record<string, unknown>): PageNode {
  return {
    ...structuredClone(node),
    props: structuredClone((node.props as PageNode['props'] | undefined) ?? {}),
    events: structuredClone((node.events as PageNode['events'] | undefined) ?? {}),
    bindings: structuredClone((node.bindings as PageNode['bindings'] | undefined) ?? {}),
  } as PageNode
}

export function createDesignerMaterialSubgraph(
  materials: ReadonlyMap<string, DesignerMaterialDefinition>,
  key: string,
  context: DesignerCreateNodeContext,
): NodeSubgraph {
  const material = materials.get(key)
  if (!material) {
    throw new DesignerRegistryError(
      'DESIGNER_MATERIAL_UNKNOWN',
      `Unknown designer material: ${key}`,
      { key },
    )
  }

  const created = material.createNode(context)
  const subgraph: NodeSubgraph = 'root' in created
    ? {
        root: structuredClone(created.root),
        nodesById: Object.fromEntries(Object.entries(created.nodesById).map(([id, node]) => [id, normalizeNode(node)])),
      }
    : {
        root: [{ nodeId: created.id, placement: {} }],
        nodesById: { [created.id]: normalizeNode(created) },
      }
  const root = subgraph.root[0]
  const node = root ? subgraph.nodesById[root.nodeId] : undefined
  if (!node
    || subgraph.root.length !== 1
    || node.component !== material.key
    || node.kind !== material.kind
    || node.id !== context.id) {
    throw new DesignerRegistryError(
      'DESIGNER_MATERIAL_FACTORY_INVALID',
      `Designer material factory returned an invalid node: ${key}`,
      { key, nodeId: node?.id },
    )
  }
  return subgraph
}
