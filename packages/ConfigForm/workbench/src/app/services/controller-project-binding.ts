import type { createDesignerLocale } from '@moluoxixi/config-form-designer'
import type {
  ProjectChangeSet,
  ProjectCommandAction,
  ProjectEmbeddedResourceWrite,
  ProjectRepository,
  ProjectSummary,
} from '@moluoxixi/config-form-model'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { WorkbenchAdapter } from '../../adapters'
import type {
  ProjectEditorSession,
  ProjectEditorSessionSnapshot,
  ProjectPersistenceSession,
  ProjectPersistenceSnapshot,
} from '../../project'
import type { PreviewSession, WorkbenchDesignSession, WorkbenchExportService } from '../../session'
import type { WorkbenchRecoveryDraftSummary, WorkbenchUiStore } from '../types'
import { initializePrototypeProjectSession } from '@moluoxixi/config-form-prototype-runtime/session'
import { loadWorkbenchAdapter } from '../../adapters'
import {
  createProjectCoordinationChannel,
  createProjectEditorSession,
  createProjectPersistenceSession,
} from '../../project'
import { createWorkbenchRecoveryDraftStore, discoverWorkspaceUrl, isHttpWorkbenchRepository, openWorkbenchProjectRepository } from './workspace-repository'

export function createWorkbenchProjectBinding(options: {
  configError: Ref<string>
  currentAdapter: ShallowRef<WorkbenchAdapter | undefined>
  currentSurfaceId: Ref<string>
  currentProject: ComputedRef<ProjectEditorSessionSnapshot['document'] | undefined>
  designSession: WorkbenchDesignSession
  exportService: WorkbenchExportService
  hasUnsavedChanges: ComputedRef<boolean>
  isDisposed: () => boolean
  listRecoveryDrafts: () => Promise<WorkbenchRecoveryDraftSummary[]>
  persistenceSnapshot: ShallowRef<ProjectPersistenceSnapshot | undefined>
  previewSession: PreviewSession
  projectSession: ShallowRef<ProjectEditorSession | undefined>
  projectSessionSnapshot: ShallowRef<ProjectEditorSessionSnapshot | undefined>
  projects: Ref<ProjectSummary[]>
  recoveryDrafts: ShallowRef<WorkbenchRecoveryDraftSummary[]>
  repository: ShallowRef<ProjectRepository | undefined>
  ui: WorkbenchUiStore
  workbenchLocale: ComputedRef<ReturnType<typeof createDesignerLocale>>
  storageInfo: Ref<{ mode: 'browser' | 'local', name: string, connected: boolean }>
}) {
  const {
    configError,
    currentAdapter,
    currentSurfaceId,
    currentProject,
    designSession,
    exportService,
    hasUnsavedChanges,
    isDisposed,
    listRecoveryDrafts,
    persistenceSnapshot,
    previewSession,
    projectSession,
    projectSessionSnapshot,
    projects,
    recoveryDrafts,
    repository,
    ui,
    workbenchLocale,
  } = options
  let openProjectRequestId = 0
  let projectCommandSequence = 0
  let unsubscribeProjectSession: (() => void) | undefined
  let unsubscribePersistenceSession: (() => void) | undefined
  let persistenceSession: ProjectPersistenceSession | undefined
  let projectSessionIdSequence = 0
  let previewSessionSequence = 0
  let projectedSurfaceId = ''

  function resolveCurrentSurfaceId(
    snapshot: ProjectEditorSessionSnapshot,
    preferredId = currentSurfaceId.value,
  ): string {
    const document = snapshot.document
    const page = (preferredId ? document.surfacesById[preferredId] : undefined)
      ?? document.surfacesById[document.homeSurfaceId]
      ?? document.surfacesById[document.surfaceOrder[0]!]
    return page?.id ?? ''
  }

  function acceptProjectSnapshot(
    snapshot: ProjectEditorSessionSnapshot,
    changeSet?: ProjectChangeSet,
  ): void {
    const previous = projectSessionSnapshot.value
    const nextSurfaceId = resolveCurrentSurfaceId(snapshot)
    const pageChanged = previous?.document.id !== snapshot.document.id
      || projectedSurfaceId !== nextSurfaceId
    const modelChanged = pageChanged
      || previous?.editVersion !== snapshot.editVersion
      || previous?.contentHash !== snapshot.contentHash
    projectSessionSnapshot.value = snapshot
    currentSurfaceId.value = nextSurfaceId
    projectedSurfaceId = nextSurfaceId
    exportService.sync(snapshot)
    if (!nextSurfaceId) {
      configError.value = ''
      designSession.clear()
      previewSession.clear()
      return
    }
    if (!modelChanged)
      return

    designSession.accept(snapshot, nextSurfaceId, changeSet)
    // A project may start with a dialog or drawer. Its design can be saved
    // before a navigable home page exists for the project experience.
    if (!snapshot.document.homeSurfaceId) {
      previewSession.clear()
      return
    }
    const capture = exportService.capture()
    if (!capture) {
      previewSession.clear()
      if (!configError.value)
        configError.value = 'Preview project compilation failed.'
      return
    }

    const sequence = ++previewSessionSequence
    let rowIdSequence = 0
    const homeInstanceId = `preview-home-${sequence}`
    const initialized = initializePrototypeProjectSession({
      compilation: capture.compilation,
      homeInstanceId,
      createRowId: () => `preview-row-${sequence}-${++rowIdSequence}`,
    })
    if (!initialized.success) {
      previewSession.clear()
      configError.value = initialized.diagnostics[0]?.message
        ?? 'Preview Prototype Session initialization failed.'
      return
    }

    const revision = [
      capture.compilation.key.compilerVersion,
      capture.compilation.key.environmentHash,
      capture.compilation.key.irHash,
    ].join(':')
    previewSession.accept({
      compilation: capture.compilation,
      revision,
      session: initialized.data,
      sessionId: `${snapshot.document.id}:preview:${sequence}`,
    })

    if (pageChanged)
      designSession.selectedIds.value = []
  }

  async function disposeProjectPersistence(): Promise<void> {
    unsubscribePersistenceSession?.()
    unsubscribePersistenceSession = undefined
    const active = persistenceSession
    persistenceSession = undefined
    persistenceSnapshot.value = undefined
    if (active)
      await active.dispose()
  }

  async function bindProjectSession(
    session: ProjectEditorSession,
    preferredSurfaceId: string,
    activeRepository: ProjectRepository,
    activate: () => void,
    canActivate: () => boolean = () => true,
  ): Promise<boolean> {
    const nextSurfaceId = resolveCurrentSurfaceId(session.snapshot, preferredSurfaceId)
    const sessionId = `${session.snapshot.document.id}:workbench:${++projectSessionIdSequence}:${Date.now().toString(36)}`
    const draftStore = createWorkbenchRecoveryDraftStore(activeRepository)
    let coordination: ReturnType<typeof createProjectCoordinationChannel> | undefined
    let nextPersistenceSession: ProjectPersistenceSession | undefined
    try {
      if ('open' in draftStore)
        await draftStore.open()
      if (!canActivate()) {
        draftStore.close()
        return false
      }
      coordination = createProjectCoordinationChannel({
        projectId: session.snapshot.document.id,
        sessionId,
        ...(isHttpWorkbenchRepository(activeRepository) ? { namespace: activeRepository.workspaceId } : {}),
      })
      nextPersistenceSession = createProjectPersistenceSession({
        coordination,
        draftStore,
        editor: session,
        readEmbedded: input => session.readEmbedded(input),
        sessionId,
        onExternalRevision: async (resolution) => {
          if (resolution === 'reload' && !isDisposed() && projectSession.value === session)
            await openProject(session.snapshot.document.id, currentSurfaceId.value, session)
        },
      })
      const previousPersistenceSession = persistenceSession
      activate()
      unsubscribePersistenceSession?.()
      unsubscribeProjectSession?.()
      projectSession.value = session
      currentSurfaceId.value = nextSurfaceId
      projectedSurfaceId = ''
      unsubscribeProjectSession = session.subscribe(acceptProjectSnapshot)
      persistenceSession = nextPersistenceSession
      unsubscribePersistenceSession = nextPersistenceSession.subscribe((snapshot) => {
        persistenceSnapshot.value = snapshot
      })
      await previousPersistenceSession?.dispose().catch(error => ui.notify(error))
    }
    catch (error) {
      if (nextPersistenceSession) {
        await nextPersistenceSession.dispose()
      }
      else {
        draftStore.close()
        coordination?.close()
      }
      throw error
    }
    try {
      recoveryDrafts.value = await listRecoveryDrafts()
    }
    catch (error) {
      recoveryDrafts.value = []
      ui.notify(error)
    }
    return true
  }

  function selectCurrentSurface(surfaceId: string): boolean {
    const snapshot = projectSessionSnapshot.value
    if (!snapshot?.document.surfacesById[surfaceId]) {
      configError.value = `Surface does not exist: ${surfaceId}`
      return false
    }
    if (currentSurfaceId.value === surfaceId)
      return false
    currentSurfaceId.value = surfaceId
    configError.value = ''
    acceptProjectSnapshot(snapshot)
    return true
  }

  function executeProjectActions(
    label: string,
    actions: ProjectCommandAction[],
    mergeKey?: string,
    embeddedWrites: readonly ProjectEmbeddedResourceWrite[] = [],
  ): boolean {
    const session = projectSession.value
    if (!session)
      return false
    const result = session.execute({
      id: `project-${++projectCommandSequence}`,
      label,
      actions,
      ...(mergeKey ? { mergeKey } : {}),
    }, { embeddedWrites })
    configError.value = result.diagnostics[0]?.message ?? ''
    return result.changed
  }

  async function refreshProjects(): Promise<void> {
    const activeRepository = repository.value
    if (!activeRepository)
      return
    const nextProjects = await activeRepository.list()
    if (!isDisposed() && repository.value === activeRepository)
      projects.value = nextProjects
  }

  async function openProject(id: string, surfaceId?: string, externalBase?: ProjectEditorSession): Promise<void> {
    const requestId = ++openProjectRequestId
    const baseEditVersion = externalBase?.snapshot.editVersion
    const activeRepository = repository.value
    if (!activeRepository)
      return
    const project = await activeRepository.get(id)
    if (
      !project
      || isDisposed()
      || requestId !== openProjectRequestId
      || activeRepository !== repository.value
    ) {
      return
    }
    const document = project.document
    const adapterId = document.registryLock.adapter
    if (adapterId !== 'antd-vue' && adapterId !== 'element-plus')
      throw new TypeError(`Unsupported Workbench adapter: ${adapterId}`)
    const adapter = await loadWorkbenchAdapter(adapterId)
    if (
      isDisposed()
      || requestId !== openProjectRequestId
      || activeRepository !== repository.value
    ) {
      return
    }
    const page = (surfaceId ? document.surfacesById[surfaceId] : undefined)
      ?? document.surfacesById[document.homeSurfaceId]
      ?? document.surfacesById[document.surfaceOrder[0]!]
    const session = createProjectEditorSession({
      project,
      registry: adapter.componentRegistry,
      repository: activeRepository,
    })
    function canActivate(): boolean {
      if (isDisposed() || requestId !== openProjectRequestId || activeRepository !== repository.value)
        return false
      if (!externalBase)
        return true
      if (projectSession.value !== externalBase)
        return false
      return externalBase.snapshot.editVersion === baseEditVersion && !hasUnsavedChanges.value
    }
    const activated = canActivate() && await bindProjectSession(session, page?.id ?? '', activeRepository, () => {
      previewSession.clear()
      configError.value = ''
      currentAdapter.value = adapter
      designSession.configure(adapter)
      exportService.clear()
    }, canActivate)
    if (!activated && externalBase && projectSession.value === externalBase) {
      await persistenceSession?.notifyExternalRevision(project.repositoryRevision)
      ui.notify('外部保存期间产生了本地编辑，已保留当前草稿。请保存为新项目或重新加载已保存版本。')
    }
  }

  async function requestOpenProject(id: string, surfaceId?: string): Promise<void> {
    if (currentProject.value?.id === id) {
      if (surfaceId && currentSurfaceId.value !== surfaceId)
        selectCurrentSurface(surfaceId)
      return
    }
    if (hasUnsavedChanges.value) {
      ui.notify(workbenchLocale.value.t(
        'workbench.openBlocked',
        'Save or resolve the current project before opening another project.',
      ))
      return
    }
    await openProject(id, surfaceId)
  }

  async function closeProject(): Promise<void> {
    openProjectRequestId += 1
    disposeProjectSubscription()
    await disposeProjectPersistence()
    projectSession.value = undefined
    projectSessionSnapshot.value = undefined
    persistenceSnapshot.value = undefined
    currentSurfaceId.value = ''
    projectedSurfaceId = ''
    currentAdapter.value = undefined
    recoveryDrafts.value = []
    configError.value = ''
    designSession.clear()
    exportService.clear()
    previewSession.clear()
  }

  async function initializeRepository(): Promise<void> {
    const workspaceUrl = await discoverWorkspaceUrl()
    if (workspaceUrl)
      options.storageInfo.value = { mode: 'local', name: new URL(workspaceUrl).host, connected: false }
    const openedRepository = await openWorkbenchProjectRepository()
    if (isDisposed()) {
      openedRepository.close()
      return
    }
    repository.value = openedRepository
    if (isHttpWorkbenchRepository(openedRepository)) {
      options.storageInfo.value = { mode: 'local', name: openedRepository.workspaceName, connected: true }
      openedRepository.subscribeConnection(connected => options.storageInfo.value = { ...options.storageInfo.value, connected })
      let changes: Promise<void> = Promise.resolve()
      openedRepository.subscribeChanges((change) => {
        changes = changes.then(async () => {
          if (isDisposed() || repository.value !== openedRepository)
            return
          await refreshProjects()
          const active = projectSession.value
          if (!active || (change.projectId && change.projectId !== active.snapshot.document.id))
            return
          const latest = await openedRepository.get(active.snapshot.document.id)
          if (!latest) {
            if (hasUnsavedChanges.value) {
              await persistenceSession?.notifyExternalRevision(Number.MAX_SAFE_INTEGER)
              ui.notify('The project was deleted in another client. Save the local draft as a new project.')
            }
            else {
              await closeProject()
            }
            return
          }
          const resolution = await persistenceSession?.notifyExternalRevision(latest.repositoryRevision)
          if (resolution === 'reload' && projectSession.value === active)
            await openProject(active.snapshot.document.id, currentSurfaceId.value, active)
        }).catch(error => ui.notify(error))
      })
    }
    await refreshProjects()
    if (isDisposed() || repository.value !== openedRepository)
      return
    const first = projects.value[0]
    if (first)
      await openProject(first.id)
  }

  function invalidateOpenRequests(): void {
    openProjectRequestId += 1
  }

  function disposeProjectSubscription(): void {
    unsubscribeProjectSession?.()
    unsubscribeProjectSession = undefined
  }

  function getPersistenceSession(): ProjectPersistenceSession | undefined {
    return persistenceSession
  }

  return {
    closeProject,
    disposeProjectPersistence,
    disposeProjectSubscription,
    executeProjectActions,
    getPersistenceSession,
    initializeRepository,
    invalidateOpenRequests,
    openProject,
    refreshProjects,
    requestOpenProject,
    selectCurrentSurface,
  }
}
