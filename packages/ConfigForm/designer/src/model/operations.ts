import type { DesignerJsonValue } from '../document'
import type { LowCodeComponentRegistry } from './registry'
import type {
  LowCodeNode,
  LowCodePageModel,
  ModelDiagnostic,
  ModelNodeTarget,
  ModelOperation,
  ModelOperationFailure,
  ModelOperationResult,
} from './types'
import { cloneDesignerJsonValue } from '../document'
import { cloneConfigModel } from './transform'

interface NodeLocation {
  node: LowCodeNode
  nodes: LowCodeNode[]
  index: number
  parentId: string | null
  slot?: string
}

type RegisteredDefinition = NonNullable<ReturnType<LowCodeComponentRegistry['get']>>

function cloneJson<T>(value: T): T {
  return cloneDesignerJsonValue(value as unknown as DesignerJsonValue) as unknown as T
}

function failure(model: LowCodePageModel, diagnostic: ModelDiagnostic): ModelOperationFailure {
  return { success: false, model, diagnostics: [diagnostic] }
}

function findInNodes(
  nodes: LowCodeNode[],
  nodeId: string,
  parentId: string | null = null,
  slot?: string,
): NodeLocation | undefined {
  for (const [index, node] of nodes.entries()) {
    if (node.id === nodeId)
      return { node, nodes, index, parentId, slot }
    const child = findInNodes(node.children, nodeId, node.id)
    if (child)
      return child
    for (const [slotName, slotNodes] of Object.entries(node.slots)) {
      const found = findInNodes(slotNodes, nodeId, node.id, slotName)
      if (found)
        return found
    }
  }
  return undefined
}

export function findConfigModelNode(model: LowCodePageModel, nodeId: string): NodeLocation | undefined {
  return findInNodes(model.nodes, nodeId)
}

function collectIds(nodes: LowCodeNode[], target = new Set<string>()): Set<string> {
  for (const node of nodes) {
    target.add(node.id)
    collectIds(node.children, target)
    for (const slotNodes of Object.values(node.slots))
      collectIds(slotNodes, target)
  }
  return target
}

function countNodes(nodes: LowCodeNode[]): number {
  return nodes.reduce((count, node) => count
    + 1
    + countNodes(node.children)
    + Object.values(node.slots).reduce((slotCount, slotNodes) => slotCount + countNodes(slotNodes), 0), 0)
}

function validateProps(
  nodeId: string,
  props: LowCodeNode['props'],
  definition: RegisteredDefinition,
): ModelDiagnostic | undefined {
  const allowedProps = new Set([
    ...Object.keys(definition.defaults.props),
    ...definition.props.flatMap(setter => setter.path[0] === 'props' && setter.path[1] ? [setter.path[1]] : []),
  ])
  const unknownProp = Object.keys(props).find(key => !allowedProps.has(key))
  return unknownProp
    ? { code: 'MODEL_PROP_UNKNOWN', message: `Property is not registered for ${definition.component}: ${unknownProp}`, nodeId }
    : undefined
}

function validateEvents(
  nodeId: string,
  events: LowCodeNode['events'],
  definition: RegisteredDefinition,
): ModelDiagnostic | undefined {
  const registeredEvents = new Set(definition.events.map(event => event.name))
  const invalidEvent = Object.entries(events).find(([name, actions]) =>
    !registeredEvents.has(name)
    || !Array.isArray(actions)
    || actions.some(action => typeof action.action !== 'string' || action.action.length === 0))
  return invalidEvent
    ? { code: 'MODEL_EVENT_UNKNOWN', message: `Event is not registered or contains an invalid action: ${invalidEvent[0]}`, nodeId }
    : undefined
}

function validateBindings(
  nodeId: string,
  bindings: LowCodeNode['bindings'],
  definition: RegisteredDefinition,
): ModelDiagnostic | undefined {
  const registeredBindings = new Set(definition.bindings.map(binding => binding.name))
  const invalidBinding = Object.entries(bindings).find(([name, binding]) =>
    !registeredBindings.has(name) || typeof binding.source !== 'string' || binding.source.length === 0)
  return invalidBinding
    ? { code: 'MODEL_BINDING_UNKNOWN', message: `Binding is not registered or has an invalid source: ${invalidBinding[0]}`, nodeId }
    : undefined
}

