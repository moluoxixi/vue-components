import type {
  ModelJsonObject,
  NodeSubgraph,
  PageGraph,
  ProjectCommand,
  ProjectCommandAction,
  ProjectNodePatchKey,
  ProjectOperation,
  RegisteredBinding,
  RegisteredEventAction,
} from '@moluoxixi/config-form-model'
import type { DesignerDropTarget } from '../types'

const NODE_PATCH_KEYS = new Set<ProjectNodePatchKey>([
  'conditions',
  'defaultValue',
  'extensions',
  'field',
  'label',
  'reactions',
  'validateOn',
  'validation',
])
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
  pageId: string,
  subgraph: NodeSubgraph,
  target: DesignerDropTarget,
  options: { id?: string, label?: string } = {},
): ProjectCommand {
  return createOperationCommand(
    options.label ?? 'Insert component',
    [{ type: 'node.insert', pageId, subgraph, target }],
    { id: options.id },
  )
}

export function createMoveCommand(
  pageId: string,
  nodeId: string,
  target: DesignerDropTarget,
  options: { id?: string, label?: string } = {},
): ProjectCommand {
  return createOperationCommand(
    options.label ?? 'Move component',
    [{ type: 'node.move', pageId, nodeId, target }],
    { id: options.id },
  )
}

export function createRemoveCommand(pageId: string, nodeIds: string[]): ProjectCommand {
  return createOperationCommand(
    nodeIds.length === 1 ? 'Remove component' : 'Remove components',
    nodeIds.map(nodeId => ({ type: 'node.remove', pageId, nodeId })),
  )
}

export function createStoredConfigRemovalCommand(
  pageId: string,
  nodeId: string,
  path: string[],
): ProjectCommand {
  const [property, key, ...extra] = path
  const recordProperties = new Set(['bindings', 'conditions', 'events'])
  const fieldProperties = new Set(['validation', 'validateOn'])
  if (
    !property
    || extra.length > 0
    || (recordProperties.has(property) && !key)
    || (fieldProperties.has(property) && key !== undefined)
    || (!recordProperties.has(property) && !fieldProperties.has(property))
  ) {
    throw new TypeError('DESIGN_STORED_CONFIG_PATH_INVALID: Stored configuration removal requires one exact supported path.')
  }
  return createOperationCommand('Remove stored configuration', [{
    type: 'node.config.remove',
    pageId,
    nodeId,
    property: property as 'bindings' | 'conditions' | 'events' | 'validation' | 'validateOn',
    ...(key === undefined ? {} : { key }),
  }])
}

export function createResizeCommand(pageId: string, nodeId: string, span: number | null): ProjectCommand {
  return {
    id: createDesignerCommandId('resize'),
    label: 'Resize component',
    mergeKey: `resize:${pageId}:${nodeId}`,
    actions: [{ type: 'node.resize', pageId, nodeId, span }],
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
  graph: PageGraph,
  pageId: string,
  nodeIds: string[],
  path: string[],
  value: unknown,
): ProjectCommand {
  if (nodeIds.length === 0)
    throw new TypeError('DESIGN_SELECTION_EMPTY: A property update requires at least one node.')
  const [rootKey, ...nestedPath] = path
  if (!rootKey || UNSAFE_PATH_SEGMENTS.has(rootKey))
    throw new TypeError('DESIGN_PROPERTY_PATH_INVALID: Property paths must contain safe non-empty segments.')

  if (rootKey === 'span') {
    const span = value === undefined || value === null ? null : Number(value)
    return {
      id: createDesignerCommandId('resize'),
      label: nodeIds.length === 1 ? 'Resize component' : 'Resize components',
      mergeKey: `resize:${pageId}:${[...nodeIds].sort().join(',')}`,
      actions: nodeIds.map(nodeId => ({ type: 'node.resize', pageId, nodeId, span })),
    }
  }

  const actions: ProjectCommandAction[] = nodeIds.map((nodeId) => {
    const node = graph.nodesById[nodeId]
    if (!node)
      throw new TypeError(`DESIGN_NODE_UNKNOWN: Node does not exist: ${nodeId}`)
    if (rootKey === 'props') {
      const props = nestedPath.length === 0
        ? cloneRecord(value as ModelJsonObject | undefined)
        : assignPath(node.props, nestedPath, value)
      return { type: 'operation.apply', operations: [{ type: 'node.props', pageId, nodeId, props }] }
    }
    if (rootKey === 'events') {
      const events = nestedPath.length === 0
        ? structuredClone((value ?? {}) as Record<string, RegisteredEventAction[]>)
        : assignPath(node.events as ModelJsonObject, nestedPath, value) as Record<string, RegisteredEventAction[]>
      return { type: 'operation.apply', operations: [{ type: 'node.events', pageId, nodeId, events }] }
    }
    if (rootKey === 'bindings') {
      const bindings = nestedPath.length === 0
        ? structuredClone((value ?? {}) as Record<string, RegisteredBinding>)
        : assignPath(node.bindings as ModelJsonObject, nestedPath, value) as Record<string, RegisteredBinding>
      return { type: 'operation.apply', operations: [{ type: 'node.bindings', pageId, nodeId, bindings }] }
    }
    if (!NODE_PATCH_KEYS.has(rootKey as ProjectNodePatchKey))
      throw new TypeError(`DESIGN_PROPERTY_UNSUPPORTED: Unsupported node property: ${rootKey}`)

    if (nestedPath.length === 0) {
      return {
        type: 'node.patch',
        pageId,
        nodeId,
        patch: value === undefined
          ? { unset: [rootKey as ProjectNodePatchKey] }
          : { set: { [rootKey]: structuredClone(value) } },
      }
    }

    const current = (node as unknown as Record<string, unknown>)[rootKey]
    const nested = assignPath(
      typeof current === 'object' && current !== null && !Array.isArray(current)
        ? current as ModelJsonObject
        : {},
      nestedPath,
      value,
    )
    return {
      type: 'node.patch',
      pageId,
      nodeId,
      patch: { set: { [rootKey]: nested } },
    }
  })

  return {
    id: createDesignerCommandId('property'),
    label: nodeIds.length === 1 ? 'Update component' : 'Update components',
    mergeKey: `property:${pageId}:${[...nodeIds].sort().join(',')}:${path.join('.')}`,
    actions,
  }
}

export function createFormCommand(
  graph: PageGraph,
  pageId: string,
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
    type: 'page.form',
    pageId,
    form,
  }], { mergeKey: `form:${pageId}:${Object.keys(changes).sort().join(',')}` })
}
