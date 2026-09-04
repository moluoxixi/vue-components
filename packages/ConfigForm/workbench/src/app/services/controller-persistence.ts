import type { createDesignerLocale } from '@moluoxixi/config-form-designer'
import type { ProjectDocument, ProjectRepository, ProjectVersionSummary } from '@moluoxixi/config-form-model'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type {
  ProjectEditorSession,
  ProjectEditorSessionSnapshot,
  ProjectPersistenceSession,
} from '../../project'
import type { WorkbenchRecoveryDraftSummary, WorkbenchUiStore } from '../types'
import {
  createIndexedDBProjectRecoveryDraftStore,
  createMemoryProjectRecoveryDraftStore,
} from '../../project'

export function createWorkbenchPersistenceCommands(options: {
  busy: Ref<boolean>
  configError: Ref<string>
  currentPageId: Ref<string>
  currentProject: ComputedRef<ProjectEditorSessionSnapshot['document'] | undefined>
  disposeProjectPersistence: () => Promise<void>
  getPersistenceSession: () => ProjectPersistenceSession | undefined
  openProject: (id: string, pageId?: string) => Promise<void>
  projectSession: ShallowRef<ProjectEditorSession | undefined>
  recoveryDrafts: ShallowRef<WorkbenchRecoveryDraftSummary[]>
  refreshProjects: () => Promise<void>
  repository: ShallowRef<ProjectRepository | undefined>
  repositoryRevision: ComputedRef<number>
  ui: WorkbenchUiStore
  workbenchLocale: ComputedRef<ReturnType<typeof createDesignerLocale>>
}) {
  const {
    busy,
    configError,
    currentPageId,
    currentProject,
    disposeProjectPersistence,
    getPersistenceSession,
    openProject,
    projectSession,
    recoveryDrafts,
    refreshProjects,
    repository,
    repositoryRevision,
    ui,
    workbenchLocale,
  } = options

  async function saveProject(): Promise<void> {
    const activePersistence = getPersistenceSession()
    if (!activePersistence || !repository.value || configError.value || busy.value)
      return
    busy.value = true
    ui.clearMessage()
    try {
      const result = await activePersistence.flush()
      if (!result)
        return
      if (!result.success) {
        ui.notify(result.error.message)
        return
      }
      await refreshProjects()
      ui.notify(result.newerEdits
        ? workbenchLocale.value.t(
            'workbench.savedWithNewer',
            'Saved revision {revision}; newer edits remain unsaved',
            { revision: result.repositoryRevision },
          )
        : workbenchLocale.value.t('workbench.saved', 'Saved revision {revision}', { revision: result.repositoryRevision }))
    }
    catch (error) {
      ui.notify(error)
    }
    finally {
      busy.value = false
    }
  }

  async function createNamedCheckpoint(label: string): Promise<void> {
    const activePersistence = getPersistenceSession()
    if (!activePersistence || configError.value || busy.value)
      return
    busy.value = true
    ui.clearMessage()
    try {
      const result = await activePersistence.createNamedCheckpoint(label)
      if (!result)
        return
      if (!result.success) {
        ui.notify(result.error.message)
        return
      }
      await refreshProjects()
      ui.notify(workbenchLocale.value.t(
        'workbench.checkpointCreated',
        'Created checkpoint “{label}” at v{revision}',
        { label: label.trim(), revision: result.repositoryRevision },
      ))
    }
    catch (error) {
      ui.notify(error)
    }
    finally {
      busy.value = false
    }
  }

  async function listProjectVersions(): Promise<ProjectVersionSummary[]> {
    const projectId = currentProject.value?.id
    return projectId && repository.value
      ? await repository.value.listVersions(projectId)
      : []
  }

  async function setProjectVersionLabel(revision: number, label?: string): Promise<void> {
    const projectId = currentProject.value?.id
    const activeRepository = repository.value
    if (!projectId || !activeRepository)
      return
    await activeRepository.setVersionLabel({
      projectId,
      revision,
      ...(label !== undefined ? { label } : {}),
      expectedRepositoryRevision: repositoryRevision.value,
    })
  }

  async function inspectProjectVersion(revision: number) {
    const projectId = currentProject.value?.id
    return projectId && repository.value
      ? await repository.value.getVersion(projectId, revision)
      : undefined
  }

  async function restoreProjectVersion(revision: number): Promise<void> {
    const projectId = currentProject.value?.id
    const activeRepository = repository.value
    const activePersistence = getPersistenceSession()
    if (!projectId || !activeRepository || !activePersistence || busy.value)
      return
    busy.value = true
    try {
      const flushed = await activePersistence.flush()
      if (flushed && !flushed.success)
        throw new Error(flushed.error.message)
      const version = await activeRepository.getVersion(projectId, revision)
      if (!version)
        throw new Error(`Project version does not exist: ${projectId}@${revision}`)
      const expectedRepositoryRevision = projectSession.value?.snapshot.repositoryRevision
      if (expectedRepositoryRevision === undefined)
        return
      await disposeProjectPersistence()
      await activeRepository.commit({
        commandId: `${projectId}:restore:${revision}:${Date.now().toString(36)}`,
        document: version.document,
        expectedRepositoryRevision,
        id: projectId,
        metadata: { source: 'restore', restoredFromRevision: revision },
      })
      await openProject(projectId, currentPageId.value)
      await refreshProjects()
    }
    catch (error) {
      ui.notify(error)
    }
    finally {
      busy.value = false
    }
  }

  async function openRecoveryDraftStore() {
    const activeRepository = repository.value
    if (!activeRepository)
      return undefined
    const store = activeRepository.persistence === 'durable'
      ? createIndexedDBProjectRecoveryDraftStore()
      : createMemoryProjectRecoveryDraftStore()
    if ('open' in store)
      await store.open()
    return store
  }

  async function listRecoveryDrafts(): Promise<WorkbenchRecoveryDraftSummary[]> {
    const store = await openRecoveryDraftStore()
    if (!store)
      return []
    try {
      const drafts = await store.list(currentProject.value?.id)
      return await Promise.all(drafts
        .filter(draft => draft.draftId !== getPersistenceSession()?.draftId)
        .map(async draft => ({
          ...draft,
          presence: await (getPersistenceSession()?.querySessionPresence(draft.sessionId)
            ?? Promise.resolve('unknown' as const)),
        })))
    }
    finally {
      store.close()
    }
  }

  async function discardRecoveryDraft(draftId: string): Promise<void> {
    const store = await openRecoveryDraftStore()
    if (!store)
      return
    try {
      await store.delete(draftId)
      recoveryDrafts.value = recoveryDrafts.value.filter(draft => draft.draftId !== draftId)
    }
    finally {
      store.close()
    }
  }

  async function restoreRecoveryDraft(draftId: string): Promise<void> {
    const activeRepository = repository.value
    const projectId = currentProject.value?.id
    if (!activeRepository || !projectId || busy.value)
      return
    busy.value = true
    const store = await openRecoveryDraftStore()
    try {
      const draft = await store?.get(draftId)
      const latest = await activeRepository.get(projectId)
      if (!draft || !latest)
        throw new Error('Recovery draft is no longer available.')
      if (draft.projectId !== projectId
        || draft.baseRepositoryRevision !== latest.repositoryRevision) {
        throw new Error('Recovery draft is based on another project revision and cannot be applied automatically.')
      }
      await disposeProjectPersistence()
      await activeRepository.commit({
        commandId: `${projectId}:recover:${draft.editVersion}:${Date.now().toString(36)}`,
        document: draft.document,
        expectedRepositoryRevision: latest.repositoryRevision,
        id: projectId,
        metadata: { source: 'manual', label: 'Recovered draft' },
      })
      await store?.delete(draftId)
      await openProject(projectId, currentPageId.value)
      await refreshProjects()
      recoveryDrafts.value = recoveryDrafts.value.filter(draft => draft.draftId !== draftId)
    }
    catch (error) {
      ui.notify(error)
    }
    finally {
      store?.close()
      busy.value = false
    }
  }

  async function reloadCurrentProject(): Promise<void> {
    const projectId = currentProject.value?.id
    const pageId = currentPageId.value
    if (!projectId || busy.value)
      return
    busy.value = true
    ui.clearMessage()
    try {
      const discardedDraftId = getPersistenceSession()?.draftId
      await openProject(projectId, pageId)
      if (discardedDraftId)
        await discardRecoveryDraft(discardedDraftId)
      ui.notify(workbenchLocale.value.t('recovery.reloaded', 'Reloaded the latest saved revision'))
    }
    catch (error) {
      ui.notify(error)
    }
    finally {
      busy.value = false
    }
  }

  async function saveCurrentDraftAsProject(): Promise<void> {
    const activeRepository = repository.value
    const document = currentProject.value
    const pageId = currentPageId.value
    if (!activeRepository || !document || busy.value)
      return
    busy.value = true
    try {
      await getPersistenceSession()?.handleVisibilityHidden()
      const oldDraftId = getPersistenceSession()?.draftId
      const id = `${document.id}-recovered-${Date.now().toString(36)}`
      const fork: ProjectDocument = structuredClone(document) as ProjectDocument
      fork.id = id
      fork.name = `${document.name} recovered`
      await activeRepository.create({ document: fork })
      await refreshProjects()
      await openProject(id, pageId)
      if (oldDraftId)
        await discardRecoveryDraft(oldDraftId)
      ui.notify(workbenchLocale.value.t(
        'recovery.savedAsProject',
        'Saved local draft as “{name}”',
        { name: fork.name },
      ))
    }
    catch (error) {
      ui.notify(error)
    }
    finally {
      busy.value = false
    }
  }

  return {
    createNamedCheckpoint,
    discardRecoveryDraft,
    inspectProjectVersion,
    listProjectVersions,
    listRecoveryDrafts,
    reloadCurrentProject,
    restoreProjectVersion,
    restoreRecoveryDraft,
    saveCurrentDraftAsProject,
    saveProject,
    setProjectVersionLabel,
  }
}