function validateSubtree(
  nodes: LowCodeNode[],
  registry: LowCodeComponentRegistry,
): ModelDiagnostic | undefined {
  for (const node of nodes) {
    const definition = registry.get(node.component)
    if (!definition) {
      return { code: 'MODEL_COMPONENT_UNKNOWN', message: `Component is not registered: ${node.component}`, nodeId: node.id }
    }
    const expectedKind = definition.kind === 'layout' ? 'container' : 'field'
    if (node.kind !== expectedKind) {
      return { code: 'MODEL_COMPONENT_KIND_INVALID', message: `Component ${node.component} does not match node kind ${node.kind}.`, nodeId: node.id }
    }
    const valueDiagnostic = validateProps(node.id, node.props, definition)
      ?? validateEvents(node.id, node.events, definition)
      ?? validateBindings(node.id, node.bindings, definition)
    if (valueDiagnostic)
      return valueDiagnostic
    if (node.kind === 'field') {
      if (node.children.length > 0 || Object.values(node.slots).some(slotNodes => slotNodes.length > 0)) {
        return { code: 'MODEL_CHILDREN_INVALID', message: `Field component ${node.component} cannot contain children.`, nodeId: node.id }
      }
      continue
    }

    const slotEntries: Array<[string, LowCodeNode[]]> = [
      ['default', node.children],
      ...Object.entries(node.slots),
    ]
    for (const [slotName, children] of slotEntries) {
      const slot = definition.slots.find(candidate => candidate.name === slotName)
      if (!slot) {
        if (children.length === 0 && slotName === 'default')
          continue
        return { code: 'MODEL_TARGET_SLOT_INVALID', message: `Target slot is not registered: ${slotName}`, nodeId: node.id }
      }
      for (const child of children) {
        if (slot.accepts && !slot.accepts.includes(child.kind)) {
          return { code: 'MODEL_TARGET_KIND_INVALID', message: `Component ${child.component} is not accepted by ${slotName}.`, nodeId: child.id }
        }
        if (slot.materials && !slot.materials.includes(child.component)) {
          return { code: 'MODEL_TARGET_COMPONENT_INVALID', message: `Component ${child.component} is not accepted by ${slotName}.`, nodeId: child.id }
        }
      }
      const descendantDiagnostic = validateSubtree(children, registry)
      if (descendantDiagnostic)
        return descendantDiagnostic
    }
  }
  return undefined
}

function resolveTarget(
  model: LowCodePageModel,
  target: ModelNodeTarget,
  registry: LowCodeComponentRegistry,
  node?: LowCodeNode,
): { nodes?: LowCodeNode[], diagnostic?: ModelDiagnostic } {
  if (target.parentId === null) {
    if (target.slot) {
      return { diagnostic: { code: 'MODEL_TARGET_ROOT_SLOT_INVALID', message: 'Root targets cannot name a slot.' } }
    }
    return { nodes: model.nodes }
  }

  const parent = findConfigModelNode(model, target.parentId)?.node
  if (!parent) {
    return { diagnostic: { code: 'MODEL_TARGET_PARENT_UNKNOWN', message: `Target parent not found: ${target.parentId}`, nodeId: target.parentId } }
  }
  const definition = registry.get(parent.component)
  if (!definition || definition.kind !== 'layout') {
    return { diagnostic: { code: 'MODEL_TARGET_PARENT_INVALID', message: 'Target parent is not a registered layout.', nodeId: parent.id } }
  }

  const slotName = target.slot ?? 'default'
  const slot = definition.slots.find(candidate => candidate.name === slotName)
  if (!slot) {
    return { diagnostic: { code: 'MODEL_TARGET_SLOT_INVALID', message: `Target slot is not registered: ${slotName}`, nodeId: parent.id } }
  }
  if (node) {
    if (slot.accepts && !slot.accepts.includes(node.kind)) {
      return { diagnostic: { code: 'MODEL_TARGET_KIND_INVALID', message: `Component ${node.component} is not accepted by ${slotName}.`, nodeId: node.id } }
    }
    if (slot.materials && !slot.materials.includes(node.component)) {
      return { diagnostic: { code: 'MODEL_TARGET_COMPONENT_INVALID', message: `Component ${node.component} is not accepted by ${slotName}.`, nodeId: node.id } }
    }
  }

  if (slotName === 'default')
    return { nodes: parent.children }
  parent.slots[slotName] ??= []
  return { nodes: parent.slots[slotName] }
}

