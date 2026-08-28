import type {
  DesignerDiagnostic,
  DesignerDocument,
  DesignerNode,
} from '../document'
import type { DesignerRegistry } from '../registry'
import type {
  DesignerCommand,
  DesignerDropTarget,
  DesignerReduceResult,
} from './types'
import {
  areDesignerJsonValuesEqual,
  cloneDesignerDocument,
  cloneDesignerNode,
  designerDiagnostic,
  hasDesignerErrors,
  parseDesignerDocument,
} from '../document'
import { analyzeDesignerDocument } from '../registry'
import {
  collectDesignerSubtreeIds,
  findDesignerNode,
} from './tree'

interface TargetListResult {
  nodes?: DesignerNode[]
  diagnostics: DesignerDiagnostic[]
}

const IMMUTABLE_NODE_KEYS = ['id', 'kind', 'slots']
const UNSAFE_PATH_SEGMENTS = ['__proto__', 'constructor', 'prototype']

function unchanged(document: DesignerDocument, diagnostics: DesignerDiagnostic[] = []): DesignerReduceResult {
  return { document, changed: false, diagnostics }
}

function nodeNotFound(document: DesignerDocument, nodeId: string): DesignerReduceResult {
  return unchanged(document, [designerDiagnostic(
    'DESIGNER_COMMAND_NODE_UNKNOWN',
    `Designer node not found: ${nodeId}`,
    [],
    'error',
    nodeId,
  )])
}

function resolveTargetList(
  document: DesignerDocument,
  target: DesignerDropTarget,
  registry: DesignerRegistry,
): TargetListResult {
  if (target.parentId === null)
    return { nodes: document.nodes, diagnostics: [] }

  const parent = findDesignerNode(document, target.parentId)
  if (!parent) {
    return {
      diagnostics: [designerDiagnostic(
        'DESIGNER_COMMAND_PARENT_UNKNOWN',
        `Designer target parent not found: ${target.parentId}`,
        [],
        'error',
        target.parentId,
      )],
    }
  }
  if (parent.node.kind !== 'container') {
    return {
      diagnostics: [designerDiagnostic(
        'DESIGNER_COMMAND_PARENT_NOT_CONTAINER',
        `Designer target parent is not a container: ${target.parentId}`,
        parent.path,
        'error',
        target.parentId,
      )],
    }
  }
  const material = registry.getMaterial(parent.node.material)
  if (!material || material.kind !== 'container' || !material.slots.some(slot => slot.name === target.slot)) {
    return {
      diagnostics: [designerDiagnostic(
        'DESIGNER_COMMAND_SLOT_INVALID',
        `Designer target slot is not registered: ${target.slot}`,
        [...parent.path, 'slots', target.slot],
        'error',
        target.parentId,
      )],
    }
  }

  parent.node.slots[target.slot] ??= []
  return { nodes: parent.node.slots[target.slot], diagnostics: [] }
}

function insertAtTarget(
  document: DesignerDocument,
  node: DesignerNode,
  target: DesignerDropTarget,
  registry: DesignerRegistry,
): DesignerDiagnostic[] {
  const resolved = resolveTargetList(document, target, registry)
  if (!resolved.nodes)
    return resolved.diagnostics
  const index = target.index ?? resolved.nodes.length
  if (!Number.isInteger(index) || index < 0 || index > resolved.nodes.length) {
    return [designerDiagnostic(
      'DESIGNER_COMMAND_INDEX_INVALID',
      `Designer target index is out of range: ${index}`,
    )]
  }
  resolved.nodes.splice(index, 0, node)
  return []
}

function finalizeCandidate(
  current: DesignerDocument,
  candidate: unknown,
  registry: DesignerRegistry,
): DesignerReduceResult {
  const parsed = parseDesignerDocument(candidate)
  if (!parsed.success)
    return unchanged(current, parsed.diagnostics)
  const diagnostics = analyzeDesignerDocument(parsed.data, registry, {
    includeDefaultDiagnostics: false,
    includeMaterialDiagnostics: false,
  })
  if (hasDesignerErrors(diagnostics))
    return unchanged(current, diagnostics)
  if (areDesignerJsonValuesEqual(current, parsed.data))
    return unchanged(current, diagnostics)
  return { document: parsed.data, changed: true, diagnostics }
}

