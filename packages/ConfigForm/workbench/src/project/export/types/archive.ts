import type { SourceFile } from '@moluoxixi/config-form-source/generator'

export interface SourceArchiveInput {
  files: readonly SourceFile[]
  name: string
}
