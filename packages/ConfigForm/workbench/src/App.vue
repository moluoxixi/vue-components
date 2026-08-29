<script setup lang="ts">
import type {
  ConfigModelHistory,
  DesignerDocument,
  DesignerCommand,
  DesignerCompileSuccess,
  DesignerLocaleOptions,
  DesignerNode,
  DesignerRegistry,
  DesignerSelectionMode,
  ConfigFormDesignerExpose,
  LowCodePageModel,
  ModelOperation,
} from '@moluoxixi/config-form-designer'
import type {
  ProjectPath,
  WorkspaceApplication,
  WorkspaceApplicationOperation,
  WorkspaceApplicationRepository,
  WorkspaceApplicationSummary,
  ExportSnapshot,
} from './project'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { ConfigFormRendererExpose } from '@moluoxixi/config-form/renderer'
import {
  Blocks,
  Braces,
  ChevronDown as MoveDown,
  ChevronDown,
  ChevronUp,
  Code2,
  Clipboard,
  Copy,
  Download,
  Files,
  Layers3,
  IndentDecrease,
  IndentIncrease,
  Maximize2,
  Minimize2,
  Moon,
  Monitor,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Smartphone,
  Tablet,
  Trash2,
  Sun,
  Undo2,
  Workflow,
  X,
} from '@lucide/vue'
import {
  applyConfigModelOperation,
  compileDesignerDocument,
  configModelToDesignerDocument,
  ConfigFormDesigner,
  createConfigModelHistory,
  createDesignerLocale,
  createLowCodeComponentRegistry,
  DesignerPalette,
  designerCommandToModelOperation,
  redoConfigModelHistory,
  undoConfigModelHistory,
} from '@moluoxixi/config-form-designer'
import { createAntdVueDesignerRegistry } from '@moluoxixi/config-form-designer-antd-vue'
import { createElementPlusDesignerRegistry } from '@moluoxixi/config-form-designer-element-plus'
import { ConfigFormFlowInterpreter } from '@moluoxixi/config-form-core'
import { ConfigFormRenderer } from '@moluoxixi/config-form/renderer'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import PreviewRuntimeBoundary from './components/PreviewRuntimeBoundary.vue'
import FlowWorkspace from './components/FlowWorkspace.vue'
import PageManager from './components/PageManager.vue'
import ProjectFileTree from './components/ProjectFileTree.vue'
import {
  applyPreviewFlowValuePatch,
  createPreviewRevisionGate,
  createWorkbenchFlowActionRegistry,
  PreviewFlowCoordinator,
} from './preview'
import { cloneWorkbenchJson } from './utils/clone'
import {
  BUILT_IN_WORKSPACE_TEMPLATES,
  applyWorkspaceApplicationOperation,
  buildProjectFileTree,
  cloneWorkspaceApplication,
  collectProjectTreeDirectoryIds,
  createExportSnapshot,
  createBuiltInWorkspaceApplication,
  createBuiltInWorkspacePage,
  createWorkspaceApplicationSourceExport,
  downloadWorkspaceArchive,
  duplicateWorkspacePage,
  isExportSnapshotStale,
  nextWorkspacePageId,
  nextWorkspacePageRoute,
  normalizeProjectPath,
  openDefaultWorkspaceApplicationRepository,
  resolveExportSnapshotPath,
  WORKSPACE_CONFIG_MODULE_PATH,
} from './project'
import { formatLowCodePageConfig } from './workbench/config-codec'

const WorkspaceCodeEditor = defineAsyncComponent(() => import('./components/WorkspaceCodeEditor.vue'))

type MobileSurface = 'edit' | 'preview'
type PreviewViewport = 'desktop' | 'tablet' | 'mobile'
type DesignerLeftView = 'components' | 'layers' | 'pages'
type WorkbenchTheme = 'dark' | 'light'

const props = defineProps<{
  locale?: DesignerLocaleOptions
}>()

const SOURCE_PATH = normalizeProjectPath('src/App.vue')
const CONFIG_PATH = WORKSPACE_CONFIG_MODULE_PATH
const previewViewports = [
  { icon: Monitor, id: 'desktop' as const, label: 'Desktop preview' },
  { icon: Tablet, id: 'tablet' as const, label: 'Tablet preview' },
  { icon: Smartphone, id: 'mobile' as const, label: 'Mobile preview' },
]
const designerLeftViews = [
  { icon: Blocks, id: 'components' as const, label: 'Components' },
  { icon: Layers3, id: 'layers' as const, label: 'Layers' },
  { icon: Files, id: 'pages' as const, label: 'Pages' },
]
const registries: Record<WorkspaceApplication['manifest']['adapter'], DesignerRegistry> = {
  'antd-vue': createAntdVueDesignerRegistry(),
  'element-plus': createElementPlusDesignerRegistry(),
}
const lowCodeRegistries = {
  'antd-vue': createLowCodeComponentRegistry(registries['antd-vue']),
  'element-plus': createLowCodeComponentRegistry(registries['element-plus']),
}

