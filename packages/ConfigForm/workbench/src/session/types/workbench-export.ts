import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { ProjectRepository } from '@moluoxixi/config-form-model'
import type { ShallowRef } from 'vue'
import type { WorkbenchAdapter } from '../../adapters'
import type {
  BuildExportSnapshotInput,
  ProjectEditorSessionSnapshot,
} from '../../project'

export interface WorkbenchExportServiceOptions {
  getAdapter: () => WorkbenchAdapter | undefined
  getSnapshot: () => ProjectEditorSessionSnapshot | undefined
  readEmbedded: ProjectRepository['readEmbedded']
}

export interface WorkbenchExportService {
  readonly compilation: ShallowRef<ProjectCompilation | undefined>
  capture: () => BuildExportSnapshotInput | undefined
  clear: () => void
  getCompilation: () => ProjectCompilation | undefined
  sync: (snapshot: ProjectEditorSessionSnapshot) => void
}