function cloneSubtree(
  node: DesignerNode,
  newIds: Record<string, string>,
  newFields: Record<string, string>,
): DesignerNode | undefined {
  const id = newIds[node.id]
  if (!id)
    return undefined
  if (node.kind === 'field') {
    const field = newFields[node.field]
    if (!field)
      return undefined
    return {
      ...cloneDesignerNode(node),
      id,
      field,
    }
  }
  const slots: Record<string, DesignerNode[]> = {}
  for (const [slot, children] of Object.entries(node.slots)) {
    const clonedChildren = children.map(child => cloneSubtree(child, newIds, newFields))
    if (clonedChildren.includes(undefined))
      return undefined
    slots[slot] = clonedChildren as DesignerNode[]
  }
  return {
    ...cloneDesignerNode(node),
    id,
    slots,
  }
}

function reduceAdd(
  document: DesignerDocument,
  command: Extract<DesignerCommand, { type: 'addNode' }>,
  registry: DesignerRegistry,
): DesignerReduceResult {
  const candidate = cloneDesignerDocument(document)
  const diagnostics = insertAtTarget(candidate, command.node, command.target, registry)
  return diagnostics.length > 0 ? unchanged(document, diagnostics) : finalizeCandidate(document, candidate, registry)
}

function reduceMove(
  document: DesignerDocument,
  command: Extract<DesignerCommand, { type: 'moveNode' }>,
  registry: DesignerRegistry,
): DesignerReduceResult {
  const source = findDesignerNode(document, command.nodeId)
  if (!source)
    return nodeNotFound(document, command.nodeId)
  if (command.target.parentId !== null && collectDesignerSubtreeIds(source.node).has(command.target.parentId)) {
    return unchanged(document, [designerDiagnostic(
      'DESIGNER_COMMAND_MOVE_CYCLE',
      'A designer node cannot be moved into its own subtree',
      source.path,
      'error',
      source.node.id,
    )])
  }

  const candidate = cloneDesignerDocument(document)
  const candidateSource = findDesignerNode(candidate, command.nodeId)
  if (!candidateSource)
    return nodeNotFound(document, command.nodeId)
  const [node] = candidateSource.nodes.splice(candidateSource.index, 1)
  if (!node)
    return nodeNotFound(document, command.nodeId)
  const diagnostics = insertAtTarget(candidate, node, command.target, registry)
  return diagnostics.length > 0 ? unchanged(document, diagnostics) : finalizeCandidate(document, candidate, registry)
}

function reduceCopy(
  document: DesignerDocument,
  command: Extract<DesignerCommand, { type: 'copyNode' }>,
  registry: DesignerRegistry,
): DesignerReduceResult {
  const source = findDesignerNode(document, command.nodeId)
  if (!source)
    return nodeNotFound(document, command.nodeId)
  const copied = cloneSubtree(source.node, command.newIds, command.newFields)
  if (!copied) {
    return unchanged(document, [designerDiagnostic(
      'DESIGNER_COMMAND_COPY_MAPPING_INCOMPLETE',
      'Copy commands must provide new ids and fields for the complete subtree',
      source.path,
      'error',
      source.node.id,
    )])
  }

  const candidate = cloneDesignerDocument(document)
  const diagnostics = insertAtTarget(candidate, copied, command.target, registry)
  return diagnostics.length > 0 ? unchanged(document, diagnostics) : finalizeCandidate(document, candidate, registry)
}

function reduceRemove(
  document: DesignerDocument,
  command: Extract<DesignerCommand, { type: 'removeNode' }>,
  registry: DesignerRegistry,
): DesignerReduceResult {
  const candidate = cloneDesignerDocument(document)
  const source = findDesignerNode(candidate, command.nodeId)
  if (!source)
    return nodeNotFound(document, command.nodeId)
  source.nodes.splice(source.index, 1)
  return finalizeCandidate(document, candidate, registry)
}

function reduceUpdate(
  document: DesignerDocument,
  command: Extract<DesignerCommand, { type: 'updateNode' }>,
  registry: DesignerRegistry,
): DesignerReduceResult {
  const candidate = cloneDesignerDocument(document)
  const source = findDesignerNode(candidate, command.nodeId)
  if (!source)
    return nodeNotFound(document, command.nodeId)
  const unsafeChanges = command.changes as Record<string, unknown>
  const immutableKey = IMMUTABLE_NODE_KEYS.find(key => Object.hasOwn(unsafeChanges, key))
  if (immutableKey) {
    return unchanged(document, [designerDiagnostic(
      'DESIGNER_COMMAND_PROPERTY_IMMUTABLE',
      'Node id, kind, and slots cannot be changed through updateNode',
      source.path,
      'error',
      source.node.id,
    )])
  }
  const updated = { ...source.node } as Record<string, unknown>
  for (const [key, value] of Object.entries(command.changes)) {
    if (value === undefined)
      delete updated[key]
    else
      updated[key] = value
  }
  source.nodes[source.index] = updated as unknown as DesignerNode
  return finalizeCandidate(document, candidate, registry)
}