const repository = shallowRef<WorkspaceApplicationRepository>()
const applications = ref<WorkspaceApplicationSummary[]>([])
const currentApplication = shallowRef<WorkspaceApplication>()
const currentPageId = ref('')
const configHistory = shallowRef<ConfigModelHistory>()
const configError = ref('')
const mobileSurface = ref<MobileSurface>('edit')
const previewOpen = ref(false)
const previewExpanded = ref(false)
const previewViewport = ref<PreviewViewport>('desktop')
const previewModel = ref<Record<string, unknown>>({})
const fallbackPreviewModel = ref<Record<string, unknown>>({})
const previewFlowProjections = shallowRef<Record<string, ConfigFormReactionProjection<Record<string, unknown>>>>({})
const rendererPreviewVersion = ref(0)
const dirty = ref(false)
const templatePickerOpen = ref(false)
const pageManagerOpen = ref(false)
const exportMenuOpen = ref(false)
const exportPreviewMode = ref<'source' | 'config'>()
const flowWorkspaceOpen = ref(false)
const configViewMode = ref<'source' | 'json' | 'tree'>('source')
const exportPreviewReturnFocus = ref<HTMLElement>()
const activeDesignerLeftView = ref<DesignerLeftView>('components')
const selectedDesignerIds = ref<string[]>([])
const sourceViewPath = ref<ProjectPath>(SOURCE_PATH)
const sourceSnapshot = shallowRef<ExportSnapshot>()
const sourceSnapshotError = ref('')
const sourceTreeExpandedIds = ref<string[]>([])
const sourceMobileView = ref<'tree' | 'code'>('tree')
const sourceMutationRevision = ref(0)
const theme = ref<WorkbenchTheme>('dark')
const busy = ref(false)
const message = ref('')
const newPageButtonRef = useTemplateRef<HTMLButtonElement>('newPageButton')
const exportButtonRef = useTemplateRef<HTMLButtonElement>('exportButton')
const templateDialogRef = useTemplateRef<HTMLElement>('templateDialog')
const pageManagerDialogRef = useTemplateRef<HTMLElement>('pageManagerDialog')
const exportDialogRef = useTemplateRef<HTMLElement>('exportDialog')
const flowDialogRef = useTemplateRef<HTMLElement>('flowDialog')
const designerRef = useTemplateRef<ConfigFormDesignerExpose>('designer')
const previewRendererRef = useTemplateRef<ConfigFormRendererExpose<Record<string, unknown>>>('previewRenderer')
const fallbackPreviewRendererRef = useTemplateRef<ConfigFormRendererExpose<Record<string, unknown>>>('fallbackPreviewRenderer')
const designerLeftTabsRef = useTemplateRef<HTMLElement>('designerLeftTabs')
const mobileSurfaceTabsRef = useTemplateRef<HTMLElement>('mobileSurfaceTabs')
let openApplicationRequestId = 0
let disposed = false
let pageManagerReturnFocus: HTMLElement | undefined
const previewRevisionGate = createPreviewRevisionGate()
let previewFlowAbortController = new AbortController()
const flowActionRegistry = createWorkbenchFlowActionRegistry(
  value => message.value = value,
)
const flowInterpreter = new ConfigFormFlowInterpreter(flowActionRegistry)
const previewFlowCoordinator = new PreviewFlowCoordinator(flowInterpreter)
const workbenchLocale = computed(() => createDesignerLocale(props.locale))

function advancePreviewRevision(): string {
  previewFlowAbortController.abort('revision-changed')
  previewFlowAbortController = new AbortController()
  previewFlowProjections.value = {}
  rendererPreviewVersion.value += 1
  const revision = currentApplication.value && currentPageId.value
    ? `${currentApplication.value.id}-${currentPageId.value}-${rendererPreviewVersion.value}`
    : ''
  previewRevisionGate.request(revision)
  return revision
}

const currentPage = computed(() => currentApplication.value?.pages.find(page => page.id === currentPageId.value))
const lowCodeRegistry = computed(() => currentApplication.value
  ? lowCodeRegistries[currentApplication.value.manifest.adapter]
  : lowCodeRegistries['element-plus'])
const registry = computed(() => lowCodeRegistry.value.designer)
const configModel = computed(() => configHistory.value?.present)
const modelRevision = computed(() => configHistory.value?.revision ?? 0)
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
interface DesignerLayerEntry { id: string, label: string, component: string, depth: number }
const designerLayers = computed<DesignerLayerEntry[]>(() => {
  const entries: DesignerLayerEntry[] = []
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
const currentSourceRevisionKey = computed(() => currentApplication.value
  ? `${currentApplication.value.id}:${currentApplication.value.revision}:${currentPageId.value}:${modelRevision.value}:${sourceMutationRevision.value}`
  : '')
const sourceSnapshotStale = computed(() => isExportSnapshotStale(
  sourceSnapshot.value,
  currentApplication.value?.id,
  currentSourceRevisionKey.value,
))
const sourceFileTree = computed(() => sourceSnapshot.value
  ? buildProjectFileTree(sourceSnapshot.value.files)
  : [])
const selectedSourceFile = computed(() => sourceSnapshot.value?.files[sourceViewPath.value])
const sourceCode = computed(() => {
  const file = selectedSourceFile.value
  return file?.kind === 'text' ? file.content : ''
})
const sourceLanguage = computed(() => {
  const file = selectedSourceFile.value
  if (file?.kind === 'text' && file.language)
    return file.language
  if (sourceViewPath.value.endsWith('.vue')) return 'vue'
  if (sourceViewPath.value.endsWith('.json')) return 'json'
  if (sourceViewPath.value.endsWith('.css')) return 'css'
  if (sourceViewPath.value.endsWith('.html')) return 'html'
  return 'typescript'
})
const generatedConfigSource = computed(() => configModel.value
  ? formatLowCodePageConfig(configModel.value, lowCodeRegistry.value)
  : '')
const generatedConfigJson = computed(() => configModel.value
  ? `${JSON.stringify(configModel.value, null, 2)}\n`
  : '')
interface ConfigTreeEntry { path: string, value: string, depth: number, branch: boolean }
const generatedConfigTree = computed<ConfigTreeEntry[]>(() => {
  const root = configModel.value
  if (!root)
    return []
  const entries: ConfigTreeEntry[] = []
  const visit = (value: unknown, path: string, depth: number): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, depth))
      return
    }
    if (typeof value === 'object' && value !== null) {
      for (const [key, child] of Object.entries(value)) {
        const childPath = path ? `${path}.${key}` : key
        const branch = typeof child === 'object' && child !== null
        entries.push({ path: childPath, value: branch ? (Array.isArray(child) ? `[${child.length}]` : '{…}') : JSON.stringify(child), depth, branch })
        if (branch)
          visit(child, childPath, depth + 1)
      }
    }
  }
  visit(root, '', 0)
  return entries
})
const compiledPreview = computed(() => designerDocument.value
  ? compileDesignerDocument(designerDocument.value, registry.value)
  : undefined)