function insertNode(
  model: LowCodePageModel,
  node: LowCodeNode,
  target: ModelNodeTarget,
  registry: LowCodeComponentRegistry,
): ModelOperationResult {
  const subtreeDiagnostic = validateSubtree([node], registry)
  if (subtreeDiagnostic)
    return failure(model, subtreeDiagnostic)
  const existingIds = collectIds(model.nodes)
  const insertedIds = collectIds([node])
  if (insertedIds.size !== countNodes([node]) || [...insertedIds].some(id => existingIds.has(id))) {
    return failure(model, { code: 'MODEL_NODE_ID_DUPLICATE', message: 'Inserted nodes must have unique ids.', nodeId: node.id })
  }

  const candidate = cloneConfigModel(model)
  const resolved = resolveTarget(candidate, target, registry, node)
  if (!resolved.nodes)
    return failure(model, resolved.diagnostic!)
  const index = target.index ?? resolved.nodes.length
  if (!Number.isInteger(index) || index < 0 || index > resolved.nodes.length) {
    return failure(model, { code: 'MODEL_TARGET_INDEX_INVALID', message: `Target index is out of range: ${index}`, nodeId: target.parentId ?? undefined })
  }
  resolved.nodes.splice(index, 0, cloneJson(node))
  return {
    success: true,
    model: candidate,
    inverse: { type: 'remove', nodeId: node.id },
    diagnostics: [],
  }
}

function moveNode(
  model: LowCodePageModel,
  operation: Extract<ModelOperation, { type: 'move' }>,
  registry: LowCodeComponentRegistry,
): ModelOperationResult {
  const source = findConfigModelNode(model, operation.nodeId)
  if (!source)
    return failure(model, { code: 'MODEL_NODE_UNKNOWN', message: `Node not found: ${operation.nodeId}`, nodeId: operation.nodeId })
  if (operation.target.parentId && collectIds([source.node]).has(operation.target.parentId)) {
    return failure(model, { code: 'MODEL_MOVE_CYCLE', message: 'A node cannot be moved into its own subtree.', nodeId: operation.nodeId })
  }

  const candidate = cloneConfigModel(model)
  const candidateSource = findConfigModelNode(candidate, operation.nodeId)!
  const previousTarget: ModelNodeTarget = {
    parentId: candidateSource.parentId,
    ...(candidateSource.slot ? { slot: candidateSource.slot } : {}),
    index: candidateSource.index,
  }
  const [node] = candidateSource.nodes.splice(candidateSource.index, 1)
  const resolved = resolveTarget(candidate, operation.target, registry, node)
  if (!node || !resolved.nodes)
    return failure(model, resolved.diagnostic ?? { code: 'MODEL_MOVE_FAILED', message: 'Unable to move node.', nodeId: operation.nodeId })
  const index = operation.target.index ?? resolved.nodes.length
  if (!Number.isInteger(index) || index < 0 || index > resolved.nodes.length)
    return failure(model, { code: 'MODEL_TARGET_INDEX_INVALID', message: `Target index is out of range: ${index}`, nodeId: operation.nodeId })
  resolved.nodes.splice(index, 0, node)
  return { success: true, model: candidate, inverse: { type: 'move', nodeId: operation.nodeId, target: previousTarget }, diagnostics: [] }
}

