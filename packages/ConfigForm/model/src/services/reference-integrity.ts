import type {
  ProjectDocument,
  ProjectReference,
  ProjectSurface,
  PrototypeInteraction,
  SurfaceDependencyClosure,
} from '../types'

/** The single deterministic walker for persisted cross-asset and node references. */
export function findProjectReferences(document: Readonly<ProjectDocument>): ProjectReference[] {
  const references: ProjectReference[] = [{
    sourceKind: 'project-home',
    targetKind: 'surface',
    targetId: document.homeSurfaceId,
    path: ['homeSurfaceId'],
  }]
  document.surfaceOrder.forEach((surfaceId) => {
    const surface = document.surfacesById[surfaceId]
    if (surface)
      references.push(...findSurfaceReferences(surface, ['surfacesById', surfaceId]))
  })
  return references
}

export function findSurfaceReferences(
  surface: Readonly<ProjectSurface>,
  pathPrefix: Array<string | number> = [],
): ProjectReference[] {
  const references: ProjectReference[] = []
  Object.entries(surface.graph.nodesById).forEach(([nodeId, node]) => {
    Object.entries(node.datasetBindings ?? {}).forEach(([key, reference]) => references.push({
      sourceKind: 'node-dataset-binding',
      targetKind: 'dataset',
      targetId: reference.datasetId,
      sourceSurfaceId: surface.id,
      nodeId,
      path: [...pathPrefix, 'graph', 'nodesById', nodeId, 'datasetBindings', key, 'datasetId'],
    }))
    Object.entries(node.resourceBindings ?? {}).forEach(([key, reference]) => references.push({
      sourceKind: 'node-resource-binding',
      targetKind: 'resource',
      targetId: reference.resourceId,
      sourceSurfaceId: surface.id,
      nodeId,
      path: [...pathPrefix, 'graph', 'nodesById', nodeId, 'resourceBindings', key, 'resourceId'],
    }))
  })
  surface.interactions.forEach((interaction, index) => {
    references.push(...findInteractionReferences(surface.id, interaction, [
      ...pathPrefix,
      'interactions',
      index,
    ]))
  })
  return references
}

export function collectSurfaceDependencyClosure(
  document: Readonly<ProjectDocument>,
  rootSurfaceId: string,
): SurfaceDependencyClosure {
  if (!Object.hasOwn(document.surfacesById, rootSurfaceId))
    return { surfaceIds: [], datasetIds: [], resourceIds: [] }
  const surfaceIds = new Set<string>()
  const datasetIds = new Set<string>()
  const resourceIds = new Set<string>()
  const queue = [rootSurfaceId]
  while (queue.length > 0) {
    const surfaceId = queue.shift()!
    if (surfaceIds.has(surfaceId))
      continue
    surfaceIds.add(surfaceId)
    const surface = document.surfacesById[surfaceId]
    if (!surface)
      continue
    findSurfaceReferences(surface).forEach((reference) => {
      if (reference.targetKind === 'surface' && !surfaceIds.has(reference.targetId))
        queue.push(reference.targetId)
      else if (reference.targetKind === 'dataset')
        datasetIds.add(reference.targetId)
      else if (reference.targetKind === 'resource')
        resourceIds.add(reference.targetId)
    })
  }
  return {
    surfaceIds: document.surfaceOrder.filter(id => surfaceIds.has(id)),
    datasetIds: document.datasetOrder.filter(id => datasetIds.has(id)),
    resourceIds: Object.keys(document.resources).filter(id => resourceIds.has(id)).sort((left, right) => left.localeCompare(right)),
  }
}

function findInteractionReferences(
  surfaceId: string,
  interaction: Readonly<PrototypeInteraction>,
  base: Array<string | number>,
): ProjectReference[] {
  const result: ProjectReference[] = []
  const node = (targetId: string, path: Array<string | number>, sourceKind: 'interaction-node' | 'interaction-field'): void => {
    result.push({
      sourceKind,
      targetKind: 'node',
      targetId,
      sourceSurfaceId: surfaceId,
      interactionId: interaction.id,
      path,
    })
  }
  if (interaction.kind === 'stateProjection') {
    node(interaction.target.nodeId, [...base, 'target', 'nodeId'], 'interaction-node')
  }
  else if (interaction.kind === 'valueChange') {
    interaction.dependencies.forEach((nodeId, index) => node(nodeId, [...base, 'dependencies', index], 'interaction-field'))
    if (interaction.action.kind === 'copy')
      node(interaction.action.sourceFieldId, [...base, 'action', 'sourceFieldId'], 'interaction-field')
    node(interaction.action.targetFieldId, [...base, 'action', 'targetFieldId'], 'interaction-field')
  }
  else {
    node(interaction.nodeId, [...base, 'nodeId'], 'interaction-node')
    interaction.validate?.fieldIds?.forEach((nodeId, index) => node(nodeId, [...base, 'validate', 'fieldIds', index], 'interaction-field'))
    if (interaction.action.kind === 'navigate' || interaction.action.kind === 'open') {
      result.push({
        sourceKind: 'interaction-surface',
        targetKind: 'surface',
        targetId: interaction.action.targetSurfaceId,
        sourceSurfaceId: surfaceId,
        nodeId: interaction.nodeId,
        interactionId: interaction.id,
        path: [...base, 'action', 'targetSurfaceId'],
      })
    }
    if (interaction.action.kind === 'open') {
      interaction.action.onResults?.forEach((binding, resultIndex) => {
        binding.assignments.forEach((assignment, assignmentIndex) => node(
          assignment.targetFieldId,
          [...base, 'action', 'onResults', resultIndex, 'assignments', assignmentIndex, 'targetFieldId'],
          'interaction-field',
        ))
      })
    }
  }
  return result
}
