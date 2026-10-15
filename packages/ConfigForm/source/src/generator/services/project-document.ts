import type { ContractResult, ProjectDocument, ProjectPageSurface } from '@moluoxixi/config-form-model'
import {
  collectSurfaceDependencyClosure,
  parseProjectDocument,
  readProjectImageResourceId,
  SURFACE_GRAPH_VERSION,
} from '@moluoxixi/config-form-model'

/** Validate a document and select the assets needed by a standalone Surface export. */
export function selectProjectSourceDocument(
  input: unknown,
  surfaceId?: string,
): ContractResult<ProjectDocument> {
  const parsed = parseProjectDocument(input)
  if (!parsed.success || surfaceId === undefined)
    return parsed
  const document = parsed.data
  const root = document.surfacesById[surfaceId]
  if (!root) {
    return {
      success: false,
      diagnostics: [{
        code: 'source_surface_missing',
        message: `Surface does not exist: ${surfaceId}`,
        surfaceId,
        path: ['surfacesById', surfaceId],
      }],
    }
  }
  const closure = collectSurfaceDependencyClosure(document, surfaceId)
  const surfaceOrder = [...closure.surfaceIds]
  const surfacesById = Object.fromEntries(surfaceOrder.map(id => [id, structuredClone(document.surfacesById[id]!)]))
  const page = root.kind === 'page'
    ? root
    : surfaceOrder.map(id => surfacesById[id]).find(surface => surface?.kind === 'page')
  let homeSurfaceId = page?.id
  if (!homeSurfaceId) {
    const base = 'export-host-page'
    homeSurfaceId = base
    let suffix = 2
    while (surfacesById[homeSurfaceId])
      homeSurfaceId = `${base}-${suffix++}`
    const host: ProjectPageSurface = {
      id: homeSurfaceId,
      kind: 'page',
      name: 'Export host',
      route: '/',
      parameters: [],
      outputs: [],
      interactions: [],
      graph: { version: SURFACE_GRAPH_VERSION, props: {}, form: {}, root: [], nodesById: {} },
    }
    surfacesById[homeSurfaceId] = host
    surfaceOrder.push(homeSurfaceId)
  }
  const imageId = readProjectImageResourceId(document.settings)
  const resourceIds = imageId && document.resources[imageId] && !closure.resourceIds.includes(imageId)
    ? [...closure.resourceIds, imageId]
    : closure.resourceIds
  return parseProjectDocument({
    ...document,
    homeSurfaceId,
    surfaceOrder,
    surfacesById,
    datasetOrder: [...closure.datasetIds],
    datasetsById: Object.fromEntries(closure.datasetIds.map(id => [id, structuredClone(document.datasetsById[id]!)])),
    resources: Object.fromEntries(resourceIds.map(id => [id, structuredClone(document.resources[id]!)])),
  })
}
