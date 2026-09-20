export type AssetImportConflictStrategy = 'copy' | 'overwrite' | 'skip'

export interface EmbeddedResourceInput {
  bytes: Uint8Array
  fileName: string
  mediaType: string
  name: string
}

export interface UrlResourceInput {
  integrity?: string
  mediaType?: string
  name: string
  url: string
}
