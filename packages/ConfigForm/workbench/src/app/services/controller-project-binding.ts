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
  createIndexedDBProjectRecoveryDraftStore,
  createMemoryProjectRecoveryDraftStore,
  createProjectCoordinationChannel,
  createProjectEditorSession,
  createProjectPersistenceSession,
  openDefaultProjectRepository,
} from '../../project'

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
    if (!page)
      throw new TypeError('PROJECT_PAGE_UNKNOWN: An editor session requires at least one page.')
    return page.id
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
    if (!modelChanged)
      return

    designSession.accept(snapshot, nextSurfaceId, changeSet)
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
  ): Promise<void> {
    const nextSurfaceId = resolveCurrentSurfaceId(session.snapshot, preferredSurfaceId)
    const sessionId = `${session.snapshot.document.id}:workbench:${++projectSessionIdSequence}:${Date.now().toString(36)}`
    const draftStore = activeRepository.persistence === 'durable'
      ? createIndexedDBProjectRecoveryDraftStore()
      : createMemoryProjectRecoveryDraftStore()
    let coordination: ReturnType<typeof createProjectCoordinationChannel> | undefined
    let nextPersistenceSession: ProjectPersistenceSession | undefined
    try {
      if ('open' in draftStore)
        await draftStore.open()
      coordination = createProjectCoordinationChannel({
        projectId: session.snapshot.document.id,
        sessionId,
      })
      nextPersistenceSession = createProjectPersistenceSession({
        coordination,
        draftStore,
        editor: session,
        readEmbedded: input => session.readEmbedded(input),
        sessionId,
        onExternalRevision: async (resolution) => {
          if (resolution === 'reload' && !isDisposed() && projectSession.value === session)
            await openProject(session.snapshot.document.id, currentSurfaceId.value)
        },
      })
      await disposeProjectPersistence()
      activate()
      unsubscribeProjectSession?.()
      projectSession.value = session
      currentSurfaceId.value = nextSurfaceId
      projectedSurfaceId = ''
      unsubscribeProjectSession = session.subscribe(acceptProjectSnapshot)
      persistenceSession = nextPersistenceSession
      unsubscribePersistenceSession = nextPersistenceSession.subscribe((snapshot) => {
        persistenceSnapshot.value = snapshot
      })
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

  async function openProject(id: string, surfaceId?: string): Promise<void> {
    const requestId = ++openProjectRequestId
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
    if (!page)
      return
    const session = createProjectEditorSession({
      project,
      registry: adapter.componentRegistry,
      repository: activeRepository,
    })
    await bindProjectSession(session, page.id, activeRepository, () => {
      previewSession.clear()
      configError.value = ''
      currentAdapter.value = adapter
      designSession.configure(adapter)
      exportService.clear()
    })
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

  async function initializeRepository(): Promise<void> {
    const openedRepository = await openDefaultProjectRepository({})
    if (isDisposed()) {
      openedRepository.close()
      return
    }
    repository.value = openedRepository
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