function updateNode(
  model: LowCodePageModel,
  operation: Extract<ModelOperation, { type: 'updateProps' | 'updateEvents' | 'updateBindings' | 'updateNode' | 'resize' }>,
  registry: LowCodeComponentRegistry,
): ModelOperationResult {
  const candidate = cloneConfigModel(model)
  const location = findConfigModelNode(candidate, operation.nodeId)
  if (!location)
    return failure(model, { code: 'MODEL_NODE_UNKNOWN', message: `Node not found: ${operation.nodeId}`, nodeId: operation.nodeId })

  const definition = registry.get(location.node.component)
  if (!definition) {
    return failure(model, {
      code: 'MODEL_COMPONENT_UNKNOWN',
      message: `Component is not registered: ${location.node.component}`,
      nodeId: operation.nodeId,
    })
  }

  if (operation.type === 'updateProps') {
    const diagnostic = validateProps(operation.nodeId, operation.props, definition)
    if (diagnostic)
      return failure(model, diagnostic)
    const previous = cloneJson(location.node.props)
    location.node.props = cloneJson(operation.props)
    return { success: true, model: candidate, inverse: { type: 'updateProps', nodeId: operation.nodeId, props: previous }, diagnostics: [] }
  }
  if (operation.type === 'updateEvents') {
    const diagnostic = validateEvents(operation.nodeId, operation.events, definition)
    if (diagnostic)
      return failure(model, diagnostic)
    const previous = cloneJson(location.node.events)
    location.node.events = cloneJson(operation.events)
    return { success: true, model: candidate, inverse: { type: 'updateEvents', nodeId: operation.nodeId, events: previous }, diagnostics: [] }
  }
  if (operation.type === 'updateBindings') {
    const diagnostic = validateBindings(operation.nodeId, operation.bindings, definition)
    if (diagnostic)
      return failure(model, diagnostic)
    const previous = cloneJson(location.node.bindings)
    location.node.bindings = cloneJson(operation.bindings)
    return { success: true, model: candidate, inverse: { type: 'updateBindings', nodeId: operation.nodeId, bindings: previous }, diagnostics: [] }
  }
  if (operation.type === 'resize') {
    const spanSchema = definition.layout.span
    if (!spanSchema) {
      return failure(model, { code: 'MODEL_RESIZE_UNSUPPORTED', message: `Component does not register a grid span layout capability: ${definition.component}`, nodeId: operation.nodeId })
    }
    if (operation.span !== null && (
      !Number.isInteger(operation.span)
      || operation.span < spanSchema.min
      || operation.span > spanSchema.max
    )) {
      return failure(model, { code: 'MODEL_RESIZE_INVALID', message: `Grid span must be an integer from ${spanSchema.min} to ${spanSchema.max}.`, nodeId: operation.nodeId })
    }
    const previous = location.node.span ?? null
    if (operation.span === null)
      delete location.node.span
    else
      location.node.span = operation.span
    return { success: true, model: candidate, inverse: { type: 'resize', nodeId: operation.nodeId, span: previous }, diagnostics: [] }
  }

  const previous = Object.fromEntries(
    Object.keys(operation.patch).map(key => [key, cloneJson(location.node[key as keyof LowCodeNode])]),
  ) as typeof operation.patch
  for (const [key, value] of Object.entries(operation.patch)) {
    if (value === undefined)
      delete location.node[key as keyof LowCodeNode]
    else
      Object.assign(location.node, { [key]: cloneJson(value) })
  }
  return { success: true, model: candidate, inverse: { type: 'updateNode', nodeId: operation.nodeId, patch: previous }, diagnostics: [] }
}

function updatePage(
  model: LowCodePageModel,
  operation: Extract<ModelOperation, { type: 'updatePage' }>,
): ModelOperationResult {
  const candidate = cloneConfigModel(model)
  const inverse: ModelOperation = {
    type: 'updatePage',
    form: cloneJson(candidate.form),
    props: cloneJson(candidate.props),
  }
  candidate.form = cloneJson(operation.form)
  candidate.props = cloneJson(operation.props)
  return { success: true, model: candidate, inverse, diagnostics: [] }
}

