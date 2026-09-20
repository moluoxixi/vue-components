import type { ProjectDocument, ProjectEmbeddedResourceWrite, ProjectResource, ProjectSurface, RegistryLock, SurfaceTransferReadResultV1 } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapter, WorkbenchAdapterId } from '../../../adapters'
import type {
  CanonicalImportPayload,
  ConfigImportDiagnostic,
  ConfigImportSummary,
  PrepareConfigImportOptions,
  PrepareConfigImportResult,
} from '../types'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import {
  assertProjectDocument,
  getProjectDocumentContentHash,
  PROJECT_THEME_VERSION,
  readProjectTransfer,
  readSurfaceTransfer,
  registryLockFingerprint,
  SURFACE_GRAPH_VERSION,
} from '@moluoxixi/config-form-model'
import { loadWorkbenchAdapter } from '../../../adapters'
import { DEFAULT_PROJECT_IDENTITY_FACTORY } from '../../defaults'
import { prepareIsolatedProjectPreview, remapProjectSurfaceIdentity } from '../../services'
import { parseConfigImportPayload } from '../schemas/current'
import {
  appendConfigImportPath,
  guardConfigImportValue,
  MAX_IMPORT_NODES,
  MAX_IMPORT_SURFACES,
  parseConfigImportSource,
} from '../schemas/guard'
import { allocateImportedIdentityMap, instantiateImportedProject } from './identity'

function fail(code: ConfigImportDiagnostic['code'], message: string, path = '$'): PrepareConfigImportResult {
  return { success: false, diagnostics: [{ code, message, path }] }
}

function modelDiagnostics(diagnostics: readonly { message: string, path?: Array<string | number> }[], code: ConfigImportDiagnostic['code']): ConfigImportDiagnostic[] {
  return diagnostics.map(item => ({
    code,
    message: item.message,
    path: (item.path ?? []).reduce<string>((path, segment) => appendConfigImportPath(path, segment), '$'),
  }))
}

function adapterId(value: string): WorkbenchAdapterId | undefined {
  return value === 'antd-vue' || value === 'element-plus' ? value : undefined
}

function summary(document: ProjectDocument, target: 'project' | 'surface', surface?: ProjectSurface): ConfigImportSummary {
  const surfaces = target === 'surface' && surface ? [surface] : Object.values(document.surfacesById)
  return {
    adapter: document.registryLock.adapter as WorkbenchAdapterId,
    name: target === 'surface' && surface ? surface.name : document.name,
    nodeCount: surfaces.reduce((count, item) => count + Object.keys(item.graph.nodesById).length, 0),
    surfaceCount: surfaces.length,
    surfaceGraphVersion: surfaces[0]?.graph.version ?? SURFACE_GRAPH_VERSION,
    resourceCount: Object.keys(document.resources).length,
    version: document.version,
    target,
  }
}

function validateRegistryLock(lock: RegistryLock, adapter: WorkbenchAdapter, path: string): ConfigImportDiagnostic[] {
  const diagnostics = adapter.componentRegistry.analyzeLock(lock).map(item => ({
    code: 'IMPORT_REGISTRY_INVALID' as const,
    message: item.message,
    path: (item.path ?? []).reduce<string>((current, segment) => appendConfigImportPath(current, segment), path),
  }))
  const expected = adapter.componentRegistry.lock
  const keys = Object.keys(lock.components).sort()
  const expectedKeys = Object.keys(expected.components).sort()
  if (lock.adapter !== expected.adapter || lock.version !== expected.version || lock.fingerprint !== expected.fingerprint || JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    diagnostics.push({ code: 'IMPORT_REGISTRY_INVALID', message: 'Transfer Registry lock must exactly match the active Registry.', path })
  }
  return diagnostics
}

