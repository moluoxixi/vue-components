import type { createDesignerLocale } from '@moluoxixi/config-form-designer'
import type { ProjectCommandAction, ProjectRepository } from '@moluoxixi/config-form-model'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { ProjectEditorSessionSnapshot, ProjectPersistenceSession } from '../../project'
import type { WorkbenchUiStore } from '../types'
import { loadWorkbenchAdapter } from '../../adapters'
import { createProjectEditorSession } from '../../project'

export function createWorkbenchProjectCommands(options: {
  busy: Ref<boolean>
  closeProject: () => Promise<void>
  currentProject: ComputedRef<ProjectEditorSessionSnapshot['document'] | undefined>
  executeProjectActions: (label: string, actions: ProjectCommandAction[]) => boolean
  getPersistenceSession: () => ProjectPersistenceSession | undefined
  hasUnsavedChanges: ComputedRef<boolean>
  openProject: (id: string) => Promise<void>
  refreshProjects: () => Promise<void>
  repository: ShallowRef<ProjectRepository | undefined>
  ui: WorkbenchUiStore
  workbenchLocale: ComputedRef<ReturnType<typeof createDesignerLocale>>
}) {
  const {
    busy,
    closeProject,
    currentProject,
    executeProjectActions,
    getPersistenceSession,
    hasUnsavedChanges,
    openProject,
    refreshProjects,
    repository,
    ui,
    workbenchLocale,
  } = options
  let commandSequence = 0

  async function renameProject(projectId: string, name: string): Promise<boolean> {
    const activeRepository = repository.value
    if (!activeRepository || busy.value)
      return false
    busy.value = true
    ui.clearMessage()
    try {
      if (currentProject.value?.id === projectId) {
        const changed = executeProjectActions('Rename project', [{
          type: 'operation.apply',
          operations: [{ type: 'project.rename', name }],
        }])
        if (!changed)
          return false
        const saved = await getPersistenceSession()?.flush()
        if (saved && !saved.success)
          throw new Error(saved.error.message)
      }
      else {
        const persisted = await activeRepository.get(projectId)
        if (!persisted)
          throw new TypeError(`Project does not exist: ${projectId}`)
        const adapterId = persisted.document.registryLock.adapter
        if (adapterId !== 'antd-vue' && adapterId !== 'element-plus')
          throw new TypeError(`Unsupported Workbench adapter: ${adapterId}`)
        const adapter = await loadWorkbenchAdapter(adapterId)
        const session = createProjectEditorSession({
          project: persisted,
          registry: adapter.componentRegistry,
          repository: activeRepository,
        })
        const result = session.execute({
          id: `project-manager-rename-${++commandSequence}`,
          label: 'Rename project',
          actions: [{
            type: 'operation.apply',
            operations: [{ type: 'project.rename', name }],
          }],
        })
        if (!result.changed) {
          const message = result.diagnostics[0]?.message
          if (message)
            throw new TypeError(message)
          return false
        }
        const saved = await session.save({ sealHistoryGroup: true, source: 'manual' })
        if (!saved.success)
          throw new Error(saved.error.message)
      }
      await refreshProjects()
      return true
    }
    catch (error) {
      ui.notify(error)
      return false
    }
    finally {
      busy.value = false
    }
  }

  async function deleteProject(projectId: string): Promise<boolean> {
    const activeRepository = repository.value
    if (!activeRepository || busy.value)
      return false
    const deletingCurrent = currentProject.value?.id === projectId
    if (deletingCurrent && hasUnsavedChanges.value) {
      ui.notify(workbenchLocale.value.t(
        'project.deleteBlocked',
        'Save or resolve the current project before deleting it.',
      ))
      return false
    }
    busy.value = true
    ui.clearMessage()
    try {
      if (deletingCurrent)
        await closeProject()
      await activeRepository.delete(projectId)
      await refreshProjects()
      return true
    }
    catch (error) {
      if (deletingCurrent)
        await openProject(projectId).catch(() => undefined)
      ui.notify(error)
      return false
    }
    finally {
      busy.value = false
    }
  }

  return { deleteProject, renameProject }
}
