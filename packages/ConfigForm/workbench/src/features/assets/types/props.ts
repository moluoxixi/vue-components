import type {
  ContractResult,
  DatasetProjection,
  DatasetTransferEnvelopeV1,
  ReadonlyProjectDocument,
  ResourceTransferEnvelopeV1,
} from '@moluoxixi/config-form-model'

export type AssetImportConflictStrategy = 'copy' | 'overwrite' | 'skip'

export interface AssetManagerCommands {
  createDataset: (name: string, rows?: unknown) => string | undefined
  createEmbeddedResource: (input: {
    bytes: Uint8Array
    fileName: string
    mediaType: string
    name: string
  }) => Promise<string | undefined>
  createUrlResource: (input: {
    integrity?: string
    mediaType?: string
    name: string
    url: string
  }) => string | undefined
  deleteDataset: (datasetId: string) => boolean
  deleteResource: (resourceId: string) => boolean
  exportDataset: (datasetId: string) => ContractResult<DatasetTransferEnvelopeV1> | undefined
  exportResource: (resourceId: string) => Promise<ContractResult<ResourceTransferEnvelopeV1> | undefined>
  importDataset: (input: unknown, strategy?: AssetImportConflictStrategy) => string | undefined
  importResource: (input: unknown, strategy?: AssetImportConflictStrategy) => Promise<string | undefined>
  renameDataset: (datasetId: string, name: string) => boolean
  renameResource: (resourceId: string, name: string) => boolean
  replaceDatasetRows: (datasetId: string, rows: unknown) => boolean
  replaceEmbeddedResource: (resourceId: string, input: {
    bytes: Uint8Array
    fileName: string
    mediaType: string
    name: string
  }) => Promise<boolean>
  replaceUrlResource: (resourceId: string, input: {
    integrity?: string
    mediaType?: string
    name: string
    url: string
  }) => boolean
  setDatasetDefaultProjection: (datasetId: string, projection?: DatasetProjection) => boolean
}

export interface AssetManagerDialogProps {
  commands: AssetManagerCommands
  initialId?: string
  initialKind?: 'dataset' | 'resource'
  modelValue: boolean
  project: ReadonlyProjectDocument
}
