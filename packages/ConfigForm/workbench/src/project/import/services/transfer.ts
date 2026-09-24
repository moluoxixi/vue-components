import type {
  ProjectTransferEnvelopeV1,
  ReadonlyProjectDocument,
  SurfaceTransferEnvelopeV1,
} from '@moluoxixi/config-form-model'
import { writeProjectTransfer, writeSurfaceTransfer } from '@moluoxixi/config-form-model'

type EmbeddedResourceReader = (
  input: { projectId: string, resourceId: string, contentHash: string },
) => Promise<Uint8Array | undefined>

/** Create the strict Project transfer envelope used by Workbench JSON export. */
export async function createProjectTransferDocument(
  document: ReadonlyProjectDocument,
  readEmbedded: EmbeddedResourceReader,
): Promise<ProjectTransferEnvelopeV1> {
  const result = await writeProjectTransfer({ document, readEmbedded })
  if (!result.success)
    throw new TypeError(result.diagnostics[0]?.message ?? 'Project transfer could not be written.')
  return result.data
}

/** Create the strict Surface transfer envelope used by Workbench JSON export. */
export async function createSurfaceTransferDocument(
  document: ReadonlyProjectDocument,
  surfaceId: string,
  readEmbedded: EmbeddedResourceReader,
): Promise<SurfaceTransferEnvelopeV1> {
  const result = await writeSurfaceTransfer({
    document,
    rootSurfaceId: surfaceId,
    readEmbedded,
  })
  if (!result.success)
    throw new TypeError(result.diagnostics[0]?.message ?? 'Surface transfer could not be written.')
  return result.data
}
