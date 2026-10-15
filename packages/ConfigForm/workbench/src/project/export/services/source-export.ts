import type { GeneratedSourceArchiveInput, ProjectSourceInput, ProjectSourceInputOptions } from '../types'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { generateVueSource, selectProjectSourceDocument } from '@moluoxixi/config-form-source/generator'
import { downloadStructuredSourceArchive } from './download'

/** Create the Source Generator input for a persisted project. */
export function createProjectSourceInput(
  input: ProjectSourceInputOptions,
): ProjectSourceInput {
  const selected = selectProjectSourceDocument(input.document, input.surfaceId)
  if (!selected.success)
    throw new TypeError(selected.diagnostics[0]?.message ?? 'Project source selection failed.')
  const document = selected.data
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
