import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type {
  BuildExportSnapshotInput,
  ProjectEditorSessionSnapshot,
} from '../../project'
import type {
  WorkbenchExportService,
  WorkbenchExportServiceOptions,
} from '../types'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { shallowRef } from 'vue'
import { projectSnapshotFromEditorSession } from '../../project'

function matchesSnapshot(
  compilation: ProjectCompilation,
  snapshot: ProjectEditorSessionSnapshot,
): boolean {
  return compilation.origin.kind === 'committed'
    && !('kind' in compilation.snapshot)
    && compilation.origin.editVersion === snapshot.editVersion
    && compilation.snapshot.document.id === snapshot.document.id
    && compilation.snapshot.contentHash === snapshot.contentHash
}

export function createWorkbenchExportService(
  options: WorkbenchExportServiceOptions,
): WorkbenchExportService {
  const compilation = shallowRef<ProjectCompilation>()

  function sync(snapshot: ProjectEditorSessionSnapshot): void {
    if (compilation.value && !matchesSnapshot(compilation.value, snapshot))
      compilation.value = undefined
  }

  function capture(): BuildExportSnapshotInput | undefined {
    const snapshot = options.getSnapshot()
    const adapter = options.getAdapter()
    if (!snapshot || !adapter)
      return undefined
    const current = compilation.value
    const next = current && matchesSnapshot(current, snapshot)
      ? current
      : (() => {
          const result = compileCanonicalProject({
            snapshot: projectSnapshotFromEditorSession(snapshot),
            registry: adapter.registrySnapshot,
          })
          if (!result.success)
            return undefined
          compilation.value = result.compilation
          return result.compilation
        })()
    return next
      ? { compilation: next, resolver: adapter.sourceResolver }
      : undefined
  }

  return {
    compilation,
    capture,
    clear() {
      compilation.value = undefined
    },
    getCompilation: () => compilation.value,
    sync,
  }
}
