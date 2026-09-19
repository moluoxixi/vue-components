import type {
  ComponentContract,
  ComponentContractRegistry,
  LayoutNode,
  ModelDiagnostic,
  NodeId,
  ProjectDocument,
  ProjectSurface,
  SurfaceId,
  SurfaceNode,
} from '../../../types'
import { analyzeSurfaceValueScopes } from '../../value-scope'

export function validateRegistryLock(
  document: ProjectDocument,
  registry: ComponentContractRegistry,
): ModelDiagnostic[] {
  const diagnostics = registry.analyzeLock(document.registryLock)
  const projectKeys = Object.keys(document.registryLock.components).sort((left, right) => left.localeCompare(right))
  const registryKeys = Object.keys(registry.lock.components).sort((left, right) => left.localeCompare(right))
  if (projectKeys.length !== registryKeys.length
    || projectKeys.some((key, index) => key !== registryKeys[index])) {
    diagnostics.push({
      code: 'PROJECT_REGISTRY_COMPONENT_SET_MISMATCH',
      message: 'Project Registry lock must contain the exact active component set.',
      path: ['registryLock', 'components'],
    })
  }
  return diagnostics
}

export function validateDocumentAgainstRegistry(
  document: ProjectDocument,
  registry: ComponentContractRegistry,
): ModelDiagnostic[] {
  const diagnostics = validateRegistryLock(document, registry)
  document.surfaceOrder.forEach((surfaceId) => {
    const surface = document.surfacesById[surfaceId]
    if (surface)
      validateSurface(surface, document, registry, diagnostics)
  })
  return diagnostics
}

export function validateSelectedNodesAgainstRegistry(
  document: ProjectDocument,
  registry: ComponentContractRegistry,
  nodeIdsBySurface: ReadonlyMap<SurfaceId, ReadonlySet<NodeId>>,
): ModelDiagnostic[] {
  const diagnostics: ModelDiagnostic[] = []
  document.surfaceOrder.forEach((surfaceId) => {
    const surface = document.surfacesById[surfaceId]
    const selected = nodeIdsBySurface.get(surfaceId)
    if (!surface || !selected)
      return
    Object.values(surface.graph.nodesById).forEach((node) => {
      if (!selected.has(node.id))
        return
      const contract = registry.get(node.component)
      if (!contract) {
        add(diagnostics, 'PROJECT_COMPONENT_UNKNOWN', `Component is not registered: ${node.component}.`, surface.id, ['graph', 'nodesById', node.id, 'component'], node.id)
        return
      }
      validateNode(surface, node, contract, document, registry, diagnostics)
      validateNodePlacement(surface, node, contract, registry, diagnostics)
    })
  })
  return diagnostics
}

function validateSurface(
  surface: ProjectSurface,
  document: ProjectDocument,
  registry: ComponentContractRegistry,
  diagnostics: ModelDiagnostic[],
): void {
  const analysis = analyzeSurfaceValueScopes(surface.graph)
  analysis.issues.forEach(problem => add(diagnostics, 'surface_graph_invalid', problem.message, surface.id, problem.path))

  Object.values(surface.graph.nodesById).forEach((node) => {
    const contract = registry.get(node.component)
    if (!contract) {
      add(diagnostics, 'PROJECT_COMPONENT_UNKNOWN', `Component is not registered: ${node.component}.`, surface.id, ['graph', 'nodesById', node.id, 'component'], node.id)
      return
    }
    validateNode(surface, node, contract, document, registry, diagnostics)
  })
  surface.graph.root.forEach((item, index) => {
    const node = surface.graph.nodesById[item.nodeId]
    if (!node)
      return
    const contract = registry.get(node.component)
    if (contract && contract.allowedParents.length > 0)
      add(diagnostics, 'PROJECT_COMPONENT_PARENT_INVALID', `Component ${node.component} requires a registered parent slot.`, surface.id, ['graph', 'root', index], node.id)
  })

  surface.interactions.forEach((interaction, index) => {
    if (interaction.kind === 'stateProjection' && interaction.target.kind === 'property') {
      const target = interaction.target
      const node = surface.graph.nodesById[target.nodeId]
      const contract = node ? registry.get(node.component) : undefined
      if (contract && !contract.stateProjectionProperties.some(path => samePath(path, target.path))) {
        add(
          diagnostics,
          'interaction_trigger_invalid',
          `Component ${node!.component} does not allow state projection at ${target.path.join('.')}.`,
          surface.id,
          ['interactions', index, 'target', 'path'],
          target.nodeId,
        )
      }
    }
    if (interaction.kind === 'primaryUiAction') {
      const node = surface.graph.nodesById[interaction.nodeId]
      const contract = node ? registry.get(node.component) : undefined
      if (contract && !contract.semanticTriggers.includes(interaction.trigger)) {
        add(
          diagnostics,
          'interaction_trigger_invalid',
          `Component ${node!.component} does not support ${interaction.trigger}.`,
          surface.id,
          ['interactions', index, 'trigger'],
          interaction.nodeId,
        )
      }
    }
  })
}

