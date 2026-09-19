import type {
  ModelJsonObject,
  NodeSubgraph,
  SurfaceGraph,
  ProjectCommand,
  ProjectCommandAction,
  ProjectNodePatchKey,
  ProjectOperation,
} from '@moluoxixi/config-form-model'
import type { DesignerDropTarget } from '../types'
import { assertDesignerSetterPathAllowed } from './setter-path'

const UNSAFE_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

export function createDesignerCommandId(prefix = 'design'): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`
}

export function createDesignerNodeId(prefix = 'node'): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`
}

export function createOperationCommand(
  label: string,
  operations: ProjectOperation[],
  options: { id?: string, mergeKey?: string } = {},
): ProjectCommand {
  return {
    id: options.id ?? createDesignerCommandId(),
    label,
    actions: [{ type: 'operation.apply', operations }],
    ...(options.mergeKey ? { mergeKey: options.mergeKey } : {}),
  }
}

export function createInsertCommand(
  surfaceId: string,
  subgraph: NodeSubgraph,
  target: DesignerDropTarget,
  options: { id?: string, label?: string } = {},
): ProjectCommand {
  return createOperationCommand(
    options.label ?? 'Insert component',
    [{ type: 'node.insert', surfaceId, subgraph, target }],
    { id: options.id },
  )
}

export function createMoveCommand(
  surfaceId: string,
  nodeId: string,
  target: DesignerDropTarget,
  options: { id?: string, label?: string } = {},
): ProjectCommand {
  return createOperationCommand(
    options.label ?? 'Move component',
    [{ type: 'node.move', surfaceId, nodeId, target }],
    { id: options.id },
  )
}

export function createRemoveCommand(surfaceId: string, nodeIds: string[]): ProjectCommand {
  return createOperationCommand(
    nodeIds.length === 1 ? 'Remove component' : 'Remove components',
    nodeIds.map(nodeId => ({ type: 'node.remove', surfaceId, nodeId })),
  )
}

export function createResizeCommand(surfaceId: string, nodeId: string, span: number | null): ProjectCommand {
  return {
    id: createDesignerCommandId('resize'),
    label: 'Resize component',
    mergeKey: `resize:${surfaceId}:${nodeId}`,
    actions: [{ type: 'node.resize', surfaceId, nodeId, span }],
  }
}

function cloneRecord(value: ModelJsonObject | undefined): ModelJsonObject {
  return structuredClone(value ?? {})
}

function assignPath(root: ModelJsonObject, path: string[], value: unknown): ModelJsonObject {
  if (path.length === 0 || path.some(segment => !segment || UNSAFE_PATH_SEGMENTS.has(segment)))
    throw new TypeError('DESIGN_PROPERTY_PATH_INVALID: Property paths must contain safe non-empty segments.')
  const next = structuredClone(root)
  let target = next as Record<string, unknown>
  for (const segment of path.slice(0, -1)) {
    const current = target[segment]
    if (current === undefined) {
      const created: Record<string, unknown> = {}
      target[segment] = created
      target = created
      continue
    }
    if (typeof current !== 'object' || current === null || Array.isArray(current))
      throw new TypeError(`DESIGN_PROPERTY_PATH_INVALID: Cannot traverse ${segment}.`)
    target = current as Record<string, unknown>
  }
  const key = path.at(-1)!
  if (value === undefined)
    delete target[key]
  else
    target[key] = structuredClone(value)
  return next
}

export function createNodePathCommand(
  graph: SurfaceGraph,
  surfaceId: string,
  nodeIds: string[],
  path: string[],
  value: unknown,
): ProjectCommand {
  if (nodeIds.length === 0)
    throw new TypeError('DESIGN_SELECTION_EMPTY: A property update requires at least one node.')
  assertDesignerSetterPathAllowed(path)
  const [rootKey, ...nestedPath] = path
  const writableRoot = rootKey!

  if (writableRoot === 'span') {
    const span = value === undefined || value === null ? null : Number(value)
    return {
      id: createDesignerCommandId('resize'),
      label: nodeIds.length === 1 ? 'Resize component' : 'Resize components',
      mergeKey: `resize:${surfaceId}:${[...nodeIds].sort().join(',')}`,
      actions: nodeIds.map(nodeId => ({ type: 'node.resize', surfaceId, nodeId, span })),
    }
  }

  const actions: ProjectCommandAction[] = nodeIds.map((nodeId) => {
    const node = graph.nodesById[nodeId]
    if (!node)
      throw new TypeError(`DESIGN_NODE_UNKNOWN: Node does not exist: ${nodeId}`)
    if (writableRoot === 'props') {
      const props = nestedPath.length === 0
        ? cloneRecord(value as ModelJsonObject | undefined)
        : assignPath(node.props, nestedPath, value)
      return { type: 'operation.apply', operations: [{ type: 'node.props', surfaceId, nodeId, props }] }
    }
    return {
      type: 'node.patch',
      surfaceId,
      nodeId,
      patch: value === undefined
        ? { unset: [writableRoot as ProjectNodePatchKey] }
        : { set: { [writableRoot]: structuredClone(value) } },
    }
  })

  return {
    id: createDesignerCommandId('property'),
    label: nodeIds.length === 1 ? 'Update component' : 'Update components',
    mergeKey: `property:${surfaceId}:${[...nodeIds].sort().join(',')}:${path.join('.')}`,
    actions,
  }
}

export function createFormCommand(
  graph: SurfaceGraph,
  surfaceId: string,
  changes: Record<string, unknown>,
): ProjectCommand {
  const form = structuredClone(graph.form) as Record<string, unknown>
  Object.entries(changes).forEach(([key, value]) => {
    if (value === undefined)
      delete form[key]
    else
      form[key] = structuredClone(value)
  })
  return createOperationCommand('Update form', [{
    type: 'surface.form',
    surfaceId,
    form,
  }], { mergeKey: `form:${surfaceId}:${Object.keys(changes).sort().join(',')}` })
}