function validateSurfaceRegistry(lock: RegistryLock, adapter: WorkbenchAdapter, surfaces: readonly ProjectSurface[]): ConfigImportDiagnostic[] {
  const diagnostics: ConfigImportDiagnostic[] = []
  const keys = [...new Set(surfaces.flatMap(surface => Object.values(surface.graph.nodesById).map(node => node.component)))].sort()
  const lockKeys = Object.keys(lock.components).sort()
  if (lock.adapter !== adapter.componentRegistry.lock.adapter || lock.version !== adapter.componentRegistry.lock.version || JSON.stringify(keys) !== JSON.stringify(lockKeys)) {
    diagnostics.push({ code: 'IMPORT_REGISTRY_INVALID', message: 'Surface transfer Registry lock must contain exactly the closure components.', path: '$.registryLock.components' })
  }
  if (lock.fingerprint !== registryLockFingerprint(lock.components))
    diagnostics.push({ code: 'IMPORT_REGISTRY_INVALID', message: 'Surface transfer Registry fingerprint is invalid.', path: '$.registryLock.fingerprint' })
  for (const key of keys) {
    const transferred = lock.components[key]
    const available = adapter.componentRegistry.lock.components[key]
    if (!transferred || !available || transferred.contractVersion !== available.contractVersion || transferred.fingerprint !== available.fingerprint)
      diagnostics.push({ code: 'IMPORT_REGISTRY_INVALID', message: `Component contract does not match the current Registry: ${key}.`, path: '$.registryLock.components' })
  }
  return diagnostics
}

function compileDocument(document: ProjectDocument, adapter: WorkbenchAdapter): ConfigImportDiagnostic[] {
  const result = compileCanonicalProject({
    snapshot: { document, editVersion: 0, contentHash: getProjectDocumentContentHash(document) },
    registry: adapter.registrySnapshot,
  })
  return result.success
    ? []
    : result.diagnostics.map(item => ({
        code: 'IMPORT_PREVIEW_COMPILE_FAILED' as const,
        message: item.message,
        path: item.path?.reduce<string>((path, segment) => appendConfigImportPath(path, segment), '$') ?? '$',
      }))
}

function embeddedWrites(
  sourceResources: Record<string, ProjectResource>,
  bytesByResourceId: Readonly<Record<string, Uint8Array>>,
  resourceMap: ReadonlyMap<string, string> = new Map(),
): ProjectEmbeddedResourceWrite[] {
  return Object.values(sourceResources)
    .filter(resource => resource.kind === 'embedded')
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((resource) => {
      const bytes = bytesByResourceId[resource.id]
      if (!(bytes instanceof Uint8Array))
        throw new TypeError(`Embedded Resource bytes are missing: ${resource.id}`)
      return {
        resourceId: resourceMap.get(resource.id) ?? resource.id,
        contentHash: resource.contentHash,
        bytes: new Uint8Array(bytes),
      }
    })
}

function createPreview(document: ProjectDocument, adapter: WorkbenchAdapter, adapterIdValue: WorkbenchAdapterId, revision: string, surfaceId = document.homeSurfaceId) {
  return prepareIsolatedProjectPreview({ adapter, adapterId: adapterIdValue, document, surfaceId, revision })
}

function validateSurfaceRouteConflicts(
  current: ProjectDocument,
  transfer: SurfaceTransferReadResultV1,
): ConfigImportDiagnostic[] {
  const currentRoutes = new Set(Object.values(current.surfacesById)
    .flatMap(surface => surface.kind === 'page' ? [surface.route] : []))

  return transfer.surfaceOrder.flatMap((surfaceId) => {
    const surface = transfer.surfacesById[surfaceId]!
    if (surface.kind !== 'page' || !currentRoutes.has(surface.route))
      return []
    return [{
      code: 'IMPORT_SURFACE_INVALID' as const,
      message: `Page route conflicts with the target project: ${surface.route}.`,
      path: `${appendConfigImportPath('$.surfacesById', surfaceId)}.route`,
    }]
  })
}

