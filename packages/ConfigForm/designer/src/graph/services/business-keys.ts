import type { NodeSubgraph, PageGraph, PageNode } from '@moluoxixi/config-form-model'
import type { DesignerDropTarget } from '../types'
import { findDesignNode } from '../utils'

function businessKey(node: PageNode): string | undefined {
  return node.kind === 'field' ? node.field : node.valueScope?.field
}

function ownerAtTarget(graph: PageGraph, target: DesignerDropTarget): string | undefined {
  let parent = target.parentId ? graph.nodesById[target.parentId] : undefined
  while (parent) {
    if (parent.kind === 'layout' && parent.valueScope)
      return parent.id
    parent = findDesignNode(graph, parent.id)?.parent
  }
  return undefined
}

export function createDesignBusinessKeyAllocator(graph: PageGraph) {
  const keys = new Map<string | undefined, Set<string>>()
  const keysFor = (owner: string | undefined): Set<string> => {
    let used = keys.get(owner)
    if (!used) {
      used = new Set()
      keys.set(owner, used)
    }
    return used
  }
  function visit(
    nodes: NodeSubgraph['nodesById'],
    ids: readonly string[],
    owner: string | undefined,
    onKey: (node: PageNode, key: string, owner: string | undefined) => void,
  ): void {
    for (const id of ids) {
      const node = nodes[id]
      if (!node)
        continue
      const key = businessKey(node)
      if (key !== undefined)
        onKey(node, key, owner)
      if (node.kind === 'layout') {
        visit(nodes, Object.values(node.slots).flat().map(item => item.nodeId),
          node.valueScope ? node.id : owner, onKey)
      }
    }
  }
  visit(graph.nodesById, graph.root.map(item => item.nodeId), undefined,
    (_node, key, owner) => keysFor(owner).add(key))

  function allocate(base: string, owners: readonly (string | undefined)[], copy: boolean): string {
    const available = (key: string) => owners.every(owner => !keysFor(owner).has(key))
    let candidate = base
    if (!available(candidate)) {
      const stem = copy ? `${base}_copy` : base
      candidate = stem
      let suffix = 2
      while (!available(candidate))
        candidate = `${stem}_${suffix++}`
    }
    owners.forEach(owner => keysFor(owner).add(candidate))
    return candidate
  }

  return {
    assign(subgraph: NodeSubgraph, target: DesignerDropTarget, copy = false): void {
      visit(subgraph.nodesById, subgraph.root.map(item => item.nodeId), ownerAtTarget(graph, target),
        (node, key, owner) => {
          const next = allocate(key, [owner], copy)
          if (node.kind === 'field')
            node.field = next
          else if (node.valueScope)
            node.valueScope.field = next
        })
    },
    duplicateMap(subgraph: NodeSubgraph, target: DesignerDropTarget, idMap: Record<string, string>): Record<string, string> {
      const ownersByKey = new Map<string, (string | undefined)[]>()
      visit(subgraph.nodesById, subgraph.root.map(item => item.nodeId), ownerAtTarget(graph, target),
        (_node, key, owner) => {
          const owners = ownersByKey.get(key) ?? []
          owners.push(owner === undefined ? undefined : idMap[owner] ?? owner)
          ownersByKey.set(key, owners)
        })
      // The Model duplicate command maps names across the complete subtree.
      // Reserve each result in every owning scope where that name occurs.
      return Object.fromEntries([...ownersByKey].map(([key, owners]) => [key, allocate(key, owners, true)]))
    },
  }
}
