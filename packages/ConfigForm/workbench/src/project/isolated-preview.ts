import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { ProjectDocument, ProjectPage } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapter, WorkbenchAdapterId } from '../adapters'
import type { RuntimeHostRuntimeStatePayload } from '../runtime-host/protocol'
import { compileCanonicalPage } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'

export interface IsolatedProjectPreview {
  adapter: WorkbenchAdapterId
  compilation: PageCompilation
  namespace: string
  reactionProjection: ConfigFormReactionProjection<Record<string, unknown>>
  revision: string
  runtimeSessionKey: string
  runtimeState: RuntimeHostRuntimeStatePayload
}

function initialValues(page: ProjectPage): Record<string, unknown> {
  return Object.fromEntries(Object.values(page.graph.nodesById)
    .filter(node => node.kind === 'field' && node.defaultValue !== undefined)
    .map(node => [node.kind === 'field' ? node.field : '', structuredClone(node.kind === 'field' ? node.defaultValue : undefined)]))
}

export function prepareIsolatedProjectPreview(input: {
  adapter: Pick<WorkbenchAdapter, 'designerRegistry' | 'registrySnapshot'>
  adapterId: WorkbenchAdapterId
  document: ProjectDocument
  pageId: string
  revision: string
}): IsolatedProjectPreview {
  const snapshot = createProjectSnapshot(input.document, 0)
  const compiled = compileCanonicalPage({
    snapshot: {
      document: snapshot.document,
      editVersion: snapshot.editVersion,
      contentHash: snapshot.contentHash,
    },
    pageId: input.pageId,
    registry: input.adapter.registrySnapshot,
  })
  if (!compiled.success) {
    throw new TypeError(
      `${compiled.diagnostics[0]?.code ?? 'ISOLATED_PREVIEW_COMPILE_FAILED'}: ${compiled.diagnostics[0]?.message ?? 'Preview compilation failed.'}`,
    )
  }
  const page = input.document.pagesById[input.pageId]!
  const values = initialValues(page)
  return {
    adapter: input.adapterId,
    compilation: compiled.compilation,
    namespace: input.adapter.designerRegistry.rendererNamespace,
    reactionProjection: { values: structuredClone(values), props: {}, states: {}, validate: [] },
    revision: input.revision,
    runtimeSessionKey: `${input.document.id}:${input.adapterId}:${input.pageId}`,
    runtimeState: { values, touched: [], validation: {} },
  }
}
