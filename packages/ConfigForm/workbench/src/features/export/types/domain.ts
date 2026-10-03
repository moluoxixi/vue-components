import type { BuildExportSnapshotInput, ExportSnapshot } from '../../../project'

export type ExportMode = 'source' | 'config'

export interface SourceWorkspaceArchiveOptions {
  captured: BuildExportSnapshotInput
  snapshot: ExportSnapshot
  mode: ExportMode
  scope: 'project' | 'surface'
  surfaceId?: string
}
