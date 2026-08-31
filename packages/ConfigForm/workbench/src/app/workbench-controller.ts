import type {
  CanonicalPageIR,
  CompileCoordinator,
  PageCompilation,
  ProjectCompilation,
} from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormFlowTrigger,
} from '@moluoxixi/config-form-core'
import type {
  DesignerCommand,
  DesignerDocument,
  DesignerLocaleOptions,
  DesignerNode,
  ModelOperation,
} from '@moluoxixi/config-form-designer'
import type {
  ProjectChangeSet,
  ProjectCommandAction,
  ProjectCompilationSnapshot,
  ProjectDocument,
  ProjectPage,
  ProjectRepository,
  ProjectSnapshot,
} from '@moluoxixi/config-form-model'
import type { VueRuntimeCompileResult, VueRuntimeCompileSuccess } from '@moluoxixi/config-form-vue-backend'
import type { ComputedRef } from 'vue'
import type { WorkbenchAdapter } from '../adapters'
import type { WorkbenchLocaleId } from '../locale'
import type {
  BuildExportSnapshotInput,
  ProjectEditorSession,
  ProjectEditorSessionSnapshot,
  WorkspaceApplication,
  WorkspaceApplicationOperation,
  WorkspaceApplicationSummary,
} from '../project'
import type {
  WorkspacePreviewProjection,
} from '../session'
import type { PreviewViewport } from '../studio/PreviewDrawer.vue'
import type { StudioLayerEntry, StudioLeftView } from '../studio/StudioLeftPanel.vue'
import {
  compileCanonicalProject,
  createCompileCoordinator,
} from '@moluoxixi/config-form-compiler'
import {
  createDesignerLocale,
  designerCommandToModelOperation,
} from '@moluoxixi/config-form-designer'
import {
  applyProjectDraftTransaction,
  createProjectDraftSnapshotFromTransaction,
  migrateLegacyWorkspaceApplication,
  projectPageToLegacyLowCodePageModel,
  resolveProjectCommand,
} from '@moluoxixi/config-form-model'
import { compileCanonicalPageRuntime } from '@moluoxixi/config-form-vue-backend'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { loadWorkbenchAdapter } from '../adapters'
import {
  canonicalPageToDesignerDocument,
  createPreviewModel,
  mergePreviewModel,
  projectPageToDesignerDocument,
} from '../design'
import { collectFlowEventTargets } from '../flow/event-targets'
import { createWorkbenchPageFlowEngine } from '../flow/page-flow-engine'
import {
  createWorkbenchLocaleOptions,
  readWorkbenchLocalePreference,
  resolveWorkbenchLocale,
  writeWorkbenchLocalePreference,
} from '../locale'
import {
  BUILT_IN_WORKSPACE_TEMPLATES,
  createBuiltInWorkspaceApplication,
  createBuiltInWorkspacePage,
  createProjectEditorSession,
  duplicateWorkspacePage,
  legacyApplicationOperationToProjectActions,
  legacyModelOperationToProjectActions,
  nextWorkspacePageId,
  nextWorkspacePageRoute,
  openDefaultProjectRepository,
  projectDocumentToLegacyWorkspaceApplication,
  projectSummaryToLegacyWorkspaceSummary,
} from '../project'
import {
  createPageRuntimeArtifactCache,
  createWorkspaceProjectionCoordinator,
} from '../session'
import { cloneWorkbenchJson } from '../utils/clone'

export type MobileStudioView = 'canvas' | 'components' | 'inspector' | 'layers' | 'pages'
export type WorkbenchTheme = 'dark' | 'light'

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

