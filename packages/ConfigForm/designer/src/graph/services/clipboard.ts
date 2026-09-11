import type { NodeSubgraph, PageGraph, PageNode } from '@moluoxixi/config-form-model'
import { collectDesignSubtreeIds, findDesignNode, walkDesignGraph } from '../utils'
import { createDesignerNodeId } from './commands'

// Graphs arrive as reactive proxies, which structuredClone rejects; nodes are
// JSON-safe by schema, so a JSON round-trip is the reliable deep clone here.
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Extracts the given top-level nodes (with their subtrees and placements)
 * into a serializable subgraph, ordered by document order. The extracted
 * subgraph still carries the original ids; remap before re-inserting.
 */
export function extractDesignSubgraph(graph: PageGraph, nodeIds: readonly string[]): NodeSubgraph | undefined {
  const order: string[] = []
  walkDesignGraph(graph, ({ node }) => {
    order.push(node.id)
  })
  const roots = [...new Set(nodeIds)]
    .map(nodeId => findDesignNode(graph, nodeId))
    .filter((location): location is NonNullable<typeof location> => Boolean(location))
    .sort((left, right) => order.indexOf(left.node.id) - order.indexOf(right.node.id))
  if (roots.length === 0)
    return undefined

  const nodesById: Record<string, PageNode> = {}
  for (const location of roots) {
    for (const subtreeId of collectDesignSubtreeIds(graph, location.node.id)) {
      const node = graph.nodesById[subtreeId]
      if (node)
        nodesById[subtreeId] = cloneJson(node)
    }
  }
  return {
    root: roots.map(location => cloneJson(location.item)),
    nodesById,
  }
}

function usedGraphFields(graph: PageGraph): Set<string> {
  const used = new Set<string>()
  walkDesignGraph(graph, ({ node }) => {
    if (node.kind === 'field')
      used.add(node.field)
  })
  return used
}

function remappedPasteField(sourceField: string, used: ReadonlySet<string>): string {
  if (!used.has(sourceField))
    return sourceField
  const base = `${sourceField}_copy`
  if (!used.has(base))
    return base
  let suffix = 2
  while (used.has(`${base}_${suffix}`))
    suffix += 1
  return `${base}_${suffix}`
}

/**
 * Rewrites every node id (and clashing field name) in a subgraph so it can be
 * inserted into the target graph without id or field conflicts. Slot
 * references between layout parents and children are rewritten in lockstep.
 */
export function remapDesignSubgraph(subgraph: NodeSubgraph, graph: PageGraph): NodeSubgraph {
  const idMap = new Map<string, string>()
  for (const sourceId of Object.keys(subgraph.nodesById))
    idMap.set(sourceId, createDesignerNodeId(subgraph.nodesById[sourceId]!.kind))

  const usedFields = usedGraphFields(graph)
  const nodesById: Record<string, PageNode> = {}
  for (const [sourceId, sourceNode] of Object.entries(subgraph.nodesById)) {
    const node = cloneJson(sourceNode)
    node.id = idMap.get(sourceId)!
    if (node.kind === 'field') {
      const nextField = remappedPasteField(node.field, usedFields)
      usedFields.add(nextField)
      node.field = nextField
    }
    if (node.kind === 'layout') {
      node.slots = Object.fromEntries(Object.entries(node.slots).map(([slot, items]) => [
        slot,
        items.map(item => ({ ...item, nodeId: idMap.get(item.nodeId) ?? item.nodeId })),
      ]))
    }
    nodesById[node.id] = node
  }
  return {
    root: subgraph.root.map(item => ({ ...cloneJson(item), nodeId: idMap.get(item.nodeId) ?? item.nodeId })),
    nodesById,
  }
}
