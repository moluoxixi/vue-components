import type { ProjectDocument, ProjectPageSurface, ProjectRepository } from '@moluoxixi/config-form-model'
import type { RevisionPreviewCapture } from '../types/revision-preview'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { assertProjectDocument, createProjectSnapshot, SURFACE_GRAPH_VERSION } from '@moluoxixi/config-form-model'
import { initializePrototypeProjectSession } from '@moluoxixi/config-form-prototype-runtime/session'
import { selectProjectSourceDocument } from '@moluoxixi/config-form-source/generator'
import { createStudioNode, getStudioPreset } from '@moluoxixi/config-form-studio'

export function prepareRevisionPreview(input: { document: ProjectDocument, repositoryRevision: number, surfaceId: string, resourceUrls?: Record<string, string> }): RevisionPreviewCapture {
  const selected = selectProjectSourceDocument(input.document, input.surfaceId)
  if (!selected.success)
    throw new Error(selected.diagnostics[0]?.message ?? 'Preview Surface is unavailable.')
  let document = selected.data
  for (const surface of Object.values(document.surfacesById)) {
    for (const node of Object.values(surface.graph.nodesById)) {
      for (const [key, binding] of Object.entries(node.resourceBindings ?? {})) {
        const resource = document.resources[binding.resourceId]
        const url = resource?.kind === 'url' ? resource.url : input.resourceUrls?.[binding.resourceId]
        if (url)
          node.props[key] = url
      }
    }
  }
  const surface = document.surfacesById[input.surfaceId]!
  const preset = document.registryLock.adapter
  if (preset !== 'element-plus' && preset !== 'antd-vue')
    throw new TypeError('Unsupported preview component library.')
  if (surface.kind !== 'page') {
    let id = 'revision-preview-host'
    while (document.surfacesById[id]) id += '-host'
    const button = createStudioNode({ preset, component: `${preset === 'element-plus' ? 'element' : 'antd'}.button`, id: 'preview-open', props: { text: `打开 ${surface.name}` } })
    const host: ProjectPageSurface = {
      id,
      name: surface.name,
      kind: 'page',
      route: '/revision-preview',
      parameters: [],
      outputs: [],
      graph: { version: SURFACE_GRAPH_VERSION, props: {}, form: {}, ...button },
      interactions: [{ kind: 'primaryUiAction', id: 'preview-open', nodeId: 'preview-open', trigger: 'activate', action: {
        kind: 'open',
        targetSurfaceId: surface.id,
        parameters: surface.parameters.map(parameter => ({ name: parameter.name, value: { version: 1, ast: { kind: 'literal', value: parameter.defaultValue ?? null } } })),
      } }],
    }
    document = assertProjectDocument({ ...document, homeSurfaceId: id, surfaceOrder: [...document.surfaceOrder, id], surfacesById: { ...document.surfacesById, [id]: host } })
  }
  const compiled = compileCanonicalProject({ snapshot: createProjectSnapshot(document, input.repositoryRevision), registry: getStudioPreset(preset).registry })
  if (!compiled.success)
    throw new Error(JSON.stringify(compiled.diagnostics))
  let row = 0
  const session = initializePrototypeProjectSession({ compilation: compiled.compilation, homeInstanceId: 'revision-preview-home', createRowId: () => `preview-row-${++row}` })
  if (!session.success)
    throw new Error(JSON.stringify(session.diagnostics))
  return { compilation: compiled.compilation, session: session.data, sessionId: `revision-preview:${input.repositoryRevision}`, revision: `saved:${input.repositoryRevision}:${compiled.compilation.key.irHash}`, preset, name: surface.name } as const
}

/** Resolve resource contents from the same saved version, never from browser storage. */
export async function loadRevisionPreview(repository: ProjectRepository, input: { projectId: string, repositoryRevision: number, surfaceId: string }): Promise<RevisionPreviewCapture> {
  const saved = await repository.getVersion(input.projectId, input.repositoryRevision)
  if (!saved)
    throw new Error('该项目版本已不可用。请获取新的预览链接。')
  const selected = selectProjectSourceDocument(saved.document, input.surfaceId)
  if (!selected.success)
    throw new Error(selected.diagnostics[0]?.message ?? 'Preview Surface is unavailable.')
  const entries = await Promise.all(Object.values(selected.data.resources).map(async (resource): Promise<[string, string]> => {
    if (resource.kind === 'url')
      return [resource.id, resource.url]
    const bytes = await repository.readEmbedded({ projectId: input.projectId, resourceId: resource.id, contentHash: resource.contentHash })
    if (!bytes)
      throw new Error(`预览图片已不可用：${resource.name}`)
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
    return [resource.id, `data:${resource.mediaType};base64,${btoa(binary)}`]
  }))
  return prepareRevisionPreview({ document: saved.document, repositoryRevision: saved.repositoryRevision, surfaceId: input.surfaceId, resourceUrls: Object.fromEntries(entries) })
}
