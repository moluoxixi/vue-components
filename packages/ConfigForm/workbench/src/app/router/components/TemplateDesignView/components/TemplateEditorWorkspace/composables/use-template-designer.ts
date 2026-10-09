import type { ProjectSurface } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapter } from '../../../../../../../adapters'
import type { ProjectEditorSession, ProjectEditorSessionSnapshot, ProjectTemplateCatalogEntry } from '../../../../../../../project'
import { createMemoryProjectRepository } from '@moluoxixi/config-form-model'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { loadWorkbenchAdapter } from '../../../../../../../adapters'
import { createProjectEditorSession, instantiateTemplateSurfacePreviewProject } from '../../../../../../../project'
import { createWorkbenchDesignSession } from '../../../../../../../session'

/** The template owns an isolated command/history session, not a user project. */
export function useTemplateDesigner(template: ProjectTemplateCatalogEntry) {
  const adapter = shallowRef<WorkbenchAdapter>()
  const snapshot = shallowRef<ProjectEditorSessionSnapshot>()
  const surfaceId = ref('')
  const error = ref('')
  const repository = createMemoryProjectRepository()
  let session: ProjectEditorSession | undefined
  let unsubscribe: (() => void) | undefined
  let disposed = false
  const design = createWorkbenchDesignSession({
    getAdapter: () => adapter.value,
    getProjectSession: () => session,
    getSnapshot: () => snapshot.value,
    getSurfaceId: () => surfaceId.value,
    setDiagnostic: message => error.value = message,
  })
  const surface = computed(() => snapshot.value?.document.surfacesById[surfaceId.value] as ProjectSurface | undefined)

  onMounted(async () => {
    try {
      const loaded = await loadWorkbenchAdapter(template.manifest.adapter)
      if (disposed)
        return
      const workspace = instantiateTemplateSurfacePreviewProject(template, loaded.componentRegistry.lock)
      const project = await repository.create({ document: workspace.document, embeddedContents: [] })
      if (disposed)
        return
      adapter.value = loaded
      surfaceId.value = workspace.surfaceId
      session = createProjectEditorSession({ project, repository, registry: loaded.componentRegistry })
      design.configure(loaded)
      snapshot.value = session.snapshot
      design.accept(session.snapshot, surfaceId.value)
      unsubscribe = session.subscribe((next, changeSet) => {
        snapshot.value = next
        design.accept(next, surfaceId.value, changeSet)
      })
    }
    catch (reason) {
      if (!disposed)
        error.value = reason instanceof Error ? reason.message : String(reason)
    }
  })

  onBeforeUnmount(() => {
    disposed = true
    unsubscribe?.()
    design.dispose()
    repository.close()
  })

  return { adapter, design, error, snapshot, surface, surfaceId }
}
