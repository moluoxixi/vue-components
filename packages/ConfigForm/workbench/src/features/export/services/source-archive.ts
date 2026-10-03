import type { StructuredSourceArchiveInput } from '../../../project'
import type { SourceWorkspaceArchiveOptions } from '../types'
import { generateConfigFormBindings, generateVueSource } from '@moluoxixi/config-form-source/generator'
import { createProjectSourceInput } from '../../../project'
import { sourceSurfaceDirectory } from '../../../project/export/services/structured-projection'

/** Keep page downloads on the same model, output shape, and style as the source tab. */
export async function createSourceWorkspaceArchiveInput(
  options: SourceWorkspaceArchiveOptions,
): Promise<StructuredSourceArchiveInput> {
  const { captured, mode, scope, snapshot: current, surfaceId } = options
  const artifact = mode === 'config' ? current.configBindings : current.rawSource
  if (artifact.status !== 'ready')
    throw new Error(artifact.diagnostics.map(item => item.message).join('; '))
  const suffix = mode === 'config' ? 'config-form-bindings' : 'vue-source'
  const base: StructuredSourceArchiveInput = {
    name: `${current.compilation.ir.name}-${suffix}`,
    projectName: current.compilation.ir.name,
    projectId: current.compilation.key.projectId,
    files: artifact.fileSet.files,
    scope,
  }
  if (scope === 'project')
    return base
  if (!surfaceId)
    throw new Error('A page must be selected for a page source download.')
  const page = createProjectSourceInput({
    document: current.compilation.snapshot.document,
    editVersion: current.compilation.origin.kind === 'committed'
      ? current.compilation.origin.editVersion
      : current.compilation.origin.baseEditVersion,
    registry: current.compilation.registry,
    componentResolver: captured.componentResolver,
    readEmbedded: request => captured.resourceReader.readEmbedded(request),
    surfaceId,
  })
  const source = { ...page.source, styleTarget: current.styleTarget }
  const generated = mode === 'config'
    ? await generateConfigFormBindings({ ...source, bindingResolver: captured.bindingResolver })
    : await generateVueSource(source)
  if (!generated.success)
    throw new Error(generated.diagnostics.map(item => item.message).join('; '))
  const surfaceDirectory = sourceSurfaceDirectory(generated.data.files, surfaceId, page.document.surfaceOrder)
  if (!surfaceDirectory)
    throw new Error(`Generated source does not contain Surface: ${surfaceId}`)
  return {
    ...base,
    name: `${current.compilation.ir.name}-${page.document.surfacesById[surfaceId]!.name}-${suffix}`,
    files: generated.data.files,
    surfaceId,
    surfaceDirectory,
    surfaceDirectories: page.document.surfaceOrder.flatMap((id) => {
      const directory = sourceSurfaceDirectory(generated.data.files, id, page.document.surfaceOrder)
      return directory ? [directory] : []
    }),
  }
}
