import type { WorkspaceFile } from '../../types'

export interface DownloadWorkspaceFileInput {
  file: Readonly<WorkspaceFile>
  filename: string
  mime?: string
}