function reduceUpdatePath(
  document: DesignerDocument,
  command: Extract<DesignerCommand, { type: 'updateNodePath' }>,
  registry: DesignerRegistry,
): DesignerReduceResult {
  const candidate = cloneDesignerDocument(document)
  const source = findDesignerNode(candidate, command.nodeId)
  if (!source)
    return nodeNotFound(document, command.nodeId)
  if (command.path.length === 0 || command.path.some(segment => !segment)) {
    return unchanged(document, [designerDiagnostic(
      'DESIGNER_COMMAND_PATH_INVALID',
      'Designer node property paths must contain non-empty segments',
      source.path,
      'error',
      source.node.id,
    )])
  }
  if (IMMUTABLE_NODE_KEYS.includes(command.path[0]!)) {
    return unchanged(document, [designerDiagnostic(
      'DESIGNER_COMMAND_PROPERTY_IMMUTABLE',
      'Node id, kind, and slots cannot be changed through updateNodePath',
      [...source.path, ...command.path],
      'error',
      source.node.id,
    )])
  }
  if (command.path.some(segment => UNSAFE_PATH_SEGMENTS.includes(segment))) {
    return unchanged(document, [designerDiagnostic(
      'DESIGNER_COMMAND_PATH_UNSAFE',
      'Designer node property paths cannot contain prototype keys',
      [...source.path, ...command.path],
      'error',
      source.node.id,
    )])
  }

  let target = source.node as unknown as Record<string, unknown>
  for (const segment of command.path.slice(0, -1)) {
    const current = target[segment]
    if (current === undefined) {
      const created: Record<string, unknown> = {}
      target[segment] = created
      target = created
      continue
    }
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return unchanged(document, [designerDiagnostic(
        'DESIGNER_COMMAND_PATH_INVALID',
        `Designer node property path cannot traverse ${segment}`,
        [...source.path, ...command.path],
        'error',
        source.node.id,
      )])
    }
    target = current as Record<string, unknown>
  }

  const property = command.path.at(-1)!
  if (command.value === undefined)
    delete target[property]
  else
    target[property] = command.value
  return finalizeCandidate(document, candidate, registry)
}

function reduceUpdateForm(
  document: DesignerDocument,
  command: Extract<DesignerCommand, { type: 'updateForm' }>,
  registry: DesignerRegistry,
): DesignerReduceResult {
  const candidate = cloneDesignerDocument(document)
  for (const [key, value] of Object.entries(command.changes)) {
    if (value === undefined)
      delete candidate.form[key as keyof typeof candidate.form]
    else
      Object.assign(candidate.form, { [key]: value })
  }
  return finalizeCandidate(document, candidate, registry)
}

function reduceReplace(
  document: DesignerDocument,
  command: Extract<DesignerCommand, { type: 'replaceDocument' }>,
  registry: DesignerRegistry,
): DesignerReduceResult {
  return finalizeCandidate(document, command.document, registry)
}

function reduceBatch(
  document: DesignerDocument,
  command: Extract<DesignerCommand, { type: 'batch' }>,
  registry: DesignerRegistry,
): DesignerReduceResult {
  if (command.commands.length === 0)
    return unchanged(document)
  let candidate = document
  for (const child of command.commands) {
    const result = reduceDesignerCommand(candidate, child, registry)
    if (!result.changed) {
      return unchanged(document, result.diagnostics.length > 0
        ? result.diagnostics
        : [designerDiagnostic('DESIGNER_COMMAND_BATCH_NOOP', 'Every command in a batch must change the document')])
    }
    candidate = result.document
  }
  return { document: candidate, changed: true, diagnostics: [] }
}

export function reduceDesignerCommand(
  document: DesignerDocument,
  command: DesignerCommand,
  registry: DesignerRegistry,
): DesignerReduceResult {
  switch (command.type) {
    case 'addNode': return reduceAdd(document, command, registry)
    case 'moveNode': return reduceMove(document, command, registry)
    case 'copyNode': return reduceCopy(document, command, registry)
    case 'removeNode': return reduceRemove(document, command, registry)
    case 'updateNode': return reduceUpdate(document, command, registry)
    case 'updateNodePath': return reduceUpdatePath(document, command, registry)
    case 'updateForm': return reduceUpdateForm(document, command, registry)
    case 'replaceDocument': return reduceReplace(document, command, registry)
    case 'batch': return reduceBatch(document, command, registry)
  }
}
