import type { SourceFile } from '@moluoxixi/config-form-source/generator'

export interface DownloadSourceFileInput {
  file: Readonly<SourceFile>
  filename: string
  mime?: string
}
