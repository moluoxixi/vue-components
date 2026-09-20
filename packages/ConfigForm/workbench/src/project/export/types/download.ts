import type {
  ProjectEmbeddedResourceRead,
  ReadonlyProjectDocument,
} from '@moluoxixi/config-form-model'
import type { SourceFile } from '@moluoxixi/config-form-source/generator'

export type ExportEmbeddedResourceReader = (
  input: ProjectEmbeddedResourceRead,
) => Promise<Uint8Array | undefined>

export interface DownloadSourceFileInput {
  file: Readonly<SourceFile>
  filename: string
  mime?: string
}

export interface DownloadProjectTransferInput {
  document: ReadonlyProjectDocument
  readEmbedded: ExportEmbeddedResourceReader
}

export interface DownloadSurfaceTransferInput extends DownloadProjectTransferInput {
  surfaceId: string
}
