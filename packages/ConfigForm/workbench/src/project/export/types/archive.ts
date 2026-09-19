import type { SourceFile } from '@moluoxixi/config-form-source/generator'

export interface WorkspaceArchiveInput {
  files: readonly SourceFile[]
  name: string
}