export function createWorkbenchController(props: Readonly<WorkbenchControllerProps>) {
  function initialLocale(): WorkbenchLocaleId {
    if (props.locale?.locale)
      return resolveWorkbenchLocale(props.locale.locale)
    const persisted = readWorkbenchLocalePreference(typeof localStorage === 'undefined' ? undefined : localStorage)
    if (persisted)
      return persisted
    return resolveWorkbenchLocale(typeof navigator === 'undefined' ? undefined : navigator.language)
  }

  const repository = shallowRef<ProjectRepository>()
  const currentAdapter = shallowRef<WorkbenchAdapter>()
  const applications = ref<WorkspaceApplicationSummary[]>([])
  const projectSession = shallowRef<ProjectEditorSession>()
  const projectSessionSnapshot = shallowRef<ProjectEditorSessionSnapshot>()
  const currentPageId = ref('')
  const configError = ref('')
  const mobileStudioView = ref<MobileStudioView>('canvas')
  const studioLeftView = ref<StudioLeftView>('components')
  const previewOpen = ref(false)
  const previewExpanded = ref(false)
  const previewViewport = ref<PreviewViewport>('desktop')
  const previewModel = ref<Record<string, unknown>>({})
  const previewProjection = shallowRef<WorkspacePreviewProjection>()
  const templatePickerOpen = ref(false)
  const pageManagerOpen = ref(false)
  const exportPreviewMode = ref<'source' | 'config'>()
  const flowWorkspaceOpen = ref(false)
  const selectedDesignerIds = ref<string[]>([])
  const theme = ref<WorkbenchTheme>('dark')
  const localeId = ref<WorkbenchLocaleId>(initialLocale())
  const busy = ref(false)
  const message = ref('')
  let openApplicationRequestId = 0
  let projectCommandSequence = 0
  let disposed = false
  let unsubscribeProjectSession: (() => void) | undefined
  let projectedPageId = ''
  const projectionCoordinator = createWorkspaceProjectionCoordinator()
  const pageFlowEngine = createWorkbenchPageFlowEngine({
    readValues: () => previewModel.value,
    writeValues: values => previewModel.value = values,
    onNotify: value => message.value = value,
    onDiagnostic: diagnostic => message.value = diagnostic.message,
  })
  // Design and Preview share one page-scoped compilation. Full-project
  // compilation is captured lazily and only for readonly Export.
  let compileCoordinator: CompileCoordinator | undefined
  const pageRuntimeArtifactCache = createPageRuntimeArtifactCache()
  const canonicalPage = shallowRef<PageCompilation>()
  const canonicalExportProject = shallowRef<ProjectCompilation>()
  const canonicalPageRuntime = shallowRef<VueRuntimeCompileSuccess>()
  const localeOptions = computed(() => createWorkbenchLocaleOptions(
    localeId.value,
    currentAdapter.value?.locale,
    props.locale,
  ))
  const workbenchLocale = computed(() => createDesignerLocale(localeOptions.value))
  const currentApplication = computed(() => {
    const snapshot = projectSessionSnapshot.value
    return snapshot
      ? projectDocumentToLegacyWorkspaceApplication(snapshot.document, {
          createdAt: snapshot.createdAt,
          repositoryRevision: snapshot.repositoryRevision,
          updatedAt: snapshot.updatedAt,
        })
      : undefined
  })
  const currentPage = computed(() => currentApplication.value?.pages.find(page => page.id === currentPageId.value))
  const currentProjectPage = computed(() => projectSessionSnapshot.value?.document.pagesById[currentPageId.value])
  const lowCodeRegistry = computed(() => currentAdapter.value!.lowCodeRegistry)
  const registry = computed(() => currentAdapter.value!.designerRegistry)
  const configModel = computed(() => currentProjectPage.value
    ? projectPageToLegacyLowCodePageModel(currentProjectPage.value as unknown as ProjectPage)
    : undefined)
  const modelRevision = computed(() => projectSessionSnapshot.value?.editVersion ?? 0)
  const dirty = computed(() => projectSessionSnapshot.value?.dirty ?? false)
  const designerDocument = computed(() => {
    const page = canonicalPage.value?.page
    if (page)
      return canonicalPageToDesignerDocument(page as unknown as CanonicalPageIR)
    const projectPage = currentProjectPage.value
    return projectPage ? projectPageToDesignerDocument(projectPage as unknown as ProjectPage) : undefined
  })
  const previewFlowProjection = pageFlowEngine.projection
  const designerLayers = computed<StudioLayerEntry[]>(() => {
    const entries: StudioLayerEntry[] = []
    const visit = (nodes: DesignerNode[], depth: number): void => {
      nodes.forEach((node) => {
        entries.push({
          id: node.id,
          label: node.kind === 'field'
            ? node.label ?? node.field
            : registry.value.getMaterial(node.material)?.title ?? node.material,
          component: node.material,
          depth,
        })
        if (node.kind === 'container')
          Object.values(node.slots).forEach(children => visit(children, depth + 1))
      })
    }
    visit(designerDocument.value?.nodes ?? [], 0)
    return entries
  })
  const designerFieldNames = computed<string[]>(() => {
    const fields: string[] = []
    const visit = (nodes: DesignerNode[]): void => {
      nodes.forEach((node) => {
        if (node.kind === 'field')
          fields.push(node.field)
        else
          Object.values(node.slots).forEach(visit)
      })
    }
    visit(designerDocument.value?.nodes ?? [])
    return [...new Set(fields)]
  })
  const flowEventTargets = computed(() => collectFlowEventTargets(designerDocument.value, currentAdapter.value?.lowCodeRegistry))

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
  const currentSourceRevisionKey = computed(() => previewProjection.value?.current.revisionKey ?? '')
  const lastRuntimePreview = shallowRef<{
    applicationId: string
    compilation: PageCompilation
    modelValue: Record<string, unknown>
    pageId: string
  }>()
  const previewState = computed(() => {
    const projection = previewProjection.value
    if (configError.value || projection?.status === 'stale') {
      return {
        label: workbenchLocale.value.t('preview.staleAt', 'Stale at r{revision}', {
          revision: projection?.display?.snapshot.modelRevision ?? modelRevision.value,
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
  const previewCompilation: ComputedRef<PageCompilation | undefined> = computed(() => {
    const projection = previewProjection.value
    if (projection?.compileResult.success && canonicalPage.value)
      return canonicalPage.value
    const fallback = lastRuntimePreview.value
    if (!fallback
      || fallback.applicationId !== currentApplication.value?.id
      || fallback.pageId !== currentPageId.value) {
      return undefined
    }
    return fallback.compilation
  })

  function getPreviewCompilation(): PageCompilation | undefined {
    return previewCompilation.value
  }

  function getPreviewRuntimeModel(): Record<string, unknown> {
    if (previewProjection.value?.compileResult.success)
      return previewModel.value
    return lastRuntimePreview.value?.modelValue ?? previewModel.value
  }

  function updatePreviewRuntimeModel(value: Record<string, unknown>): void {
    if (previewProjection.value?.compileResult.success) {
      previewModel.value = value
      return
    }
    const fallback = lastRuntimePreview.value
    if (fallback)
      lastRuntimePreview.value = { ...fallback, modelValue: value }
  }
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
          'This application changed in another session. Reload the latest saved revision to continue; unsaved local edits will be discarded.',
        ),
        tone: 'error',
      }
    }
    const migrationErrors = repository.value?.migrationErrors ?? []
    if (migrationErrors.length > 0) {
      return {
        message: workbenchLocale.value.t(
          'recovery.migrationFailed',
          '{count} legacy workspace item(s) could not be migrated. The original data was preserved. {detail}',
          { count: migrationErrors.length, detail: migrationErrors[0] },
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

  function publishWorkspaceProjection(
    snapshot: ProjectEditorSessionSnapshot,
    application: WorkspaceApplication,
    runtime: VueRuntimeCompileResult,
  ): void {
    if (!currentAdapter.value)
      return
    previewProjection.value = projectionCoordinator.publish({
      application,
      applicationRevision: snapshot.repositoryRevision,
      currentPageId: currentPageId.value,
      modelRevision: snapshot.editVersion,
    }, () => runtime)
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
    pageFlowEngine.sync({
      pageKey: `${snapshot.document.id}:${nextPageId}`,
      plans: compiled.compilation?.page.flows.map(flow => flow.plan) ?? [],
    })

    const document = compiled.compilation?.page
      ? canonicalPageToDesignerDocument(compiled.compilation.page as unknown as CanonicalPageIR)
      : projectPageToDesignerDocument(projectPage as unknown as ProjectPage)
    const defaults = createPreviewModel(document)
    previewModel.value = pageChanged
      ? defaults
      : mergePreviewModel(document, previewModel.value, defaults)
    if (pageChanged) {
      selectedDesignerIds.value = []
      lastRuntimePreview.value = undefined
    }
    const application = currentApplication.value
    if (application)
      publishWorkspaceProjection(snapshot, application, compiled.result)
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

  function designerCommandActions(
    command: DesignerCommand,
    document: DesignerDocument,
  ): ProjectCommandAction[] {
    const pageId = currentPageId.value
    const page = projectSessionSnapshot.value?.document.pagesById[pageId]
    if (!page)
      return []
    const operation = designerCommandToModelOperation(command, document, page.graph.props)
    return legacyModelOperationToProjectActions(pageId, operation)
  }

  function updateDesigner(command: DesignerCommand, document: DesignerDocument): boolean {
    try {
      const actions = designerCommandActions(command, document)
      return actions.length > 0 && executeProjectActions('Update design', actions)
    }
    catch (error) {
      configError.value = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  function compileDesignerCandidate(
    command: DesignerCommand,
    document: DesignerDocument,
  ): PageCompilation | undefined {
    const snapshot = projectSessionSnapshot.value
    const adapter = currentAdapter.value
    const pageId = currentPageId.value
    if (!snapshot || !adapter || !pageId)
      return undefined

    try {
      const base = snapshot.document as ProjectDocument
      const resolution = resolveProjectCommand(base, {
        id: 'design-candidate',
        label: 'Preview design candidate',
        actions: designerCommandActions(command, document),
      }, { registry: adapter.componentRegistry })
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
          'design-candidate',
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

  function getDesignRuntimeCompilation(
    command?: DesignerCommand,
    document?: DesignerDocument,
  ): PageCompilation | undefined {
    if (!command || !document)
      return canonicalPage.value
    return compileDesignerCandidate(command, document)
  }

  function previewDesignerRuntime(
    command: DesignerCommand,
    document: DesignerDocument,
  ): VueRuntimeCompileSuccess['artifact']['plan']['renderer'] | undefined {
    const compilation = compileDesignerCandidate(command, document)
    const adapter = currentAdapter.value
    if (!compilation || !adapter)
      return undefined
    const result = compileCanonicalPageRuntime({ compilation }, adapter.runtimeResolver)
    return result.success ? result.artifact.plan.renderer : undefined
  }

  const designerCommandControl = {
    apply: updateDesigner,
    applyModelOperation: updateModelOperation,
    previewRuntime: previewDesignerRuntime,
  }

  function updateModelOperation(operation: ModelOperation): boolean {
    if (!currentPageId.value)
      return false
    return executeProjectActions('Update design', legacyModelOperationToProjectActions(currentPageId.value, operation))
  }

  function handlePreviewRuntimeReady(revision: string): void {
    const applicationId = currentApplication.value?.id
    const pageId = currentPageId.value
    const compilation = canonicalPage.value
    const result = previewProjection.value?.compileResult
    if (!applicationId
      || !pageId
      || !projectionCoordinator.isCurrent(revision)
      || !compilation
      || !result?.success) {
      return
    }
    lastRuntimePreview.value = {
      applicationId,
      compilation,
      modelValue: cloneWorkbenchJson(previewModel.value),
      pageId,
    }
  }

  function handlePreviewRuntimeMounted(revision: string): void {
    if (!projectionCoordinator.isCurrent(revision))
      return
    runPreviewFlows('page.mount', previewModel.value)
  }

  function runPreviewFlows(
    triggerOrKind: ConfigFormFlowTrigger['kind'] | ConfigFormFlowTrigger,
    values: Record<string, unknown>,
    field?: string,
  ): void {
    const applicationId = currentApplication.value?.id
    const pageId = currentPageId.value
    const projection = previewProjection.value
    if (!applicationId || !pageId || !projection)
      return
    const revision = modelRevision.value
    const revisionKey = projection.current.revisionKey
    const signal = projection.signal
    const isCurrentRun = (): boolean => applicationId === currentApplication.value?.id
      && pageId === currentPageId.value
      && revision === modelRevision.value
      && projectionCoordinator.isCurrent(revisionKey)
      && !signal.aborted

    const trigger: ConfigFormFlowTrigger = typeof triggerOrKind === 'string'
      ? { kind: triggerOrKind, ...(field ? { field } : {}) }
      : triggerOrKind
    void pageFlowEngine.dispatch({
      trigger,
      values: cloneWorkbenchJson(values),
      revision,
      signal,
      isCurrent: isCurrentRun,
    })
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

  async function refreshApplications(): Promise<void> {
    const activeRepository = repository.value
    if (!activeRepository)
      return
    const nextApplications = (await activeRepository.list()).map(projectSummaryToLegacyWorkspaceSummary)
    if (!disposed && repository.value === activeRepository)
      applications.value = nextApplications
  }

  async function openApplication(id: string, pageId?: string): Promise<void> {
    const requestId = ++openApplicationRequestId
    const activeRepository = repository.value
    if (!activeRepository)
      return
    const project = await activeRepository.get(id)
    if (
      !project
      || disposed
      || requestId !== openApplicationRequestId
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
      || requestId !== openApplicationRequestId
      || activeRepository !== repository.value
    ) {
      return
    }
    const page = (pageId ? document.pagesById[pageId] : undefined)
      ?? document.pagesById[document.homePageId]
      ?? document.pagesById[document.pageOrder[0]!]
    if (!page)
      return
    lastRuntimePreview.value = undefined
    configError.value = ''
    currentAdapter.value = adapter
    pageFlowEngine.clear()
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
    templatePickerOpen.value = false
  }

  async function requestOpenApplication(id: string, pageId?: string): Promise<void> {
    if (currentApplication.value?.id === id) {
      if (pageId && currentPageId.value !== pageId)
        selectCurrentPage(pageId)
      return
    }
    if (hasUnsavedChanges.value) {
      message.value = workbenchLocale.value.t(
        'workbench.openBlocked',
        'Save or resolve the current application before opening another application.',
      )
      return
    }
    await openApplication(id, pageId)
  }

  async function createApplication(templateId: string): Promise<void> {
    if (!repository.value || busy.value)
      return
    busy.value = true
    message.value = ''
    try {
      const template = BUILT_IN_WORKSPACE_TEMPLATES.get(templateId)!
      const now = new Date().toISOString()
      const application = createBuiltInWorkspaceApplication(templateId, {
        createdAt: now,
        id: `${templateId}-${Date.now().toString(36)}`,
        name: `${template.title} page`,
      })
      const adapter = await loadWorkbenchAdapter(template.adapter)
      const migrated = migrateLegacyWorkspaceApplication(application, {
        registryLock: adapter.componentRegistry.lock,
      })
      if (!migrated.success)
        throw new TypeError(migrated.diagnostics[0]?.message ?? 'Unable to create the project document.')
      await repository.value.create({ document: migrated.data })
      await refreshApplications()
      await openApplication(application.id)
      templatePickerOpen.value = false
    }
    catch (error) {
      message.value = error instanceof Error ? error.message : String(error)
    }
    finally {
      busy.value = false
    }
  }

  async function createPage(templateId: string): Promise<void> {
    const application = currentApplication.value
    if (!repository.value || !application || busy.value)
      return
    busy.value = true
    message.value = ''
    try {
      const now = new Date().toISOString()
      const name = `${BUILT_IN_WORKSPACE_TEMPLATES.get(templateId)?.title ?? 'New'} page`
      const id = nextWorkspacePageId(application, name)
      const page = createBuiltInWorkspacePage(templateId, {
        createdAt: now,
        id,
        name,
        route: nextWorkspacePageRoute(application, name),
      })
      const document = projectSessionSnapshot.value?.document
      if (!document)
        return
      const changed = executeProjectActions(
        'Add page',
        legacyApplicationOperationToProjectActions(document, { type: 'add-page', page }),
      )
      if (changed)
        selectCurrentPage(page.id)
      templatePickerOpen.value = false
    }
    catch (error) {
      message.value = error instanceof Error ? error.message : String(error)
    }
    finally {
      busy.value = false
    }
  }

  async function handleApplicationOperation(operation: WorkspaceApplicationOperation): Promise<void> {
    const application = currentApplication.value
    if (!application || busy.value)
      return
    try {
      const resolvedOperation = operation.type === 'duplicate-page'
        ? (() => {
            const source = application.pages.find(page => page.id === operation.pageId)
            if (!source)
              throw new Error(`Page "${operation.pageId}" does not exist.`)
            const name = `${source.name} copy`
            const id = nextWorkspacePageId(application, name)
            return {
              type: 'duplicate-page' as const,
              pageId: source.id,
              page: duplicateWorkspacePage(source, {
                id,
                name,
                route: nextWorkspacePageRoute(application, name),
              }),
            }
          })()
        : operation
      const document = projectSessionSnapshot.value?.document
      if (!document)
        return
      executeProjectActions(
        'Update pages',
        legacyApplicationOperationToProjectActions(document, resolvedOperation),
      )
    }
    catch (error) {
      message.value = error instanceof Error ? error.message : String(error)
    }
  }

  async function saveProject(): Promise<void> {
    const session = projectSession.value
    if (!session || !repository.value || configError.value || busy.value)
      return
    busy.value = true
    message.value = ''
    try {
      const result = await session.save()
      if (!result.success) {
        message.value = result.error.message
        return
      }
      await refreshApplications()
      message.value = result.newerEdits
        ? workbenchLocale.value.t(
            'workbench.savedWithNewer',
            'Saved revision {revision}; newer edits remain unsaved',
            { revision: result.repositoryRevision },
          )
        : workbenchLocale.value.t('workbench.saved', 'Saved revision {revision}', { revision: result.repositoryRevision })
    }
    catch (error) {
      message.value = error instanceof Error ? error.message : String(error)
    }
    finally {
      busy.value = false
    }
  }

  async function reloadCurrentApplication(): Promise<void> {
    const applicationId = currentApplication.value?.id
    const pageId = currentPageId.value
    if (!applicationId || busy.value)
      return
    busy.value = true
    message.value = ''
    try {
      await openApplication(applicationId, pageId)
      message.value = workbenchLocale.value.t('recovery.reloaded', 'Reloaded the latest saved revision')
    }
    catch (error) {
      message.value = error instanceof Error ? error.message : String(error)
    }
    finally {
      busy.value = false
    }
  }

  function openExportPreview(mode: 'source' | 'config'): void {
    exportPreviewMode.value = mode
  }

  function closeExportPreview(): void {
    exportPreviewMode.value = undefined
  }

  function openFlowWorkspace(): void {
    if (currentApplication.value)
      flowWorkspaceOpen.value = true
  }

  function closeFlowWorkspace(): void {
    flowWorkspaceOpen.value = false
  }

  function togglePreview(): void {
    previewOpen.value = !previewOpen.value
    if (!previewOpen.value)
      previewExpanded.value = false
  }

  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function toggleLocale(): void {
    localeId.value = localeId.value === 'zh-CN' ? 'en-US' : 'zh-CN'
  }

  async function selectPageFromDesigner(pageId: string): Promise<void> {
    selectCurrentPage(pageId)
  }

  function openTemplatePicker(): void {
    templatePickerOpen.value = true
  }

  function openPageTemplatePicker(): void {
    pageManagerOpen.value = false
    openTemplatePicker()
  }

  function openPageManager(): void {
    pageManagerOpen.value = true
  }

  function closePageManager(): void {
    pageManagerOpen.value = false
  }

  function closeTemplatePicker(): void {
    templatePickerOpen.value = false
  }

  function selectTemplate(templateId: string): void {
    if (currentApplication.value)
      void createPage(templateId)
    else
      void createApplication(templateId)
  }

  watch(() => props.locale?.locale, (value) => {
    if (value)
      localeId.value = resolveWorkbenchLocale(value)
  })

  watch(localeId, (value) => {
    writeWorkbenchLocalePreference(value, typeof localStorage === 'undefined' ? undefined : localStorage)
    if (typeof document !== 'undefined')
      document.documentElement.lang = value
  }, { immediate: true })

  onMounted(async () => {
    try {
      const openedRepository = await openDefaultProjectRepository({
        resolveRegistryLock: async (adapterId) => {
          const adapter = await loadWorkbenchAdapter(adapterId)
          return adapter.componentRegistry.lock
        },
      })
      if (disposed) {
        openedRepository.close()
        return
      }
      repository.value = openedRepository
      await refreshApplications()
      if (disposed || repository.value !== openedRepository)
        return
      const first = applications.value[0]
      if (first)
        await openApplication(first.id)
      else
        templatePickerOpen.value = true
    }
    catch (error) {
      message.value = error instanceof Error ? error.message : String(error)
      templatePickerOpen.value = true
    }
  })

  onBeforeUnmount(() => {
    disposed = true
    openApplicationRequestId += 1
    unsubscribeProjectSession?.()
    compileCoordinator?.clear()
    pageRuntimeArtifactCache.clear()
    pageFlowEngine.dispose()
    projectionCoordinator.invalidate('workbench-unmounted')
    repository.value?.close()
  })

  return {
    applications,
    busy,
    closeExportPreview,
    closeFlowWorkspace,
    closePageManager,
    closeTemplatePicker,
    configError,
    configModel,
    captureExportSnapshotInput,
    createApplication,
    currentApplication,
    currentPage,
    currentPageId,
    currentSourceRevisionKey,
    designRuntime: canonicalPageRuntime,
    designerCommandControl,
    designerDocument,
    designerFieldNames,
    flowEventTargets,
    designerHistoryControl,
    designerLayers,
    dirty,
    exportPreviewMode,
    flowWorkspaceOpen,
    getCurrentExportCompilation,
    getDesignRuntimeCompilation,
    getPreviewRuntimeModel,
    handleApplicationOperation,
    handlePreviewRuntimeMounted,
    handlePreviewRuntimeReady,
    localeId,
    localeOptions,
    lowCodeRegistry,
    message,
    mobileStudioView,
    openExportPreview,
    openFlowWorkspace,
    openPageManager,
    openPageTemplatePicker,
    openTemplatePicker,
    pageManagerOpen,
    previewExpanded,
    getPreviewCompilation,
    previewFlowProjection,
    previewModel,
    previewOpen,
    previewProjection,
    previewState,
    previewViewport,
    projectionCoordinator,
    registry,
    requestOpenApplication,
    reloadCurrentApplication,
    runPreviewFlows,
    saveProject,
    selectPageFromDesigner,
    selectedDesignerIds,
    selectTemplate,
    statusLabel,
    studioLeftView,
    templates: BUILT_IN_WORKSPACE_TEMPLATES,
    templatePickerOpen,
    theme,
    toggleLocale,
    togglePreview,
    toggleTheme,
    updateModelOperation,
    updatePreviewRuntimeModel,
    workbenchLocale,
    workspaceRecoveryNotice,
  }
}

export type WorkbenchController = ReturnType<typeof createWorkbenchController>
