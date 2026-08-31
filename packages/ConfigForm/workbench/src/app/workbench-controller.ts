import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type {
  PageGraph,
  ProjectChangeSet,
  ProjectCommand,
  ProjectCommandAction,
  ProjectDocument,
  ProjectRepository,
  ProjectSummary,
  ProjectVersionSummary,
} from '@moluoxixi/config-form-model'
import type { WorkbenchAdapter, WorkbenchAdapterId } from '../adapters'
import type {
  ProjectEditorSession,
  ProjectEditorSessionSnapshot,
  ProjectPageAction,
  ProjectPersistenceSession,
  ProjectPersistenceSnapshot,
  ProjectRecoveryDraftSummary,
} from '../project'
import type { StudioLayerEntry } from '../studio/StudioLeftPanel.vue'
import type { WorkbenchUiStore } from './workbench-ui-store'
import {
  createDesignerLocale,
  walkDesignGraph,
} from '@moluoxixi/config-form-designer'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { loadWorkbenchAdapter } from '../adapters'
import { collectFlowEventTargets } from '../flow/event-targets'
import {
  createWorkbenchLocaleOptions,
} from '../locale'
import {
  BUILT_IN_PROJECT_TEMPLATES,
  createBuiltInProject,
  createBuiltInProjectPage,
  createIndexedDBProjectRecoveryDraftStore,
  createMemoryProjectRecoveryDraftStore,
  createProjectCoordinationChannel,
  createProjectEditorSession,
  createProjectPersistenceSession,
  duplicateProjectPage,
  nextProjectPageId,
  nextProjectPageRoute,
  openDefaultProjectRepository,
} from '../project'
import {
  createWorkbenchDesignSession,
  createWorkbenchExportService,
  createWorkbenchPreviewSession,
} from '../session'

export interface WorkbenchControllerProps {
  locale?: DesignerLocaleOptions
}

export interface WorkbenchRecoveryNotice {
  action?: 'fork' | 'reload' | 'versions'
  actionLabel?: string
  message: string
  secondaryAction?: 'fork' | 'reload' | 'versions'
  secondaryActionLabel?: string
  tertiaryAction?: 'fork' | 'reload' | 'versions'
  tertiaryActionLabel?: string
  tone: 'error' | 'warning'
}

export interface WorkbenchRecoveryDraftSummary extends ProjectRecoveryDraftSummary {
  presence: 'active' | 'inactive' | 'unknown'
}

