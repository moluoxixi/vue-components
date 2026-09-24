import type {
  ProjectCommandAction,
  ProjectDocument,
  ProjectEmbeddedResourceWrite,
  ProjectOperation,
} from '@moluoxixi/config-form-model'
import type { ComputedRef, Ref } from 'vue'
import type { WorkbenchAdapter } from '../../adapters'
import type { ProjectEditorSessionSnapshot, ProjectSurfaceAction } from '../../project'
import type { WorkbenchUiStore } from '../types'
import { getProjectDocumentContentHash } from '@moluoxixi/config-form-model'
import {
  duplicateProjectSurface,
  nextProjectSurfaceId,
  nextProjectSurfaceRoute,
  preflightPreparedProject,
} from '../../project'

export function createWorkbenchSurfaceCommands(options: {
  busy: Ref<boolean>
  currentProject: ComputedRef<ProjectEditorSessionSnapshot['document'] | undefined>
  executeProjectActions: (
    label: string,
    actions: ProjectCommandAction[],
    mergeKey?: string,
    embeddedWrites?: readonly ProjectEmbeddedResourceWrite[],
  ) => boolean
  selectCurrentSurface: (surfaceId: string) => boolean
  ui: WorkbenchUiStore
}) {
  const {
    busy,
    currentProject,
    executeProjectActions,
    selectCurrentSurface,
    ui,
  } = options

  function addPreparedSurface(
    surface: ProjectDocument['surfacesById'][string],
    adapter: WorkbenchAdapter,
    document: ProjectDocument,
    embeddedWrites: readonly ProjectEmbeddedResourceWrite[] = [],
  ): boolean {
    const current = currentProject.value
    if (!current)
      return false
    const candidate = structuredClone(document) as ProjectDocument
    if (!Object.hasOwn(candidate.surfacesById, surface.id)) {
      candidate.surfaceOrder.push(surface.id)
      candidate.surfacesById[surface.id] = structuredClone(surface)
    }
    preflightPreparedProject(candidate, adapter.registrySnapshot)
    const currentProjection = structuredClone(candidate) as ProjectDocument
    currentProjection.surfaceOrder = [...current.surfaceOrder]
    currentProjection.surfacesById = Object.fromEntries(current.surfaceOrder.map(id => [
      id,
      candidate.surfacesById[id],
    ]))
    currentProjection.datasetOrder = [...current.datasetOrder]
    currentProjection.datasetsById = Object.fromEntries(current.datasetOrder.map(id => [
      id,
      candidate.datasetsById[id],
    ]))
    currentProjection.resources = Object.fromEntries(Object.keys(current.resources).map(id => [
      id,
      candidate.resources[id],
    ]))
    if (getProjectDocumentContentHash(currentProjection) !== getProjectDocumentContentHash(current))
      throw new TypeError('Prepared Surface import must only add its dependency closure.')

    const addedResourceIds = Object.keys(candidate.resources)
      .filter(id => !Object.hasOwn(current.resources, id))
      .sort()
    const addedDatasetIds = candidate.datasetOrder
      .filter(id => !Object.hasOwn(current.datasetsById, id))
    const addedSurfaceIds = candidate.surfaceOrder
      .filter(id => !Object.hasOwn(current.surfacesById, id))
    if (!addedSurfaceIds.includes(surface.id))
      throw new TypeError(`Prepared Surface is not a new asset: ${surface.id}`)
    const embeddedResourceIds = addedResourceIds.filter(resourceId =>
      candidate.resources[resourceId]?.kind === 'embedded')
    const embeddedWriteIds = embeddedWrites.map(write => write.resourceId).sort()
    if (new Set(embeddedWriteIds).size !== embeddedWriteIds.length
      || JSON.stringify(embeddedWriteIds) !== JSON.stringify([...embeddedResourceIds].sort())
      || embeddedWrites.some((write) => {
        const resource = candidate.resources[write.resourceId]
        return resource?.kind !== 'embedded'
          || !(write.bytes instanceof Uint8Array)
          || write.contentHash !== resource.contentHash
          || write.bytes.byteLength !== resource.byteLength
      })) {
      throw new TypeError('Prepared Surface bytes must exactly match its Resource dependency closure.')
    }

    const operations: ProjectOperation[] = [
      ...addedResourceIds.map(resourceId => ({
        type: 'resource.add' as const,
        resource: candidate.resources[resourceId]!,
      })),
      ...addedDatasetIds.map(datasetId => ({
        type: 'dataset.add' as const,
        dataset: candidate.datasetsById[datasetId]!,
        index: candidate.datasetOrder.indexOf(datasetId),
      })),
      ...addedSurfaceIds.map(surfaceId => ({
        type: 'surface.add' as const,
        surface: candidate.surfacesById[surfaceId]!,
        index: candidate.surfaceOrder.indexOf(surfaceId),
      })),
    ]
    const changed = executeProjectActions(
      'Add Surface dependency closure',
      [{ type: 'operation.apply', operations }],
      undefined,
      embeddedWrites,
    )
    if (changed)
      selectCurrentSurface(surface.id)
    return changed
  }

  async function handleSurfaceAction(action: ProjectSurfaceAction): Promise<void> {
    const document = currentProject.value
    if (!document || busy.value)
      return
    try {
      const operations = (() => {
        switch (action.type) {
          case 'surface.rename': return [{ type: 'surface.rename' as const, surfaceId: action.surfaceId, name: action.name }]
          case 'surface.route': return [{ type: 'surface.route' as const, surfaceId: action.surfaceId, route: action.route }]
          case 'surface.home': return [{ type: 'project.home' as const, surfaceId: action.surfaceId }]
          case 'surface.move': return [{ type: 'surface.move' as const, surfaceId: action.surfaceId, index: action.index }]
          case 'surface.presentation': return [{ type: 'surface.presentation' as const, surfaceId: action.surfaceId, presentation: action.presentation }]
          case 'surface.remove': return [{ type: 'surface.remove' as const, surfaceId: action.surfaceId }]
          case 'surface.duplicate': {
            const source = document.surfacesById[action.surfaceId]
            if (!source)
              throw new Error(`Surface "${action.surfaceId}" does not exist.`)
            const name = `${source.name} copy`
            const surface = duplicateProjectSurface(source, {
              id: nextProjectSurfaceId(document, name),
              name,
              route: nextProjectSurfaceRoute(document, name),
            })
            return [{ type: 'surface.copy' as const, surface, index: document.surfaceOrder.indexOf(source.id) + 1 }]
          }
        }
      })()
      executeProjectActions('Update surfaces', [{ type: 'operation.apply', operations }])
    }
    catch (error) {
      ui.notify(error)
    }
  }

  async function selectSurfaceFromDesigner(surfaceId: string): Promise<void> {
    selectCurrentSurface(surfaceId)
  }

  return {
    addPreparedSurface,
    handleSurfaceAction,
    selectSurfaceFromDesigner,
  }
}
