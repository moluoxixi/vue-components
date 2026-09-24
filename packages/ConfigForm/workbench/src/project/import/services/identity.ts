import type { ProjectDocument } from '@moluoxixi/config-form-model'
import type { ProjectIdentityFactory } from '../../types'
import type { ImportedIdentityMaps } from '../types'
import { assertProjectDocument, PROJECT_THEME_VERSION } from '@moluoxixi/config-form-model'
import { DEFAULT_PROJECT_IDENTITY_FACTORY } from '../../defaults'
import { remapProjectSurfaceIdentity } from '../../services'

type ImportedAssetIdentityKind = 'dataset' | 'resource' | 'surface'

function identityLabel(kind: ImportedAssetIdentityKind): string {
  return `${kind[0]!.toUpperCase()}${kind.slice(1)}`
}

export function allocateImportedIdentityMap(
  kind: ImportedAssetIdentityKind,
  sourceIds: readonly string[],
  factory: ProjectIdentityFactory,
  occupiedIds: Iterable<string> = [],
): ReadonlyMap<string, string> {
  const label = identityLabel(kind)
  const sourceSet = new Set<string>()
  const allocated = new Set(occupiedIds)
  const result = new Map<string, string>()
  sourceIds.forEach((sourceId) => {
    if (sourceSet.has(sourceId))
      throw new TypeError(`IMPORT_${kind.toUpperCase()}_IDENTITY_INVALID: ${label} source identity is duplicated: ${sourceId}.`)
    sourceSet.add(sourceId)
    const targetId = factory.create(kind, sourceId)
    if (allocated.has(targetId)) {
      throw new TypeError(
        `IMPORT_${kind.toUpperCase()}_IDENTITY_CONFLICT: ${label} identity collides with another or existing asset: ${targetId}.`,
      )
    }
    allocated.add(targetId)
    result.set(sourceId, targetId)
  })
  if (result.size !== sourceIds.length)
    throw new TypeError(`IMPORT_${kind.toUpperCase()}_IDENTITY_INVALID: ${label} identity mapping is not bijective.`)
  return result
}

function requireImportedIdentity(
  identities: ReadonlyMap<string, string>,
  sourceId: string,
  kind: ImportedAssetIdentityKind,
): string {
  const targetId = identities.get(sourceId)
  if (!targetId)
    throw new TypeError(`IMPORT_${kind.toUpperCase()}_IDENTITY_INVALID: ${identityLabel(kind)} identity is not mapped: ${sourceId}.`)
  return targetId
}

export function instantiateImportedProject(
  source: ProjectDocument,
  factory: ProjectIdentityFactory = DEFAULT_PROJECT_IDENTITY_FACTORY,
): { document: ProjectDocument, maps: ImportedIdentityMaps } {
  const projectId = factory.create('project', source.id)
  const surfaces = allocateImportedIdentityMap('surface', source.surfaceOrder, factory)
  const datasets = allocateImportedIdentityMap('dataset', source.datasetOrder, factory)
  const resources = allocateImportedIdentityMap('resource', Object.keys(source.resources), factory)
  const surfacesById: ProjectDocument['surfacesById'] = Object.create(null)
  source.surfaceOrder.forEach((sourceSurfaceId) => {
    const sourceSurface = source.surfacesById[sourceSurfaceId]!
    const surfaceId = requireImportedIdentity(surfaces, sourceSurfaceId, 'surface')
    const mapped = remapProjectSurfaceIdentity(sourceSurface, surfaceId, factory, {
      datasets,
      resources,
      surfaces,
    }).surface
    surfacesById[mapped.id] = mapped
  })
  const datasetsById: ProjectDocument['datasetsById'] = Object.create(null)
  source.datasetOrder.forEach((sourceId) => {
    const dataset = source.datasetsById[sourceId]!
    if (dataset.id !== sourceId)
      throw new TypeError(`IMPORT_DATASET_IDENTITY_INVALID: Dataset map key does not match its identity: ${sourceId}.`)
    const id = requireImportedIdentity(datasets, sourceId, 'dataset')
    datasetsById[id] = { ...structuredClone(dataset), id }
  })
  const resourcesById: ProjectDocument['resources'] = Object.create(null)
  Object.entries(source.resources).forEach(([sourceId, resource]) => {
    if (resource.id !== sourceId)
      throw new TypeError(`IMPORT_RESOURCE_IDENTITY_INVALID: Resource map key does not match its identity: ${sourceId}.`)
    const id = requireImportedIdentity(resources, sourceId, 'resource')
    if (Object.hasOwn(resourcesById, id))
      throw new TypeError(`IMPORT_RESOURCE_IDENTITY_CONFLICT: Resource identity would overwrite another asset: ${id}.`)
    resourcesById[id] = { ...structuredClone(resource), id }
  })
  const document = assertProjectDocument({
    ...structuredClone(source),
    id: projectId,
    homeSurfaceId: requireImportedIdentity(surfaces, source.homeSurfaceId, 'surface'),
    surfaceOrder: source.surfaceOrder.map(surfaceId => requireImportedIdentity(surfaces, surfaceId, 'surface')),
    surfacesById,
    datasetOrder: source.datasetOrder.map(datasetId => requireImportedIdentity(datasets, datasetId, 'dataset')),
    datasetsById,
    resources: resourcesById,
    theme: structuredClone(source.theme) ?? { version: PROJECT_THEME_VERSION },
    settings: structuredClone(source.settings),
  })
  return { document, maps: { surfaces, datasets, resources } }
}