function validateNode(
  surface: ProjectSurface,
  node: SurfaceNode,
  contract: ComponentContract,
  document: ProjectDocument,
  registry: ComponentContractRegistry,
  diagnostics: ModelDiagnostic[],
): void {
  const base = ['graph', 'nodesById', node.id]
  if (contract.kind !== node.kind) {
    add(diagnostics, 'PROJECT_COMPONENT_KIND_INVALID', `Component kind does not match node ${node.id}.`, surface.id, [...base, 'kind'], node.id)
    return
  }
  const allowedProps = new Set([
    ...Object.keys(contract.defaults),
    ...contract.props.map(property => property.path[0] === 'props' ? property.path[1] : property.path[0]).filter((key): key is string => !!key),
  ])
  Object.keys(node.props).forEach((key) => {
    if (!allowedProps.has(key))
      add(diagnostics, 'PROJECT_COMPONENT_PROP_UNKNOWN', `Property is not registered for ${node.component}: ${key}.`, surface.id, [...base, 'props', key], node.id)
  })

  Object.entries(node.datasetBindings ?? {}).forEach(([key, reference]) => {
    const capability = contract.datasetBindings.find(candidate => candidate.key === key)
    if (!capability) {
      add(diagnostics, 'surface_graph_invalid', `Dataset binding is not registered for ${node.component}: ${key}.`, surface.id, [...base, 'datasetBindings', key], node.id)
      return
    }
    if (!capability.projectionKinds.includes(reference.projection.kind)) {
      add(diagnostics, 'dataset_projection_invalid', `Dataset projection ${reference.projection.kind} is not allowed for ${node.component}.${key}.`, surface.id, [...base, 'datasetBindings', key, 'projection', 'kind'], node.id)
    }
  })

  Object.entries(node.resourceBindings ?? {}).forEach(([key, reference]) => {
    const capability = contract.resourceBindings.find(candidate => candidate.key === key)
    if (!capability) {
      add(diagnostics, 'surface_graph_invalid', `Resource binding is not registered for ${node.component}: ${key}.`, surface.id, [...base, 'resourceBindings', key], node.id)
      return
    }
    const resource = document.resources[reference.resourceId]
    if (resource && capability.mediaTypes && !capability.mediaTypes.includes(resource.mediaType ?? '')) {
      add(diagnostics, 'resource_reference_invalid', `Resource media type is not allowed for ${node.component}.${key}.`, surface.id, [...base, 'resourceBindings', key, 'resourceId'], node.id)
    }
  })

  if (node.kind === 'layout')
    validateLayout(surface, node, contract, registry, diagnostics)
}

