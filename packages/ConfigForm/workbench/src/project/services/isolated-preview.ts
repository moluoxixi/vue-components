import type { ModelJsonObject, ProjectDocument, ProjectSurface } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapter } from '../../adapters'
import type { IsolatedProjectPreview } from '../types'
import { compileCanonicalSurface } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'

function initialValues(surface: ProjectSurface): ModelJsonObject {
  const values: ModelJsonObject = {}
  for (const node of Object.values(surface.graph.nodesById)) {
    if (node.kind === 'field' && node.defaultValue !== undefined)
      values[node.field] = structuredClone(node.defaultValue)
  }
  return values
}

export function prepareIsolatedProjectPreview(input: {
  adapter: Pick<WorkbenchAdapter, 'designerRegistry' | 'registrySnapshot'>
  adapterId: IsolatedProjectPreview['adapter']
  document: ProjectDocument
  surfaceId: string
  revision: string
}): IsolatedProjectPreview {
  const snapshot = createProjectSnapshot(input.document, 0)
  const compiled = compileCanonicalSurface({
    snapshot: {
      document: snapshot.document,
      editVersion: snapshot.editVersion,
      contentHash: snapshot.contentHash,
    },
    surfaceId: input.surfaceId,
    registry: input.adapter.registrySnapshot,
  })
  if (!compiled.success) {
    throw new TypeError(
      `${compiled.diagnostics[0]?.code ?? 'ISOLATED_PREVIEW_COMPILE_FAILED'}: ${compiled.diagnostics[0]?.message ?? 'Preview compilation failed.'}`,
    )
  }
  const surface = input.document.surfacesById[input.surfaceId]!
  const values = initialValues(surface)
  return {
    adapter: input.adapterId,
    compilation: compiled.compilation,
    namespace: input.adapter.designerRegistry.rendererNamespace,
    revision: input.revision,
    values,
  }
}
