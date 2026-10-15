import type { ContractResult, ModelDiagnostic, ProjectDocument } from '@moluoxixi/config-form-model'
import type { GenerateProjectSourceInput, GenerateProjectSourceResult, SourceResourceReader } from '../types'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot, readProjectTransfer } from '@moluoxixi/config-form-model'
import { generateVueSource } from './generate'
import { selectProjectSourceDocument } from './project-document'
import { isSourceStyleTarget } from './style-backend'

function fail(message: string, path: Array<string | number> = []): { success: false, diagnostics: ModelDiagnostic[] } {
  return { success: false, diagnostics: [{ code: 'source_input_invalid', message, path }] }
}

function missingResourceReader(): SourceResourceReader {
  return {
    async readEmbedded(request) {
      return {
        success: false,
        diagnostics: [{
          code: 'source_resource_read_failed',
          message: 'A document with embedded resources requires a resourceReader or a complete project transfer.',
          resourceId: request.resourceId,
          projectId: request.projectId,
        }],
      }
    },
  }
}

async function readProject(input: unknown): Promise<ContractResult<{
  document: ProjectDocument
  resourceReader?: SourceResourceReader
}>> {
  let project = input
  if (typeof project === 'string') {
    try {
      project = JSON.parse(project)
    }
    catch {
      return fail('Project source is not valid JSON.', ['project'])
    }
  }
  if (project && typeof project === 'object' && 'kind' in project) {
    const read = await readProjectTransfer(project)
    if (!read.success)
      return read
    const { document, embeddedBytesByResourceId } = read.data
    return {
      success: true,
      data: {
        document,
        resourceReader: {
          async readEmbedded(request) {
            const resource = document.resources[request.resourceId]
            const bytes = embeddedBytesByResourceId[request.resourceId]
            if (request.projectId !== document.id || resource?.kind !== 'embedded' || resource.contentHash !== request.contentHash || !bytes)
              return fail('Embedded resource does not belong to this project transfer.', ['resources', request.resourceId])
            return { success: true, data: new Uint8Array(bytes), diagnostics: [] }
          },
        },
      },
      diagnostics: [],
    }
  }
  const document = selectProjectSourceDocument(project)
  if (!document.success)
    return document
  return { success: true, data: { document: document.data }, diagnostics: [] }
}

/** Generate standalone Vue files directly from a current project document or transfer. */
export async function generateProjectSource(input: GenerateProjectSourceInput): GenerateProjectSourceResult {
  try {
    if (!input || typeof input !== 'object' || !input.preset)
      return fail('Project source generation requires a project and provider preset.')
    if (!isSourceStyleTarget(input.styleTarget ?? 'css'))
      return fail('Source generation style target must be "css" or "tailwind-v4".', ['styleTarget'])
    const project = await readProject(input.project)
    if (!project.success)
      return project
    const selected = selectProjectSourceDocument(project.data.document, input.surfaceId)
    if (!selected.success)
      return selected
    const compiled = compileCanonicalProject({
      snapshot: createProjectSnapshot(selected.data, 0),
      registry: input.preset.registry,
    })
    if (!compiled.success)
      return compiled
    return await generateVueSource({
      compilation: compiled.compilation,
      componentResolver: input.preset.componentResolver,
      resourceReader: project.data.resourceReader ?? input.resourceReader ?? missingResourceReader(),
      styleTarget: input.styleTarget,
    })
  }
  catch (error) {
    return fail(error instanceof Error ? error.message : 'Project source generation failed.')
  }
}
