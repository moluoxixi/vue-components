import type { NodeSubgraph, SurfaceNode } from '@moluoxixi/config-form-model'
import type {
  DesignerCreateNodeContext,
  DesignerMaterialDefinition,
} from '../types'
import { DesignerRegistryError } from '../../graph'

function isSurfaceNode(value: object): value is SurfaceNode {
  const candidate = value as Record<string, unknown>
  if (typeof candidate.id !== 'string' || typeof candidate.component !== 'string'
    || !['field', 'layout', 'element'].includes(candidate.kind as string))
    return false
  if (typeof candidate.props !== 'object' || candidate.props === null || Array.isArray(candidate.props))
    return false
  if (candidate.kind === 'field')
    return typeof candidate.field === 'string'
  if (candidate.kind === 'layout')
    return typeof candidate.slots === 'object' && candidate.slots !== null && !Array.isArray(candidate.slots)
  return true
}

function normalizeNode(node: SurfaceNode | Record<string, unknown>): SurfaceNode {
  const cloned = structuredClone(node)
  if (typeof cloned !== 'object' || cloned === null || Array.isArray(cloned))
    throw new DesignerRegistryError('DESIGNER_MATERIAL_FACTORY_INVALID', 'Designer material factory returned a non-object node')
  const candidate = cloned as Record<string, unknown>
  if (typeof candidate.id !== 'string' || typeof candidate.component !== 'string'
    || !['field', 'layout', 'element'].includes(candidate.kind as string)) {
    throw new DesignerRegistryError('DESIGNER_MATERIAL_FACTORY_INVALID', 'Designer material factory returned an invalid node')
  }
  const props = candidate.props
  if (props !== undefined && (typeof props !== 'object' || props === null || Array.isArray(props)))
    throw new DesignerRegistryError('DESIGNER_MATERIAL_FACTORY_INVALID', 'Designer material node props must be an object')
  candidate.props = structuredClone((props as Record<string, unknown> | undefined) ?? {})
  if (candidate.datasetBindings !== undefined)
    candidate.datasetBindings = structuredClone(candidate.datasetBindings)
  if (candidate.resourceBindings !== undefined)
    candidate.resourceBindings = structuredClone(candidate.resourceBindings)
  if (!isSurfaceNode(candidate))
    throw new DesignerRegistryError('DESIGNER_MATERIAL_FACTORY_INVALID', 'Designer material factory returned an invalid node shape')
  return candidate
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
