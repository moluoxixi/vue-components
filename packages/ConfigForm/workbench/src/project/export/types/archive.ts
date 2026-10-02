import type { SourceFile } from '@moluoxixi/config-form-source/generator'

export interface SourceArchiveInput {
  files: readonly SourceFile[]
  name: string
}

/** Copy-friendly projection used by project and page source exports. */
export interface StructuredSourceArchiveInput extends SourceArchiveInput {
  projectName?: string
  projectId?: string
  scope?: 'project' | 'surface'
  surfaceDirectory?: string
  surfaceDirectories?: readonly string[]
  surfaceId?: string
  surfaceName?: string
}