const lastValidPreview = shallowRef<{
  projectId: string
  revision: number
  result: DesignerCompileSuccess
}>()
const lastRuntimePreview = shallowRef<{
  projectId: string
  result: DesignerCompileSuccess
}>()
watch(compiledPreview, (result) => {
  const projectId = currentApplication.value?.id
  if (result?.success && projectId) {
    lastValidPreview.value = {
      projectId,
      revision: modelRevision.value,
      result,
    }
  }
}, { immediate: true })
const activePreview = computed(() => {
  if (compiledPreview.value?.success)
    return compiledPreview.value
  const lastValid = lastValidPreview.value
  if (lastValid && lastValid.projectId === currentApplication.value?.id)
    return lastValid.result
  return undefined
})
const previewState = computed(() => {
  if (configError.value || !compiledPreview.value?.success) {
    if (activePreview.value)
      return { label: `Last valid r${lastValidPreview.value?.revision ?? modelRevision.value}`, tone: 'error' as const }
    return { label: 'Blocked', tone: 'error' as const }
  }
  return { label: dirty.value ? 'Live draft' : 'Live', tone: 'live' as const }
})
const runtimeFallbackPreview = computed(() => {
  const fallback = lastRuntimePreview.value
  if (!fallback || fallback.projectId !== currentApplication.value?.id)
    return undefined
  return fallback.result
})
const designerHistoryControl = computed(() => ({
  canUndo: (configHistory.value?.past.length ?? 0) > 0,
  canRedo: (configHistory.value?.future.length ?? 0) > 0,
  undo: undoDesign,
  redo: redoDesign,
}))
const hasUnsavedChanges = computed(() => dirty.value || !!configError.value)
const statusLabel = computed(() => {
  if (!repository.value)
    return 'Loading'
  if (hasUnsavedChanges.value)
    return 'Unsaved'
  return repository.value.persistence === 'durable' ? 'Saved locally' : 'Temporary session'
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

function materializeModel(model: LowCodePageModel): void {
  const application = currentApplication.value
  const page = currentPage.value
  if (!application || !page)
    return
  const document = configModelToDesignerDocument(model)
  const next = cloneWorkspaceApplication(application)
  const nextPage = next.pages.find(item => item.id === page.id)
  if (!nextPage)
    return
  nextPage.model = structuredClone(model)
  currentApplication.value = next
  sourceMutationRevision.value += 1
  previewModel.value = mergePreviewModel(document, createPreviewModel(document))
  advancePreviewRevision()
  dirty.value = true
}

function commitModelHistory(result: ReturnType<typeof applyConfigModelOperation>): boolean {
  if (!result.changed) {
    configError.value = result.diagnostics[0]?.message ?? ''
    return false
  }
  configError.value = ''
  configHistory.value = result.history
  materializeModel(result.history.present)
  return true
}

function updateDesigner(command: DesignerCommand, document: DesignerDocument): boolean {
  const history = configHistory.value
  if (!history)
    return false
  try {
    const operation = designerCommandToModelOperation(command, document, history.present.props)
    return commitModelHistory(applyConfigModelOperation(history, operation, lowCodeRegistry.value, { flowActions: flowActionRegistry }))
  }
  catch (error) {
    configError.value = error instanceof Error ? error.message : String(error)
    dirty.value = true
    return false
  }
}

const designerCommandControl = { apply: updateDesigner }

function updateModelOperation(operation: ModelOperation): void {
  const history = configHistory.value
  if (history)
    commitModelHistory(applyConfigModelOperation(history, operation, lowCodeRegistry.value, { flowActions: flowActionRegistry }))
}

function handlePreviewRuntimeReady(revision: string): void {
  const applicationId = currentApplication.value?.id
  const expectedRevision = applicationId && currentPageId.value
    ? `${applicationId}-${currentPageId.value}-${rendererPreviewVersion.value}`
    : ''
  if (!applicationId || revision !== expectedRevision || !previewRevisionGate.isCurrent(revision) || !activePreview.value)
    return
  lastRuntimePreview.value = { projectId: applicationId, result: activePreview.value }
  fallbackPreviewModel.value = cloneWorkbenchJson(previewModel.value)
  runPreviewFlows('page.mount', previewModel.value)
}

function submitPreviewForm(): void {
  const renderer = previewRendererRef.value ?? fallbackPreviewRendererRef.value
  if (!renderer)
    return
  void renderer.submit().catch((error) => {
    message.value = error instanceof Error ? error.message : String(error)
  })
}

function runPreviewFlows(kind: 'page.mount' | 'form.submit' | 'field.change', values: Record<string, unknown>, field?: string): void {
  const flows = configModel.value?.flows ?? []
  const applicationId = currentApplication.value?.id
  const pageId = currentPageId.value
  if (!applicationId || !pageId)
    return
  const revision = modelRevision.value
  const signal = previewFlowAbortController.signal
  const isCurrentRun = (): boolean => applicationId === currentApplication.value?.id
    && pageId === currentPageId.value
    && revision === modelRevision.value
    && !signal.aborted

  void previewFlowCoordinator.dispatch({
    flows,
    trigger: { kind, ...(field ? { field } : {}) },
    values: cloneWorkbenchJson(values),
    revision,
    signal,
    isCurrent: isCurrentRun,
    onTrace: event => {
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
  const history = configHistory.value
  return history ? commitModelHistory(undoConfigModelHistory(history, lowCodeRegistry.value, { flowActions: flowActionRegistry })) : false
}

function redoDesign(): boolean {
  const history = configHistory.value
  return history ? commitModelHistory(redoConfigModelHistory(history, lowCodeRegistry.value, { flowActions: flowActionRegistry })) : false
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
  const application = await activeRepository?.get(id)
  if (
    !application
    || disposed
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
  lastValidPreview.value = undefined
  lastRuntimePreview.value = undefined
  currentApplication.value = application
  sourceMutationRevision.value += 1
  currentPageId.value = page.id
  configHistory.value = createConfigModelHistory(page.model, { revision: application.revision })
  advancePreviewRevision()
  configError.value = ''
  dirty.value = false
  previewModel.value = createPreviewModel(configModelToDesignerDocument(page.model))
  selectedDesignerIds.value = []
  templatePickerOpen.value = false
}

async function requestOpenApplication(id: string, pageId?: string): Promise<void> {
  if (currentApplication.value?.id === id && (!pageId || currentPageId.value === pageId))
    return
  if (hasUnsavedChanges.value) {
    message.value = 'Save or resolve the current draft before switching pages.'
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
    currentApplication.value = applyWorkspaceApplicationOperation(application, { type: 'add-page', page })
    sourceMutationRevision.value += 1
    currentPageId.value = page.id
    configHistory.value = createConfigModelHistory(page.model, { revision: application.revision })
    previewModel.value = createPreviewModel(configModelToDesignerDocument(page.model))
    dirty.value = true
    selectedDesignerIds.value = []
    templatePickerOpen.value = false
    advancePreviewRevision()
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
    const previousPageId = currentPageId.value
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
    const next = applyWorkspaceApplicationOperation(application, resolvedOperation)
    currentApplication.value = next
    sourceMutationRevision.value += 1
    const activePage = next.pages.find(page => page.id === previousPageId) ?? next.pages[0]!
    currentPageId.value = activePage.id
    if (activePage.id !== previousPageId) {
      configHistory.value = createConfigModelHistory(activePage.model, { revision: next.revision })
    }
    else if (configHistory.value) {
      configHistory.value = {
        ...configHistory.value,
        present: structuredClone(activePage.model),
      }
    }
    dirty.value = true
    if (activePage.id !== previousPageId) {
      selectedDesignerIds.value = []
      previewModel.value = createPreviewModel(configModelToDesignerDocument(activePage.model))
      advancePreviewRevision()
    }
  }
  catch (error) {
    message.value = error instanceof Error ? error.message : String(error)
  }
}

async function saveProject(): Promise<void> {
  const application = currentApplication.value
  if (!application || !repository.value || configError.value || busy.value)
    return
  busy.value = true
  message.value = ''
  try {
    const committed = await repository.value.commit(application.id, application.revision, application)
    if (currentApplication.value === application) {
      currentApplication.value = committed
      dirty.value = false
    }
    else if (currentApplication.value?.id === application.id) {
      currentApplication.value = {
        ...currentApplication.value,
        revision: committed.revision,
        updatedAt: committed.updatedAt,
      }
      dirty.value = true
    }
    await refreshApplications()
    message.value = dirty.value
      ? `Saved revision ${committed.revision}; newer edits remain unsaved`
      : `Saved revision ${committed.revision}`
  }
  catch (error) {
    message.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    busy.value = false
  }
}

async function exportProject(): Promise<void> {
  const snapshot = sourceSnapshot.value
  if (!snapshot)
    return
  try {
    const filename = await downloadWorkspaceArchive({ name: snapshot.applicationName, files: snapshot.files })
    message.value = `Downloaded ${filename}`
  }
  catch (error) {
    message.value = error instanceof Error ? error.message : String(error)
  }
}

function refreshSourceSnapshot(): void {
  const application = currentApplication.value
  if (!application)
    return
  try {
    const exported = createWorkspaceApplicationSourceExport(application, lowCodeRegistry.value)
    const next = createExportSnapshot({
      applicationId: application.id,
      applicationName: application.name,
      applicationRevision: application.revision,
      entry: SOURCE_PATH,
      files: exported.files,
      modelRevision: modelRevision.value,
      revisionKey: currentSourceRevisionKey.value,
    })
    const selected = resolveExportSnapshotPath(next, sourceViewPath.value)
    sourceSnapshot.value = next
    sourceSnapshotError.value = ''
    sourceViewPath.value = selected ?? SOURCE_PATH
    sourceTreeExpandedIds.value = collectProjectTreeDirectoryIds(buildProjectFileTree(next.files))
  }
  catch (error) {
    sourceSnapshotError.value = error instanceof Error ? error.message : String(error)
  }
}

function selectSourcePath(path: ProjectPath): void {
  sourceViewPath.value = path
  sourceMobileView.value = 'code'
}

function openExportPreview(mode: 'source' | 'config'): void {
  exportMenuOpen.value = false
  exportPreviewMode.value = mode
  if (mode === 'config')
    configViewMode.value = 'source'
  else {
    sourceViewPath.value = SOURCE_PATH
    sourceMobileView.value = 'tree'
    sourceSnapshot.value = undefined
    sourceSnapshotError.value = ''
    refreshSourceSnapshot()
  }
  exportPreviewReturnFocus.value = exportButtonRef.value
    ?? (document.activeElement instanceof HTMLElement ? document.activeElement : undefined)
  void nextTick(() => exportDialogRef.value?.querySelector<HTMLButtonElement>('button')?.focus())
}

function closeExportPreview(): void {
  exportPreviewMode.value = undefined
  void nextTick(() => exportPreviewReturnFocus.value?.focus())
}

function openFlowWorkspace(): void {
  if (!currentApplication.value)
    return
  flowWorkspaceOpen.value = true
  void nextTick(() => flowDialogRef.value?.querySelector<HTMLElement>('button, input, select')?.focus())
}

function closeFlowWorkspace(): void {
  flowWorkspaceOpen.value = false
}

function exportPreviewText(): string {
  if (exportPreviewMode.value === 'source')
    return sourceCode.value
  return configViewMode.value === 'source' ? generatedConfigSource.value : generatedConfigJson.value
}

async function copyExportPreview(): Promise<void> {
  if (exportPreviewMode.value === 'source' && !sourceSnapshot.value) {
    message.value = sourceSnapshotError.value
    return
  }
  try {
    if (!navigator.clipboard)
      throw new Error('Clipboard API is unavailable.')
    await navigator.clipboard.writeText(exportPreviewText())
    message.value = 'Copied export to clipboard'
  }
  catch (error) {
    message.value = error instanceof Error ? error.message : 'Unable to copy export.'
  }
}

function downloadExportPreview(): void {
  const mode = exportPreviewMode.value
  if (!mode || (mode === 'source' && !sourceSnapshot.value))
    return
  const url = URL.createObjectURL(new Blob([exportPreviewText()], { type: mode === 'source' || configViewMode.value === 'source' ? 'text/plain' : 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = mode === 'source'
    ? sourceViewPath.value.split('/').at(-1)!
    : configViewMode.value === 'source' ? 'form.config.ts' : 'page.config.json'
  anchor.click()
  URL.revokeObjectURL(url)
  message.value = `Downloaded ${mode === 'source' ? 'source' : 'config'} export`
}

function togglePreview(): void {
  previewOpen.value = !previewOpen.value
  if (!previewOpen.value)
    previewExpanded.value = false
  if (!previewOpen.value && mobileSurface.value === 'preview')
    mobileSurface.value = 'edit'
}

function showMobileSurface(surface: MobileSurface): void {
  mobileSurface.value = surface
  previewExpanded.value = false
  if (surface === 'preview')
    previewOpen.value = true
}

function selectDesignerLayer(nodeId: string, event: MouseEvent): void {
  const mode: DesignerSelectionMode = event.shiftKey
    ? 'range'
    : event.ctrlKey || event.metaKey ? 'toggle' : 'replace'
  designerRef.value?.select(nodeId, mode)
}

function moveDesignerLayer(
  action: 'moveBefore' | 'moveAfter' | 'indent' | 'outdent',
  nodeId: string,
): void {
  designerRef.value?.performNodeAction(action, nodeId)
}

function toggleTheme(): void {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

async function selectPageFromDesigner(pageId: string): Promise<void> {
  const application = currentApplication.value
  if (!application || pageId === currentPageId.value)
    return
  if (hasUnsavedChanges.value) {
    message.value = 'Save or resolve the current draft before switching pages.'
    return
  }
  const page = application.pages.find(item => item.id === pageId)
  if (!page)
    return
  currentPageId.value = page.id
  configHistory.value = createConfigModelHistory(page.model, { revision: application.revision })
  configError.value = ''
  selectedDesignerIds.value = []
  previewModel.value = createPreviewModel(configModelToDesignerDocument(page.model))
  lastValidPreview.value = undefined
  lastRuntimePreview.value = undefined
  advancePreviewRevision()
}

function resolveKeyboardTab<T extends string>(
  event: KeyboardEvent,
  current: T,
  ids: readonly T[],
): T | undefined {
  const index = ids.indexOf(current)
  let nextIndex = index
  if (event.key === 'ArrowRight')
    nextIndex = (index + 1) % ids.length
  else if (event.key === 'ArrowLeft')
    nextIndex = (index - 1 + ids.length) % ids.length
  else if (event.key === 'Home')
    nextIndex = 0
  else if (event.key === 'End')
    nextIndex = ids.length - 1
  else
    return undefined
  event.preventDefault()
  return ids[nextIndex]
}

function handleMobileSurfaceTabKeydown(event: KeyboardEvent, surface: MobileSurface): void {
  const nextSurface = resolveKeyboardTab(event, surface, ['edit', 'preview'])
  if (!nextSurface)
    return
  showMobileSurface(nextSurface)
  void nextTick(() => mobileSurfaceTabsRef.value
    ?.querySelector<HTMLButtonElement>(`[data-mobile-surface-tab="${nextSurface}"]`)
    ?.focus())
}

function handleDesignerLeftTabKeydown(event: KeyboardEvent, view: DesignerLeftView): void {
  const nextView = resolveKeyboardTab(event, view, designerLeftViews.map(item => item.id))
  if (!nextView)
    return
  activeDesignerLeftView.value = nextView
  void nextTick(() => designerLeftTabsRef.value
    ?.querySelector<HTMLButtonElement>(`[data-designer-left-tab="${nextView}"]`)
    ?.focus())
}

function openTemplatePicker(): void {
  templatePickerOpen.value = true
  void nextTick(() => templateDialogRef.value?.querySelector<HTMLButtonElement>('.template-list button')?.focus())
}

function openPageTemplatePicker(): void {
  pageManagerOpen.value = false
  openTemplatePicker()
}

function openPageManager(event?: Event): void {
  pageManagerReturnFocus = event?.currentTarget instanceof HTMLElement
    ? event.currentTarget
    : document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined
  pageManagerOpen.value = true
  void nextTick(() => pageManagerDialogRef.value?.querySelector<HTMLElement>('button, input, select')?.focus())
}

function closePageManager(): void {
  pageManagerOpen.value = false
  void nextTick(() => pageManagerReturnFocus?.focus())
}

function closeTemplatePicker(): void {
  templatePickerOpen.value = false
  void nextTick(() => newPageButtonRef.value?.focus())
}

function handleDialogKeydown(event: KeyboardEvent, dialog: HTMLElement | null, close: () => void): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab' || !dialog)
    return
  const focusable = [...dialog.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )]
  if (focusable.length === 0)
    return
  const first = focusable[0]!
  const last = focusable.at(-1)!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function handleTemplateDialogKeydown(event: KeyboardEvent): void {
  handleDialogKeydown(event, templateDialogRef.value, closeTemplatePicker)
}

function handlePageManagerKeydown(event: KeyboardEvent): void {
  handleDialogKeydown(event, pageManagerDialogRef.value, closePageManager)
}

function handleExportDialogKeydown(event: KeyboardEvent): void {
  handleDialogKeydown(event, exportDialogRef.value, closeExportPreview)
}

function handleFlowDialogKeydown(event: KeyboardEvent): void {
  handleDialogKeydown(event, flowDialogRef.value, closeFlowWorkspace)
}

onMounted(async () => {
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
})

onBeforeUnmount(() => {
  disposed = true
  openApplicationRequestId += 1
  previewFlowAbortController.abort('workbench-unmounted')
  previewRevisionGate.invalidate()
  repository.value?.close()
})
</script>

<template>
  <main class="workbench-app" :data-theme="theme">
    <header class="workbench-topbar">
      <div class="brand-lockup">
        <span>ConfigForm</span>
        <strong>Workbench</strong>
      </div>

      <div v-if="currentApplication && currentPage" class="workspace-context" aria-label="Current application and page">
        <span>{{ currentApplication.name }}</span>
        <strong>{{ currentPage.name }}</strong>
      </div>

      <div class="topbar-actions">
        <button
          v-if="currentApplication"
          type="button"
          class="mobile-page-manager-button"
          title="Manage pages"
          aria-label="Manage pages"
          @click="openPageManager"
        >
          <Files :size="17" aria-hidden="true" />
        </button>
        <span v-if="currentApplication" class="revision-state" :class="{ 'is-dirty': dirty }">
          r{{ currentApplication.revision }} · {{ statusLabel }}
        </span>
        <button ref="newPageButton" type="button" title="New page" aria-label="New page" @click="openTemplatePicker">
          <Plus :size="17" aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Save"
          aria-label="Save"
          :disabled="!dirty || !!configError || busy"
          @click="saveProject"
        >
          <Save :size="17" aria-hidden="true" />
        </button>
        <div v-if="currentApplication" class="export-menu">
          <button
            ref="exportButton"
            type="button"
            title="Export"
            aria-label="Export"
            :aria-expanded="exportMenuOpen"
            aria-haspopup="menu"
            @click="exportMenuOpen = !exportMenuOpen"
          >
            <Download :size="16" aria-hidden="true" />
            <ChevronDown class="export-chevron" :size="13" aria-hidden="true" />
          </button>
          <div v-if="exportMenuOpen" class="export-menu-popover" role="menu">
            <button type="button" role="menuitem" @click="openExportPreview('source')">
              <Code2 :size="15" aria-hidden="true" />
              <span>导出源码</span>
            </button>
            <button type="button" role="menuitem" @click="openExportPreview('config')">
              <Braces :size="15" aria-hidden="true" />
              <span>导出配置</span>
            </button>
          </div>
        </div>
        <button
          v-if="currentApplication"
          type="button"
          :class="{ 'is-active': flowWorkspaceOpen }"
          :title="workbenchLocale.t('flow.dialog.title', 'Flow orchestration')"
          :aria-label="workbenchLocale.t('flow.dialog.title', 'Flow orchestration')"
          :aria-expanded="flowWorkspaceOpen"
          data-flow-workspace-trigger
          @click="openFlowWorkspace"
        >
          <Workflow :size="17" aria-hidden="true" />
        </button>
        <button type="button" :title="theme === 'dark' ? 'Use light theme' : 'Use dark theme'" :aria-label="theme === 'dark' ? 'Use light theme' : 'Use dark theme'" @click="toggleTheme">
          <Sun v-if="theme === 'dark'" :size="17" aria-hidden="true" />
          <Moon v-else :size="17" aria-hidden="true" />
        </button>
        <button
          v-if="currentApplication"
          type="button"
          class="preview-toggle-button"
          :title="previewOpen ? 'Hide preview' : 'Show preview'"
          :aria-label="previewOpen ? 'Hide preview' : 'Show preview'"
          @click="togglePreview"
        >
          <PanelRightClose v-if="previewOpen" :size="17" aria-hidden="true" />
          <PanelRightOpen v-else :size="17" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div v-if="currentApplication" ref="mobileSurfaceTabs" class="mobile-surface-tabs" role="tablist" aria-label="Workspace surface">
      <button id="mobile-edit-tab" type="button" role="tab" aria-controls="workspace-panel" :aria-selected="mobileSurface === 'edit'" data-mobile-surface-tab="edit" :tabindex="mobileSurface === 'edit' ? 0 : -1" @click="showMobileSurface('edit')" @keydown="handleMobileSurfaceTabKeydown($event, 'edit')">
        Edit
      </button>
      <button id="mobile-preview-tab" type="button" role="tab" aria-controls="workspace-panel" :aria-selected="mobileSurface === 'preview'" data-mobile-surface-tab="preview" :tabindex="mobileSurface === 'preview' ? 0 : -1" @click="showMobileSurface('preview')" @keydown="handleMobileSurfaceTabKeydown($event, 'preview')">
        Preview
      </button>
    </div>

    <section
      v-if="currentApplication"
      id="workspace-panel"
      class="workbench-layout"
      role="tabpanel"
      :aria-labelledby="mobileSurface === 'edit' ? 'mobile-edit-tab' : 'mobile-preview-tab'"
      :class="{
        'is-preview-collapsed': !previewOpen,
        'is-preview-expanded': previewExpanded,
        'show-mobile-preview': mobileSurface === 'preview',
      }"
    >
      <section
        id="page-editor-panel"
        class="editor-pane"
        :aria-hidden="previewExpanded ? 'true' : undefined"
        aria-label="Design editor"
        :inert="previewExpanded ? true : undefined"
      >
        <header class="pane-header design-pane-header">
          <div class="editor-file-meta">
            <Blocks :size="14" aria-hidden="true" />
            <span>Design canvas</span>
            <small>DESIGN</small>
          </div>
        </header>

        <div class="provider-surface">
          <ConfigFormDesigner
            v-if="designerDocument"
            ref="designer"
            :key="`${currentApplication.manifest.adapter}-${currentPageId}`"
            class="embedded-designer"
            :document="designerDocument"
            :model="configModel"
            :model-registry="lowCodeRegistry"
            :command-control="designerCommandControl"
            :history-control="designerHistoryControl"
            :locale="props.locale"
            :readonly="busy"
            :registry="registry"
            @selection-set-change="selectedDesignerIds = $event"
            @model-operation="updateModelOperation"
          >
            <template #toolbar="{ breakpoint, canUndo, canRedo, canEditSelection, copySelection, removeSelection, selectBreakpoint, undo, redo }">
              <div class="mx-config-form-designer__toolbar-actions" role="toolbar" aria-label="Designer commands">
                <button type="button" class="mx-config-form-designer__icon-button" :disabled="!canUndo" title="Undo" aria-label="Undo" @click="undo">
                  <Undo2 :size="17" aria-hidden="true" />
                </button>
                <button type="button" class="mx-config-form-designer__icon-button" :disabled="!canRedo" title="Redo" aria-label="Redo" @click="redo">
                  <Redo2 :size="17" aria-hidden="true" />
                </button>
                <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
                <button type="button" class="mx-config-form-designer__icon-button" :disabled="!canEditSelection" title="Copy selection" aria-label="Copy selection" @click="copySelection">
                  <Copy :size="16" aria-hidden="true" />
                </button>
                <button type="button" class="mx-config-form-designer__icon-button is-danger" :disabled="!canEditSelection" title="Delete selection" aria-label="Delete selection" @click="removeSelection">
                  <Trash2 :size="16" aria-hidden="true" />
                </button>
                <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
                <div class="mx-config-form-designer__segmented" role="group" aria-label="Canvas viewport">
                  <button type="button" :class="{ 'is-active': breakpoint === 'desktop' }" :aria-pressed="breakpoint === 'desktop'" title="Desktop" aria-label="Desktop" @click="selectBreakpoint('desktop')">
                    <Monitor :size="15" aria-hidden="true" />
                  </button>
                  <button type="button" :class="{ 'is-active': breakpoint === 'tablet' }" :aria-pressed="breakpoint === 'tablet'" title="Tablet" aria-label="Tablet" @click="selectBreakpoint('tablet')">
                    <Tablet :size="15" aria-hidden="true" />
                  </button>
                  <button type="button" :class="{ 'is-active': breakpoint === 'mobile' }" :aria-pressed="breakpoint === 'mobile'" title="Mobile" aria-label="Mobile" @click="selectBreakpoint('mobile')">
                    <Smartphone :size="15" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </template>

            <template #palette="{ materials, addMaterial, readonly, form }">
              <div class="designer-left-panel">
                <nav ref="designerLeftTabs" class="designer-left-tabs" role="tablist" aria-label="Designer navigation">
                  <button
                    v-for="view in designerLeftViews"
                    :key="view.id"
                    type="button"
                    role="tab"
                    :aria-selected="activeDesignerLeftView === view.id"
                    :data-designer-left-tab="view.id"
                    :tabindex="activeDesignerLeftView === view.id ? 0 : -1"
                    :title="view.label"
                    @click="activeDesignerLeftView = view.id"
                    @keydown="handleDesignerLeftTabKeydown($event, view.id)"
                  >
                    <component :is="view.icon" :size="14" aria-hidden="true" />
                    <span>{{ view.label }}</span>
                  </button>
                </nav>

                <DesignerPalette
                  v-if="activeDesignerLeftView === 'components'"
                  :materials="materials"
                  :form="form"
                  :registry="registry"
                  :readonly="readonly"
                  @add-material="addMaterial"
                />

                <div v-else-if="activeDesignerLeftView === 'layers'" class="designer-layers" role="tree" aria-label="Page layers">
                  <div
                    v-for="layer in designerLayers"
                    :key="layer.id"
                    role="treeitem"
                    :aria-selected="selectedDesignerIds.includes(layer.id)"
                    :class="{ 'is-selected': selectedDesignerIds.includes(layer.id) }"
                  >
                    <button type="button" class="designer-layer-select" :style="{ paddingLeft: `${10 + layer.depth * 16}px` }" @click="selectDesignerLayer(layer.id, $event)">
                      <Layers3 :size="13" aria-hidden="true" />
                      <span>{{ layer.label }}</span>
                      <small>{{ layer.component }}</small>
                    </button>
                    <div class="designer-layer-actions" role="toolbar" :aria-label="`Arrange ${layer.label}`">
                      <button type="button" title="Move up" aria-label="Move up" @click="moveDesignerLayer('moveBefore', layer.id)"><ChevronUp :size="12" aria-hidden="true" /></button>
                      <button type="button" title="Move down" aria-label="Move down" @click="moveDesignerLayer('moveAfter', layer.id)"><MoveDown :size="12" aria-hidden="true" /></button>
                      <button type="button" title="Indent" aria-label="Indent" @click="moveDesignerLayer('indent', layer.id)"><IndentIncrease :size="12" aria-hidden="true" /></button>
                      <button type="button" title="Outdent" aria-label="Outdent" @click="moveDesignerLayer('outdent', layer.id)"><IndentDecrease :size="12" aria-hidden="true" /></button>
                    </div>
                  </div>
                  <p v-if="designerLayers.length === 0">No layers yet</p>
                </div>

                <div v-else class="designer-pages-panel">
                  <nav class="designer-pages" aria-label="Application pages">
                    <button
                      v-for="page in currentApplication.pages"
                      :key="page.id"
                      type="button"
                      :aria-current="page.id === currentPageId ? 'page' : undefined"
                      :class="{ 'is-current': page.id === currentPageId }"
                      @click="selectPageFromDesigner(page.id)"
                    >
                      <Files :size="14" aria-hidden="true" />
                      <span>{{ page.name }}</span>
                      <small>{{ page.route }}</small>
                    </button>
                  </nav>
                  <button type="button" class="manage-pages-button" @click="openPageManager">
                    <Settings2 :size="14" aria-hidden="true" />
                    Manage pages
                  </button>
                </div>
              </div>
            </template>
          </ConfigFormDesigner>
        </div>
      </section>

      <aside v-if="previewOpen" class="preview-pane" aria-label="Page preview">
        <header class="pane-header">
          <div class="preview-heading">
            <strong>Preview</strong>
            <span class="preview-live-state" :data-tone="previewState.tone" role="status" aria-live="polite">
              <span aria-hidden="true" />
              {{ previewState.label }}
            </span>
          </div>
          <div class="preview-toolbar">
            <div class="preview-viewport-switch" role="group" aria-label="Preview viewport">
              <button
                v-for="viewport in previewViewports"
                :key="viewport.id"
                type="button"
                :aria-label="viewport.label"
                :aria-pressed="previewViewport === viewport.id"
                :title="viewport.label"
                @click="previewViewport = viewport.id"
              >
                <component :is="viewport.icon" :size="15" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              :disabled="!activePreview"
              title="Submit preview form"
              aria-label="Submit preview form"
              @click="submitPreviewForm"
            >
              <Send :size="15" aria-hidden="true" />
            </button>
            <button
              class="preview-expand-button"
              type="button"
              :title="previewExpanded ? 'Restore preview' : 'Expand preview'"
              :aria-label="previewExpanded ? 'Restore preview' : 'Expand preview'"
              @click="previewExpanded = !previewExpanded"
            >
              <Minimize2 v-if="previewExpanded" :size="16" aria-hidden="true" />
              <Maximize2 v-else :size="16" aria-hidden="true" />
            </button>
          </div>
        </header>
        <div class="preview-canvas">
          <div class="preview-stage" :data-viewport="previewViewport">
            <div
              v-if="activePreview && (configError || !compiledPreview?.success)"
              class="preview-diagnostics"
              role="status"
            >
              <strong>Showing last valid preview</strong>
              <p v-if="configError">{{ configError }}</p>
              <p v-for="diagnostic in compiledPreview?.success === false ? compiledPreview.diagnostics : []" :key="`${diagnostic.code}-${diagnostic.path.join('.')}`">
                {{ diagnostic.message }}
              </p>
            </div>
            <PreviewRuntimeBoundary
              v-if="activePreview"
              :revision="`${currentApplication.id}-${currentPageId}-${rendererPreviewVersion}`"
              @ready="handlePreviewRuntimeReady"
            >
              <ConfigFormRenderer
                :key="`${currentApplication.id}-${currentPageId}-${rendererPreviewVersion}`"
                ref="previewRenderer"
                v-model="previewModel"
                class="page-preview-form"
                mode="preview"
                :namespace="registry.rendererNamespace"
                :reaction-projection="previewFlowProjection"
                v-bind="activePreview.renderer"
                @submit="runPreviewFlows('form.submit', $event)"
                @field-change="runPreviewFlows('field.change', $event.values, $event.field)"
              />
              <template #fallback>
                <ConfigFormRenderer
                  v-if="runtimeFallbackPreview"
                  ref="fallbackPreviewRenderer"
                  v-model="fallbackPreviewModel"
                  class="page-preview-form"
                  mode="preview"
                  :namespace="registry.rendererNamespace"
                  :reaction-projection="previewFlowProjection"
                  v-bind="runtimeFallbackPreview.renderer"
                  @submit="runPreviewFlows('form.submit', $event)"
                  @field-change="runPreviewFlows('field.change', $event.values, $event.field)"
                />
              </template>
            </PreviewRuntimeBoundary>
            <div v-else class="preview-errors">
              <strong>Preview unavailable</strong>
              <p v-for="diagnostic in compiledPreview?.diagnostics ?? []" :key="`${diagnostic.code}-${diagnostic.path.join('.')}`">
                {{ diagnostic.message }}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </section>

    <section v-else class="empty-workbench" aria-labelledby="new-page-title">
      <h1 id="new-page-title">
        New page
      </h1>
      <div class="template-list">
        <button
          v-for="template in BUILT_IN_WORKSPACE_TEMPLATES.values()"
          :key="template.id"
          type="button"
          :disabled="busy"
          @click="createApplication(template.id)"
        >
          <strong>{{ template.title }}</strong>
          <span>{{ template.adapter }}</span>
        </button>
      </div>
    </section>

    <div v-if="templatePickerOpen" class="template-overlay" @click.self="closeTemplatePicker">
      <section ref="templateDialog" role="dialog" aria-modal="true" aria-labelledby="template-dialog-title" @keydown="handleTemplateDialogKeydown">
        <header>
          <h2 id="template-dialog-title">
            New page
          </h2>
          <button type="button" @click="closeTemplatePicker">
            Close
          </button>
        </header>
        <div class="template-list">
          <button
            v-for="template in BUILT_IN_WORKSPACE_TEMPLATES.values()"
            :key="template.id"
            type="button"
            :disabled="busy"
            @click="currentApplication ? createPage(template.id) : createApplication(template.id)"
          >
            <strong>{{ template.title }}</strong>
            <span>{{ template.adapter }}</span>
          </button>
        </div>
      </section>
    </div>

    <div
      v-if="pageManagerOpen && currentApplication"
      ref="pageManagerDialog"
      class="page-manager-overlay"
      @click.self="closePageManager"
      @keydown="handlePageManagerKeydown"
    >
      <PageManager
        :application="currentApplication"
        :applications="applications"
        :busy="busy"
        @close="closePageManager"
        @create-page="openPageTemplatePicker"
        @open-application="requestOpenApplication($event)"
        @operation="handleApplicationOperation"
      />
    </div>

    <div v-if="flowWorkspaceOpen && currentApplication" class="flow-workspace-overlay" @click.self="closeFlowWorkspace">
      <section
        ref="flowDialog"
        class="flow-workspace-dialog"
        data-flow-workspace-dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="flow-workspace-dialog-title"
        tabindex="-1"
        @keydown="handleFlowDialogKeydown"
      >
        <header class="flow-workspace-dialog-header">
          <h2 id="flow-workspace-dialog-title">{{ workbenchLocale.t('flow.dialog.title', 'Flow orchestration') }}</h2>
          <button type="button" :title="workbenchLocale.t('flow.dialog.close', 'Close flow orchestration')" :aria-label="workbenchLocale.t('flow.dialog.close', 'Close flow orchestration')" @click="closeFlowWorkspace">
            <X :size="17" aria-hidden="true" />
          </button>
        </header>
        <div class="flow-workspace-dialog-body">
          <FlowWorkspace
            :flows="configModel?.flows ?? []"
            :field-names="designerFieldNames"
            :locale="props.locale"
            :readonly="busy"
            @update="updateModelOperation({ type: 'updateFlows', flows: $event })"
          />
        </div>
      </section>
    </div>

    <div v-if="exportPreviewMode" class="export-preview-overlay" @click.self="closeExportPreview">
      <section ref="exportDialog" class="export-preview-dialog" role="dialog" aria-modal="true" :aria-labelledby="`${exportPreviewMode}-export-title`" @keydown="handleExportDialogKeydown">
        <header>
          <div>
            <span class="dialog-eyebrow">Read only export</span>
            <h2 :id="`${exportPreviewMode}-export-title`">{{ exportPreviewMode === 'source' ? 'Generated Vue source' : 'Config model' }}</h2>
          </div>
          <button type="button" title="Close" aria-label="Close" @click="closeExportPreview">
            <X :size="17" aria-hidden="true" />
          </button>
        </header>
        <div class="export-preview-body">
          <div v-if="exportPreviewMode === 'source'" class="source-export-view">
            <div v-if="sourceSnapshotError" class="export-diagnostic" role="alert">
              <strong>Source export unavailable</strong>
              <p>{{ sourceSnapshotError }}</p>
            </div>
            <div v-else-if="sourceSnapshotStale" class="export-stale" role="status">
              <span>The design changed after this export snapshot was opened.</span>
              <button type="button" @click="refreshSourceSnapshot">
                <RefreshCw :size="14" aria-hidden="true" /> Refresh snapshot
              </button>
            </div>
            <div class="source-file-layout">
              <nav class="source-file-tabs" role="tablist" aria-label="Source export view">
                <button type="button" role="tab" :aria-selected="sourceMobileView === 'tree'" @click="sourceMobileView = 'tree'">Tree</button>
                <button type="button" role="tab" :aria-selected="sourceMobileView === 'code'" @click="sourceMobileView = 'code'">Code</button>
              </nav>
              <ProjectFileTree
                v-model:expanded-ids="sourceTreeExpandedIds"
                :class="{ 'is-mobile-hidden': sourceMobileView !== 'tree' }"
                :nodes="sourceFileTree"
                :selected-path="sourceViewPath"
                @select="selectSourcePath"
              />
              <div class="source-code-pane" :class="{ 'is-mobile-hidden': sourceMobileView !== 'code' }">
                <WorkspaceCodeEditor
                  v-if="selectedSourceFile?.kind === 'text'"
                  :filename="sourceViewPath"
                  :language="sourceLanguage"
                  :model-value="sourceCode"
                  :readonly="true"
                  :theme="theme"
                />
                <div v-else-if="selectedSourceFile" class="source-binary-placeholder" role="status">
                  <Files :size="24" aria-hidden="true" />
                  <strong>{{ sourceViewPath.split('/').at(-1) }}</strong>
                  <span>{{ selectedSourceFile.content.byteLength }} byte binary file</span>
                </div>
              </div>
            </div>
          </div>
          <template v-else>
            <nav class="config-view-tabs" role="tablist" aria-label="Config view">
              <button type="button" role="tab" :aria-selected="configViewMode === 'source'" @click="configViewMode = 'source'">Source</button>
              <button type="button" role="tab" :aria-selected="configViewMode === 'json'" @click="configViewMode = 'json'">JSON</button>
              <button type="button" role="tab" :aria-selected="configViewMode === 'tree'" @click="configViewMode = 'tree'">Tree</button>
            </nav>
            <WorkspaceCodeEditor
              v-if="configViewMode === 'source'"
              :filename="CONFIG_PATH"
              language="typescript"
              :model-value="generatedConfigSource"
              :readonly="true"
              :theme="theme"
            />
            <pre v-if="configViewMode === 'json'" class="config-json-view" tabindex="0">{{ generatedConfigJson }}</pre>
            <div v-else-if="configViewMode === 'tree'" class="config-tree-view" role="tree" tabindex="0">
              <div
                v-for="entry in generatedConfigTree"
                :key="entry.path"
                role="treeitem"
                :style="{ paddingLeft: `${12 + entry.depth * 18}px` }"
              >
                <span class="config-tree-key">{{ entry.path.split('.').at(-1) }}</span>
                <span class="config-tree-value" :class="{ 'is-branch': entry.branch }">{{ entry.value }}</span>
              </div>
            </div>
          </template>
        </div>
        <footer>
          <span v-if="exportPreviewMode === 'source'">Snapshot model revision {{ sourceSnapshot?.modelRevision ?? '—' }}{{ sourceSnapshotStale ? ' · Stale' : '' }}</span>
          <span v-else>Model revision {{ modelRevision }} · Generated from Design Model</span>
          <div>
            <button v-if="exportPreviewMode === 'source'" type="button" class="dialog-action secondary" :disabled="!sourceSnapshot" @click="exportProject">
              <Download :size="15" aria-hidden="true" /> Project ZIP
            </button>
            <button type="button" class="dialog-action secondary" @click="copyExportPreview">
              <Clipboard :size="15" aria-hidden="true" /> Copy
            </button>
            <button type="button" class="dialog-action" :disabled="exportPreviewMode === 'source' && !sourceSnapshot" @click="downloadExportPreview">
              <Download :size="15" aria-hidden="true" /> Download
            </button>
          </div>
        </footer>
      </section>
    </div>

    <p v-if="message" class="workbench-message" aria-live="polite">
      {{ message }}
    </p>
  </main>
</template>
