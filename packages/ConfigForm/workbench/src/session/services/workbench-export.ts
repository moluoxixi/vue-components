import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { ModelDiagnostic } from '@moluoxixi/config-form-model'
import type { SourceResourceReader } from '@moluoxixi/config-form-source/generator'
import type { BuildExportSnapshotInput, ProjectEditorSessionSnapshot } from '../../project'
import type { WorkbenchExportService, WorkbenchExportServiceOptions } from '../types'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { shallowRef } from 'vue'
import { projectSnapshotFromEditorSession } from '../../project'

function matchesSnapshot(compilation: ProjectCompilation, snapshot: ProjectEditorSessionSnapshot): boolean {
  return (
    compilation.origin.kind === 'committed'
    && !('kind' in compilation.snapshot)
    && compilation.origin.editVersion === snapshot.editVersion
    && compilation.snapshot.document.id === snapshot.document.id
    && compilation.snapshot.contentHash === snapshot.contentHash
  )
}

export function createWorkbenchExportService(options: WorkbenchExportServiceOptions): WorkbenchExportService {
  const compilation = shallowRef<ProjectCompilation>()
  const diagnostics = shallowRef<readonly ModelDiagnostic[]>([])
  const resourceReader: SourceResourceReader = {
    async readEmbedded(input) {
      const bytes = await options.readEmbedded(input)
      return bytes
        ? { success: true, data: Uint8Array.from(bytes), diagnostics: [] }
        : {
            success: false,
            diagnostics: [
              {
                code: 'resource_missing',
                message: `Embedded Resource "${input.resourceId}" is unavailable.`,
                resourceId: input.resourceId,
              },
            ],
          }
    },
  }

  function sync(snapshot: ProjectEditorSessionSnapshot): void {
    if (!compilation.value || !matchesSnapshot(compilation.value, snapshot)) {
      compilation.value = undefined
      diagnostics.value = []
    }
  }

  function capture(): BuildExportSnapshotInput | undefined {
    const snapshot = options.getSnapshot()
    const adapter = options.getAdapter()
    if (!snapshot || !adapter) {
      diagnostics.value = [
        { code: 'EXPORT_NOT_READY', message: 'The project and runtime adapter must be ready before exporting.' },
      ]
      return undefined
    }
    diagnostics.value = []
    const current = compilation.value
    const next
      = current && matchesSnapshot(current, snapshot)
        ? current
        : (() => {
            const result = compileCanonicalProject({
              snapshot: projectSnapshotFromEditorSession(snapshot),
              registry: adapter.registrySnapshot,
            })
            if (!result.success) {
              diagnostics.value = result.diagnostics
              return undefined
            }
            compilation.value = result.compilation
            return result.compilation
          })()
    return next
      ? {
          compilation: next,
          bindingResolver: adapter.sourceBindingResolver,
          componentResolver: adapter.sourceComponentResolver,
          resourceReader,
        }
      : undefined
  }

  return {
    compilation,
    diagnostics,
    capture,
    clear() {
      compilation.value = undefined
      diagnostics.value = []
    },
    getCompilation: () => compilation.value,
    sync,
  }
}
