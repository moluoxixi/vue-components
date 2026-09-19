import type {
  ComponentContractRegistry,
  ModelDiagnostic,
  NodeId,
  ProjectDocument,
  ProjectOperation,
  SurfaceGraph,
  SurfaceId,
} from '../../../types'
import { analyzeSurfaceValueScopes } from '../../value-scope'
import { validateSelectedNodesAgainstRegistry } from './registry'

interface NodeRelation {
  parentId: NodeId | null
  slot: string | null
}

export function validateTrustedIncrementalTransaction(
  source: ProjectDocument,
  candidate: ProjectDocument,
  operations: readonly ProjectOperation[],
  registry?: ComponentContractRegistry,
): ModelDiagnostic[] | undefined {
  const selectedNodes = new Map<SurfaceId, Set<NodeId>>()
  const insertedNodes = new Map<SurfaceId, Set<NodeId>>()
  const scopeSurfaces = new Set<SurfaceId>()

  for (const operation of operations) {
    switch (operation.type) {
      case 'node.move': {
        const before = findNodeRelation(source, operation.surfaceId, operation.nodeId)
        const after = findNodeRelation(candidate, operation.surfaceId, operation.nodeId)
        if (!before || !after || before.parentId !== after.parentId || before.slot !== after.slot)
          return undefined
        break
      }
      case 'node.insert':
        Object.keys(operation.subgraph.nodesById).forEach((nodeId) => {
          addSelectedNode(selectedNodes, operation.surfaceId, nodeId)
          addSelectedNode(insertedNodes, operation.surfaceId, nodeId)
        })
        scopeSurfaces.add(operation.surfaceId)
        break
      case 'node.props':
        addSelectedNode(selectedNodes, operation.surfaceId, operation.nodeId)
        break
      case 'node.placement':
        break
      default:
        return undefined
    }
  }

  const diagnostics: ModelDiagnostic[] = []
  candidate.surfaceOrder.forEach((surfaceId) => {
    if (!scopeSurfaces.has(surfaceId))
      return
    const surface = candidate.surfacesById[surfaceId]
    if (!surface)
      return
    const reachable = collectReachableNodeIds(surface.graph)
    insertedNodes.get(surfaceId)?.forEach((nodeId) => {
      if (!reachable.has(nodeId)) {
        diagnostics.push({
          code: 'surface_graph_invalid',
          message: `Node is unreachable: ${nodeId}.`,
          path: ['surfacesById', surfaceId, 'graph', 'nodesById', nodeId],
          surfaceId,
          nodeId,
        })
      }
    })
    analyzeSurfaceValueScopes(surface.graph).issues.forEach((problem) => {
      diagnostics.push({
        code: 'surface_graph_invalid',
        message: problem.message,
        path: ['surfacesById', surfaceId, 'graph', ...problem.path],
        surfaceId,
      })
    })
  })

  selectedNodes.forEach((nodeIds, surfaceId) => {
    const surface = candidate.surfacesById[surfaceId]
    if (!surface)
      return
    nodeIds.forEach((nodeId) => {
      const node = surface.graph.nodesById[nodeId]
      if (!node)
        return
      if (!Object.hasOwn(candidate.registryLock.components, node.component)) {
        diagnostics.push({
          code: 'surface_graph_invalid',
          message: `Registry lock does not contain node component: ${node.component}.`,
          path: ['surfacesById', surfaceId, 'graph', 'nodesById', nodeId, 'component'],
          surfaceId,
          nodeId,
          context: { surfaceId, nodeId, component: node.component },
        })
      }
      Object.entries(node.datasetBindings ?? {}).forEach(([key, reference]) => {
        if (!Object.hasOwn(candidate.datasetsById, reference.datasetId)) {
          diagnostics.push({
            code: 'dataset_reference_invalid',
            message: `Dataset reference does not exist: ${reference.datasetId}.`,
            path: ['surfacesById', surfaceId, 'graph', 'nodesById', nodeId, 'datasetBindings', key, 'datasetId'],
            surfaceId,
            datasetId: reference.datasetId,
            nodeId,
            context: { datasetId: reference.datasetId, surfaceId, nodeId },
          })
        }
      })
      Object.entries(node.resourceBindings ?? {}).forEach(([key, reference]) => {
        if (!Object.hasOwn(candidate.resources, reference.resourceId)) {
          diagnostics.push({
            code: 'resource_reference_invalid',
            message: `Resource reference does not exist: ${reference.resourceId}.`,
            path: ['surfacesById', surfaceId, 'graph', 'nodesById', nodeId, 'resourceBindings', key, 'resourceId'],
            surfaceId,
            resourceId: reference.resourceId,
            nodeId,
            context: { resourceId: reference.resourceId, surfaceId, nodeId },
          })
        }
      })
    })
  })

  if (registry)
    diagnostics.push(...validateSelectedNodesAgainstRegistry(candidate, registry, selectedNodes))
  return diagnostics
}

function addSelectedNode(
  target: Map<SurfaceId, Set<NodeId>>,
  surfaceId: SurfaceId,
  nodeId: NodeId,
): void {
  const nodeIds = target.get(surfaceId) ?? new Set<NodeId>()
  nodeIds.add(nodeId)
  target.set(surfaceId, nodeIds)
}

function findNodeRelation(
  document: ProjectDocument,
  surfaceId: SurfaceId,
  nodeId: NodeId,
): NodeRelation | undefined {
  const graph = document.surfacesById[surfaceId]?.graph
  if (!graph)
    return undefined
  if (graph.root.some(item => item.nodeId === nodeId))
    return { parentId: null, slot: null }
  for (const parent of Object.values(graph.nodesById)) {
    if (parent.kind !== 'layout')
      continue
    for (const [slot, items] of Object.entries(parent.slots)) {
      if (items.some(item => item.nodeId === nodeId))
        return { parentId: parent.id, slot }
    }
  }
}

function collectReachableNodeIds(graph: SurfaceGraph): Set<NodeId> {
  const reachable = new Set<NodeId>()
  const pending = graph.root.map(item => item.nodeId)
  while (pending.length > 0) {
    const nodeId = pending.pop()!
    if (reachable.has(nodeId))
      continue
    reachable.add(nodeId)
    const node = graph.nodesById[nodeId]
    if (node?.kind === 'layout') {
      Object.values(node.slots).forEach((items) => {
        items.forEach(item => pending.push(item.nodeId))
      })
    }
  }
  return reachable
}
