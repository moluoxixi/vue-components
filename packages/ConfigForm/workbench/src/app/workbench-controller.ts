import type {
  CompileCoordinator,
  PageCompilation,
  ProjectCompilation,
} from '@moluoxixi/config-form-compiler'
import type {
  DesignCommandPreview,
  DesignerLocaleOptions,
} from '@moluoxixi/config-form-designer'
import type {
  PageGraph,
  ProjectChangeSet,
  ProjectCommand,
  ProjectCommandAction,
  ProjectCompilationSnapshot,
  ProjectDocument,
  ProjectRepository,
  ProjectSnapshot,
  ProjectSummary,
} from '@moluoxixi/config-form-model'
import type { VueRuntimeCompileResult, VueRuntimeCompileSuccess } from '@moluoxixi/config-form-vue-backend'
import type { WorkbenchAdapter, WorkbenchAdapterId } from '../adapters'
import type {
  BuildExportSnapshotInput,
  ProjectEditorSession,
  ProjectEditorSessionSnapshot,
  ProjectPageAction,
} from '../project'
import type { StudioLayerEntry } from '../studio/StudioLeftPanel.vue'
import type { WorkbenchUiStore } from './workbench-ui-store'
import {
  compileCanonicalProject,
  createCompileCoordinator,
} from '@moluoxixi/config-form-compiler'
import {
  createDesignerLocale,
  walkDesignGraph,
} from '@moluoxixi/config-form-designer'
import {
  applyProjectDraftTransaction,
  createProjectDraftSnapshotFromTransaction,
  resolveProjectCommand,
} from '@moluoxixi/config-form-model'
import { compileCanonicalPageRuntime } from '@moluoxixi/config-form-vue-backend'
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
  createProjectEditorSession,
  duplicateProjectPage,
  nextProjectPageId,
  nextProjectPageRoute,
  openDefaultProjectRepository,
} from '../project'
import {
  createPageRuntimeArtifactCache,
  createWorkbenchPreviewSession,
} from '../session'

export interface WorkbenchControllerProps {
  locale?: DesignerLocaleOptions
}

export interface WorkbenchRecoveryNotice {
  action?: 'reload'
  actionLabel?: string
  message: string
  tone: 'error' | 'warning'
}