export function createWorkbenchController(
  props: Readonly<WorkbenchControllerProps>,
  ui: WorkbenchUiStore,
) {
  const repository = shallowRef<ProjectRepository>()
  const currentAdapter = shallowRef<WorkbenchAdapter>()
  const projects = ref<ProjectSummary[]>([])
  const projectSession = shallowRef<ProjectEditorSession>()
  const projectSessionSnapshot = shallowRef<ProjectEditorSessionSnapshot>()
  const persistenceSnapshot = shallowRef<ProjectPersistenceSnapshot>()
  const recoveryDrafts = shallowRef<WorkbenchRecoveryDraftSummary[]>([])
  const currentPageId = ref('')
  const configError = ref('')
  const busy = ref(false)
  let openProjectRequestId = 0
  let projectCommandSequence = 0
  let disposed = false
  let unsubscribeProjectSession: (() => void) | undefined
  let unsubscribePersistenceSession: (() => void) | undefined
  let persistenceSession: ProjectPersistenceSession | undefined
  let projectSessionIdSequence = 0
  let disposePromise: Promise<void> | undefined
  let projectedPageId = ''
  const previewSession = createWorkbenchPreviewSession({
    onNotify: ui.notify,
    onDiagnostic: diagnostic => ui.notify(diagnostic.message),
  })
  const previewProjection = previewSession.projection
  const designSession = createWorkbenchDesignSession({
    getAdapter: () => currentAdapter.value,
    getPageId: () => currentPageId.value,
    getProjectSession: () => projectSession.value,
    getSnapshot: () => projectSessionSnapshot.value,
    setDiagnostic: message => configError.value = message,
  })
  const exportService = createWorkbenchExportService({
    getAdapter: () => currentAdapter.value,
    getSnapshot: () => projectSessionSnapshot.value,
  })
  const localeOptions = computed(() => createWorkbenchLocaleOptions(
    ui.localeId.value,
    currentAdapter.value?.locale,
    props.locale,
  ))
  const workbenchLocale = computed(() => createDesignerLocale(localeOptions.value))
  const currentProject = computed(() => projectSessionSnapshot.value?.document)
  const currentProjectPage = computed(() => projectSessionSnapshot.value?.document.pagesById[currentPageId.value])
  const currentPage = computed(() => currentProjectPage.value
    ? structuredClone(currentProjectPage.value) as ProjectDocument['pagesById'][string]
    : undefined)
  const currentGraph = computed<PageGraph | undefined>(() => currentPage.value?.graph)
  const componentRegistry = computed(() => currentAdapter.value!.componentRegistry)
  const registry = computed(() => currentAdapter.value!.designerRegistry)
  const modelRevision = computed(() => projectSessionSnapshot.value?.editVersion ?? 0)
  const repositoryRevision = computed(() => projectSessionSnapshot.value?.repositoryRevision ?? 0)
  const dirty = computed(() => projectSessionSnapshot.value?.dirty ?? false)
  const designerLayers = computed<StudioLayerEntry[]>(() => {
    const entries: StudioLayerEntry[] = []
    const graph = currentGraph.value
    if (!graph)
      return entries
    walkDesignGraph(graph, ({ node, path }) => entries.push({
      id: node.id,
      label: node.kind === 'field'
        ? node.label ?? node.field
        : registry.value.getMaterial(node.component)?.title ?? node.component,
      component: node.component,
      depth: path.filter(segment => segment === 'slots').length,
    }))
    return entries
  })
  const designerFieldNames = computed<string[]>(() => {
    const fields: string[] = []
    const graph = currentGraph.value
    if (graph) {
      walkDesignGraph(graph, ({ node }) => {
        if (node.kind === 'field')
          fields.push(node.field)
      })
    }
    return [...new Set(fields)]
  })
  const flowEventTargets = computed(() => collectFlowEventTargets(
    currentGraph.value,
    currentAdapter.value?.componentRegistry,
    currentAdapter.value?.designerRegistry,
    { valueChange: workbenchLocale.value.t('flow.trigger.valueChange', 'Value change') },
  ))

  function getCurrentAdapterId(): WorkbenchAdapterId {
    const adapter = currentAdapter.value?.registrySnapshot.adapter
    if (adapter === 'antd-vue' || adapter === 'element-plus')
      return adapter
    throw new TypeError('Workbench adapter is unavailable.')
  }
  const previewState = computed(() => {
    const projection = previewProjection.value
    if (configError.value || projection?.status === 'stale') {
      return {
        label: workbenchLocale.value.t('preview.staleAt', 'Stale at r{revision}', {
          revision: projection?.display?.snapshot.editVersion ?? modelRevision.value,
        }),
        tone: 'error' as const,
      }
    }
    if (!projection || projection.status === 'blocked')
      return { label: workbenchLocale.value.t('preview.blocked', 'Blocked'), tone: 'error' as const }
    return {
      label: dirty.value
        ? workbenchLocale.value.t('preview.liveDraft', 'Live draft')
        : workbenchLocale.value.t('preview.live', 'Live'),
      tone: 'live' as const,
    }
  })
  const hasUnsavedChanges = computed(() => dirty.value || !!configError.value)
  const workspaceRecoveryNotice = computed<WorkbenchRecoveryNotice | undefined>(() => {
    if (persistenceSnapshot.value?.status === 'conflict') {
      return {
        action: 'versions',
        actionLabel: workbenchLocale.value.t('recovery.viewLatest', 'View latest'),
        secondaryAction: 'fork',
        secondaryActionLabel: workbenchLocale.value.t('recovery.saveAsProject', 'Save draft as new project'),
        tertiaryAction: 'reload',
        tertiaryActionLabel: workbenchLocale.value.t('recovery.discardAndReload', 'Discard and reload'),
        message: workbenchLocale.value.t(
          'recovery.revisionConflict',
          'This project changed in another session. Your local work is preserved as a recovery draft. Reload the latest revision or save the draft as another project.',
        ),
        tone: 'error',
      }
    }
    if (repository.value?.persistence === 'volatile') {
      return {
        message: workbenchLocale.value.t(
          'recovery.volatile',
          'Persistent browser storage is unavailable. This temporary workspace will be lost when the page is refreshed.',
        ),
        tone: 'warning',
      }
    }
    return undefined
  })
  const statusLabel = computed(() => {
    if (!repository.value)
      return workbenchLocale.value.t('status.loading', 'Loading')
    switch (persistenceSnapshot.value?.status) {
      case 'saving': return workbenchLocale.value.t('status.saving', 'Autosaving')
      case 'pending': return workbenchLocale.value.t('status.pending', 'Changes pending')
      case 'failed': return workbenchLocale.value.t('status.failed', 'Autosave failed')
      case 'conflict': return workbenchLocale.value.t('status.conflict', 'External revision detected')
      case 'volatile': return workbenchLocale.value.t('status.temporary', 'Temporary session')
      case 'saved': return workbenchLocale.value.t('status.savedAuto', 'Autosaved')
      default: return repository.value.persistence === 'durable'
        ? workbenchLocale.value.t('status.savedAuto', 'Autosaved')
        : workbenchLocale.value.t('status.temporary', 'Temporary session')
    }
  })

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
  ): Promise<void> {
    await disposeProjectPersistence()
    unsubscribeProjectSession?.()
    projectSession.value = session
    currentPageId.value = resolveCurrentPageId(session.snapshot, preferredPageId)
    projectedPageId = ''
    unsubscribeProjectSession = session.subscribe(acceptProjectSnapshot)
    const sessionId = `${session.snapshot.document.id}:workbench:${++projectSessionIdSequence}:${Date.now().toString(36)}`
    const draftStore = activeRepository.persistence === 'durable'
      ? createIndexedDBProjectRecoveryDraftStore()
      : createMemoryProjectRecoveryDraftStore()
    if ('open' in draftStore)
      await draftStore.open()
    const coordination = createProjectCoordinationChannel({
      projectId: session.snapshot.document.id,
      sessionId,
    })
    persistenceSession = createProjectPersistenceSession({
      coordination,
      draftStore,
      editor: session,
      sessionId,
      onExternalRevision: async (resolution) => {
        if (resolution === 'reload' && !disposed)
          await openProject(session.snapshot.document.id, currentPageId.value)
      },
    })
    unsubscribePersistenceSession = persistenceSession.subscribe((snapshot) => {
      persistenceSnapshot.value = snapshot
    })
    recoveryDrafts.value = await listRecoveryDrafts()
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
    if (!disposed && repository.value === activeRepository)
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
      || disposed
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
      disposed
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
    previewSession.clear('project-opened')
    configError.value = ''
    currentAdapter.value = adapter
    designSession.configure(adapter)
    exportService.clear()
    await bindProjectSession(createProjectEditorSession({
      project,
      registry: adapter.componentRegistry,
      repository: activeRepository,
    }), page.id, activeRepository)
    ui.closeTemplatePicker()
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

  async function createProject(templateId: string): Promise<void> {
    if (!repository.value || busy.value)
      return
    busy.value = true
    ui.clearMessage()
    try {
      const template = BUILT_IN_PROJECT_TEMPLATES.get(templateId)!
      const adapter = await loadWorkbenchAdapter(template.adapter)
      const project = createBuiltInProject(templateId, {
        id: `${templateId}-${Date.now().toString(36)}`,
        name: `${template.title} page`,
      }, adapter.componentRegistry.lock)
      await repository.value.create({ document: project })
      await refreshProjects()
      await openProject(project.id)
      ui.closeTemplatePicker()
    }
    catch (error) {
      ui.notify(error)
    }
    finally {
      busy.value = false
    }
  }

  async function createPage(templateId: string): Promise<void> {
    const document = currentProject.value
    if (!repository.value || !document || busy.value)
      return
    busy.value = true
    ui.clearMessage()
    try {
      const name = `${BUILT_IN_PROJECT_TEMPLATES.get(templateId)?.title ?? 'New'} page`
      const id = nextProjectPageId(document, name)
      const page = createBuiltInProjectPage(templateId, {
        id,
        name,
        route: nextProjectPageRoute(document, name),
      })
      const changed = executeProjectActions(
        'Add page',
        [{ type: 'operation.apply', operations: [{ type: 'page.add', page }] }],
      )
      if (changed)
        selectCurrentPage(page.id)
      ui.closeTemplatePicker()
    }
    catch (error) {
      ui.notify(error)
    }
    finally {
      busy.value = false
    }
  }

  async function handlePageAction(action: ProjectPageAction): Promise<void> {
    const document = currentProject.value
    if (!document || busy.value)
      return
    try {
      const operations = (() => {
        switch (action.type) {
          case 'page.rename': return [{ type: 'page.rename' as const, pageId: action.pageId, name: action.name }]
          case 'page.route': return [{ type: 'page.route' as const, pageId: action.pageId, route: action.route }]
          case 'page.home': return [{ type: 'project.home' as const, pageId: action.pageId }]
          case 'page.move': return [{ type: 'page.move' as const, pageId: action.pageId, index: action.index }]
          case 'page.remove': return [{ type: 'page.remove' as const, pageId: action.pageId }]
          case 'page.duplicate': {
            const source = document.pagesById[action.pageId]
            if (!source)
              throw new Error(`Page "${action.pageId}" does not exist.`)
            const name = `${source.name} copy`
            const page = duplicateProjectPage(source, {
              id: nextProjectPageId(document, name),
              name,
              route: nextProjectPageRoute(document, name),
            })
            return [{ type: 'page.add' as const, page, index: document.pageOrder.indexOf(source.id) + 1 }]
          }
        }
      })()
      executeProjectActions('Update pages', [{ type: 'operation.apply', operations }])
    }
    catch (error) {
      ui.notify(error)
    }
  }

  async function saveProject(): Promise<void> {
    const activePersistence = persistenceSession
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
    const activePersistence = persistenceSession
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
    const activePersistence = persistenceSession
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
        .filter(draft => draft.draftId !== persistenceSession?.draftId)
        .map(async draft => ({
          ...draft,
          presence: await (persistenceSession?.querySessionPresence(draft.sessionId)
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
      const discardedDraftId = persistenceSession?.draftId
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
      await persistenceSession?.handleVisibilityHidden()
      const oldDraftId = persistenceSession?.draftId
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

  async function selectPageFromDesigner(pageId: string): Promise<void> {
    selectCurrentPage(pageId)
  }

  function selectTemplate(templateId: string): void {
    if (currentProject.value)
      void createPage(templateId)
    else
      void createProject(templateId)
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden')
      void persistenceSession?.handleVisibilityHidden()
  }

  function handlePageHide(): void {
    void persistenceSession?.handleVisibilityHidden()
  }

  function handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (!persistenceSnapshot.value?.beforeUnloadRequired)
      return
    event.preventDefault()
    event.returnValue = ''
  }

  async function disposeWorkbench(): Promise<void> {
    if (disposePromise)
      return await disposePromise
    disposePromise = (async () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      globalThis.removeEventListener('pagehide', handlePageHide)
      globalThis.removeEventListener('beforeunload', handleBeforeUnload)
      await disposeProjectPersistence()
      repository.value?.close()
    })()
    return await disposePromise
  }

  onMounted(async () => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    globalThis.addEventListener('pagehide', handlePageHide)
    globalThis.addEventListener('beforeunload', handleBeforeUnload)
    try {
      const openedRepository = await openDefaultProjectRepository({})
      if (disposed) {
        openedRepository.close()
        return
      }
      repository.value = openedRepository
      await refreshProjects()
      if (disposed || repository.value !== openedRepository)
        return
      const first = projects.value[0]
      if (first)
        await openProject(first.id)
      else
        ui.openTemplatePicker()
    }
    catch (error) {
      ui.notify(error)
      ui.openTemplatePicker()
    }
  })

  onBeforeUnmount(() => {
    disposed = true
    openProjectRequestId += 1
    unsubscribeProjectSession?.()
    designSession.dispose()
    exportService.clear()
    previewSession.dispose()
    void disposeWorkbench()
  })

  return {
    projects,
    busy,
    componentRegistry,
    configError,
    createNamedCheckpoint,
    createProject,
    currentProject,
    currentGraph,
    currentPage,
    currentPageId,
    discardRecoveryDraft,
    designerFieldNames,
    flowEventTargets,
    designerLayers,
    dirty,
    executeFlowCommand: executeProjectCommand,
    getCurrentAdapterId,
    handlePageAction,
    inspectProjectVersion,
    listProjectVersions,
    listRecoveryDrafts,
    localeOptions,
    previewState,
    registry,
    repositoryRevision,
    recoveryDrafts,
    requestOpenProject,
    restoreProjectVersion,
    restoreRecoveryDraft,
    reloadCurrentProject,
    saveProject,
    saveCurrentDraftAsProject,
    selectPageFromDesigner,
    selectTemplate,
    setProjectVersionLabel,
    statusLabel,
    templates: BUILT_IN_PROJECT_TEMPLATES,
    workbenchLocale,
    workspaceRecoveryNotice,
    designSession,
    exportService,
    previewSession,
  }
}

export type WorkbenchController = ReturnType<typeof createWorkbenchController>
