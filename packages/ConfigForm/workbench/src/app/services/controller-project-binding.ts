import type { createDesignerLocale } from '@moluoxixi/config-form-designer'
import type {
  PageGraph,
  ProjectChangeSet,
  ProjectCommand,
  ProjectCommandAction,
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
  currentPageId: Ref<string>
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
    currentPageId,
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
  let projectedPageId = ''

  function resolveCurrentPageId(
    snapshot: ProjectEditorSessionSnapshot,
    preferredId = currentPageId.value,
  ): string {
    const document = snapshot.document
    const page = (preferredId ? document.pagesById[preferredId] : undefined)
      ?? document.pagesById[document.homePageId]
      ?? document.pagesById[document.pageOrder[0]!]
    if (!page)
      throw new TypeError('PROJECT_PAGE_UNKNOWN: An editor session requires at least one page.')
    return page.id
  }

  function acceptProjectSnapshot(
    snapshot: ProjectEditorSessionSnapshot,
    changeSet?: ProjectChangeSet,
  ): void {
    const previous = projectSessionSnapshot.value
    const nextPageId = resolveCurrentPageId(snapshot)
    const pageChanged = previous?.document.id !== snapshot.document.id
      || projectedPageId !== nextPageId
    const modelChanged = pageChanged
      || previous?.editVersion !== snapshot.editVersion
      || previous?.contentHash !== snapshot.contentHash
    projectSessionSnapshot.value = snapshot
    currentPageId.value = nextPageId
    projectedPageId = nextPageId
    exportService.sync(snapshot)
    if (!modelChanged)
      return

    const projectPage = snapshot.document.pagesById[nextPageId]
    if (!projectPage)
      throw new TypeError(`Project snapshot does not contain the current page: ${nextPageId}`)

    // Compile only the active page before publishing either surface. Design
    // and Preview consume the exact same page program and Runtime plan.
    const compiled = designSession.accept(snapshot, nextPageId, changeSet)
    const adapter = currentAdapter.value
    if (!adapter)
      throw new TypeError('Workbench adapter is unavailable while publishing Preview.')
    previewSession.accept({
      adapter: adapter.registrySnapshot.adapter,
      compilation: compiled.compilation,
      editVersion: snapshot.editVersion,
      graph: projectPage.graph as PageGraph,
      pageId: nextPageId,
      projectId: snapshot.document.id,
      repositoryRevision: snapshot.repositoryRevision,
      runtime: compiled.runtime,
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
    preferredPageId: string,
    activeRepository: ProjectRepository,
    activate: () => void,
  ): Promise<void> {
    const nextPageId = resolveCurrentPageId(session.snapshot, preferredPageId)
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
        sessionId,
        onExternalRevision: async (resolution) => {
          if (resolution === 'reload' && !isDisposed() && projectSession.value === session)
            await openProject(session.snapshot.document.id, currentPageId.value)
        },
      })
      await disposeProjectPersistence()
      activate()
      unsubscribeProjectSession?.()
      projectSession.value = session
      currentPageId.value = nextPageId
      projectedPageId = ''
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

  function selectCurrentPage(pageId: string): boolean {
    const snapshot = projectSessionSnapshot.value
    if (!snapshot?.document.pagesById[pageId]) {
      configError.value = `Page does not exist: ${pageId}`
      return false
    }
    if (currentPageId.value === pageId)
      return false
    currentPageId.value = pageId
    configError.value = ''
    acceptProjectSnapshot(snapshot)
    return true
  }

  function executeProjectActions(
    label: string,
    actions: ProjectCommandAction[],
    mergeKey?: string,
  ): boolean {
    const session = projectSession.value
    if (!session)
      return false
    const result = session.execute({
      id: `project-${++projectCommandSequence}`,
      label,
      actions,
      ...(mergeKey ? { mergeKey } : {}),
    })
    configError.value = result.diagnostics[0]?.message ?? ''
    return result.changed
  }

  function executeProjectCommand(command: ProjectCommand) {
    const session = projectSession.value
    if (!session)
      return { changed: false, diagnostics: [] }
    const result = session.execute(command)
    configError.value = result.diagnostics[0]?.message ?? ''
    return { changed: result.changed, diagnostics: result.diagnostics }
  }

  async function refreshProjects(): Promise<void> {
    const activeRepository = repository.value
    if (!activeRepository)
      return
    const nextProjects = await activeRepository.list()
    if (!isDisposed() && repository.value === activeRepository)
      projects.value = nextProjects
  }

  async function openProject(id: string, pageId?: string): Promise<void> {
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
    const page = (pageId ? document.pagesById[pageId] : undefined)
      ?? document.pagesById[document.homePageId]
      ?? document.pagesById[document.pageOrder[0]!]
    if (!page)
      return
    const session = createProjectEditorSession({
      project,
      registry: adapter.componentRegistry,
      repository: activeRepository,
    })
    await bindProjectSession(session, page.id, activeRepository, () => {
      previewSession.clear('project-opened')
      configError.value = ''
      currentAdapter.value = adapter
      designSession.configure(adapter)
      exportService.clear()
    })
  }

  async function requestOpenProject(id: string, pageId?: string): Promise<void> {
    if (currentProject.value?.id === id) {
      if (pageId && currentPageId.value !== pageId)
        selectCurrentPage(pageId)
      return
    }
    if (hasUnsavedChanges.value) {
      ui.notify(workbenchLocale.value.t(
        'workbench.openBlocked',
        'Save or resolve the current project before opening another project.',
      ))
      return
    }
    await openProject(id, pageId)
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
    executeProjectCommand,
    getPersistenceSession,
    initializeRepository,
    invalidateOpenRequests,
    openProject,
    refreshProjects,
    requestOpenProject,
    selectCurrentPage,
  }
}
