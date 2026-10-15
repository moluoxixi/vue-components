import type { RawSourceFileSetV1 } from '@moluoxixi/config-form-source/generator'

export interface SourceArtifact {
  version: 1
  id: string
  projectId: string
  repositoryRevision: number
  source: RawSourceFileSetV1
}
