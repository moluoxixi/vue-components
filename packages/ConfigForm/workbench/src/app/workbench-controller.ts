import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type {
  DesignerCommand,
  DesignerDocument,
  DesignerLocaleOptions,
  DesignerNode,
  ModelOperation,
} from '@moluoxixi/config-form-designer'
import type { WorkbenchAdapter } from '../adapters'
import type { WorkbenchLocaleId } from '../locale'
import type {
  WorkspaceApplicationOperation,
  WorkspaceApplicationRepository,
  WorkspaceApplicationSummary,
} from '../project'
import type {
  WorkspaceOperation,
  WorkspacePreviewProjection,
  WorkspaceSession,
  WorkspaceSessionSnapshot,
} from '../session'
import type { PreviewViewport } from '../studio/PreviewDrawer.vue'
import type { StudioLayerEntry, StudioLeftView } from '../studio/StudioLeftPanel.vue'
import { ConfigFormFlowInterpreter } from '@moluoxixi/config-form-core'
import {
  compileDesignerDocument,
  configModelToDesignerDocument,
  createDesignerLocale,
  designerCommandToModelOperation,
} from '@moluoxixi/config-form-designer'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { loadWorkbenchAdapter } from '../adapters'
import {
  createWorkbenchLocaleOptions,
  readWorkbenchLocalePreference,
  resolveWorkbenchLocale,
  writeWorkbenchLocalePreference,
} from '../locale'
import {
  applyPreviewFlowValuePatch,
  createWorkbenchFlowActionRegistry,
  PreviewFlowCoordinator,
} from '../preview'
import {
  BUILT_IN_WORKSPACE_TEMPLATES,
  createBuiltInWorkspaceApplication,
  createBuiltInWorkspacePage,
  duplicateWorkspacePage,
  nextWorkspacePageId,
  nextWorkspacePageRoute,
  openDefaultWorkspaceApplicationRepository,
} from '../project'
import { createWorkspaceProjectionCoordinator, createWorkspaceSession } from '../session'
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