function mergeSurfaceTransfer(
  current: ProjectDocument,
  transfer: SurfaceTransferReadResultV1,
  identityFactory: NonNullable<PrepareConfigImportOptions['identityFactory']>,
): { document: ProjectDocument, rootSurfaceId: string, resourceMap: ReadonlyMap<string, string> } {
  const surfaceMap = allocateImportedIdentityMap(
    'surface',
    transfer.surfaceOrder,
    identityFactory,
    current.surfaceOrder,
  )
  const datasetMap = allocateImportedIdentityMap(
    'dataset',
    transfer.datasetOrder,
    identityFactory,
    current.datasetOrder,
  )
  const resourceMap = allocateImportedIdentityMap(
    'resource',
    Object.keys(transfer.resources),
    identityFactory,
    Object.keys(current.resources),
  )
  const surfacesById = structuredClone(current.surfacesById) as ProjectDocument['surfacesById']
  transfer.surfaceOrder.forEach((sourceId) => {
    const source = transfer.surfacesById[sourceId]!
    const surfaceId = surfaceMap.get(sourceId)
    if (!surfaceId)
      throw new TypeError(`IMPORT_SURFACE_IDENTITY_INVALID: Surface identity is not mapped: ${sourceId}.`)
    const remapped = remapProjectSurfaceIdentity(
      source,
      surfaceId,
      identityFactory,
      {
        datasets: datasetMap,
        resources: resourceMap,
        surfaces: surfaceMap,
      },
    ).surface
    const surface = structuredClone(remapped)
    surfacesById[surface.id] = surface
  })
  const datasetsById = structuredClone(current.datasetsById) as ProjectDocument['datasetsById']
  transfer.datasetOrder.forEach((sourceId) => {
    const dataset = transfer.datasetsById[sourceId]!
    if (dataset.id !== sourceId)
      throw new TypeError(`IMPORT_DATASET_IDENTITY_INVALID: Dataset map key does not match its identity: ${sourceId}.`)
    const id = datasetMap.get(sourceId)
    if (!id)
      throw new TypeError(`IMPORT_DATASET_IDENTITY_INVALID: Dataset identity is not mapped: ${sourceId}.`)
    datasetsById[id] = { ...structuredClone(dataset), id }
  })
  const resources = structuredClone(current.resources) as ProjectDocument['resources']
  Object.entries(transfer.resources).forEach(([sourceId, resource]) => {
    if (resource.id !== sourceId)
      throw new TypeError(`IMPORT_RESOURCE_IDENTITY_INVALID: Resource map key does not match its identity: ${sourceId}.`)
    const id = resourceMap.get(sourceId)
    if (!id)
      throw new TypeError(`IMPORT_RESOURCE_IDENTITY_INVALID: Resource identity is not mapped: ${sourceId}.`)
    if (Object.hasOwn(resources, id))
      throw new TypeError(`IMPORT_RESOURCE_IDENTITY_CONFLICT: Resource identity would overwrite an existing asset: ${id}.`)
    resources[id] = { ...structuredClone(resource), id }
  })
  const rootSurfaceId = surfaceMap.get(transfer.rootSurfaceId)
  if (!rootSurfaceId)
    throw new TypeError(`IMPORT_SURFACE_IDENTITY_INVALID: Root Surface identity is not mapped: ${transfer.rootSurfaceId}.`)
  const document = assertProjectDocument({
    ...structuredClone(current),
    surfaceOrder: [...current.surfaceOrder, ...transfer.surfaceOrder.map((id) => {
      const mapped = surfaceMap.get(id)
      if (!mapped)
        throw new TypeError(`IMPORT_SURFACE_IDENTITY_INVALID: Surface identity is not mapped: ${id}.`)
      return mapped
    })],
    surfacesById,
    datasetOrder: [...current.datasetOrder, ...transfer.datasetOrder.map((id) => {
      const mapped = datasetMap.get(id)
      if (!mapped)
        throw new TypeError(`IMPORT_DATASET_IDENTITY_INVALID: Dataset identity is not mapped: ${id}.`)
      return mapped
    })],
    datasetsById,
    resources,
    theme: structuredClone(current.theme) ?? { version: PROJECT_THEME_VERSION },
  })
  return { document, rootSurfaceId, resourceMap }
}