function cloneSubtree(
  node: LowCodeNode,
  idMap: Record<string, string>,
  fieldMap: Record<string, string>,
): LowCodeNode | undefined {
  const id = idMap[node.id]
  if (!id)
    return undefined
  const children = node.children.map(child => cloneSubtree(child, idMap, fieldMap))
  if (children.some(child => !child))
    return undefined
  const slots = Object.fromEntries(Object.entries(node.slots).map(([slot, nodes]) => {
    const copied = nodes.map(child => cloneSubtree(child, idMap, fieldMap))
    return [slot, copied]
  }))
  if (Object.values(slots).some(nodes => nodes.some(node => !node)))
    return undefined
  const copy = cloneJson(node)
  copy.id = id
  copy.children = children as LowCodeNode[]
  copy.slots = slots as Record<string, LowCodeNode[]>
  if (copy.field && fieldMap[copy.field])
    copy.field = fieldMap[copy.field]
  return copy
}

function duplicateNode(
  model: LowCodePageModel,
  operation: Extract<ModelOperation, { type: 'duplicate' }>,
  registry: LowCodeComponentRegistry,
): ModelOperationResult {
  const source = findConfigModelNode(model, operation.nodeId)
  if (!source)
    return failure(model, { code: 'MODEL_NODE_UNKNOWN', message: `Node not found: ${operation.nodeId}`, nodeId: operation.nodeId })
  const copy = cloneSubtree(source.node, operation.idMap, operation.fieldMap ?? {})
  if (!copy)
    return failure(model, { code: 'MODEL_DUPLICATE_MAPPING_INCOMPLETE', message: 'Duplicate operations require ids for the complete subtree.', nodeId: operation.nodeId })
  return insertNode(model, copy, operation.target, registry)
}

function removeNode(model: LowCodePageModel, nodeId: string): ModelOperationResult {
  const candidate = cloneConfigModel(model)
  const location = findConfigModelNode(candidate, nodeId)
  if (!location)
    return failure(model, { code: 'MODEL_NODE_UNKNOWN', message: `Node not found: ${nodeId}`, nodeId })
  const [node] = location.nodes.splice(location.index, 1)
  const target: ModelNodeTarget = {
    parentId: location.parentId,
    ...(location.slot ? { slot: location.slot } : {}),
    index: location.index,
  }
  return { success: true, model: candidate, inverse: { type: 'insert', node: cloneJson(node!), target }, diagnostics: [] }
}

function batchOperations(
  model: LowCodePageModel,
  operations: ModelOperation[],
  registry: LowCodeComponentRegistry,
): ModelOperationResult {
  if (operations.length === 0)
    return failure(model, { code: 'MODEL_BATCH_EMPTY', message: 'Batch operations must contain at least one operation.' })
  let current = model
  const inverses: ModelOperation[] = []
  for (const operation of operations) {
    const result = applyModelOperation(current, operation, registry)
    if (!result.success)
      return { ...result, model }
    current = result.model
    inverses.unshift(result.inverse)
  }
  return { success: true, model: current, inverse: { type: 'batch', operations: inverses }, diagnostics: [] }
}

export function applyModelOperation(
  model: LowCodePageModel,
  operation: ModelOperation,
  registry: LowCodeComponentRegistry,
): ModelOperationResult {
  switch (operation.type) {
    case 'insert': return insertNode(model, operation.node, operation.target, registry)
    case 'move': return moveNode(model, operation, registry)
    case 'updatePage': return updatePage(model, operation)
    case 'updateProps':
    case 'updateEvents':
    case 'updateBindings':
    case 'updateNode':
    case 'resize': return updateNode(model, operation, registry)
    case 'duplicate': return duplicateNode(model, operation, registry)
    case 'remove': return removeNode(model, operation.nodeId)
    case 'batch': return batchOperations(model, operation.operations, registry)
  }
}
