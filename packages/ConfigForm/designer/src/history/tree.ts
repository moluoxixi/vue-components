import type {
  DesignerDocument,
  DesignerNode,
  DesignerNodeVisit,
} from '../document'
import type {
  CreateDesignerCopyCommandOptions,
  DesignerCommand,
  DesignerDropTarget,
} from './types'
import { walkDesignerNodes } from '../document'

export interface DesignerNodeLocation extends DesignerNodeVisit {
  nodes: DesignerNode[]
}

function findInNodes(
  nodes: DesignerNode[],
  nodeId: string,
  path: (string | number)[] = ['nodes'],
  parent?: DesignerNode,
  slot?: string,
): DesignerNodeLocation | undefined {
  for (const [index, node] of nodes.entries()) {
    const nodePath = [...path, index]
    if (node.id === nodeId)
      return { node, nodes, index, path: nodePath, parent, slot }
    if (node.kind !== 'container')
      continue
    for (const [childSlot, children] of Object.entries(node.slots)) {
      const found = findInNodes(children, nodeId, [...nodePath, 'slots', childSlot], node, childSlot)
      if (found)
        return found
    }
  }
  return undefined
}

export function findDesignerNode(
  document: DesignerDocument,
  nodeId: string,
): DesignerNodeLocation | undefined {
  return findInNodes(document.nodes, nodeId)
}

export function collectDesignerSubtreeIds(node: DesignerNode): Set<string> {
  const ids = new Set<string>()
  walkDesignerNodes([node], ({ node: child }) => ids.add(child.id))
  return ids
}

function defaultCopyField(sourceField: string, usedFields: ReadonlySet<string>): string {
  const base = `${sourceField}_copy`
  if (!usedFields.has(base))
    return base
  let suffix = 2
  while (usedFields.has(`${base}_${suffix}`))
    suffix += 1
  return `${base}_${suffix}`
}

export function createDesignerNodeId(prefix = 'node'): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`
}

export function createDesignerCopyCommand(
  document: DesignerDocument,
  nodeId: string,
  target: DesignerDropTarget,
  options: CreateDesignerCopyCommandOptions = {},
): Extract<DesignerCommand, { type: 'copyNode' }> {
  const location = findDesignerNode(document, nodeId)
  if (!location)
    throw new Error(`Designer node not found: ${nodeId}`)

  const newIds: Record<string, string> = {}
  const newFields: Record<string, string> = {}
  const usedFields = new Set<string>()
  walkDesignerNodes(document.nodes, ({ node }) => {
    if (node.kind === 'field')
      usedFields.add(node.field)
  })

  walkDesignerNodes([location.node], ({ node }) => {
    newIds[node.id] = options.createId?.(node.id) ?? createDesignerNodeId(node.kind)
    if (node.kind === 'field') {
      const nextField = options.createField?.(node.field, usedFields)
        ?? defaultCopyField(node.field, usedFields)
      newFields[node.field] = nextField
      usedFields.add(nextField)
    }
  })

  return { type: 'copyNode', nodeId, target, newIds, newFields }
}