async function prepareConfigImportUnsafe(options: PrepareConfigImportOptions): Promise<PrepareConfigImportResult> {
  const parsed = parseConfigImportSource(options.source)
  if (!parsed.success)
    return parsed
  const guardDiagnostics = guardConfigImportValue(parsed.value)
  if (guardDiagnostics.length > 0)
    return { success: false, diagnostics: guardDiagnostics }
  const envelope = parseConfigImportPayload(parsed.value, options.target)
  if (!envelope.success)
    return envelope
  const budgetDiagnostics = guardCanonicalConfigImportBudgets(envelope.payload)
  if (budgetDiagnostics.length > 0)
    return { success: false, diagnostics: budgetDiagnostics }
  const loadAdapter = options.loadAdapter ?? loadWorkbenchAdapter
  const identityFactory = options.identityFactory ?? DEFAULT_PROJECT_IDENTITY_FACTORY
  if (envelope.payload.target === 'project') {
    const transfer = await readProjectTransfer(envelope.payload.envelope)
    if (!transfer.success)
      return { success: false, diagnostics: modelDiagnostics(transfer.diagnostics, 'IMPORT_PROJECT_INVALID') }
    const source = transfer.data.document
    const id = adapterId(source.registryLock.adapter)
    if (!id)
      return fail('IMPORT_ADAPTER_UNSUPPORTED', `Unsupported Workbench adapter: ${source.registryLock.adapter}.`, '$.document.registryLock.adapter')
    const adapter = await loadAdapter(id)
    const lockDiagnostics = validateRegistryLock(source.registryLock, adapter, '$.document.registryLock')
    if (lockDiagnostics.length > 0)
      return { success: false, diagnostics: lockDiagnostics }
    const remapped = instantiateImportedProject(source, identityFactory)
    const compileDiagnostics = compileDocument(remapped.document, adapter)
    if (compileDiagnostics.length > 0)
      return { success: false, diagnostics: compileDiagnostics }
    const embeddedContents = embeddedWrites(source.resources, transfer.data.embeddedBytesByResourceId, remapped.maps.resources)
    const preview = createPreview(remapped.document, adapter, id, `import:${getConfigFormJsonSemanticHash(remapped.document)}`)
    return {
      success: true,
      prepared: {
        adapter: id,
        diagnostics: [],
        document: remapped.document,
        embeddedContents,
        preview,
        previewCompilation: preview.compilation,
        summary: summary(remapped.document, 'project'),
        target: 'project',
      },
    }
  }

  const currentProject = options.currentProject
  if (!currentProject)
    return fail('IMPORT_TARGET_MISMATCH', 'Surface import requires an active project.')
  const transfer = await readSurfaceTransfer(envelope.payload.envelope)
  if (!transfer.success)
    return { success: false, diagnostics: modelDiagnostics(transfer.diagnostics, 'IMPORT_SURFACE_INVALID') }
  const id = adapterId(currentProject.registryLock.adapter)
  if (!id)
    return fail('IMPORT_ADAPTER_UNSUPPORTED', `Unsupported Workbench adapter: ${currentProject.registryLock.adapter}.`, '$.registryLock.adapter')
  const adapter = await loadAdapter(id)
  const registryDiagnostics = validateSurfaceRegistry(transfer.data.registryLock, adapter, transfer.data.surfaceOrder.map(surfaceId => transfer.data.surfacesById[surfaceId]!))
  if (registryDiagnostics.length > 0)
    return { success: false, diagnostics: registryDiagnostics }
  if (transfer.data.surfaceOrder.length > MAX_IMPORT_SURFACES)
    return fail('IMPORT_SURFACE_LIMIT_EXCEEDED', `Surface transfer contains more than ${MAX_IMPORT_SURFACES} surfaces.`, '$.surfaceOrder')
  if (transfer.data.surfaceOrder.reduce((count, surfaceId) => count + Object.keys(transfer.data.surfacesById[surfaceId]!.graph.nodesById).length, 0) > MAX_IMPORT_NODES)
    return fail('IMPORT_NODE_LIMIT_EXCEEDED', `Surface transfer contains more than ${MAX_IMPORT_NODES} nodes.`, '$.surfacesById')
  const routeDiagnostics = validateSurfaceRouteConflicts(currentProject, transfer.data)
  if (routeDiagnostics.length > 0)
    return { success: false, diagnostics: routeDiagnostics }
  const merged = mergeSurfaceTransfer(currentProject, transfer.data, identityFactory)
  const compileDiagnostics = compileDocument(merged.document, adapter)
  if (compileDiagnostics.length > 0)
    return { success: false, diagnostics: compileDiagnostics }
  const root = merged.document.surfacesById[merged.rootSurfaceId]!
  const preview = createPreview(merged.document, adapter, id, `import:${getConfigFormJsonSemanticHash(root)}`, merged.rootSurfaceId)
  return {
    success: true,
    prepared: {
      adapter: id,
      diagnostics: [],
      document: merged.document,
      embeddedContents: embeddedWrites(transfer.data.resources, transfer.data.embeddedBytesByResourceId, merged.resourceMap),
      originContentHash: getProjectDocumentContentHash(currentProject),
      originProjectId: currentProject.id,
      preview,
      previewCompilation: preview.compilation,
      registryLock: transfer.data.registryLock,
      summary: summary(merged.document, 'surface', root),
      surface: structuredClone(root),
      target: 'surface',
    },
  }
}

