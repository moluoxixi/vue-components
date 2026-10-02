import type { ProjectDocument, ReadonlyProjectDocument, RegistryContractSnapshot } from '@moluoxixi/config-form-model'
import type {
  GenerateVueSourceInput,
  SourceComponentResolver,
  SourceResourceReader,
} from '@moluoxixi/config-form-source/generator'

export interface ProjectSourceInput {
  document: ProjectDocument
  source: GenerateVueSourceInput
}

export interface ProjectSourceInputOptions {
  document: ReadonlyProjectDocument
  editVersion?: number
  registry: RegistryContractSnapshot
  componentResolver: SourceComponentResolver
  readEmbedded: SourceResourceReader['readEmbedded']
  surfaceId?: string
}

export interface GeneratedSourceArchiveInput {
  document: ReadonlyProjectDocument
  source: GenerateVueSourceInput
  surfaceId?: string
}
