import type { ProjectDocument, ProjectPageSurface, ReadonlyProjectDocument } from '@moluoxixi/config-form-model'
import type { GeneratedSourceArchiveInput, ProjectSourceInput, ProjectSourceInputOptions } from '../types'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import {
  assertProjectDocument,
  collectSurfaceDependencyClosure,
  createProjectSnapshot,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  readProjectImageResourceId,
  SURFACE_GRAPH_VERSION,
} from '@moluoxixi/config-form-model'
import { generateVueSource } from '@moluoxixi/config-form-source/generator'
import { downloadStructuredSourceArchive } from './download'

/** Create the Source Generator input for a persisted project. */
export function createProjectSourceInput(
  input: ProjectSourceInputOptions,
): ProjectSourceInput {
  const document = sourceDocument(input.document, input.surfaceId)
  const result = compileCanonicalProject({
    snapshot: createProjectSnapshot(document, input.editVersion ?? 0),
    registry: input.registry,
  })
  if (!result.success)
    throw new TypeError(result.diagnostics[0]?.message ?? 'Project compilation failed.')
  return {
    document,
    source: {
      compilation: result.compilation,
      componentResolver: input.componentResolver,
      resourceReader: { readEmbedded: input.readEmbedded },
      styleTarget: 'tailwind-v4',
    },
  }
}

function sourceDocument(
  document: ReadonlyProjectDocument,
  surfaceId?: string,
): ProjectDocument {
  const mutableDocument = structuredClone(document) as unknown as ProjectDocument
  if (!surfaceId)
    return mutableDocument
  const root = mutableDocument.surfacesById[surfaceId]
  if (!root)
    throw new TypeError(`Surface does not exist: ${surfaceId}`)
  const closure = collectSurfaceDependencyClosure(mutableDocument, surfaceId)
  const surfaceOrder = [...closure.surfaceIds]
  const surfacesById = Object.fromEntries(surfaceOrder.map(id => [id, structuredClone(mutableDocument.surfacesById[id]!)]))
  const page = root.kind === 'page'
    ? root
    : closure.surfaceIds.map(id => mutableDocument.surfacesById[id]).find(surface => surface?.kind === 'page')
  if (!page) {
    const hostId = 'export-host-page'
    const host: ProjectPageSurface = {
      id: hostId,
      kind: 'page',
      name: 'Export host',
      route: '/',
      parameters: [],
      outputs: [],
      interactions: [],
      graph: {
        version: SURFACE_GRAPH_VERSION,
        props: {},
        form: {},
        root: [],
        nodesById: {},
      },
    }
    surfacesById[hostId] = host
    surfaceOrder.push(hostId)
  }
  const imageId = readProjectImageResourceId(mutableDocument.settings)
  const resourceIds = imageId && mutableDocument.resources[imageId] && !closure.resourceIds.includes(imageId)
    ? [...closure.resourceIds, imageId]
    : closure.resourceIds
  return assertProjectDocument({
    version: PROJECT_DOCUMENT_VERSION,
    id: mutableDocument.id,
    name: mutableDocument.name,
    homeSurfaceId: page?.id ?? 'export-host-page',
    surfaceOrder,
    surfacesById,
    datasetOrder: closure.datasetIds,
    datasetsById: Object.fromEntries(closure.datasetIds.map(id => [id, structuredClone(mutableDocument.datasetsById[id]!)])),
    resources: Object.fromEntries(resourceIds.map(id => [id, structuredClone(mutableDocument.resources[id]!)])),
    theme: structuredClone(mutableDocument.theme) ?? { version: PROJECT_THEME_VERSION },
    registryLock: structuredClone(mutableDocument.registryLock),
    settings: structuredClone(mutableDocument.settings),
  })
}

/** Generate and download the structured project/page source archive. */
export async function downloadGeneratedSourceArchive(
  input: GeneratedSourceArchiveInput,
): Promise<string> {
  const generated = await generateVueSource(input.source)
  if (!generated.success)
    throw new TypeError(generated.diagnostics[0]?.message ?? 'Vue source generation failed.')
  const { sourceSurfaceDirectory } = await import('./structured-projection')
  const surface = input.surfaceId
    ? input.document.surfacesById[input.surfaceId]
    : undefined
  if (input.surfaceId && !surface)
    throw new TypeError(`Surface does not exist: ${input.surfaceId}`)
  const surfaceDirectory = input.surfaceId
    ? sourceSurfaceDirectory(generated.data.files, input.surfaceId, input.document.surfaceOrder)
    : undefined
  if (input.surfaceId && !surfaceDirectory)
    throw new TypeError(`Generated source does not contain Surface: ${input.surfaceId}`)
  return await downloadStructuredSourceArchive({
    files: generated.data.files,
    name: surface ? `${input.document.name}-${surface.name}` : input.document.name,
    projectName: input.document.name,
    projectId: input.document.id,
    scope: input.surfaceId ? 'surface' : 'project',
    ...(input.surfaceId
      ? {
          surfaceDirectory,
          surfaceDirectories: [...new Set(generated.data.files.flatMap((file) => {
            const match = /^src\/surfaces\/([^/]+)(?:\/|$)/u.exec(file.path)
            return match ? [match[1]!] : []
          }))],
          surfaceId: input.surfaceId,
          surfaceName: surface!.name,
        }
      : {}),
  })
}
