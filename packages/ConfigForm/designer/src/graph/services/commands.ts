import type {
  ModelJsonObject,
  NodeSubgraph,
  ProjectCommand,
  ProjectCommandAction,
  ProjectNodePatchKey,
  ProjectOperation,
  PrototypeInteraction,
  SurfaceGraph,
  SurfaceNode,
  SurfaceNodeSettings,
} from '@moluoxixi/config-form-model'
import type { DesignerDropTarget } from '../types'
import { resolveDesignerOptionValidationBase } from '../../options'
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

function optionValues(value: unknown): Array<string | number | boolean> {
  if (!Array.isArray(value))
    return []
  return value.flatMap((option) => {
    if (typeof option !== 'object' || option === null || Array.isArray(option))
      return []
    const optionValue = (option as Record<string, unknown>).value
    return typeof optionValue === 'string'
      || typeof optionValue === 'boolean'
      || (typeof optionValue === 'number' && Number.isFinite(optionValue))
      ? [optionValue]
      : []
  })
}

function optionValueExists(
  values: readonly (string | number | boolean)[],
  value: unknown,
): boolean {
  return values.some(candidate => Object.is(candidate, value))
}

export function doesDesignerOptionUpdateClearDefaultValue(
  node: SurfaceNode,
  path: readonly string[],
  value: unknown,
): boolean {
  if (node.kind !== 'field'
    || node.defaultValue === undefined
    || path.length !== 2
    || path[0] !== 'props'
    || path[1] !== 'options') {
    return false
  }
  const values = optionValues(value)
  return Array.isArray(node.defaultValue)
    ? node.defaultValue.some(item => !optionValueExists(values, item))
    : !optionValueExists(values, node.defaultValue)
}

export function countDesignerOptionDefaultClears(
  graph: SurfaceGraph,
  nodeIds: readonly string[],
  path: readonly string[],
  value: unknown,
): number {
  return nodeIds.reduce((count, nodeId) => {
    const node = graph.nodesById[nodeId]
    return count + (node && doesDesignerOptionUpdateClearDefaultValue(node, path, value) ? 1 : 0)
  }, 0)
}

function fieldSettingsForOptionUpdate(
  node: Extract<SurfaceNode, { kind: 'field' }>,
  path: readonly string[],
  value: unknown,
): SurfaceNodeSettings | undefined {
  const clearDefaultValue = doesDesignerOptionUpdateClearDefaultValue(node, path, value)
  const updateValidation = path.length === 2
    && path[0] === 'props'
    && path[1] === 'options'
    && (node.validation?.base.type === 'enum' || node.validation?.base.type === 'literal')
  if (!clearDefaultValue && !updateValidation)
    return undefined
  const {
    id: _id,
    props: _props,
    ...settings
  } = node
  const next = structuredClone(settings)
  if (clearDefaultValue)
    delete next.defaultValue
  if (updateValidation) {
    const base = resolveDesignerOptionValidationBase(value)
    if (base)
      next.validation = { ...structuredClone(node.validation!), base }
    else
      delete next.validation
  }
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
      const operations: ProjectOperation[] = [{ type: 'node.props', surfaceId, nodeId, props }]
      const settings = node.kind === 'field'
        ? fieldSettingsForOptionUpdate(node, path, value)
        : undefined
      if (settings) {
        operations.push({
          type: 'node.settings',
          surfaceId,
          nodeId,
          settings,
        })
      }
      return { type: 'operation.apply', operations }
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

export function createSurfaceInteractionsCommand(
  surfaceId: string,
  interactions: readonly PrototypeInteraction[],
): ProjectCommand {
  return createOperationCommand('Update interactions', [{
    type: 'surface.interactions',
    surfaceId,
    interactions: structuredClone(interactions) as PrototypeInteraction[],
  }])
}