function validateLayout(
  surface: ProjectSurface,
  node: LayoutNode,
  contract: ComponentContract,
  registry: ComponentContractRegistry,
  diagnostics: ModelDiagnostic[],
): void {
  Object.entries(node.slots).forEach(([slotName, items]) => {
    const slot = contract.slots.find(candidate => candidate.name === slotName)
    if (!slot) {
      add(diagnostics, 'PROJECT_COMPONENT_SLOT_UNKNOWN', `Slot is not registered for ${node.component}: ${slotName}.`, surface.id, ['graph', 'nodesById', node.id, 'slots', slotName], node.id)
      return
    }
    items.forEach((item, index) => {
      const child = surface.graph.nodesById[item.nodeId]
      if (!child)
        return
      if (slot.accepts && !slot.accepts.includes(child.kind))
        add(diagnostics, 'PROJECT_COMPONENT_SLOT_KIND_INVALID', `Slot ${node.component}.${slotName} does not accept ${child.kind}.`, surface.id, ['graph', 'nodesById', node.id, 'slots', slotName, index], child.id)
      if (slot.components && !slot.components.includes(child.component))
        add(diagnostics, 'PROJECT_COMPONENT_SLOT_CHILD_INVALID', `Slot ${node.component}.${slotName} does not accept ${child.component}.`, surface.id, ['graph', 'nodesById', node.id, 'slots', slotName, index], child.id)
      const childContract = registry.get(child.component)
      if (childContract?.allowedParents.length
        && !childContract.allowedParents.some(parent => parent.component === node.component && parent.slot === slotName)) {
        add(diagnostics, 'PROJECT_COMPONENT_PARENT_INVALID', `Component ${child.component} is not allowed in ${node.component}.${slotName}.`, surface.id, ['graph', 'nodesById', node.id, 'slots', slotName, index], child.id)
      }
    })
  })
}

function validateNodePlacement(
  surface: ProjectSurface,
  node: SurfaceNode,
  contract: ComponentContract,
  registry: ComponentContractRegistry,
  diagnostics: ModelDiagnostic[],
): void {
  const rootIndex = surface.graph.root.findIndex(item => item.nodeId === node.id)
  if (rootIndex >= 0) {
    if (contract.allowedParents.length > 0) {
      add(
        diagnostics,
        'PROJECT_COMPONENT_PARENT_INVALID',
        `Component ${node.component} requires a registered parent slot.`,
        surface.id,
        ['graph', 'root', rootIndex],
        node.id,
      )
    }
    return
  }

  for (const parent of Object.values(surface.graph.nodesById)) {
    if (parent.kind !== 'layout')
      continue
    for (const [slotName, items] of Object.entries(parent.slots)) {
      const index = items.findIndex(item => item.nodeId === node.id)
      if (index < 0)
        continue
      const parentContract = registry.get(parent.component)
      const slot = parentContract?.slots.find(candidate => candidate.name === slotName)
      if (!parentContract || !slot) {
        add(diagnostics, 'PROJECT_COMPONENT_SLOT_UNKNOWN', `Slot is not registered for ${parent.component}: ${slotName}.`, surface.id, ['graph', 'nodesById', parent.id, 'slots', slotName], parent.id)
        return
      }
      if (slot.accepts && !slot.accepts.includes(node.kind))
        add(diagnostics, 'PROJECT_COMPONENT_SLOT_KIND_INVALID', `Slot ${parent.component}.${slotName} does not accept ${node.kind}.`, surface.id, ['graph', 'nodesById', parent.id, 'slots', slotName, index], node.id)
      if (slot.components && !slot.components.includes(node.component))
        add(diagnostics, 'PROJECT_COMPONENT_SLOT_CHILD_INVALID', `Slot ${parent.component}.${slotName} does not accept ${node.component}.`, surface.id, ['graph', 'nodesById', parent.id, 'slots', slotName, index], node.id)
      if (contract.allowedParents.length > 0
        && !contract.allowedParents.some(candidate => candidate.component === parent.component && candidate.slot === slotName)) {
        add(diagnostics, 'PROJECT_COMPONENT_PARENT_INVALID', `Component ${node.component} is not allowed in ${parent.component}.${slotName}.`, surface.id, ['graph', 'nodesById', parent.id, 'slots', slotName, index], node.id)
      }
      return
    }
  }

  add(
    diagnostics,
    'surface_graph_invalid',
    `Node has no parent location: ${node.id}.`,
    surface.id,
    ['graph', 'nodesById', node.id],
    node.id,
  )
}

function add(
  diagnostics: ModelDiagnostic[],
  code: string,
  message: string,
  surfaceId: string,
  path: Array<string | number>,
  nodeId?: string,
): void {
  diagnostics.push({ code, message, surfaceId, path: ['surfacesById', surfaceId, ...path], ...(nodeId ? { nodeId } : {}) })
}

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}