function canonicalDiagnosticsToRuntimeResult(
  diagnostics: ReadonlyArray<{ code: string, message: string, path?: Array<string | number>, nodeId?: string }>,
): VueRuntimeCompileResult {
  return {
    success: false,
    diagnostics: diagnostics.map(diagnostic => ({
      code: diagnostic.code,
      message: diagnostic.message,
      path: diagnostic.path ?? [],
      severity: 'error' as const,
      ...(diagnostic.nodeId ? { nodeId: diagnostic.nodeId } : {}),
    })),
  }
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
  const currentPageId = ref('')
  const configError = ref('')
  const selectedDesignerIds = ref<string[]>([])
  const busy = ref(false)
  let openProjectRequestId = 0
  let projectCommandSequence = 0
  let disposed = false
  let unsubscribeProjectSession: (() => void) | undefined
  let projectedPageId = ''
  const previewSession = createWorkbenchPreviewSession({
    onNotify: ui.notify,
    onDiagnostic: diagnostic => ui.notify(diagnostic.message),
  })
  const previewProjection = previewSession.projection
  const previewFlowProjection = previewSession.flowProjection
  // Design and Preview share one page-scoped compilation. Full-project
  // compilation is captured lazily and only for readonly Export.
  let compileCoordinator: CompileCoordinator | undefined
  const pageRuntimeArtifactCache = createPageRuntimeArtifactCache()
  const canonicalPage = shallowRef<PageCompilation>()
  const canonicalExportProject = shallowRef<ProjectCompilation>()
  const canonicalPageRuntime = shallowRef<VueRuntimeCompileSuccess>()
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

  function captureExportSnapshotInput(): BuildExportSnapshotInput | undefined {
    const snapshot = projectSessionSnapshot.value
    const adapter = currentAdapter.value
    if (!snapshot || !adapter)
      return undefined
    const current = canonicalExportProject.value
    const compilation = current
      && current.origin.kind === 'committed'
      && !('kind' in current.snapshot)
      && current.origin.editVersion === snapshot.editVersion
      && current.snapshot.document.id === snapshot.document.id
      && current.snapshot.contentHash === snapshot.contentHash
      ? current
      : (() => {
          const result = compileCanonicalProject({
            snapshot: projectSnapshotFromEditorSession(snapshot),
            registry: adapter.registrySnapshot,
          })
          if (!result.success)
            return undefined
          canonicalExportProject.value = result.compilation
          return result.compilation
        })()
    if (!compilation)
      return undefined
    return {
      compilation,
      resolver: adapter.sourceResolver,
    }
  }

  function getCurrentExportCompilation(): ProjectCompilation | undefined {
    return canonicalExportProject.value
  }

  function getCurrentAdapterId(): WorkbenchAdapterId {
    const adapter = currentAdapter.value?.registrySnapshot.adapter
    if (adapter === 'antd-vue' || adapter === 'element-plus')
      return adapter
    throw new TypeError('Workbench adapter is unavailable.')
  }
  const getPreviewCompilation = previewSession.getCompilation
  const handlePreviewRuntimeMounted = previewSession.handleRuntimeMounted
  const handlePreviewFieldChange = previewSession.handleFieldChange
  const handlePreviewRuntimeEvent = previewSession.handleRuntimeEvent
  const handlePreviewRuntimeReady = previewSession.handleRuntimeReady
  const handlePreviewRuntimeState = previewSession.handleRuntimeState
  const handlePreviewSubmit = previewSession.handleSubmit
  const previewRuntimeState = previewSession.runtimeState
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
  const designerHistoryControl = computed(() => ({
    canUndo: projectSessionSnapshot.value?.canUndo ?? false,
    canRedo: projectSessionSnapshot.value?.canRedo ?? false,
    undo: undoDesign,
    redo: redoDesign,
  }))
  const hasUnsavedChanges = computed(() => dirty.value || !!configError.value)
  const workspaceRecoveryNotice = computed<WorkbenchRecoveryNotice | undefined>(() => {
    if (projectSessionSnapshot.value?.lastError?.code === 'PROJECT_REVISION_CONFLICT') {
      return {
        action: 'reload',
        actionLabel: workbenchLocale.value.t('recovery.reloadLatest', 'Reload latest'),
        message: workbenchLocale.value.t(
          'recovery.revisionConflict',
          'This project changed in another session. Reload the latest saved revision to continue; unsaved local edits will be discarded.',
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
    if (hasUnsavedChanges.value)
      return workbenchLocale.value.t('status.unsaved', 'Unsaved')
    return repository.value.persistence === 'durable'
      ? workbenchLocale.value.t('status.savedLocal', 'Saved locally')
      : workbenchLocale.value.t('status.temporary', 'Temporary session')
  })

  function compileCanonicalDocument(
    snapshot: ProjectCompilationSnapshot,
    pageId: string,
    changeSet?: ProjectChangeSet,
  ): { compilation?: PageCompilation, result: VueRuntimeCompileResult } {
    const adapter = currentAdapter.value
    const coordinator = compileCoordinator
    if (!adapter || !coordinator) {
      return { result: canonicalDiagnosticsToRuntimeResult([{
        code: 'RUNTIME_ADAPTER_UNAVAILABLE',
        message: 'Workbench runtime adapter is unavailable.',
        path: ['registryLock', 'adapter'],
      }]) }
    }

    const canonical = 'kind' in snapshot
      ? coordinator.compileDraftPage(snapshot, pageId, changeSet)
      : (() => {
          coordinator.acceptSnapshot(snapshot, changeSet)
          return coordinator.compilePage(pageId)
        })()
    if (!canonical.success)
      return { result: canonicalDiagnosticsToRuntimeResult(canonical.diagnostics) }

    const { compilation } = canonical
    return {
      compilation,
      result: pageRuntimeArtifactCache.resolve(
        compilation,
        () => compileCanonicalPageRuntime({ compilation }, adapter.runtimeResolver),
      ),
    }
  }

  function projectSnapshotFromEditorSession(snapshot: ProjectEditorSessionSnapshot): ProjectSnapshot {
    return Object.freeze({
      document: snapshot.document,
      editVersion: snapshot.editVersion,
      contentHash: snapshot.contentHash,
    })
  }

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
    const exportCompilation = canonicalExportProject.value
    if (exportCompilation
      && (exportCompilation.origin.kind !== 'committed'
        || 'kind' in exportCompilation.snapshot
        || exportCompilation.origin.editVersion !== snapshot.editVersion
        || exportCompilation.snapshot.contentHash !== snapshot.contentHash)) {
      canonicalExportProject.value = undefined
    }
    if (!modelChanged)
      return

    const projectPage = snapshot.document.pagesById[nextPageId]
    if (!projectPage)
      throw new TypeError(`Project snapshot does not contain the current page: ${nextPageId}`)

    // Compile only the active page before publishing either surface. Design
    // and Preview consume the exact same page program and Runtime plan.
    const compiled = compileCanonicalDocument(
      projectSnapshotFromEditorSession(snapshot),
      nextPageId,
      changeSet,
    )
    canonicalPage.value = compiled.compilation
    canonicalPageRuntime.value = compiled.result.success ? compiled.result : undefined
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
      runtime: compiled.result,
    })

    if (pageChanged)
      selectedDesignerIds.value = []
  }

  function bindProjectSession(session: ProjectEditorSession, preferredPageId: string): void {
    unsubscribeProjectSession?.()
    projectSession.value = session
    currentPageId.value = resolveCurrentPageId(session.snapshot, preferredPageId)
    projectedPageId = ''
    unsubscribeProjectSession = session.subscribe(acceptProjectSnapshot)
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

  function executeDesignerCommand(command: ProjectCommand) {
    const session = projectSession.value
    if (!session)
      return { changed: false, diagnostics: [] }
    const result = session.execute(command)
    configError.value = result.diagnostics[0]?.message ?? ''
    return { changed: result.changed, diagnostics: result.diagnostics }
  }

  function compileDesignerCandidate(command: ProjectCommand): PageCompilation | undefined {
    const snapshot = projectSessionSnapshot.value
    const adapter = currentAdapter.value
    const pageId = currentPageId.value
    if (!snapshot || !adapter || !pageId)
      return undefined

    try {
      const base = snapshot.document as ProjectDocument
      const resolution = resolveProjectCommand(base, command, { registry: adapter.componentRegistry })
      if (!resolution.success || resolution.transaction.operations.length === 0)
        return undefined
      const draft = applyProjectDraftTransaction(base, resolution.transaction, {
        registry: adapter.componentRegistry,
      })
      if (!draft.success || !draft.changed)
        return undefined
      const compiled = compileCanonicalDocument(
        createProjectDraftSnapshotFromTransaction(
          projectSnapshotFromEditorSession(snapshot),
          draft,
          `design-candidate:${command.id}`,
        ),
        pageId,
        {
          project: draft.changedProject,
          pageIds: draft.changedPageIds,
          nodeIds: draft.changedNodeIds,
          nodeChanges: draft.changedNodeChanges,
        },
      )
      return compiled.compilation
    }
    catch {
      // Candidate failures are transient invalid targets. The committed
      // runtime remains visible and the final command boundary reports errors.
      return undefined
    }
  }

  function getDesignRuntimeCompilation(command?: ProjectCommand): PageCompilation | undefined {
    if (!command)
      return canonicalPage.value
    return compileDesignerCandidate(command)
  }

  function previewDesignerCommand(command: ProjectCommand): DesignCommandPreview | undefined {
    const compilation = compileDesignerCandidate(command)
    const adapter = currentAdapter.value
    if (!compilation || !adapter)
      return undefined
    const result = compileCanonicalPageRuntime({ compilation }, adapter.runtimeResolver)
    const graph = projectSessionSnapshot.value?.document.pagesById[currentPageId.value]?.graph
    if (!graph)
      return undefined
    const resolution = resolveProjectCommand(projectSessionSnapshot.value!.document as ProjectDocument, command, {
      registry: adapter.componentRegistry,
    })
    if (!resolution.success)
      return undefined
    const draft = applyProjectDraftTransaction(
      projectSessionSnapshot.value!.document as ProjectDocument,
      resolution.transaction,
      { registry: adapter.componentRegistry },
    )
    const candidateGraph = draft.success
      ? draft.document.pagesById[currentPageId.value]?.graph
      : undefined
    return candidateGraph
      ? {
          command,
          graph: candidateGraph,
          ...(result.success ? { renderer: result.artifact.plan.renderer } : {}),
        }
      : undefined
  }

  const designerCommandControl = {
    execute: executeDesignerCommand,
    preview: previewDesignerCommand,
  }

  function undoDesign(): boolean {
    const result = projectSession.value?.undo()
    configError.value = result?.diagnostics[0]?.message ?? ''
    return result?.changed ?? false
  }

  function redoDesign(): boolean {
    const result = projectSession.value?.redo()
    configError.value = result?.diagnostics[0]?.message ?? ''
    return result?.changed ?? false
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
    compileCoordinator?.clear()
    pageRuntimeArtifactCache.clear()
    compileCoordinator = createCompileCoordinator({
      registry: adapter.registrySnapshot,
    })
    canonicalPage.value = undefined
    canonicalExportProject.value = undefined
    bindProjectSession(createProjectEditorSession({
      project,
      registry: adapter.componentRegistry,
      repository: activeRepository,
    }), page.id)
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
    const session = projectSession.value
    if (!session || !repository.value || configError.value || busy.value)
      return
    busy.value = true
    ui.clearMessage()
    try {
      const result = await session.save()
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

  async function reloadCurrentProject(): Promise<void> {
    const projectId = currentProject.value?.id
    const pageId = currentPageId.value
    if (!projectId || busy.value)
      return
    busy.value = true
    ui.clearMessage()
    try {
      await openProject(projectId, pageId)
      ui.notify(workbenchLocale.value.t('recovery.reloaded', 'Reloaded the latest saved revision'))
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

  onMounted(async () => {
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
    compileCoordinator?.clear()
    pageRuntimeArtifactCache.clear()
    previewSession.dispose()
    repository.value?.close()
  })

  return {
    projects,
    busy,
    componentRegistry,
    configError,
    captureExportSnapshotInput,
    createProject,
    currentProject,
    currentGraph,
    currentPage,
    currentPageId,
    designRuntime: canonicalPageRuntime,
    designerCommandControl,
    designerFieldNames,
    flowEventTargets,
    designerHistoryControl,
    designerLayers,
    dirty,
    executeFlowCommand: executeDesignerCommand,
    getCurrentExportCompilation,
    getCurrentAdapterId,
    getDesignRuntimeCompilation,
    handlePageAction,
    handlePreviewFieldChange,
    handlePreviewRuntimeMounted,
    handlePreviewRuntimeEvent,
    handlePreviewRuntimeReady,
    handlePreviewRuntimeState,
    handlePreviewSubmit,
    localeOptions,
    getPreviewCompilation,
    previewFlowProjection,
    previewProjection,
    previewRuntimeState,
    previewState,
    registry,
    repositoryRevision,
    requestOpenProject,
    reloadCurrentProject,
    saveProject,
    selectPageFromDesigner,
    selectedDesignerIds,
    selectTemplate,
    statusLabel,
    templates: BUILT_IN_PROJECT_TEMPLATES,
    workbenchLocale,
    workspaceRecoveryNotice,
  }
}

export type WorkbenchController = ReturnType<typeof createWorkbenchController>