export function createWorkbenchController(props: Readonly<WorkbenchControllerProps>) {
  function initialLocale(): WorkbenchLocaleId {
    if (props.locale?.locale)
      return resolveWorkbenchLocale(props.locale.locale)
    const persisted = readWorkbenchLocalePreference(typeof localStorage === 'undefined' ? undefined : localStorage)
    if (persisted)
      return persisted
    return resolveWorkbenchLocale(typeof navigator === 'undefined' ? undefined : navigator.language)
  }

  const repository = shallowRef<WorkspaceApplicationRepository>()
  const currentAdapter = shallowRef<WorkbenchAdapter>()
  const applications = ref<WorkspaceApplicationSummary[]>([])
  const workspaceSession = shallowRef<WorkspaceSession>()
  const workspaceSnapshot = shallowRef<WorkspaceSessionSnapshot>()
  const configError = ref('')
  const mobileStudioView = ref<MobileStudioView>('canvas')
  const studioLeftView = ref<StudioLeftView>('components')
  const previewOpen = ref(false)
  const previewExpanded = ref(false)
  const previewViewport = ref<PreviewViewport>('desktop')
  const previewModel = ref<Record<string, unknown>>({})
  const fallbackPreviewModel = ref<Record<string, unknown>>({})
  const previewFlowProjections = shallowRef<Record<string, ConfigFormReactionProjection<Record<string, unknown>>>>({})
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
  let workspaceTransactionSequence = 0
  let disposed = false
  let unsubscribeWorkspaceSession: (() => void) | undefined
  const projectionCoordinator = createWorkspaceProjectionCoordinator()
  const flowActionRegistry = createWorkbenchFlowActionRegistry(
    value => message.value = value,
  )
  const flowInterpreter = new ConfigFormFlowInterpreter(flowActionRegistry)
  const previewFlowCoordinator = new PreviewFlowCoordinator(flowInterpreter)
  const localeOptions = computed(() => createWorkbenchLocaleOptions(
    localeId.value,
    currentAdapter.value?.locale,
    props.locale,
  ))
  const workbenchLocale = computed(() => createDesignerLocale(localeOptions.value))
  const currentApplication = computed(() => workspaceSnapshot.value?.application)
  const currentPageId = computed(() => workspaceSnapshot.value?.currentPageId ?? '')
  const currentPage = computed(() => workspaceSnapshot.value?.currentPage)
  const lowCodeRegistry = computed(() => currentAdapter.value!.lowCodeRegistry)
  const registry = computed(() => currentAdapter.value!.designerRegistry)
  const configModel = computed(() => currentPage.value?.model)
  const modelRevision = computed(() => workspaceSnapshot.value?.modelRevision ?? 0)
  const dirty = computed(() => workspaceSnapshot.value?.dirty ?? false)
  const designerDocument = computed(() => configModel.value
    ? configModelToDesignerDocument(configModel.value)
    : undefined)
  const previewFlowProjection = computed<ConfigFormReactionProjection<Record<string, unknown>>>(() => {
    const projection: ConfigFormReactionProjection<Record<string, unknown>> = {
      values: previewModel.value,
      props: {},
      states: {},
      validate: [],
    }
    const validate = new Set<string>()
    for (const flow of configModel.value?.flows ?? []) {
      const current = previewFlowProjections.value[flow.id]
      if (!current)
        continue
      for (const [field, fieldProps] of Object.entries(current.props))
        projection.props[field] = { ...projection.props[field], ...fieldProps }
      for (const [field, fieldStates] of Object.entries(current.states))
        projection.states[field] = { ...projection.states[field], ...fieldStates }
      current.validate.forEach(field => validate.add(field))
    }
    projection.validate = [...validate]
    return projection
  })
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
  const currentSourceRevisionKey = computed(() => previewProjection.value?.current.revisionKey ?? '')
  const lastRuntimePreview = shallowRef<{
    applicationId: string
    pageId: string
    result: NonNullable<WorkspacePreviewProjection['display']>['result']
  }>()
  const activePreview = computed(() => previewProjection.value?.display?.result)
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
  const runtimeFallbackPreview = computed(() => {
    const fallback = lastRuntimePreview.value
    if (!fallback
      || fallback.applicationId !== currentApplication.value?.id
      || fallback.pageId !== currentPageId.value) {
      return undefined
    }
    return fallback.result
  })
  const designerHistoryControl = computed(() => ({
    canUndo: workspaceSnapshot.value?.canUndo ?? false,
    canRedo: workspaceSnapshot.value?.canRedo ?? false,
    undo: undoDesign,
    redo: redoDesign,
  }))
  const hasUnsavedChanges = computed(() => dirty.value || !!configError.value)
  const workspaceRecoveryNotice = computed<WorkbenchRecoveryNotice | undefined>(() => {
    if (workspaceSnapshot.value?.lastError?.code === 'PROJECT_REVISION_CONFLICT') {
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

  function createPreviewModel(document: DesignerDocument): Record<string, unknown> {
    const values: Record<string, unknown> = {}
    const visit = (nodes: DesignerNode[]): void => {
      nodes.forEach((node) => {
        if (node.kind === 'field' && node.defaultValue !== undefined)
          values[node.field] = structuredClone(node.defaultValue)
        if (node.kind === 'container')
          Object.values(node.slots).forEach(visit)
      })
    }
    visit(document.nodes)
    return values
  }

  function mergePreviewModel(
    document: DesignerDocument,
    defaults: Record<string, unknown>,
  ): Record<string, unknown> {
    const fields = new Set<string>()
    const visit = (nodes: DesignerNode[]): void => {
      nodes.forEach((node) => {
        if (node.kind === 'field')
          fields.add(node.field)
        else
          Object.values(node.slots).forEach(visit)
      })
    }
    visit(document.nodes)

    const next: Record<string, unknown> = {}
    fields.forEach((field) => {
      if (Object.hasOwn(previewModel.value, field))
        next[field] = cloneWorkbenchJson(previewModel.value[field])
      else if (Object.hasOwn(defaults, field))
        next[field] = cloneWorkbenchJson(defaults[field])
    })
    return next
  }

  function publishWorkspaceProjection(snapshot: WorkspaceSessionSnapshot): void {
    const activeRegistry = currentAdapter.value?.designerRegistry
    if (!activeRegistry || snapshot.application.manifest.adapter !== currentApplication.value?.manifest.adapter)
      return
    previewFlowProjections.value = {}
    previewProjection.value = projectionCoordinator.publish(snapshot, (captured) => {
      const document = configModelToDesignerDocument(captured.currentPage.model)
      return compileDesignerDocument(document, activeRegistry)
    })
  }

  function acceptWorkspaceSnapshot(snapshot: WorkspaceSessionSnapshot): void {
    const previous = workspaceSnapshot.value
    const pageChanged = previous?.application.id !== snapshot.application.id
      || previous.currentPageId !== snapshot.currentPageId
    const modelChanged = pageChanged || previous?.modelRevision !== snapshot.modelRevision
    workspaceSnapshot.value = snapshot
    if (!modelChanged)
      return

    const document = configModelToDesignerDocument(snapshot.currentPage.model)
    previewModel.value = pageChanged
      ? createPreviewModel(document)
      : mergePreviewModel(document, createPreviewModel(document))
    if (pageChanged) {
      selectedDesignerIds.value = []
      lastRuntimePreview.value = undefined
    }
    publishWorkspaceProjection(snapshot)
  }

  function bindWorkspaceSession(session: WorkspaceSession): void {
    unsubscribeWorkspaceSession?.()
    workspaceSession.value = session
    unsubscribeWorkspaceSession = session.subscribe(acceptWorkspaceSnapshot)
  }

  function dispatchWorkspaceOperations(
    label: string,
    operations: WorkspaceOperation[],
    mergeKey?: string,
  ): boolean {
    const session = workspaceSession.value
    if (!session)
      return false
    const result = session.dispatch({
      id: `workspace-${++workspaceTransactionSequence}`,
      label,
      operations,
      ...(mergeKey ? { mergeKey } : {}),
    })
    configError.value = result.diagnostics[0]?.message ?? ''
    return result.changed
  }

  function updateDesigner(command: DesignerCommand, document: DesignerDocument): boolean {
    const model = configModel.value
    const pageId = currentPageId.value
    if (!model || !pageId)
      return false
    try {
      const operation = designerCommandToModelOperation(command, document, model.props)
      return dispatchWorkspaceOperations('Update design', [{ type: 'page.model', pageId, operation }])
    }
    catch (error) {
      configError.value = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  const designerCommandControl = { apply: updateDesigner }

  function updateModelOperation(operation: ModelOperation): void {
    if (currentPageId.value) {
      dispatchWorkspaceOperations('Update page model', [{
        type: 'page.model',
        pageId: currentPageId.value,
        operation,
      }])
    }
  }

  function handlePreviewRuntimeReady(revision: string): void {
    const applicationId = currentApplication.value?.id
    const pageId = currentPageId.value
    if (!applicationId || !pageId || !projectionCoordinator.isCurrent(revision) || !activePreview.value)
      return
    lastRuntimePreview.value = { applicationId, pageId, result: activePreview.value }
    fallbackPreviewModel.value = cloneWorkbenchJson(previewModel.value)
    runPreviewFlows('page.mount', previewModel.value)
  }

  function runPreviewFlows(kind: 'page.mount' | 'form.submit' | 'field.change', values: Record<string, unknown>, field?: string): void {
    const flows = configModel.value?.flows ?? []
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

    void previewFlowCoordinator.dispatch({
      flows,
      trigger: { kind, ...(field ? { field } : {}) },
      values: cloneWorkbenchJson(values),
      revision,
      signal,
      isCurrent: isCurrentRun,
      onTrace: (event) => {
        if (event.type === 'error' && event.error)
          message.value = event.error
      },
    }).then((result) => {
      if (!isCurrentRun())
        return
      if ((result.status === 'failure' || result.status === 'timeout') && result.error)
        message.value = result.error.message
      if (result.status !== 'committed')
        return

      const nextProjections: typeof previewFlowProjections.value = {}
      for (const flow of configModel.value?.flows ?? []) {
        const current = previewFlowProjections.value[flow.id]
        if (current)
          nextProjections[flow.id] = current
      }
      previewFlowProjections.value = { ...nextProjections, ...result.projectionUpdates }
      previewModel.value = applyPreviewFlowValuePatch(previewModel.value, result.valuePatch)
    })
  }

  function undoDesign(): boolean {
    const result = workspaceSession.value?.undo()
    configError.value = result?.diagnostics[0]?.message ?? ''
    return result?.changed ?? false
  }

  function redoDesign(): boolean {
    const result = workspaceSession.value?.redo()
    configError.value = result?.diagnostics[0]?.message ?? ''
    return result?.changed ?? false
  }

  async function refreshApplications(): Promise<void> {
    const activeRepository = repository.value
    if (!activeRepository)
      return
    const nextApplications = await activeRepository.list()
    if (!disposed && repository.value === activeRepository)
      applications.value = nextApplications
  }

  async function openApplication(id: string, pageId?: string): Promise<void> {
    const requestId = ++openApplicationRequestId
    const activeRepository = repository.value
    if (!activeRepository)
      return
    const application = await activeRepository.get(id)
    if (
      !application
      || disposed
      || requestId !== openApplicationRequestId
      || activeRepository !== repository.value
    ) {
      return
    }
    const adapter = await loadWorkbenchAdapter(application.manifest.adapter)
    if (
      disposed
      || requestId !== openApplicationRequestId
      || activeRepository !== repository.value
    ) {
      return
    }
    const page = application.pages.find(item => item.id === pageId)
      ?? application.pages.find(item => item.id === application.homePageId)
      ?? application.pages[0]
    if (!page)
      return
    lastRuntimePreview.value = undefined
    configError.value = ''
    currentAdapter.value = adapter
    bindWorkspaceSession(createWorkspaceSession({
      application,
      currentPageId: page.id,
      modelOperationOptions: { flowActions: flowActionRegistry },
      modelRevision: application.revision,
      registry: adapter.lowCodeRegistry,
      repository: activeRepository,
    }))
    templatePickerOpen.value = false
  }

  async function requestOpenApplication(id: string, pageId?: string): Promise<void> {
    if (currentApplication.value?.id === id) {
      if (pageId && currentPageId.value !== pageId)
        workspaceSession.value?.setCurrentPage(pageId)
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
      await repository.value.create(application)
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
      const changed = dispatchWorkspaceOperations('Add page', [{
        type: 'application',
        operation: { type: 'add-page', page },
      }])
      if (changed)
        workspaceSession.value?.setCurrentPage(page.id)
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
      dispatchWorkspaceOperations('Update pages', [{
        type: 'application',
        operation: resolvedOperation,
      }])
    }
    catch (error) {
      message.value = error instanceof Error ? error.message : String(error)
    }
  }

  async function saveProject(): Promise<void> {
    const session = workspaceSession.value
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
            { revision: result.revision },
          )
        : workbenchLocale.value.t('workbench.saved', 'Saved revision {revision}', { revision: result.revision })
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
    const result = workspaceSession.value?.setCurrentPage(pageId)
    configError.value = result?.diagnostics[0]?.message ?? ''
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
      const openedRepository = await openDefaultWorkspaceApplicationRepository()
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
    unsubscribeWorkspaceSession?.()
    projectionCoordinator.invalidate('workbench-unmounted')
    repository.value?.close()
  })

  return {
    activePreview,
    applications,
    busy,
    closeExportPreview,
    closeFlowWorkspace,
    closePageManager,
    closeTemplatePicker,
    configError,
    configModel,
    createApplication,
    currentApplication,
    currentPage,
    currentPageId,
    currentSourceRevisionKey,
    designerCommandControl,
    designerDocument,
    designerFieldNames,
    designerHistoryControl,
    designerLayers,
    dirty,
    exportPreviewMode,
    fallbackPreviewModel,
    flowWorkspaceOpen,
    handleApplicationOperation,
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
    runtimeFallbackPreview,
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
    workbenchLocale,
    workspaceRecoveryNotice,
  }
}

export type WorkbenchController = ReturnType<typeof createWorkbenchController>