export function guardCanonicalConfigImportBudgets(payload: CanonicalImportPayload): ConfigImportDiagnostic[] {
  if (typeof payload.envelope !== 'object' || payload.envelope === null)
    return []
  const envelope = payload.envelope as Record<string, unknown>
  const surfaceContainer = payload.target === 'project'
    ? envelope.document
    : envelope
  if (typeof surfaceContainer !== 'object' || surfaceContainer === null)
    return []
  const surfacesInput = (surfaceContainer as Record<string, unknown>).surfacesById
  if (typeof surfacesInput !== 'object' || surfacesInput === null || Array.isArray(surfacesInput))
    return []
  const surfaces = Object.values(surfacesInput)
  const basePath = payload.target === 'project' ? '$.document.surfacesById' : '$.surfacesById'
  if (surfaces.length > MAX_IMPORT_SURFACES) {
    return [{
      code: 'IMPORT_SURFACE_LIMIT_EXCEEDED',
      message: `Transfer contains ${surfaces.length} surfaces; the limit is ${MAX_IMPORT_SURFACES}.`,
      path: basePath,
    }]
  }
  let nodeCount = 0
  for (const surface of surfaces) {
    if (typeof surface !== 'object' || surface === null)
      continue
    const graph = (surface as Record<string, unknown>).graph
    if (typeof graph !== 'object' || graph === null)
      continue
    const nodesById = (graph as Record<string, unknown>).nodesById
    if (typeof nodesById !== 'object' || nodesById === null || Array.isArray(nodesById))
      continue
    nodeCount += Object.keys(nodesById).length
    if (nodeCount > MAX_IMPORT_NODES) {
      return [{
        code: 'IMPORT_NODE_LIMIT_EXCEEDED',
        message: `Transfer contains more than ${MAX_IMPORT_NODES} Surface nodes.`,
        path: basePath,
      }]
    }
  }
  return []
}

export async function prepareConfigImport(options: PrepareConfigImportOptions): Promise<PrepareConfigImportResult> {
  try {
    return await prepareConfigImportUnsafe(options)
  }
  catch (error) {
    return {
      success: false,
      diagnostics: [{
        code: options.target === 'surface' ? 'IMPORT_SURFACE_INVALID' : 'IMPORT_PROJECT_INVALID',
        message: error instanceof Error ? error.message : String(error),
        path: '$',
      }],
    }
  }
}
